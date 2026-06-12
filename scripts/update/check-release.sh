#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

OPENDEPLOY_DIR="${OPENDEPLOY_DIR:-/opt/opendeploy}"
OPENDEPLOY_UPDATE_REPO="${OPENDEPLOY_UPDATE_REPO:-https://github.com/hamzadenizyilmaz/OpenDeploy.git}"

[[ -d "$OPENDEPLOY_DIR" ]] || { echo "OpenDeploy directory not found: $OPENDEPLOY_DIR" >&2; exit 1; }
cd "$OPENDEPLOY_DIR"

current="$(node -e "console.log(require('./package.json').version)" 2>/dev/null || echo unknown)"
latest="$(git ls-remote --tags --refs "$OPENDEPLOY_UPDATE_REPO" 2>/dev/null | awk -F/ '{print $NF}' | sort -V | tail -1)"

printf 'Repository: %s\nCurrent: %s\nLatest: %s\n' "$OPENDEPLOY_UPDATE_REPO" "$current" "${latest:-main}"
