#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

if [[ "$(uname -s)" == "FreeBSD" ]]; then
  printf 'freebsd %s pkg\n' "$(freebsd-version 2>/dev/null || uname -r)"
  exit 0
fi

[[ -f /etc/os-release ]] || { echo "/etc/os-release not found" >&2; exit 1; }
# shellcheck disable=SC1091
. /etc/os-release

case "${ID:-}" in
  ubuntu|debian) manager="apt" ;;
  almalinux|rocky|rhel|centos) manager="dnf" ;;
  *) echo "Unsupported OS: ${ID:-unknown} ${VERSION_ID:-unknown}" >&2; exit 1 ;;
esac

printf '%s %s %s\n' "${ID:-unknown}" "${VERSION_ID:-unknown}" "$manager"
