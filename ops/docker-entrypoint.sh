#!/bin/sh
# Publish the built client bundle to the Caddy-shared volume, then start the API
# (which runs migrations on boot). See OPERATIONS.md §1.
set -e

if [ -d /srv ]; then
  rm -rf /srv/* 2>/dev/null || true
  cp -r /app/packages/client/dist/. /srv/ 2>/dev/null || true
fi

cd /app/packages/server
exec pnpm start
