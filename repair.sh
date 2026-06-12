#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'
umask 027

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/common.sh
source "$SCRIPT_DIR/scripts/lib/common.sh"

OPENDEPLOY_DIR="${OPENDEPLOY_DIR:-/opt/opendeploy}"
ENV_FILE="${OPENDEPLOY_ENV_FILE:-/etc/opendeploy/opendeploy.env}"
DATA_DIR="${OPENDEPLOY_DATA:-/var/lib/opendeploy}"
BACKUP_DIR="${OPENDEPLOY_BACKUPS:-/var/backups/opendeploy}"
LOG_DIR="${OPENDEPLOY_LOGS:-/var/log/opendeploy}"

require_root
[[ -d "$OPENDEPLOY_DIR" ]] || fail "OpenDeploy directory not found: $OPENDEPLOY_DIR"
[[ -f "$ENV_FILE" ]] || fail "Environment file not found: $ENV_FILE"

log "Repairing directories and permissions..."
ensure_opendeploy_user
ensure_dir "$DATA_DIR/projects" opendeploy:opendeploy
ensure_dir "$BACKUP_DIR" opendeploy:opendeploy
ensure_dir "$LOG_DIR" opendeploy:opendeploy

log "Reinstalling dependencies and rebuilding..."
cd "$OPENDEPLOY_DIR"
normalize_panel_api_env "$ENV_FILE"
cp "$ENV_FILE" .env
if [[ -f package-lock.json ]]; then npm ci; else npm install; fi
npm run prisma:generate
npm run prisma:migrate || warn "Prisma migration failed."
npm run build

if dns_cloud_self_hosted "$ENV_FILE"; then
  cp "$ENV_FILE" "$OPENDEPLOY_DIR/OpenDeploy DNS Cloud/.env"
  (cd "$OPENDEPLOY_DIR/OpenDeploy DNS Cloud" && npm install && npm run prisma:generate && npm run prisma:migrate && npm run check && npm run build)
fi

log "Rewriting systemd units and CLI..."
fix_opendeploy_permissions "$OPENDEPLOY_DIR"
write_systemd_units "$OPENDEPLOY_DIR" "$ENV_FILE"
install_cli "$OPENDEPLOY_DIR" "$ENV_FILE"
enable_opendeploy_services "$ENV_FILE"
restart_opendeploy "$ENV_FILE"

domain="$(env_value "$ENV_FILE" DEFAULT_DOMAIN || true)"
web_port="$(env_value "$ENV_FILE" WEB_PORT || echo 8080)"
proxy="$(env_value "$ENV_FILE" DEFAULT_PROXY || true)"
if [[ -n "$domain" && "$proxy" == "nginx" && -f "$OPENDEPLOY_DIR/scripts/nginx/create-panel-site.sh" ]]; then
  bash "$OPENDEPLOY_DIR/scripts/nginx/create-panel-site.sh" "$domain" "$web_port" || warn "Nginx site rewrite failed."
fi
if [[ -n "$domain" && "$proxy" == "apache" && -f "$OPENDEPLOY_DIR/scripts/apache/create-panel-site.sh" ]]; then
  bash "$OPENDEPLOY_DIR/scripts/apache/create-panel-site.sh" "$domain" "$web_port" || warn "Apache site rewrite failed."
fi
if have nginx; then nginx -t && systemctl_safe reload nginx || warn "Nginx config test or reload failed."; fi
if have apachectl; then apachectl configtest && (systemctl_safe reload apache2 || systemctl_safe reload httpd || true) || warn "Apache config test failed."; fi
curl -fsS http://127.0.0.1:4000/health || warn "API health check failed."
curl -fsS "http://127.0.0.1:${web_port}/api/setup/status" || warn "Panel API proxy health check failed."
log "Repair completed."
