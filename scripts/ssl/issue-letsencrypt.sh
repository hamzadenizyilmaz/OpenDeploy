#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

domain=""
email=""
provider="nginx"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain|-d) domain="${2:-}"; shift 2 ;;
    --email|-m) email="${2:-}"; shift 2 ;;
    --apache) provider="apache"; shift ;;
    --nginx) provider="nginx"; shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

[[ -n "$domain" ]] || { echo "Usage: issue-letsencrypt.sh --domain example.com [--email admin@example.com] [--nginx|--apache]" >&2; exit 1; }

args=(--"$provider" -d "$domain" --agree-tos --non-interactive)
if [[ -n "$email" ]]; then
  args+=(-m "$email")
else
  args+=(--register-unsafely-without-email)
fi

certbot "${args[@]}"
