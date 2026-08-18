#!/usr/bin/env bash
# Phase 0: the published sitemap under-reports live pages (8 collections have working
# detail routes absent from it). Probe one live item per collection to establish
# ground truth, and probe known extra endpoints.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
code() { curl -s -o /dev/null -w '%{http_code}' -m 20 "https://www.radixdlt.com$1"; }
python3 - "$ROOT" <<'PY' > "$ROOT/reference/route-probe.tsv"
import json,sys,subprocess
root=sys.argv[1]
cm=json.load(open(f'{root}/reference/collection-map.json'))
for c in cm:
    items=json.load(open(f"{root}/reference/webflow/items/{c['slug']}.json"))
    live=[i for i in items if not i.get('isDraft') and not i.get('isArchived')]
    if not live: print(f"{c['slug']}\tEMPTY\t-\t-"); continue
    s=live[0]['fieldData'].get('slug')
    url=f"/{c['slug']}/{s}"
    r=subprocess.run(['curl','-s','-o','/dev/null','-w','%{http_code}','-m','20',
                      f'https://www.radixdlt.com{url}'],capture_output=True,text=True).stdout.strip()
    print(f"{c['slug']}\t{r}\t{url}\t{len(live)}")
PY
cat "$ROOT/reference/route-probe.tsv"
