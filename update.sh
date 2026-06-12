#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'
umask 027

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/common.sh
source "$SCRIPT_DIR/scripts/lib/common.sh"

OPENDEPLOY_DIR="${OPENDEPLOY_DIR:-/opt/opendeploy}"
ENV_FILE="${OPENDEPLOY_ENV_FILE:-/etc/opendeploy/opendeploy.env}"
BACKUP_DIR="${OPENDEPLOY_BACKUPS:-/var/backups/opendeploy}"
OPENDEPLOY_UPDATE_REPO="${OPENDEPLOY_UPDATE_REPO:-https://github.com/hamzadenizyilmaz/OpenDeploy.git}"
ACTION="update"
VERSION=""
NO_BACKUP="false"

usage(){
  cat <<USAGE
OpenDeploy updater

Options:
  --check
  --update
  --version <git-tag-or-branch>
  --no-backup
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check) ACTION="check"; shift ;;
    --update) ACTION="update"; shift ;;
    --version) VERSION="${2:-}"; shift 2 ;;
    --no-backup) NO_BACKUP="true"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Unknown option: $1" ;;
  esac
done

require_root
[[ -d "$OPENDEPLOY_DIR/.git" ]] || fail "OpenDeploy git checkout not found: $OPENDEPLOY_DIR"
[[ -f "$ENV_FILE" ]] || fail "Environment file not found: $ENV_FILE"

cd "$OPENDEPLOY_DIR"

current_version(){
  node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "unknown"
}

latest_tag(){
  git ls-remote --tags --refs "$OPENDEPLOY_UPDATE_REPO" 2>/dev/null | awk -F/ '{print $NF}' | sort -V | tail -1
}

if [[ "$ACTION" == "check" ]]; then
  log "Repository: $OPENDEPLOY_UPDATE_REPO"
  log "Current version: $(current_version)"
  log "Latest tag: $(latest_tag || echo main)"
  exit 0
fi

if [[ "$NO_BACKUP" != "true" ]]; then
  create_archive "$BACKUP_DIR/pre-update-$(date +%Y%m%d-%H%M%S).tar.gz" "$OPENDEPLOY_DIR" "$ENV_FILE"
fi

stop_opendeploy "$ENV_FILE"

if [[ -n "$VERSION" ]]; then
  git fetch --tags "$OPENDEPLOY_UPDATE_REPO"
  git checkout "$VERSION"
else
  branch="$(git rev-parse --abbrev-ref HEAD)"
  [[ "$branch" == "HEAD" ]] && branch="main"
  git fetch --tags "$OPENDEPLOY_UPDATE_REPO" "$branch"
  git merge --ff-only FETCH_HEAD
fi

normalize_panel_api_env "$ENV_FILE"
cp "$ENV_FILE" .env
if [[ -f package-lock.json ]]; then npm ci; else npm install; fi
npm run prisma:generate
npm run prisma:migrate
npm run build

if dns_cloud_self_hosted "$ENV_FILE"; then
  cp "$ENV_FILE" "$OPENDEPLOY_DIR/OpenDeploy DNS Cloud/.env"
  (cd "$OPENDEPLOY_DIR/OpenDeploy DNS Cloud" && npm install && npm run prisma:generate && npm run prisma:migrate && npm run check && npm run build)
fi

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
  nginx -t && systemctl_safe reload nginx || warn "Nginx config test or reload failed."
fi
if [[ -n "$domain" && "$proxy" == "apache" && -f "$OPENDEPLOY_DIR/scripts/apache/create-panel-site.sh" ]]; then
  bash "$OPENDEPLOY_DIR/scripts/apache/create-panel-site.sh" "$domain" "$web_port" || warn "Apache site rewrite failed."
  apachectl configtest && (systemctl_safe reload apache2 || systemctl_safe reload httpd || true) || warn "Apache config test or reload failed."
fi
sleep 2
curl -fsS http://127.0.0.1:4000/health >/dev/null 2>&1 || fail "API health check failed after update. Run: opendeploy logs"
curl -fsS "http://127.0.0.1:${web_port}/api/setup/status" >/dev/null 2>&1 || warn "Panel API proxy health check failed after update. Run: opendeploy logs"
log "Update completed."
