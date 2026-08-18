#!/usr/bin/env bash
# Phase 0: pull full-fidelity CMS schemas + items from Webflow.
# Idempotent — skips files that already exist. Re-run safely after failures.
set -uo pipefail
SITE=6053f7fca5bf627283b582c2
OUT="$(cd "$(dirname "$0")/.." && pwd)/reference/webflow"
mkdir -p "$OUT/fields" "$OUT/items"

# CLI prints telemetry banners to stdout; keep only from the first JSON token.
wf() { webflow "$@" --json --skip-update-check 2>/dev/null | sed 's/\x1b\[[0-9;]*m//g' | sed -n '/^[[:space:]]*[[{]/,$p'; }

ids=$(python3 -c "
import json;d=json.load(open('$OUT/collections.json'))
print('\n'.join(f\"{c['id']} {c['slug']}\" for c in (d if isinstance(d,list) else d['collections'])))")

while read -r id slug; do
  [ -z "$id" ] && continue
  f="$OUT/fields/$slug.json"
  if [ ! -s "$f" ]; then
    wf cms collections get "$id" > "$f"
    [ -s "$f" ] || { echo "FAIL schema $slug"; rm -f "$f"; }
    sleep 1
  fi

  o="$OUT/items/$slug.json"
  if [ ! -s "$o" ]; then
    offset=0; tmp=$(mktemp -d); page=0
    while :; do
      p="$tmp/$(printf '%03d' $page).json"
      # NOTE: --limit is broken in webflow-cli 2.4.0 (always fails server-side
      # validation), so we rely on the default page size of 100 and page via --offset.
      wf cms items list --collection "$id" --offset "$offset" > "$p"
      n=$(python3 -c "
import json
try:
  d=json.load(open('$p'))
  if isinstance(d,dict) and 'error' in d: print('ERR:'+d['error']['message'][:80]); raise SystemExit
  print(len(d['items'] if isinstance(d,dict) else d))
except SystemExit: raise
except Exception: print(-1)")
      case "$n" in ERR:*) echo "  $slug $n"; rm -f "$p"; break;; esac
      [ "$n" -le 0 ] && rm -f "$p"
      [ "$n" -le 0 ] && break
      page=$((page+1)); offset=$((offset+100))
      [ "$n" -lt 100 ] && break
      sleep 1
    done
    python3 - "$tmp" "$o" <<'PY'
import json,sys,glob,os
tmp,out=sys.argv[1],sys.argv[2]
all_=[]
for p in sorted(glob.glob(os.path.join(tmp,'*.json'))):
    d=json.load(open(p)); all_+= d.get('items',d) if isinstance(d,dict) else d
json.dump(all_,open(out,'w'),indent=1)
print(f'{os.path.basename(out)}: {len(all_)} items')
PY
    rm -rf "$tmp"
  fi
done <<< "$ids"
