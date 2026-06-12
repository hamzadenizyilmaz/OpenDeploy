#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'
umask 027

OPENDEPLOY_REPO="${OPENDEPLOY_REPO:-https://github.com/hamzadenizyilmaz/OpenDeploy.git}"
OPENDEPLOY_DIR="${OPENDEPLOY_DIR:-/opt/opendeploy}"
ENV_DIR="${OPENDEPLOY_ENV_DIR:-/etc/opendeploy}"
ENV_FILE="$ENV_DIR/opendeploy.env"
DATA_DIR="${OPENDEPLOY_DATA:-/var/lib/opendeploy}"
PROJECTS_DIR="${OPENDEPLOY_PROJECTS:-$DATA_DIR/projects}"
BACKUP_DIR="${OPENDEPLOY_BACKUPS:-/var/backups/opendeploy}"
LOG_DIR="${OPENDEPLOY_LOGS:-/var/log/opendeploy}"
OPENDEPLOY_VERSION="${OPENDEPLOY_VERSION:-v2.0.0-enterprise-ops}"

DOMAIN=""
WEB_PORT="8080"
USE_NGINX="true"
USE_APACHE="false"
SKIP_DB="false"
SKIP_REDIS="false"
NO_SSL="false"
SSL_EMAIL=""
MODE="production"
DNS_MODE="${DNS_CLOUD_MODE:-creartsoft}"
DNS_CLOUD_API_URL="${DNS_CLOUD_API_URL:-}"
DNS_CLOUD_ADMIN_URL="${DNS_CLOUD_ADMIN_URL:-}"
DNS_DEFAULT_NS1="${DNS_DEFAULT_NS1:-}"
DNS_DEFAULT_NS2="${DNS_DEFAULT_NS2:-}"
DNS_BRAND_NAME="${DNS_BRAND_NAME:-OpenDeploy DNS Cloud}"
DNS_BRAND_OWNER="${DNS_BRAND_OWNER:-Creart Soft}"
DNS_REGISTRATION_TOKEN="${DNS_CLOUD_REGISTRATION_TOKEN:-}"

OPENDEPLOY_SERVICES=(opendeploy-agent opendeploy-api opendeploy-worker opendeploy-web)
OPENDEPLOY_DNS_CLOUD_SERVICES=(opendeploy-dns-cloud-api opendeploy-dns-admin-panel opendeploy-dns-nameserver)

log(){ printf '\033[1;32m[OpenDeploy Install]\033[0m %s\n' "$*"; }
warn(){ printf '\033[1;33m[OpenDeploy Install]\033[0m %s\n' "$*" >&2; }
fail(){ printf '\033[1;31m[OpenDeploy Install]\033[0m %s\n' "$*" >&2; exit 1; }
have(){ command -v "$1" >/dev/null 2>&1; }
secret(){ openssl rand -hex 48; }

usage(){
  cat <<USAGE
OpenDeploy installer

Options:
  --domain example.com
  --port 8080
  --nginx
  --apache
  --skip-db
  --skip-redis
  --no-ssl
  --ssl-email admin@example.com
  --dev
  --production
  --dns-mode creartsoft|self-hosted
  --dns-api-url https://dns.example.com/api/v1
  --dns-admin-url https://dns.example.com
  --dns-ns1 ns1.example.com
  --dns-ns2 ns2.example.com
  --dns-brand-name "OpenDeploy DNS Cloud"
  --dns-brand-owner "Creart Soft"
  --dns-registration-token token
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install) shift ;;
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --port) WEB_PORT="${2:-8080}"; shift 2 ;;
    --nginx) USE_NGINX="true"; USE_APACHE="false"; shift ;;
    --apache) USE_APACHE="true"; USE_NGINX="false"; shift ;;
    --skip-db) SKIP_DB="true"; shift ;;
    --skip-redis) SKIP_REDIS="true"; shift ;;
    --no-ssl) NO_SSL="true"; shift ;;
    --ssl-email) SSL_EMAIL="${2:-}"; shift 2 ;;
    --dev) MODE="development"; shift ;;
    --production) MODE="production"; shift ;;
    --dns-mode) DNS_MODE="${2:-creartsoft}"; shift 2 ;;
    --dns-api-url) DNS_CLOUD_API_URL="${2:-}"; shift 2 ;;
    --dns-admin-url) DNS_CLOUD_ADMIN_URL="${2:-}"; shift 2 ;;
    --dns-ns1) DNS_DEFAULT_NS1="${2:-}"; shift 2 ;;
    --dns-ns2) DNS_DEFAULT_NS2="${2:-}"; shift 2 ;;
    --dns-brand-name) DNS_BRAND_NAME="${2:-}"; shift 2 ;;
    --dns-brand-owner) DNS_BRAND_OWNER="${2:-}"; shift 2 ;;
    --dns-registration-token) DNS_REGISTRATION_TOKEN="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Unknown option: $1" ;;
  esac
