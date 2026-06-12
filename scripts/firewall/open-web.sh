#!/usr/bin/env bash
set -Eeuo pipefail

ports=("$@")
if [[ ${#ports[@]} -eq 0 ]]; then
  ports=(80 443 8080)
fi

for port in "${ports[@]}"; do
  [[ "$port" =~ ^[0-9]{1,5}$ ]] || { echo "Invalid port: $port" >&2; exit 1; }
done

if command -v ufw >/dev/null 2>&1; then
  for port in "${ports[@]}"; do ufw allow "$port/tcp"; done
elif command -v firewall-cmd >/dev/null 2>&1; then
  for port in "${ports[@]}"; do firewall-cmd --permanent --add-port="$port/tcp"; done
  firewall-cmd --reload
else
  echo "No supported firewall frontend found. Open ports manually: ${ports[*]}" >&2
fi
