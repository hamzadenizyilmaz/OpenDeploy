#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'
umask 027

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/common.sh
source "$SCRIPT_DIR/scripts/lib/common.sh"

OPENDEPLOY_DIR="${OPENDEPLOY_DIR:-/opt/opendeploy}"
ENV_FILE="${OPENDEPLOY_ENV_FILE:-/etc/opendeploy/opendeploy.env}"
ENV_DIR="$(dirname "$ENV_FILE")"
DATA_DIR="${OPENDEPLOY_DATA:-/var/lib/opendeploy}"
BACKUP_DIR="${OPENDEPLOY_BACKUPS:-/var/backups/opendeploy}"

safe_remove(){
  local target="$1"
  [[ -n "$target" && "$target" != "/" ]] || fail "Refusing unsafe remove target: $target"
  case "$target" in
    /opt/opendeploy|/etc/opendeploy|/var/lib/opendeploy|/var/backups/opendeploy)
      rm -rf -- "$target"
      ;;
    *)
      fail "Refusing to remove path outside OpenDeploy ownership: $target"
      ;;
  esac
}

require_root
read -r -p "Remove OpenDeploy services and application files? [y/N] " answer
[[ "$answer" =~ ^[Yy]$ ]] || exit 0

read -r -p "Create final backup before uninstall? [Y/n] " backup_answer
if [[ ! "$backup_answer" =~ ^[Nn]$ ]]; then
  create_archive "$BACKUP_DIR/final-backup-$(date +%Y%m%d-%H%M%S).tar.gz" "$OPENDEPLOY_DIR" "$ENV_DIR" "$DATA_DIR" 2>/dev/null || true
fi

stop_opendeploy "$ENV_FILE"
systemctl_safe disable "${OPENDEPLOY_SERVICES[@]}" "${OPENDEPLOY_DNS_CLOUD_SERVICES[@]}" || true
rm -f /etc/systemd/system/opendeploy-api.service \
  /etc/systemd/system/opendeploy-web.service \
  /etc/systemd/system/opendeploy-worker.service \
  /etc/systemd/system/opendeploy-agent.service \
  /etc/systemd/system/opendeploy-dns-cloud-api.service \
  /etc/systemd/system/opendeploy-dns-admin-panel.service \
  /etc/systemd/system/opendeploy-dns-nameserver.service \
  /usr/local/bin/opendeploy
systemctl_safe daemon-reload

safe_remove "$OPENDEPLOY_DIR"
safe_remove "$ENV_DIR"

read -r -p "Remove project data in $DATA_DIR? [y/N] " data_answer
[[ "$data_answer" =~ ^[Yy]$ ]] && safe_remove "$DATA_DIR"

read -r -p "Remove backups in $BACKUP_DIR? [y/N] " backup_delete
[[ "$backup_delete" =~ ^[Yy]$ ]] && safe_remove "$BACKUP_DIR"

log "OpenDeploy uninstalled."
