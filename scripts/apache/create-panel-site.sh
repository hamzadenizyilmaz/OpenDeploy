#!/usr/bin/env bash
set -Eeuo pipefail

domain="${1:?domain required}"
port="${2:-8080}"

[[ "$domain" =~ ^[A-Za-z0-9.-]+$ ]] || { echo "Invalid domain" >&2; exit 1; }
[[ "$port" =~ ^[0-9]{2,5}$ ]] || { echo "Invalid port" >&2; exit 1; }

if [[ -d /etc/apache2/sites-available ]]; then
  target="/etc/apache2/sites-available/opendeploy.conf"
  error_log="\${APACHE_LOG_DIR}/opendeploy-error.log"
  access_log="\${APACHE_LOG_DIR}/opendeploy-access.log"
else
  target="/etc/httpd/conf.d/opendeploy.conf"
  error_log="/var/log/httpd/opendeploy-error.log"
  access_log="/var/log/httpd/opendeploy-access.log"
fi

cat > "$target" <<APACHE
<VirtualHost *:80>
  ServerName $domain
  ProxyPreserveHost On
  RequestHeader set X-Forwarded-Proto expr=%{REQUEST_SCHEME}
  Header always set X-Frame-Options "DENY"
  Header always set X-Content-Type-Options "nosniff"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set Permissions-Policy "camera=(), microphone=(), geolocation=()"
  Header always set Content-Security-Policy "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self';"
  ProxyPass /api http://127.0.0.1:4000/api
  ProxyPassReverse /api http://127.0.0.1:4000/api
  ProxyPass /api/ http://127.0.0.1:4000/api/
  ProxyPassReverse /api/ http://127.0.0.1:4000/api/
  ProxyPass / http://127.0.0.1:$port/
  ProxyPassReverse / http://127.0.0.1:$port/
  ErrorLog $error_log
  CustomLog $access_log combined
</VirtualHost>
APACHE

if command -v a2enmod >/dev/null 2>&1; then
  a2enmod proxy proxy_http headers rewrite
  a2ensite opendeploy.conf
fi
