#!/usr/bin/env bash
#
# Prepares a Debian/Ubuntu VPS to serve NOTEX's database to Vercel:
#
#   internet --TLS--> PgBouncer :6432 --local socket--> Postgres :5432
#
# Postgres itself never listens publicly. Run as root on the VPS:
#
#   sudo bash setup-vps.sh db.example.com     # with a domain, real certificate
#   sudo bash setup-vps.sh                    # no domain, self-signed certificate
#
# Safe to re-run. The database password is generated ON THIS MACHINE and written
# to /root/notex-db-credentials; it is never typed in or sent anywhere.

set -euo pipefail

DOMAIN="${1:-}"
DB_NAME="notex"
DB_USER="notex"
CRED_FILE="/root/notex-db-credentials"
TLS_DIR="/etc/pgbouncer/tls"

log() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run this with sudo."
command -v psql >/dev/null || die "Postgres is not installed on this machine."

log "Installing packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq pgbouncer openssl >/dev/null
if [[ -n "$DOMAIN" ]]; then apt-get install -y -qq certbot >/dev/null; fi

PG_CONF="$(sudo -u postgres psql -Atqc 'SHOW config_file')"
PG_HBA="$(sudo -u postgres psql -Atqc 'SHOW hba_file')"
log "Postgres config: $PG_CONF"

log "Restricting Postgres to localhost and SCRAM"
set_conf() {
  local key="$1" val="$2"
  if grep -qE "^[[:space:]]*#?[[:space:]]*${key}[[:space:]]*=" "$PG_CONF"; then
    sed -i -E "s|^[[:space:]]*#?[[:space:]]*${key}[[:space:]]*=.*|${key} = ${val}|" "$PG_CONF"
  else
    printf "%s = %s\n" "$key" "$val" >> "$PG_CONF"
  fi
}
set_conf listen_addresses "'localhost'"
set_conf password_encryption "scram-sha-256"

if ! grep -qE "^host[[:space:]]+${DB_NAME}[[:space:]]+${DB_USER}[[:space:]]+127\.0\.0\.1/32" "$PG_HBA"; then
  printf "host    %s    %s    127.0.0.1/32    scram-sha-256\n" "$DB_NAME" "$DB_USER" >> "$PG_HBA"
fi
systemctl restart postgresql
sleep 2

log "Creating role and database"
# Generated here so the secret never leaves the machine. Re-running rotates it.
DB_PASS="$(openssl rand -base64 30 | tr -d '/+=' | cut -c1-32)"

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS}';
  ELSE
    CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;
SQL

if ! sudo -u postgres psql -Atqc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" <<SQL
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO ${DB_USER};
SQL

