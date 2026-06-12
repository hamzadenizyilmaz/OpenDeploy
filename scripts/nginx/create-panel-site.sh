#!/usr/bin/env bash
set -Eeuo pipefail

domain="${1:?domain required}"
port="${2:-8080}"

[[ "$domain" =~ ^[A-Za-z0-9.-]+$ ]] || { echo "Invalid domain" >&2; exit 1; }
[[ "$port" =~ ^[0-9]{2,5}$ ]] || { echo "Invalid port" >&2; exit 1; }

if [[ -d /etc/nginx/sites-available ]]; then
  target="/etc/nginx/sites-available/opendeploy.conf"
  enabled="/etc/nginx/sites-enabled/opendeploy.conf"
  mkdir -p /etc/nginx/sites-enabled
else
  target="/etc/nginx/conf.d/opendeploy.conf"
  enabled=""
fi

cat > "$target" <<NGINX
server {
  listen 80;
  server_name $domain;

  access_log /var/log/nginx/opendeploy.access.log;
  error_log /var/log/nginx/opendeploy.error.log;
  client_max_body_size 64m;

  add_header X-Frame-Options "DENY" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
  add_header Content-Security-Policy "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self';" always;

  location = /api {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location ^~ /api/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location / {
    proxy_pass http://127.0.0.1:$port;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
NGINX

if [[ -n "$enabled" ]]; then
  ln -sfn "$target" "$enabled"
fi
