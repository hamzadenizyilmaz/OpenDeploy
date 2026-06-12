#!/usr/bin/env bash
set -Eeuo pipefail

db_name="${1:-opendeploy}"
db_user="${2:-opendeploy}"

[[ "$db_name" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || { echo "Invalid database name" >&2; exit 1; }
[[ "$db_user" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || { echo "Invalid database user" >&2; exit 1; }

sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${db_user}'" | grep -q 1 || sudo -u postgres createuser "$db_user"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${db_name}'" | grep -q 1 || sudo -u postgres createdb -O "$db_user" "$db_name"
