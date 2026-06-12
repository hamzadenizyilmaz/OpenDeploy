#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'
umask 027

SOURCE="${BASH_SOURCE[0]}"
while [[ -L "$SOURCE" ]]; do
  DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  [[ "$SOURCE" != /* ]] && SOURCE="$DIR/$SOURCE"
done
SCRIPT_DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"

# shellcheck source=scripts/lib/common.sh
source "$SCRIPT_DIR/scripts/lib/common.sh"

OPENDEPLOY_DIR="${OPENDEPLOY_DIR:-$SCRIPT_DIR}"
ENV_FILE="${OPENDEPLOY_ENV_FILE:-/etc/opendeploy/opendeploy.env}"

cmd="${1:-help}"
shift || true

case "$cmd" in
  status)
    mapfile -t services < <(service_names "$ENV_FILE")
    systemctl_safe status "${services[@]}" --no-pager
    ;;
  start)
    mapfile -t services < <(service_names "$ENV_FILE")
    systemctl_safe start "${services[@]}"
    ;;
  stop)
    stop_opendeploy "$ENV_FILE"
    ;;
  restart)
    restart_opendeploy "$ENV_FILE"
    ;;
  update)
    exec bash "$OPENDEPLOY_DIR/update.sh" --update "$@"
    ;;
  repair)
    exec bash "$OPENDEPLOY_DIR/repair.sh" "$@"
    ;;
  backup)
    create_archive "/var/backups/opendeploy/manual-$(date +%Y%m%d-%H%M%S).tar.gz" "$OPENDEPLOY_DIR" /etc/opendeploy /var/lib/opendeploy
    ;;
  restore)
    archive="${1:-}"
    [[ -n "$archive" ]] || fail "Usage: opendeploy restore <archive.tar.gz>"
    [[ -f "$archive" ]] || fail "Archive not found: $archive"
    tar -xzf "$archive" -C /
    ;;
  logs)
    mapfile -t services < <(service_names "$ENV_FILE")
    args=()
    for svc in "${services[@]}"; do args+=(-u "$svc"); done
    journalctl "${args[@]}" -f
    ;;
  version)
    node -e "console.log(require('$OPENDEPLOY_DIR/package.json').version)" 2>/dev/null || echo "unknown"
    ;;
  doctor)
    echo "OpenDeploy doctor"
    echo "Platform: $(platform_summary)"
    echo "Directory: $OPENDEPLOY_DIR"
    echo "Env file: $ENV_FILE"
    command -v node || true
    command -v npm || true
    command -v pm2 || true
    ls -ld "$OPENDEPLOY_DIR" "$OPENDEPLOY_DIR/apps" "$OPENDEPLOY_DIR/apps/api" "$OPENDEPLOY_DIR/apps/web" "$OPENDEPLOY_DIR/apps/worker" 2>/dev/null || true
    mapfile -t services < <(service_names "$ENV_FILE")
    for svc in "${services[@]}"; do systemctl_safe is-active "$svc" || true; done
    curl -fsS http://127.0.0.1:4000/health || true
    if dns_cloud_self_hosted "$ENV_FILE"; then curl -fsS http://127.0.0.1:4300/api/v1/health || true; fi
    ;;
  uninstall)
    exec bash "$OPENDEPLOY_DIR/uninstall.sh" "$@"
    ;;
  *)
    cat <<USAGE
OpenDeploy CLI

Commands:
  opendeploy status
  opendeploy start
  opendeploy stop
  opendeploy restart
  opendeploy update
  opendeploy repair
  opendeploy backup
  opendeploy restore <archive>
  opendeploy logs
  opendeploy version
  opendeploy doctor
  opendeploy uninstall
USAGE
    ;;
esac