done

[[ "${EUID:-$(id -u)}" -eq 0 ]] || fail "Please run as root."

case "$DNS_MODE" in
  creartsoft)
    DNS_CLOUD_API_URL="${DNS_CLOUD_API_URL:-https://dns.creartsoft.com/api/v1}"
    DNS_CLOUD_ADMIN_URL="${DNS_CLOUD_ADMIN_URL:-https://dns.creartsoft.com}"
    DNS_DEFAULT_NS1="${DNS_DEFAULT_NS1:-dp-ns1.opendeploy.com}"
    DNS_DEFAULT_NS2="${DNS_DEFAULT_NS2:-dp-ns2.opendeploy.com}"
    ;;
  self-hosted)
    [[ -n "$DNS_CLOUD_API_URL" ]] || fail "--dns-api-url is required for self-hosted DNS Cloud."
    [[ -n "$DNS_CLOUD_ADMIN_URL" ]] || fail "--dns-admin-url is required for self-hosted DNS Cloud."
    [[ -n "$DNS_DEFAULT_NS1" ]] || fail "--dns-ns1 is required for self-hosted DNS Cloud."
    [[ -n "$DNS_DEFAULT_NS2" ]] || fail "--dns-ns2 is required for self-hosted DNS Cloud."
    ;;
  *) fail "Invalid --dns-mode: $DNS_MODE" ;;
esac

detect_platform(){
  if [[ "$(uname -s)" == "FreeBSD" ]]; then
    OS_ID="freebsd"; OS_VERSION="$(freebsd-version 2>/dev/null || uname -r)"; PKG="pkg"; return
  fi
  [[ -f /etc/os-release ]] || fail "/etc/os-release not found."
  # shellcheck disable=SC1091
  . /etc/os-release
  OS_ID="${ID:-unknown}"
  OS_VERSION="${VERSION_ID:-unknown}"
  case "$OS_ID" in
    ubuntu|debian) PKG="apt" ;;
    almalinux|rocky|rhel|centos) PKG="dnf" ;;
    *) fail "Unsupported OS: $OS_ID $OS_VERSION" ;;
  esac
}

primary_ip(){
  local ip
  ip="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  [[ -n "$ip" ]] || ip="$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}' || true)"
  printf '%s' "${ip:-127.0.0.1}"
}

panel_public_url(){
  if [[ -n "$DOMAIN" && ( "$USE_NGINX" == "true" || "$USE_APACHE" == "true" ) ]]; then
    if [[ "$NO_SSL" == "true" ]]; then
      printf 'http://%s' "$DOMAIN"
    else
      printf 'https://%s' "$DOMAIN"
    fi
    return
  fi
  printf 'http://%s:%s' "${DOMAIN:-$(primary_ip)}" "$WEB_PORT"
}

env_quote(){
  local value="${1:-}"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '"%s"' "$value"
}

env_line(){
  printf '%s=%s\n' "$1" "$(env_quote "${2:-}")" >> "$ENV_FILE"
}

systemctl_safe(){
  if have systemctl; then systemctl "$@"; else return 0; fi
}

enable_first_service(){
  local service
  if ! have systemctl; then return 0; fi
  for service in "$@"; do
    if systemctl list-unit-files "${service}.service" --no-legend 2>/dev/null | awk '{print $1}' | grep -qx "${service}.service"; then
      systemctl_safe enable --now "$service"
      return $?
    fi
  done
  return 1
}

