#!/usr/bin/env bash
#
# Runs MinIO on this VPS as the app's object storage. MinIO speaks S3, so the
# application code does not change at all: only the S3_* variables do.
#
#   sudo bash setup-minio.sh s3.example.com https://notexproject.vercel.app
#
# Both arguments are required:
#   1. a hostname pointing at this server (needed for a real TLS certificate)
#   2. the app's origin (browsers will not PUT cross-origin without it)
#
# A hostname is not optional here. The app is served over HTTPS, so the browser
# refuses to upload to a plain-HTTP endpoint, and refuses a self-signed one too.
# A free subdomain from DuckDNS works exactly as well as a purchased domain.

set -euo pipefail

HOST="${1:-}"
APP_ORIGIN="${2:-}"
DATA_DIR="/var/lib/minio"
BUCKET="${BUCKET:-notex}"
CRED_FILE="/root/notex-minio-credentials"

log() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run this with sudo."
[[ -n "$HOST" && -n "$APP_ORIGIN" ]] || die "Usage: sudo bash setup-minio.sh s3.example.com https://your-app.vercel.app"

log "Installing Docker and Caddy"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
command -v docker >/dev/null || apt-get install -y -qq docker.io >/dev/null
if ! command -v caddy >/dev/null; then
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl gnupg >/dev/null
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  echo "deb [signed-by=/usr/share/keyrings/caddy-stable-archive-keyring.gpg] https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main" \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy >/dev/null
fi
systemctl enable --now docker >/dev/null 2>&1 || true

log "Starting MinIO"
ROOT_USER="notex-root"
ROOT_PASS="$(openssl rand -base64 30 | tr -d '/+=' | cut -c1-32)"
mkdir -p "$DATA_DIR"

docker rm -f notex-minio >/dev/null 2>&1 || true
docker run -d --name notex-minio --restart unless-stopped \
  -p 127.0.0.1:9000:9000 \
  -p 127.0.0.1:9001:9001 \
  -v "${DATA_DIR}:/data" \
  -e "MINIO_ROOT_USER=${ROOT_USER}" \
  -e "MINIO_ROOT_PASSWORD=${ROOT_PASS}" \
  -e "MINIO_API_CORS_ALLOW_ORIGIN=${APP_ORIGIN}" \
  -e "MINIO_BROWSER_REDIRECT_URL=https://${HOST}/console" \
  quay.io/minio/minio server /data --console-address ":9001" >/dev/null

# MinIO has no per-bucket CORS API, so the allowed origin is set above at
# startup. Re-run this script if the app's URL ever changes.

log "Waiting for MinIO to come up"
for _ in $(seq 1 30); do
  curl -fsS http://127.0.0.1:9000/minio/health/live >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS http://127.0.0.1:9000/minio/health/live >/dev/null 2>&1 \
  || die "MinIO did not start. Check: docker logs notex-minio"

log "Publishing it on https://${HOST}"
cat > /etc/caddy/Caddyfile <<CADDY
${HOST} {
	handle /console* {
		reverse_proxy 127.0.0.1:9001
	}
	handle {
		reverse_proxy 127.0.0.1:9000
	}
}
CADDY
systemctl reload caddy 2>/dev/null || systemctl restart caddy
sleep 3

command -v ufw >/dev/null && ufw allow 80/tcp >/dev/null 2>&1 || true
command -v ufw >/dev/null && ufw allow 443/tcp >/dev/null 2>&1 || true

log "Creating the bucket and an application key"
docker run --rm --network host --entrypoint /bin/sh quay.io/minio/mc -c "
  mc alias set local http://127.0.0.1:9000 '${ROOT_USER}' '${ROOT_PASS}' >/dev/null &&
  mc mb --ignore-existing local/${BUCKET} >/dev/null &&
  mc anonymous set none local/${BUCKET} >/dev/null
" || die "Could not create the bucket. Check: docker logs notex-minio"

ACCESS_KEY="notex$(openssl rand -hex 6)"
SECRET_KEY="$(openssl rand -base64 30 | tr -d '/+=' | cut -c1-32)"
docker run --rm --network host --entrypoint /bin/sh quay.io/minio/mc -c "
  mc alias set local http://127.0.0.1:9000 '${ROOT_USER}' '${ROOT_PASS}' >/dev/null &&
  mc admin user add local '${ACCESS_KEY}' '${SECRET_KEY}' >/dev/null &&
  mc admin policy attach local readwrite --user '${ACCESS_KEY}' >/dev/null
" || die "Could not create the application key."

log "Verifying TLS from the outside"
if curl -fsS "https://${HOST}/minio/health/live" >/dev/null 2>&1; then
  echo "https://${HOST} is serving with a valid certificate."
else
  echo "Could not reach https://${HOST} yet."
  echo "Check that ${HOST} points at this server and that ports 80 and 443 are open,"
  echo "then: sudo systemctl status caddy"
fi

umask 077
cat > "$CRED_FILE" <<CREDS
# NOTEX object storage, generated $(date -u +%Y-%m-%dT%H:%M:%SZ)
S3_ENDPOINT="https://${HOST}"
S3_REGION="us-east-1"
S3_BUCKET="${BUCKET}"
S3_ACCESS_KEY_ID="${ACCESS_KEY}"
S3_SECRET_ACCESS_KEY="${SECRET_KEY}"

# MinIO console (root login), reachable at https://${HOST}/console
MINIO_ROOT_USER="${ROOT_USER}"
MINIO_ROOT_PASSWORD="${ROOT_PASS}"
CREDS
chmod 600 "$CRED_FILE"

log "Done"
cat <<SUMMARY

Credentials written to ${CRED_FILE}. Print them with:

  sudo cat ${CRED_FILE}

Put the five S3_ lines in .env.local and in Vercel, then redeploy.
Uploads are allowed from ${APP_ORIGIN} only; re-run this script to change that.

SUMMARY
