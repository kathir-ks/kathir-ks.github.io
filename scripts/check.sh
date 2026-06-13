#!/usr/bin/env bash
# Pre-deploy verification for Kathir OS v3.
#
# There is no build step, so this is the closest thing to a gate:
#   1. syntax-check every frontend ES module (node can't --check .js ESM directly,
#      so we copy each to a .mjs first)
#   2. assert the station/position/landmark invariant (index.html ⇄ scene.js ⇄
#      viewmode.js must stay parallel — same count, same ids)
set -euo pipefail
cd "$(dirname "$0")/.."

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "→ syntax-checking ES modules"
fail=0
for f in assets/js/*.js; do
  out="$tmp/$(basename "${f%.js}").mjs"
  cp "$f" "$out"
  if node --check "$out" 2>/dev/null; then
    echo "  ✓ $f"
  else
    echo "  ✗ $f"; node --check "$out" || true; fail=1
  fi
done

echo "→ checking station / position / landmark parity"
node - <<'NODE'
const fs = require("fs");
const html = fs.readFileSync("index.html", "utf8");
const secs = [...html.matchAll(/<section class="station" id="(s-[a-z]+)" data-station>/g)].map((m) => m[1]);
const scene = fs.readFileSync("assets/js/scene.js", "utf8");
const posBlock = (scene.match(/const STATION_POS = \[([\s\S]*?)\];/) || [, ""])[1];
const pos = [...posBlock.matchAll(/new THREE\.Vector3\(/g)].length;
const vm = fs.readFileSync("assets/js/viewmode.js", "utf8");
const labels = [...vm.matchAll(/"(s-[a-z]+)":/g)].map((m) => m[1]);
console.log(`  sections=${secs.length} STATION_POS=${pos} landmarks=${labels.length}`);
const ok = secs.length === pos && pos === labels.length && secs.every((s) => labels.includes(s));
if (!ok) { console.error("  ✗ station invariant mismatch"); process.exit(1); }
console.log("  ✓ invariant holds");
NODE

if [ "$fail" -eq 0 ]; then
  echo "✓ all checks passed"
else
  echo "✗ checks failed"; exit 1
fi