postgres_cmd(){
  if have sudo; then sudo -u postgres "$@"
  elif have runuser; then runuser -u postgres -- "$@"
  else fail "sudo or runuser is required for PostgreSQL setup."
  fi
}

nologin_shell(){
  if [[ -x /usr/sbin/nologin ]]; then printf '/usr/sbin/nologin'
  elif [[ -x /sbin/nologin ]]; then printf '/sbin/nologin'
  else printf '/bin/false'
  fi
}

ensure_user(){
  if id opendeploy >/dev/null 2>&1; then return; fi
  if have useradd; then
    useradd --system --create-home --home-dir "$DATA_DIR" --shell "$(nologin_shell)" opendeploy
  elif have pw; then
    pw useradd opendeploy -d "$DATA_DIR" -s /usr/sbin/nologin -m
  else
    fail "Could not create opendeploy user."
  fi
}

install_packages(){
  log "Detected OS: $OS_ID $OS_VERSION ($PKG)"
  case "$PKG" in
    apt)
      export DEBIAN_FRONTEND=noninteractive
      apt-get update
      apt-get install -y ca-certificates curl wget git unzip tar openssl gnupg lsb-release build-essential sudo
      if [[ "$SKIP_DB" != "true" ]]; then apt-get install -y postgresql postgresql-contrib; fi
      if [[ "$SKIP_REDIS" != "true" ]]; then apt-get install -y redis-server; fi
      if [[ "$USE_NGINX" == "true" ]]; then apt-get install -y nginx certbot python3-certbot-nginx; fi
      if [[ "$USE_APACHE" == "true" ]]; then apt-get install -y apache2 certbot python3-certbot-apache; fi
      ;;
    dnf)
      dnf -y install epel-release || true
      dnf -y install ca-certificates curl wget git unzip tar openssl gnupg2 gcc gcc-c++ make sudo
      if [[ "$SKIP_DB" != "true" ]]; then dnf -y install postgresql-server postgresql-contrib; fi
      if [[ "$SKIP_REDIS" != "true" ]]; then dnf -y install redis; fi
      if [[ "$USE_NGINX" == "true" ]]; then dnf -y install nginx certbot python3-certbot-nginx; fi
      if [[ "$USE_APACHE" == "true" ]]; then dnf -y install httpd certbot python3-certbot-apache; fi
      ;;
    pkg)
      pkg update -f
      pkg install -y ca_root_nss curl wget git gtar openssl node npm nginx postgresql16-server redis
      warn "FreeBSD support is experimental; systemd services are skipped."
      ;;
  esac
  log "System packages installed."
}

install_node(){
  local major
  major="$(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || echo 0)"
  if ! have node || [[ "$major" -lt 20 ]]; then
    log "Installing Node.js 22..."
    if [[ "$PKG" == "apt" ]]; then
      curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
      apt-get install -y nodejs
    elif [[ "$PKG" == "dnf" ]]; then
      curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
      dnf -y install nodejs
    elif [[ "$PKG" == "pkg" ]]; then
      pkg install -y node npm
    fi
  fi
  npm install -g npm@latest pnpm pm2
  log "Node: $(node -v), npm: $(npm -v)"
}

prepare_directories(){
  ensure_user
  mkdir -p "$OPENDEPLOY_DIR" "$ENV_DIR" "$DATA_DIR" "$PROJECTS_DIR" "$BACKUP_DIR" "$LOG_DIR"
  chown -R opendeploy:opendeploy "$DATA_DIR" "$PROJECTS_DIR" "$BACKUP_DIR" "$LOG_DIR"
}

clone_repo(){
  if [[ -d "$OPENDEPLOY_DIR/.git" ]]; then
    local branch
    branch="$(git -C "$OPENDEPLOY_DIR" rev-parse --abbrev-ref HEAD)"
    [[ "$branch" == "HEAD" ]] && branch="main"
    git -C "$OPENDEPLOY_DIR" fetch --tags "$OPENDEPLOY_REPO" "$branch"
    git -C "$OPENDEPLOY_DIR" merge --ff-only FETCH_HEAD
  else
    if [[ -e "$OPENDEPLOY_DIR" && -n "$(find "$OPENDEPLOY_DIR" -mindepth 1 -maxdepth 1 2>/dev/null | head -1)" ]]; then
      mv "$OPENDEPLOY_DIR" "${OPENDEPLOY_DIR}.bak-$(date +%Y%m%d-%H%M%S)"
    fi
    git clone "$OPENDEPLOY_REPO" "$OPENDEPLOY_DIR"
  fi
}