log "TLS certificate"
mkdir -p "$TLS_DIR"
if [[ -n "$DOMAIN" ]]; then
  if [[ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
    systemctl stop pgbouncer 2>/dev/null || true
    certbot certonly --standalone --non-interactive --agree-tos --register-unsafely-without-email -d "$DOMAIN" \
      || die "certbot failed. Is $DOMAIN pointed at this server and port 80 free?"
  fi
  cp "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" "$TLS_DIR/server.crt"
  cp "/etc/letsencrypt/live/${DOMAIN}/privkey.pem"  "$TLS_DIR/server.key"

  cat > /etc/letsencrypt/renewal-hooks/deploy/pgbouncer.sh <<HOOK
#!/usr/bin/env bash
cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ${TLS_DIR}/server.crt
cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem  ${TLS_DIR}/server.key
chown -R postgres:postgres ${TLS_DIR}
chmod 600 ${TLS_DIR}/server.key
systemctl reload pgbouncer
HOOK
  chmod +x /etc/letsencrypt/renewal-hooks/deploy/pgbouncer.sh
  SSL_MODE="verify-full"
  DB_HOST="$DOMAIN"
else
  if [[ ! -f "$TLS_DIR/server.crt" ]]; then
    openssl req -new -x509 -days 3650 -nodes -text \
      -out "$TLS_DIR/server.crt" -keyout "$TLS_DIR/server.key" \
      -subj "/CN=$(hostname -f)" >/dev/null 2>&1
  fi
  # node-postgres reads sslmode=require as "encrypt AND verify", which a
  # self-signed certificate fails. no-verify is its opt-out: still encrypted,
  # server identity unchecked. A real certificate lets you use verify-full.
  SSL_MODE="no-verify"
  DB_HOST="$(hostname -I | awk '{print $1}')"
  echo "No domain given: using a self-signed certificate. Traffic is encrypted"
  echo "but the server is not authenticated. Re-run with a domain to fix that."
fi
chown -R postgres:postgres "$TLS_DIR"
chmod 600 "$TLS_DIR/server.key"

log "Writing PgBouncer config"
cat > /etc/pgbouncer/pgbouncer.ini <<INI
[databases]
${DB_NAME} = host=127.0.0.1 port=5432 dbname=${DB_NAME}

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt
admin_users = postgres

; Serverless opens a connection per invocation, so transaction pooling is what
; keeps Postgres from running out of backends. It is also why the app disables
; prepared statements.
pool_mode = transaction
max_client_conn = 500
default_pool_size = 20
reserve_pool_size = 5
server_idle_timeout = 60

client_tls_sslmode = require
client_tls_cert_file = ${TLS_DIR}/server.crt
client_tls_key_file = ${TLS_DIR}/server.key

ignore_startup_parameters = extra_float_digits,options
logfile = /var/log/postgresql/pgbouncer.log
pidfile = /var/run/postgresql/pgbouncer.pid
INI

# The SCRAM verifier is copied straight out of Postgres, so the password is
# never stored in two places.
sudo -u postgres psql -Atqc \
  "SELECT '\"' || rolname || '\" \"' || rolpassword || '\"' FROM pg_authid WHERE rolname = '${DB_USER}';" \
  > /etc/pgbouncer/userlist.txt
chown postgres:postgres /etc/pgbouncer/userlist.txt /etc/pgbouncer/pgbouncer.ini
chmod 600 /etc/pgbouncer/userlist.txt

systemctl enable pgbouncer >/dev/null 2>&1 || true
systemctl restart pgbouncer
sleep 2
systemctl is-active --quiet pgbouncer || die "pgbouncer did not start. Check: journalctl -u pgbouncer -n 50"

log "Firewall"
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 6432/tcp >/dev/null
  echo "Opened 6432/tcp. Port 5432 stays closed."
else
  echo "ufw is not active. Make sure 6432 is reachable and 5432 is not."
fi

log "Verifying the pooled connection"
PGPASSWORD="$DB_PASS" psql "postgres://${DB_USER}@127.0.0.1:6432/${DB_NAME}?sslmode=require" \
  -Atqc "SELECT 'pooled connection OK: ' || current_database();" \
  || die "Could not connect through PgBouncer. Check /var/log/postgresql/pgbouncer.log"

DATABASE_URL="postgres://${DB_USER}:${DB_PASS}@${DB_HOST}:6432/${DB_NAME}?sslmode=${SSL_MODE}"
DIRECT_URL="postgres://${DB_USER}:${DB_PASS}@127.0.0.1:5433/${DB_NAME}?sslmode=disable"

umask 077
cat > "$CRED_FILE" <<CREDS
# NOTEX database credentials, generated $(date -u +%Y-%m-%dT%H:%M:%SZ)
DATABASE_URL="${DATABASE_URL}"
# For Prisma Migrate from your laptop, with this tunnel open:
#   ssh -N -L 5433:127.0.0.1:5432 $(logname 2>/dev/null || echo root)@${DB_HOST}
DATABASE_URL_DIRECT="${DIRECT_URL}"
CREDS
chmod 600 "$CRED_FILE"

log "Done"
cat <<SUMMARY

Credentials written to ${CRED_FILE} (root only). Print them with:

  sudo cat ${CRED_FILE}

Put DATABASE_URL in .env.local and in the Vercel project settings.
For migrations, open the tunnel and use DATABASE_URL_DIRECT:

  ssh -N -L 5433:127.0.0.1:5432 you@${DB_HOST}
  npm run db:migrate

SUMMARY
