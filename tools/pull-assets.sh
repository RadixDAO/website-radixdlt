#!/usr/bin/env bash
# Phase 0: pull the full Webflow asset manifest (original filenames + hosted URLs).
set -uo pipefail
SITE=6053f7fca5bf627283b582c2
OUT="$(cd "$(dirname "$0")/.." && pwd)/reference/webflow"
tmp=$(mktemp -d); offset=0; page=0
while :; do
  p="$tmp/$(printf '%04d' $page).json"
  webflow assets list -s "$SITE" --offset "$offset" --json --skip-update-check 2>/dev/null \
    | sed 's/\x1b\[[0-9;]*m//g' | sed -n '/^[[:space:]]*[[{]/,$p' > "$p"
  n=$(python3 -c "
import json
try:
  d=json.load(open('$p'))
  if isinstance(d,dict) and 'error' in d: print(-1)
  else: print(len(d['assets'] if isinstance(d,dict) and 'assets' in d else (d['items'] if isinstance(d,dict) and 'items' in d else d)))
except Exception: print(-1)" )
  [ "$n" -le 0 ] && { rm -f "$p"; break; }
  page=$((page+1)); offset=$((offset+100))
  [ "$n" -lt 100 ] && break
done
python3 - "$tmp" "$OUT/assets.json" <<'PY'
import json,sys,glob,os
tmp,out=sys.argv[1],sys.argv[2]; all_=[]
for p in sorted(glob.glob(os.path.join(tmp,'*.json'))):
    d=json.load(open(p))
    all_ += d['assets'] if isinstance(d,dict) and 'assets' in d else (d['items'] if isinstance(d,dict) and 'items' in d else d)
json.dump(all_,open(out,'w'),indent=1); print(f'assets: {len(all_)}')
PY
rm -rf "$tmp"
