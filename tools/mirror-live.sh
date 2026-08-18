#!/usr/bin/env bash
# Phase 0: snapshot every published page. This is BOTH the binding oracle for Phase 3
# and the regression baseline for Phase 5. Idempotent — skips files already fetched.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fetch() {
  url="$1"; path="${url#https://www.radixdlt.com}"; path="${path#/}"
  [ -z "$path" ] && path="index"
  out="$ROOT/reference/live/$path.html"
  [ -s "$out" ] && return 0
  mkdir -p "$(dirname "$out")"
  curl -sS --fail --compressed --retry 3 --retry-delay 2 -m 60 \
       -A 'radixdlt-migration-snapshot' "$url" -o "$out" \
    || { rm -f "$out"; echo "FAIL $url" >> "$ROOT/reference/live-failures.txt"; }
}
export -f fetch; export ROOT
xargs -P 6 -I{} bash -c 'fetch "$@"' _ {} < "$ROOT/reference/live-urls.txt"
echo "mirrored: $(find "$ROOT/reference/live" -name '*.html' | wc -l | tr -d ' ')"
