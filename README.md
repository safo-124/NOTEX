# NOTEX

Night study schedule, notes, course files and reminders. Next.js 16 (App Router),
Postgres on Hetzner via Prisma 7, Auth.js magic links, S3-compatible object storage,
and reminders over email, Telegram and WhatsApp.

Built for a 23:00 to 03:00 study rhythm: a night belongs to the day it STARTED, the
app day rolls over at 04:00, and any clock time before noon counts as the small
hours at the end of that night. That single rule is in `src/lib/time.ts` and
everything else derives from it.

## Running it locally

```bash
npm install
cp .env.example .env.local     # fill in DATABASE_URL and AUTH_SECRET at minimum
npm run db:push                # create the tables (or db:migrate for a migration history)
npm run dev                    # http://localhost:3000
```

`AUTH_SECRET` is `openssl rand -base64 32`. Signing in needs SMTP, so set the
`SMTP_*` and `MAIL_FROM` variables before the first sign-in.

On first sign-in the account is seeded with the autumn 2026 plan (five courses and
the 21 weekly blocks). Edit or delete any of it in the app.

## Hetzner Postgres

Serverless functions open a connection per invocation, so put **PgBouncer in
transaction mode** in front of Postgres and point `DATABASE_URL` at port 6432.
`DATABASE_URL_DIRECT` stays on 5432 and is used only by Prisma Migrate, which
needs a direct connection. The app itself goes through the pooled URL, and
`src/lib/prisma.ts` keeps `max: 1` on the pg pool so each serverless invocation
holds one connection at most.

Keep `sslmode=require` in both URLs. If the Postgres box only listens on the
private network, allowlist Vercel's egress or run the app on the Hetzner box.

## Deploying to Vercel

Push the repo, import it, set every variable from `.env.example` in the project
settings, and set `AUTH_URL` to the deployed URL.

## Alerts

`POST /api/alerts/tick` is the whole scheduler. It looks at every user's blocks in
their own timezone and sends a reminder `leadMinutes` before each block starts,
plus one evening summary. Every send is claimed in `alert_log` first, so retries
and overlapping runs can never send twice.

**Vercel's Hobby plan only runs cron once per day**, which is useless for a
reminder that must land at 22:50. Drive it from the Hetzner box instead:

```cron
*/5 * * * * curl -fsS -X POST https://your-app.vercel.app/api/alerts/tick -H "authorization: Bearer $ALERT_CRON_SECRET" >/dev/null
```

`vercel.json` keeps one daily Vercel cron as a backstop; it authenticates with
Vercel's own `CRON_SECRET`, which the route also accepts.

### Telegram

Create a bot with @BotFather, put the token in `TELEGRAM_BOT_TOKEN`, send the bot
any message, then read your numeric chat id from
`https://api.telegram.org/bot<token>/getUpdates` and paste it into Settings.
Working in about two minutes.

### WhatsApp

Outside a 24 hour conversation window WhatsApp only delivers **pre-approved
template messages**, so an unprompted 22:50 reminder must be a template. Create
one in Meta Business Manager with a single body variable, wait for approval, then
set `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` and
`WHATSAPP_TEMPLATE_NAME`. Until those exist the channel reports itself
unconfigured and the dispatcher skips it silently, so nothing else breaks.

## Files

Uploads go to S3-compatible object storage (Hetzner Object Storage, or MinIO).
Vercel's filesystem is ephemeral, so nothing is written to disk. Objects stay
private; `GET /api/files/:id` checks ownership and hands back a 5 minute signed
URL. Limit is 25 MB per file.

## Layout of the code

```
src/app/(app)/      tonight, week, notes, courses, files, settings
src/actions/        server actions: schedule, notes, files, settings
src/alerts/         channel adapters behind one interface, plus message rendering
prisma/schema.prisma  the data model
src/lib/prisma.ts     the client, with the pg driver adapter
src/lib/time.ts     the night-shift time model
src/components/ui/  small shadcn-style primitives, no Radix dependency
```

Prisma 7 generates its client into `src/generated/prisma` (gitignored), so
`prisma generate` runs on `postinstall` and again before `next build`. Two other
v7 details worth knowing: the connection URL lives in `prisma.config.ts` rather
than in the `datasource` block, and `PrismaClient` is constructed with a driver
adapter (`@prisma/adapter-pg`) instead of a connection string.

The UI primitives follow shadcn conventions (`components.json`, `cn`, CSS
variables) but are hand-written and dependency-free. Running
`npx shadcn@latest add <component>` will overwrite the matching file with the
Radix version and pull in its dependencies, which is fine, just deliberate.

## Mobile and desktop

One layout, two shapes: a bottom tab bar under `md`, a sidebar above it. Editors
are bottom sheets on phones and centred dialogs on desktop. `manifest.ts` makes it
installable, so Add to Home Screen gives it an icon and a full-screen window.