validate_source_tree(){
  local missing=0
  local required=(
    "package.json"
    "apps/api/src/server.js"
    "apps/api/src/routes/index.js"
    "apps/api/src/modules/backups/backups.routes.js"
    "apps/web/package.json"
    "apps/web/app/page.jsx"
    "scripts/runtime/start-web.sh"
    "prisma/migrations/20260613000000_init/migration.sql"
    "apps/worker/src/worker.js"
    "apps/agent/src/server.js"
    "prisma/schema.prisma"
  )
  local file
  for file in "${required[@]}"; do
    if [[ ! -f "$OPENDEPLOY_DIR/$file" ]]; then
      warn "Missing required source file: $file"
      missing=1
    fi
  done
  [[ "$missing" -eq 0 ]] || fail "OpenDeploy repository checkout is incomplete. Push all project files to GitHub, then rerun the installer."
}

write_env(){
  if [[ -f "$ENV_FILE" ]]; then
    warn "$ENV_FILE already exists; keeping existing environment."
    return
  fi

  local db_pass dns_db_pass panel_url
  db_pass="$(secret | cut -c1-24)"
  dns_db_pass="$(secret | cut -c1-24)"
  panel_url="$(panel_public_url)"

  : > "$ENV_FILE"
  env_line NODE_ENV "$MODE"
  env_line OPENDEPLOY_VERSION "$OPENDEPLOY_VERSION"
  env_line APP_URL "$panel_url"
  env_line NEXT_PUBLIC_API_URL "/api"
  env_line API_INTERNAL_URL "http://127.0.0.1:4000"
  env_line WEB_PORT "$WEB_PORT"
  env_line API_PORT "4000"
  env_line AGENT_PORT "4100"
  env_line DNS_CLOUD_ADMIN_PORT "4310"
  env_line DATABASE_URL "postgresql://opendeploy:$db_pass@localhost:5432/opendeploy"
  env_line REDIS_URL "redis://localhost:6379"
  env_line REDIS_TLS_REJECT_UNAUTHORIZED "true"
  env_line OPENDEPLOY_PRISMA_QUERY_LOGS "false"
  env_line OPENDEPLOY_GITHUB_REPO "hamzadenizyilmaz/OpenDeploy"
  env_line JWT_ACCESS_SECRET "$(secret)"
  env_line JWT_REFRESH_SECRET "$(secret)"
  env_line SESSION_SECRET "$(secret)"
  env_line AGENT_TOKEN "$(secret)"
  env_line OPENDEPLOY_ENCRYPTION_KEY "$(openssl rand -base64 32)"
  env_line OPENDEPLOY_ROOT "$OPENDEPLOY_DIR"
  env_line OPENDEPLOY_DATA "$DATA_DIR"
  env_line OPENDEPLOY_PROJECTS "$PROJECTS_DIR"
  env_line OPENDEPLOY_BACKUPS "$BACKUP_DIR"
  env_line OPENDEPLOY_LOGS "$LOG_DIR"
  env_line DEFAULT_PROXY "$([[ "$USE_NGINX" == "true" ]] && echo nginx || echo apache)"
  env_line DEFAULT_DOMAIN "$DOMAIN"
  env_line SSL_EMAIL "$SSL_EMAIL"
  env_line DNS_CLOUD_ENABLED "true"
  env_line DNS_CLOUD_MODE "$DNS_MODE"
  env_line DNS_CLOUD_API_URL "$DNS_CLOUD_API_URL"
  env_line DNS_CLOUD_ADMIN_URL "$DNS_CLOUD_ADMIN_URL"
  env_line DNS_CLOUD_CORS_ORIGINS "$DNS_CLOUD_ADMIN_URL"
  env_line DNS_CLOUD_API_PORT "4300"
  env_line DNS_CLOUD_DATABASE_URL "postgresql://opendeploy_dns:$dns_db_pass@localhost:5432/opendeploy_dns"
  env_line DNS_CLOUD_REDIS_URL "redis://localhost:6379"
  env_line DNS_CLOUD_STATE_FILE "$DATA_DIR/dns-cloud-state.json"
  env_line DNS_CLOUD_STATE_PERSISTENCE "true"
  env_line DNS_CLOUD_JWT_SECRET "$(secret)"
  env_line DNS_CLOUD_INSTANCE_ID "opd_$(openssl rand -hex 8)"
  env_line DNS_CLOUD_API_KEY "$(secret)"
  env_line DNS_CLOUD_ADMIN_TOKEN "$(secret)"
  env_line DNS_CLOUD_ADMIN_BOOTSTRAP_TOKEN "$(secret)"
  env_line DNS_CLOUD_ENCRYPTION_KEY "$(openssl rand -base64 32)"
  env_line DNS_CLOUD_ENVELOPE_PUBLIC_KEY ""
  env_line DNS_CLOUD_ENVELOPE_PRIVATE_KEY ""
  env_line DNS_DEFAULT_NS1 "$DNS_DEFAULT_NS1"
  env_line DNS_DEFAULT_NS2 "$DNS_DEFAULT_NS2"
  env_line DNS_NAMESERVERS "$DNS_DEFAULT_NS1,$DNS_DEFAULT_NS2"
  env_line DNS_BRAND_NAME "$DNS_BRAND_NAME"
  env_line DNS_BRAND_OWNER "$DNS_BRAND_OWNER"
  env_line NEXT_PUBLIC_DNS_CLOUD_API_URL "$DNS_CLOUD_API_URL"
  env_line DNS_BIND "0.0.0.0"
  env_line DNS_PORT "53"
  env_line DNS_ZONE_SOURCE "cloud"
  env_line DNS_ZONES_DIR "$DATA_DIR/dns-zones"
  env_line DNS_NAMESERVER_HOSTNAME "$DNS_DEFAULT_NS1"
  env_line DNS_RECURSION_ENABLED "false"
  env_line DNS_QUERY_LOG_SAMPLE_RATE "0.1"
  env_line DNS_ZONE_CACHE_TTL_MS "30000"
  env_line DNS_CLOUD_TIMEOUT_MS "5000"
  env_line DNS_LOG_LEVEL "info"
  chmod 600 "$ENV_FILE"
}

