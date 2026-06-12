# Nginx / Apache

## Nginx

OpenDeploy generates reverse proxy files under `/etc/nginx/sites-available`.

Features:

- Domain to `localhost:PORT`
- WebSocket headers
- Access/error logs
- HTTP to HTTPS redirect
- Upload limit
- Proxy timeout
- Custom headers
- Gzip

## Apache

Apache support is planned for version 2 and uses VirtualHost with ProxyPass and ProxyPassReverse.
