#!/usr/bin/env bash
set -euo pipefail
if [ "$#" != 1 ]; then echo "Usage: bash prepare-source.sh <new scratch directory>" >&2; exit 64; fi
tools=$(cd "$(dirname -- "$0")" && pwd -P)
mkdir -- "$1"
cd -- "$1"
uuid=be99155c-0c4b-40e9-8f50-fb72ffee57b7
base='https://ostr-backend-prod.azure.cloud.nrcan-rncan.gc.ca/server/api/core/bitstreams'
curl -fsS --max-time 30 --max-filesize 10000 "$base/$uuid" -o "$uuid.json"
export PYTHONDONTWRITEBYTECODE=1 PYTHONOPTIMIZE=0
python3 - "$uuid" "$base/$uuid/content" <<'PY'
from pathlib import Path
import json,sys
x=json.loads(Path(sys.argv[1]+'.json').read_bytes())
assert x['name']=='of_8551.zip' and x['sizeBytes']==2420416878
assert x['_links']['content']['href']==sys.argv[2]
PY
curl -fsS --max-time 45 --max-filesize 65536 -D zip-tail.headers -r '2420351342-2420416877' "$base/$uuid/content" -o zip-tail.bin
grep -iq '^content-range: bytes 2420351342-2420416877/2420416878' zip-tail.headers
grep -iq '^etag: "0x8DB570AB981AF92"' zip-tail.headers
python3 "$tools/selective_cancoast.py"
python3 "$tools/three-headlands.py"