setup_database(){
  [[ "$SKIP_DB" == "true" || "$PKG" == "pkg" ]] && return
  enable_first_service postgresql || true
  if have postgresql-setup; then
    postgresql-setup --initdb || true
    systemctl_safe restart postgresql || true
  fi
  if [[ "$SKIP_REDIS" != "true" ]]; then
    enable_first_service redis-server redis || warn "Redis service could not be enabled automatically."
  fi

  local db_pass dns_db_pass
  db_pass="$(grep '^DATABASE_URL=' "$ENV_FILE" | sed -E 's#.*opendeploy:([^@]+)@.*#\1#; s/"$//')"
  postgres_cmd psql -tc "SELECT 1 FROM pg_roles WHERE rolname='opendeploy'" | grep -q 1 || postgres_cmd psql -c "CREATE USER opendeploy WITH PASSWORD '$db_pass';"
  postgres_cmd psql -tc "SELECT 1 FROM pg_database WHERE datname='opendeploy'" | grep -q 1 || postgres_cmd createdb -O opendeploy opendeploy

  if [[ "$DNS_MODE" == "self-hosted" ]]; then
    dns_db_pass="$(grep '^DNS_CLOUD_DATABASE_URL=' "$ENV_FILE" | sed -E 's#.*opendeploy_dns:([^@]+)@.*#\1#; s/"$//')"
    postgres_cmd psql -tc "SELECT 1 FROM pg_roles WHERE rolname='opendeploy_dns'" | grep -q 1 || postgres_cmd psql -c "CREATE USER opendeploy_dns WITH PASSWORD '$dns_db_pass';"
    postgres_cmd psql -tc "SELECT 1 FROM pg_database WHERE datname='opendeploy_dns'" | grep -q 1 || postgres_cmd createdb -O opendeploy_dns opendeploy_dns
  fi
}

