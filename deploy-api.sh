#!/usr/bin/env bash
set -euo pipefail

npm ci
npm run migrate
npm run build

if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe data-exchange-api >/dev/null 2>&1; then
    pm2 restart data-exchange-api
  else
    pm2 start dist/server.js --name data-exchange-api
  fi
  pm2 save
else
  echo "pm2 not found. Run npm run start manually or install pm2."
fi
