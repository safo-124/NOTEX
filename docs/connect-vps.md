# Pointing NOTEX at the Hetzner VPS

Run these on the VPS unless a step says otherwise. Replace `db.example.com` with
your own hostname and pick your own passwords.

Shape of the finished setup:

```
Vercel functions  --TLS-->  PgBouncer :6432  --local socket-->  Postgres :5432
your laptop       --SSH tunnel------------------------------->  Postgres :5432
```

Postgres itself never listens on the public internet. Only PgBouncer does, and it
only speaks TLS. Migrations go through an SSH tunnel, so the direct port stays
closed.

## 1. Database and role

```bash
sudo -u postgres psql
```

```sql
CREATE ROLE notex WITH LOGIN PASSWORD 'a-long-random-password';
CREATE DATABASE notex OWNER notex;
\c notex
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO notex;
\q
```

Generate the password with `openssl rand -base64 24`. It is the only thing
standing between the internet and your data, so do not reuse one.

## 2. Keep Postgres on localhost

In `/etc/postgresql/*/main/postgresql.conf`:

```
listen_addresses = 'localhost'
password_encryption = scram-sha-256
```

In `pg_hba.conf`, local connections only:

```
host    notex    notex    127.0.0.1/32    scram-sha-256
```

```bash
sudo systemctl restart postgresql
```

## 3. TLS certificate

With a domain pointing at the VPS (recommended):

```bash
sudo apt install certbot
sudo certbot certonly --standalone -d db.example.com
sudo mkdir -p /etc/pgbouncer/tls
sudo cp /etc/letsencrypt/live/db.example.com/fullchain.pem /etc/pgbouncer/tls/server.crt
sudo cp /etc/letsencrypt/live/db.example.com/privkey.pem  /etc/pgbouncer/tls/server.key
sudo chown -R postgres:postgres /etc/pgbouncer/tls
sudo chmod 600 /etc/pgbouncer/tls/server.key
```

Add a renewal hook at `/etc/letsencrypt/renewal-hooks/deploy/pgbouncer.sh` that
repeats the two `cp` lines and runs `systemctl reload pgbouncer`, then
`chmod +x` it. Without the hook, the app stops connecting in 90 days.

No domain yet? Generate a self-signed pair instead and use `sslmode=no-verify`
in the connection string. (`require` is not the right word here: node-postgres
reads it as "encrypt and verify", which a self-signed certificate fails with
`self-signed certificate`. `no-verify` keeps the encryption and drops the
identity check.) Traffic is encrypted but not authenticated, so a
determined attacker in the path could impersonate the server. Fine for a week,
not fine permanently.

## 4. PgBouncer

```bash
sudo apt install pgbouncer
```

`/etc/pgbouncer/pgbouncer.ini`:

```ini
[databases]
notex = host=127.0.0.1 port=5432 dbname=notex

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt

; Serverless opens a connection per invocation, so transaction pooling is what
; makes this survive. It is also why prepared statements are off in the app.
pool_mode = transaction
max_client_conn = 500
default_pool_size = 20
reserve_pool_size = 5
server_idle_timeout = 60

client_tls_sslmode = require
client_tls_cert_file = /etc/pgbouncer/tls/server.crt
client_tls_key_file = /etc/pgbouncer/tls/server.key

ignore_startup_parameters = extra_float_digits,options
```

Build `userlist.txt` from the SCRAM verifier Postgres already stores, so the
password is never written twice:

```bash
sudo -u postgres psql -Atq -c \
  "SELECT '\"' || rolname || '\" \"' || rolpassword || '\"' FROM pg_authid WHERE rolname = 'notex';" \
  | sudo tee /etc/pgbouncer/userlist.txt
sudo chown postgres:postgres /etc/pgbouncer/userlist.txt
sudo chmod 600 /etc/pgbouncer/userlist.txt
sudo systemctl enable --now pgbouncer
sudo systemctl restart pgbouncer
```

## 5. Firewall

```bash
sudo ufw allow 6432/tcp
sudo ufw status
```

Port 5432 stays closed. Vercel's Hobby plan has **dynamic** egress IPs (static
IPs are a Pro feature at $100/month per project), so 6432 has to accept
connections from anywhere. That is why the password length and TLS matter.

Worth adding: `fail2ban`, and a check that `ufw` is actually enabled.

## 6. Environment on your laptop

`.env.local` in the project:

```bash
# through PgBouncer, what the app uses
DATABASE_URL="postgres://notex:PASSWORD@db.example.com:6432/notex?sslmode=verify-full"

# direct, through an SSH tunnel, used only by Prisma Migrate
DATABASE_URL_DIRECT="postgres://notex:PASSWORD@127.0.0.1:5433/notex?sslmode=disable"
```

Open the tunnel in a second terminal and leave it running:

```bash
ssh -N -L 5433:127.0.0.1:5432 you@your-vps
```

Then create the tables:

```bash
npm install
npm run db:migrate      # writes prisma/migrations, commit them
npm run dev
```

`db:migrate` is the one to use now that a real database exists: it records a
migration history you can replay on any other environment. `db:push` is for
throwaway experiments.

## 7. Vercel

Set these in the project's environment variables:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | the PgBouncer URL from above |
| `DATABASE_URL_DIRECT` | same as `DATABASE_URL` (Vercel has no tunnel; it is unused at runtime) |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_URL` | the deployed URL |
| `AUTH_TRUST_HOST` | `true` |
| `SMTP_*`, `MAIL_FROM` | your mail credentials |
| `TELEGRAM_BOT_TOKEN` | from @BotFather |
| `S3_*` | Hetzner Object Storage |
| `ALERT_CRON_SECRET` | `openssl rand -hex 32` |

Deploy, then run `npm run db:deploy` locally with the tunnel open whenever a
migration needs applying to production.

## 8. The alert cron

On the VPS, as your own user:

```bash
crontab -e
```

```cron
*/5 * * * * curl -fsS -X POST https://your-app.vercel.app/api/alerts/tick -H "authorization: Bearer YOUR_ALERT_CRON_SECRET" > /dev/null 2>&1
```

Check it works before trusting it:

```bash
curl -i -X POST https://your-app.vercel.app/api/alerts/tick \
  -H "authorization: Bearer YOUR_ALERT_CRON_SECRET"
```

A 200 with `{"ok":true,...}` means the loop is live. A 401 means the secret in
the cron line and the one in Vercel do not match.

## Checks when something fails

| Symptom | Cause to check first |
| --- | --- |
| `SASL authentication failed` | `userlist.txt` regenerated after the password changed? |
| `connection refused` on 6432 | pgbouncer running, `listen_addr = 0.0.0.0`, ufw rule present |
| `self-signed certificate` | use `sslmode=no-verify` until you have a real certificate |
| `certificate verify failed` | hostname in the URL must match the certificate |
| `prepared statement already exists` | something bypassed the adapter; the app must go through `src/lib/prisma.ts` |
| Migrations hang | Prisma Migrate needs the direct connection, not PgBouncer. Tunnel open? |
| `too many clients` | raise `default_pool_size`, or lower `max` in `src/lib/prisma.ts` |