install_dependencies(){
  cd "$OPENDEPLOY_DIR"
  cp "$ENV_FILE" .env
  if [[ -f package-lock.json ]]; then npm ci; else npm install; fi
  npm run prisma:generate
  npm run prisma:migrate
  npm run build

  if [[ "$DNS_MODE" == "self-hosted" ]]; then
    cp "$ENV_FILE" "OpenDeploy DNS Cloud/.env"
    (cd "OpenDeploy DNS Cloud" && npm install && npm run prisma:generate && npm run prisma:migrate && npm run check && npm run build)
  fi
}

fix_permissions(){
  chown -R opendeploy:opendeploy "$OPENDEPLOY_DIR"
  chmod -R u+rwX,g+rX,o-rwx "$OPENDEPLOY_DIR"
}

systemd_path(){
  local value="$1"
  printf '%s' "${value// /\\x20}"
}

write_units(){
  if [[ "$PKG" == "pkg" ]]; then
    warn "Skipping systemd service setup on FreeBSD."
    return
  fi
  mkdir -p /etc/systemd/system

  cat > /etc/systemd/system/opendeploy-api.service <<SERVICE
[Unit]
Description=OpenDeploy API
After=network-online.target postgresql.service redis.service
Wants=network-online.target

[Service]
Type=simple
User=opendeploy
Group=opendeploy
WorkingDirectory=$(systemd_path "$OPENDEPLOY_DIR/apps/api")
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/env node src/server.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
SERVICE

  cat > /etc/systemd/system/opendeploy-web.service <<SERVICE
[Unit]
Description=OpenDeploy Web
After=network-online.target opendeploy-api.service
Wants=network-online.target

[Service]
Type=simple
User=opendeploy
Group=opendeploy
WorkingDirectory=$(systemd_path "$OPENDEPLOY_DIR/apps/web")
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/env bash $OPENDEPLOY_DIR/scripts/runtime/start-web.sh
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
SERVICE

  cat > /etc/systemd/system/opendeploy-worker.service <<SERVICE
[Unit]
Description=OpenDeploy Worker
After=network-online.target postgresql.service redis.service
Wants=network-online.target

[Service]
Type=simple
User=opendeploy
Group=opendeploy
WorkingDirectory=$(systemd_path "$OPENDEPLOY_DIR/apps/worker")
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/env node src/worker.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
SERVICE

  cat > /etc/systemd/system/opendeploy-agent.service <<SERVICE
[Unit]
Description=OpenDeploy Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=$(systemd_path "$OPENDEPLOY_DIR/apps/agent")
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/env node src/server.js
Restart=always
RestartSec=5
PrivateTmp=true

[Install]
WantedBy=multi-user.target
SERVICE

  if [[ "$DNS_MODE" == "self-hosted" ]]; then
    cat > /etc/systemd/system/opendeploy-dns-cloud-api.service <<SERVICE
[Unit]
Description=OpenDeploy DNS Cloud API
After=network-online.target postgresql.service redis.service
Wants=network-online.target

[Service]
Type=simple
User=opendeploy
Group=opendeploy
WorkingDirectory=$(systemd_path "$OPENDEPLOY_DIR/OpenDeploy DNS Cloud/DNS_Cloud_API")
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/env node src/server.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
SERVICE

    cat > /etc/systemd/system/opendeploy-dns-admin-panel.service <<SERVICE
[Unit]
Description=OpenDeploy DNS Admin Panel
After=network-online.target opendeploy-dns-cloud-api.service
Wants=network-online.target

[Service]
Type=simple
User=opendeploy
Group=opendeploy
WorkingDirectory=$(systemd_path "$OPENDEPLOY_DIR/OpenDeploy DNS Cloud/DNS_Admin_Panel")
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/env node ../node_modules/next/dist/bin/next start --port 4310
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
SERVICE

    cat > /etc/systemd/system/opendeploy-dns-nameserver.service <<SERVICE
[Unit]
Description=OpenDeploy DNS NameServer
After=network-online.target opendeploy-dns-cloud-api.service
Wants=network-online.target

[Service]
Type=simple
User=opendeploy
Group=opendeploy
WorkingDirectory=$(systemd_path "$OPENDEPLOY_DIR/OpenDeploy DNS Cloud/DNS_NameServer")
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/env node src/server.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
SERVICE
  else
    rm -f /etc/systemd/system/opendeploy-dns-cloud-api.service /etc/systemd/system/opendeploy-dns-admin-panel.service /etc/systemd/system/opendeploy-dns-nameserver.service
  fi

  systemctl_safe daemon-reload
}

