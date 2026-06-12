#!/usr/bin/env bash
set -Eeuo pipefail

cd "${OPENDEPLOY_WEB_DIR:-/opt/opendeploy/apps/web}"

export PORT="${WEB_PORT:-8080}"
export HOSTNAME="${WEB_HOST:-0.0.0.0}"

if [[ -f ".next/standalone/apps/web/server.js" ]]; then
  mkdir -p ".next/standalone/apps/web/.next"
  if [[ -d ".next/static" ]]; then
    cp -R ".next/static" ".next/standalone/apps/web/.next/"
  fi
  if [[ -d "public" ]]; then
    cp -R "public" ".next/standalone/apps/web/"
  fi
  cd ".next/standalone/apps/web"
  exec /usr/bin/env node server.js
fi

if [[ -f ".next/standalone/server.js" ]]; then
  mkdir -p ".next/standalone/.next"
  if [[ -d ".next/static" ]]; then
    cp -R ".next/static" ".next/standalone/.next/"
  fi
  if [[ -d "public" ]]; then
    cp -R "public" ".next/standalone/"
  fi
  cd ".next/standalone"
  exec /usr/bin/env node server.js
fi

exec /usr/bin/env node ../../node_modules/next/dist/bin/next start --port "$PORT" --hostname "$HOSTNAME"
