#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'
umask 027

OPENDEPLOY_SERVICES=(opendeploy-agent opendeploy-api opendeploy-worker opendeploy-web)
OPENDEPLOY_DNS_CLOUD_SERVICES=(opendeploy-dns-cloud-api opendeploy-dns-admin-panel opendeploy-dns-nameserver)

log(){ printf '\033[1;32m[OpenDeploy]\033[0m %s\n' "$*"; }
warn(){ printf '\033[1;33m[OpenDeploy]\033[0m %s\n' "$*" >&2; }
fail(){ printf '\033[1;31m[OpenDeploy]\033[0m %s\n' "$*" >&2; exit 1; }

require_root(){
  [[ "${EUID:-$(id -u)}" -eq 0 ]] || fail "Please run as root."
}

have(){
  command -v "$1" >/dev/null 2>&1
}

detect_platform(){
  if [[ "$(uname -s)" == "FreeBSD" ]]; then
    OS_ID="freebsd"
    OS_VERSION="$(freebsd-version 2>/dev/null || uname -r)"
    PKG_MANAGER="pkg"
    return
  fi

  [[ -f /etc/os-release ]] || fail "/etc/os-release not found."
  # shellcheck disable=SC1091
  . /etc/os-release
  OS_ID="${ID:-unknown}"
  OS_VERSION="${VERSION_ID:-unknown}"
  case "$OS_ID" in
    ubuntu|debian) PKG_MANAGER="apt" ;;
    almalinux|rocky|rhel|centos) PKG_MANAGER="dnf" ;;
    *) fail "Unsupported OS: $OS_ID $OS_VERSION" ;;
  esac
}

platform_summary(){
  detect_platform
  printf '%s %s (%s)\n' "$OS_ID" "$OS_VERSION" "$PKG_MANAGER"
}

systemctl_safe(){
  if have systemctl; then
    systemctl "$@"
  else
    return 0
  fi
}

env_value(){
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 1
  grep -E "^${key}=" "$file" | tail -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/'
}

set_env_value(){
  local file="$1" key="$2" value="$3" escaped
  [[ -f "$file" ]] || return 0
  escaped="${value//\\/\\\\}"
  escaped="${escaped//\"/\\\"}"
  if grep -qE "^${key}=" "$file"; then
    sed -i.bak -E "s#^${key}=.*#${key}=\"${escaped}\"#" "$file"
    rm -f "$file.bak"
  else
    printf '%s="%s"\n' "$key" "$escaped" >> "$file"
  fi
}

normalize_panel_api_env(){
  local env_file="${1:-/etc/opendeploy/opendeploy.env}"
  [[ -f "$env_file" ]] || return 0
  set_env_value "$env_file" "NEXT_PUBLIC_API_URL" "/api"
  set_env_value "$env_file" "API_INTERNAL_URL" "http://127.0.0.1:4000"
}

dns_cloud_self_hosted(){
  local env_file="${1:-/etc/opendeploy/opendeploy.env}"
  [[ "$(env_value "$env_file" DNS_CLOUD_MODE 2>/dev/null || true)" == "self-hosted" ]]
}

service_names(){
  local env_file="${1:-/etc/opendeploy/opendeploy.env}"
  printf '%s\n' "${OPENDEPLOY_SERVICES[@]}"
  if dns_cloud_self_hosted "$env_file"; then
    printf '%s\n' "${OPENDEPLOY_DNS_CLOUD_SERVICES[@]}"
  fi
}

stop_opendeploy(){
  local env_file="${1:-/etc/opendeploy/opendeploy.env}"
  mapfile -t services < <(service_names "$env_file")
  for svc in "${services[@]}"; do
    systemctl_safe stop "$svc" || true
  done
}

restart_opendeploy(){
  local env_file="${1:-/etc/opendeploy/opendeploy.env}"
  mapfile -t services < <(service_names "$env_file")
  for svc in "${services[@]}"; do
    systemctl_safe restart "$svc" || warn "Could not restart $svc"
  done
}

ensure_dir(){
  local dir="$1" owner="${2:-}"
  mkdir -p "$dir"
  [[ -n "$owner" ]] && chown -R "$owner" "$dir" || true
}

create_archive(){
  local target="$1"
  shift
  mkdir -p "$(dirname "$target")"
  tar --exclude=node_modules --exclude=.next --exclude=.git -czf "$target" "$@"
}

