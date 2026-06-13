#!/usr/bin/env bash
# Deploy the Cloudflare Workers with wrangler.
#
# Usage:
#   scripts/deploy-workers.sh            # deploy all (api, agents, mcp)
#   scripts/deploy-workers.sh api        # deploy just one
#
# Requires CLOUDFLARE_API_TOKEN in the environment. On the dev VM it lives in
# ~/.bashrc, so a fresh shell already has it (otherwise: `source ~/.bashrc`).
# Worker secrets (GEMINI_KEY / GITHUB_TOKEN / ADMIN_TOKEN) are NOT managed here —
# set those once with `wrangler secret put <NAME>` per worker.
set -euo pipefail
cd "$(dirname "$0")/.."

target="${1:-all}"
if [ "$target" = "all" ]; then
  workers=(api agents mcp)
else
  workers=("$target")
fi

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "⚠  CLOUDFLARE_API_TOKEN is not set." >&2
  echo "   On the dev VM:  source ~/.bashrc   (or export it manually)" >&2
  exit 1
fi

for w in "${workers[@]}"; do
  dir="workers/$w"
  if [ ! -d "$dir" ]; then echo "✗ no such worker: $dir" >&2; exit 1; fi
  echo "→ deploying $dir"
  ( cd "$dir" && wrangler deploy )
  echo "  ✓ $w deployed"
done
echo "✓ workers deployed: ${workers[*]}"
