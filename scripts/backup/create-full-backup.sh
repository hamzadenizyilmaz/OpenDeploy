#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=../lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

target="${1:-/var/backups/opendeploy/full-$(date +%Y%m%d-%H%M%S).tar.gz}"
create_archive "$target" /opt/opendeploy /etc/opendeploy /var/lib/opendeploy
echo "Backup created: $target"