postgres_cmd(){
  if have sudo; then
    sudo -u postgres "$@"
  elif have runuser; then
    runuser -u postgres -- "$@"
  else
    fail "sudo or runuser is required for PostgreSQL setup."
  fi
}

nologin_shell(){
  if [[ -x /usr/sbin/nologin ]]; then
    printf '/usr/sbin/nologin'
  elif [[ -x /sbin/nologin ]]; then
    printf '/sbin/nologin'
  else
    printf '/bin/false'
  fi
}

ensure_opendeploy_user(){
  if id opendeploy >/dev/null 2>&1; then return; fi
  if have useradd; then
    useradd --system --create-home --home-dir /var/lib/opendeploy --shell "$(nologin_shell)" opendeploy
  elif have pw; then
    pw useradd opendeploy -d /var/lib/opendeploy -s /usr/sbin/nologin -m
  else
    fail "Could not create opendeploy user."
  fi
}

fix_opendeploy_permissions(){
  local dir="${1:-/opt/opendeploy}"
  ensure_opendeploy_user
  [[ -d "$dir" ]] || return 0
  chown -R opendeploy:opendeploy "$dir"
  chmod -R u+rwX,g+rX,o-rwx "$dir"
}

systemd_path(){
  local value="$1"
  printf '%s' "${value// /\\x20}"
}

write_systemd_units(){
  local app_dir="${1:-/opt/opendeploy}" env_file="${2:-/etc/opendeploy/opendeploy.env}"
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
WorkingDirectory=$(systemd_path "$app_dir/apps/api")
EnvironmentFile=$env_file
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
WorkingDirectory=$(systemd_path "$app_dir/apps/web")
EnvironmentFile=$env_file
ExecStart=/usr/bin/env bash $app_dir/scripts/runtime/start-web.sh
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
WorkingDirectory=$(systemd_path "$app_dir/apps/worker")
EnvironmentFile=$env_file
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
WorkingDirectory=$(systemd_path "$app_dir/apps/agent")
EnvironmentFile=$env_file
ExecStart=/usr/bin/env node src/server.js
Restart=always
RestartSec=5
PrivateTmp=true

[Install]
WantedBy=multi-user.target
SERVICE

  if dns_cloud_self_hosted "$env_file"; then
    cat > /etc/systemd/system/opendeploy-dns-cloud-api.service <<SERVICE
[Unit]
Description=OpenDeploy DNS Cloud API
After=network-online.target postgresql.service redis.service
Wants=network-online.target

[Service]
Type=simple
User=opendeploy
Group=opendeploy
WorkingDirectory=$(systemd_path "$app_dir/OpenDeploy DNS Cloud/DNS_Cloud_API")
EnvironmentFile=$env_file
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
WorkingDirectory=$(systemd_path "$app_dir/OpenDeploy DNS Cloud/DNS_Admin_Panel")
EnvironmentFile=$env_file
ExecStart=/usr/bin/env node ../node_modules/next/dist/bin/next start --port \${DNS_CLOUD_ADMIN_PORT}
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
WorkingDirectory=$(systemd_path "$app_dir/OpenDeploy DNS Cloud/DNS_NameServer")
EnvironmentFile=$env_file
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
    rm -f /etc/systemd/system/opendeploy-dns-cloud-api.service \
      /etc/systemd/system/opendeploy-dns-admin-panel.service \
      /etc/systemd/system/opendeploy-dns-nameserver.service
  fi

  systemctl_safe daemon-reload
}

enable_opendeploy_services(){
  local env_file="${1:-/etc/opendeploy/opendeploy.env}"
  mapfile -t services < <(service_names "$env_file")
  systemctl_safe enable "${services[@]}" || true
}

install_cli(){
  local app_dir="${1:-/opt/opendeploy}" env_file="${2:-/etc/opendeploy/opendeploy.env}"
  mkdir -p /usr/local/bin
  chmod +x "$app_dir/opendeploy.sh" "$app_dir/update.sh" "$app_dir/repair.sh" "$app_dir/uninstall.sh" 2>/dev/null || true
  cat > /usr/local/bin/opendeploy <<EOF
#!/usr/bin/env bash
set -Eeuo pipefail
export OPENDEPLOY_DIR="\${OPENDEPLOY_DIR:-$app_dir}"
export OPENDEPLOY_ENV_FILE="\${OPENDEPLOY_ENV_FILE:-$env_file}"
exec bash "\$OPENDEPLOY_DIR/opendeploy.sh" "\$@"
EOF
  chmod 755 /usr/local/bin/opendeploy
}
