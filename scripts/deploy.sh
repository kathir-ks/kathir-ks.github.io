#!/usr/bin/env bash
# One-stop deploy for kathir-ks.github.io (Kathir OS v3).
#
# Frontend (GitHub Pages):
#   Pages auto-deploys whenever index.html / assets/** land on `main` (see
#   .github/workflows/deploy-pages.yml). This script verifies first, then pushes the
#   current branch. If that branch is `main`, the push triggers the Pages build; on any
#   other branch it tells you how to get it onto main.
#
# Workers (Cloudflare): pass --workers to also run wrangler deploy. The frontend change
#   in this repo does NOT touch workers, so you usually don't need this.
#
# Usage:
#   scripts/deploy.sh                  # verify + push current branch (frontend)
#   scripts/deploy.sh --no-push        # verify only
#   scripts/deploy.sh --workers        # also deploy all workers
#   scripts/deploy.sh --workers api    # also deploy a single worker
set -euo pipefail
cd "$(dirname "$0")/.."

do_push=1; do_workers=0; worker_target="all"
while [ $# -gt 0 ]; do
  case "$1" in
    --workers)
      do_workers=1
      if [ $# -ge 2 ] && [[ "$2" != --* ]]; then worker_target="$2"; shift; fi ;;
    --no-push) do_push=0 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
  shift
done

echo "== verify =="
scripts/check.sh

branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$do_push" -eq 1 ]; then
  echo "== push ($branch) =="
  git push -u origin "$branch"
  if [ "$branch" = "main" ]; then
    echo "✓ pushed to main — GitHub Pages will build (watch the repo Actions tab → 'Deploy Pages')."
  else
    echo "ℹ pushed '$branch'. GitHub Pages deploys from 'main'. To publish:"
    echo "    open a PR and merge,  OR"
    echo "    git checkout main && git merge --ff-only $branch && git push origin main"
  fi
else
  echo "ℹ skipped push (--no-push)"
fi

if [ "$do_workers" -eq 1 ]; then
  echo "== workers =="
  scripts/deploy-workers.sh "$worker_target"
fi
echo "✓ done"
