#!/usr/bin/env bash
# Loads the starter content: database tables + seed rows + images into R2.
# Usage: bash scripts/seed.sh --local    (wrangler dev)
#        bash scripts/seed.sh --remote   (the live Cloudflare account)
set -euo pipefail
MODE="${1:---local}"
cd "$(dirname "$0")/.."

npx wrangler d1 migrations apply noah-arts "$MODE"
npx wrangler d1 execute noah-arts "$MODE" --file=seed/seed.sql

for file in seed/media/*.jpg; do
  npx wrangler r2 object put "noah-arts-media/$(basename "$file")" \
    --file="$file" --content-type=image/jpeg "$MODE"
done