install_cli(){
  mkdir -p /usr/local/bin
  chmod +x "$OPENDEPLOY_DIR/opendeploy.sh" "$OPENDEPLOY_DIR/update.sh" "$OPENDEPLOY_DIR/repair.sh" "$OPENDEPLOY_DIR/uninstall.sh" || true
  cat > /usr/local/bin/opendeploy <<EOF
#!/usr/bin/env bash
set -Eeuo pipefail
export OPENDEPLOY_DIR="\${OPENDEPLOY_DIR:-$OPENDEPLOY_DIR}"
export OPENDEPLOY_ENV_FILE="\${OPENDEPLOY_ENV_FILE:-$ENV_FILE}"
exec bash "\$OPENDEPLOY_DIR/opendeploy.sh" "\$@"
EOF
  chmod 755 /usr/local/bin/opendeploy
}

service_list(){
  printf '%s\n' "${OPENDEPLOY_SERVICES[@]}"
  if [[ "$DNS_MODE" == "self-hosted" ]]; then
    printf '%s\n' "${OPENDEPLOY_DNS_CLOUD_SERVICES[@]}"
  fi
  return 0
}

start_services(){
  mapfile -t services < <(service_list)
  systemctl_safe enable "${services[@]}" || true
  systemctl_safe restart "${services[@]}"
}

wait_for_http(){
  local url="$1" label="$2" attempts="${3:-30}"
  local index
  for ((index=1; index<=attempts; index+=1)); do
    if curl -fsS --connect-timeout 2 --max-time 4 "$url" >/dev/null 2>&1; then
      log "$label health check passed."
      return 0
    fi
    sleep 2
  done
  warn "$label health check failed: $url"
  return 1
}

show_recent_service_logs(){
  local services=(opendeploy-api opendeploy-web opendeploy-worker opendeploy-agent)
  local svc
  for svc in "${services[@]}"; do
    warn "Recent logs for $svc"
    journalctl -u "$svc" -n 40 --no-pager || true
  done
}

register_dns_cloud(){
  [[ -n "$DNS_REGISTRATION_TOKEN" || "$DNS_MODE" == "self-hosted" ]] || { warn "DNS Cloud registration token not set; skipping registration."; return; }
  have curl || return
  local token url instance_id payload response api_key
  token="$DNS_REGISTRATION_TOKEN"
  if [[ -z "$token" ]]; then token="$(grep '^DNS_CLOUD_ADMIN_BOOTSTRAP_TOKEN=' "$ENV_FILE" | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/')"; fi
  url="$DNS_CLOUD_API_URL"
  if [[ "$DNS_MODE" == "self-hosted" ]]; then url="http://127.0.0.1:4300/api/v1"; fi
  instance_id="$(grep '^DNS_CLOUD_INSTANCE_ID=' "$ENV_FILE" | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/')"
  payload="{\"instanceId\":\"$instance_id\",\"panelName\":\"OpenDeploy Panel\",\"panelUrl\":\"$(panel_public_url)\",\"version\":\"$OPENDEPLOY_VERSION\",\"ipAddress\":\"$(primary_ip)\"}"
  response="$(curl -fsS --connect-timeout 8 --max-time 20 -H 'Content-Type: application/json' -H "X-DNS-Cloud-Registration-Token: $token" -X POST "$url/instances/register" -d "$payload" 2>/dev/null || true)"
  [[ -n "$response" ]] || { warn "DNS Cloud registration skipped or unavailable."; return; }
  api_key="$(printf '%s' "$response" | node -e "let b='';process.stdin.on('data',d=>b+=d);process.stdin.on('end',()=>{try{process.stdout.write(JSON.parse(b).data?.apiKey||'')}catch(e){}})" 2>/dev/null || true)"
  [[ -n "$api_key" ]] || return
  sed -i.bak "s#^DNS_CLOUD_API_KEY=.*#DNS_CLOUD_API_KEY=\"${api_key}\"#" "$ENV_FILE"
  rm -f "$ENV_FILE.bak"
  log "DNS Cloud instance registered."
}

configure_proxy(){
  [[ -z "$DOMAIN" ]] && return
  if [[ "$USE_NGINX" == "true" ]]; then
    bash "$OPENDEPLOY_DIR/scripts/nginx/create-panel-site.sh" "$DOMAIN" "$WEB_PORT"
    nginx -t
    systemctl_safe reload nginx || true
    if [[ "$NO_SSL" != "true" ]]; then
      certbot_args=(--nginx -d "$DOMAIN" --agree-tos --non-interactive)
      [[ -n "$SSL_EMAIL" ]] && certbot_args+=(-m "$SSL_EMAIL") || certbot_args+=(--register-unsafely-without-email)
      certbot "${certbot_args[@]}" || warn "SSL issuance failed."
    fi
  elif [[ "$USE_APACHE" == "true" ]]; then
    bash "$OPENDEPLOY_DIR/scripts/apache/create-panel-site.sh" "$DOMAIN" "$WEB_PORT"
    apachectl configtest || httpd -t
    systemctl_safe reload apache2 || systemctl_safe reload httpd || true
    if [[ "$NO_SSL" != "true" ]]; then
      certbot_args=(--apache -d "$DOMAIN" --agree-tos --non-interactive)
      [[ -n "$SSL_EMAIL" ]] && certbot_args+=(-m "$SSL_EMAIL") || certbot_args+=(--register-unsafely-without-email)
      certbot "${certbot_args[@]}" || warn "SSL issuance failed."
    fi
  fi
}

configure_firewall(){
  if have ufw; then
    ufw allow 80/tcp || true
    ufw allow 443/tcp || true
    ufw allow "$WEB_PORT/tcp" || true
    if [[ "$DNS_MODE" == "self-hosted" ]]; then ufw allow 53/tcp || true; ufw allow 53/udp || true; fi
  elif have firewall-cmd; then
    firewall-cmd --permanent --add-port=80/tcp || true
    firewall-cmd --permanent --add-port=443/tcp || true
    firewall-cmd --permanent --add-port="$WEB_PORT/tcp" || true
    if [[ "$DNS_MODE" == "self-hosted" ]]; then firewall-cmd --permanent --add-port=53/tcp || true; firewall-cmd --permanent --add-port=53/udp || true; fi
    firewall-cmd --reload || true
  fi
}

main(){
  detect_platform
  install_packages
  log "Installing Node.js and global tools..."
  install_node
  log "Preparing directories..."
  prepare_directories
  log "Cloning or updating repository..."
  clone_repo
  log "Validating repository files..."
  validate_source_tree
  log "Writing environment..."
  write_env
  log "Setting up database..."
  setup_database
  log "Installing application dependencies and building..."
  install_dependencies
  log "Fixing file permissions..."
  fix_permissions
  log "Writing systemd services..."
  write_units
  log "Installing CLI..."
  install_cli
  log "Starting services..."
  start_services
  if ! wait_for_http "http://127.0.0.1:4000/health" "API"; then
    show_recent_service_logs
    fail "API did not become healthy. Fix the service error above, then run: opendeploy repair"
  fi
  if ! wait_for_http "http://127.0.0.1:4000/api/setup/status" "API database schema"; then
    show_recent_service_logs
    fail "Database schema did not become ready. Run: cd $OPENDEPLOY_DIR && cp $ENV_FILE .env && npm run prisma:migrate"
  fi
  if ! wait_for_http "http://127.0.0.1:$WEB_PORT" "Web"; then
    show_recent_service_logs
    fail "Web did not become healthy. Fix the service error above, then run: opendeploy repair"
  fi
  log "Registering DNS Cloud instance if configured..."
  register_dns_cloud
  log "Configuring reverse proxy..."
  configure_proxy
  log "Configuring firewall..."
  configure_firewall
  log "Installation completed."
  log "Panel URL: $(panel_public_url)"
  log "DNS mode: $DNS_MODE"
  log "DNS nameservers: $DNS_DEFAULT_NS1, $DNS_DEFAULT_NS2"
  log "CLI: opendeploy status"
  log "First setup: /setup"
}

main "$@"
