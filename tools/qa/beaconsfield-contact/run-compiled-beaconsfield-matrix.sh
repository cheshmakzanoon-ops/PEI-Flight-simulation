#!/usr/bin/env bash
set -euo pipefail
S="$(cd "$(dirname "$0")" && pwd)"
dist="${1:?Pass the isolated verified build dist dir}"
out="${2:?Pass a fresh artifact directory}"
browser="${3:?Chose the approved Chromium executable}"
grade=beaconsfield-measured-frontage-grade
file=beaconsfield-contact-v1.bin.gz
mkdir -p "$out"
run() {
 local mode="$1"; shift
 python "$S/beaconsfield-pilot.py" --dist "$dist" --out "$out/$mode" --chromium "$browser" --grade-file "$file" "$@"
}
run coupled --grade-request-count 1 --expected-grade "$grade" --site harbour --site street
run old-preview --grade-request-count 0 --forbid-grade "$grade" --query 'beaconsfieldReview&stockBeaconsfieldGrade' --site harbour
run missing --grade-request-count 1 --forbid-grade "$grade" --grade-fault missing --site harbour
run corrupt --grade-request-count 1 --forbid-grade "$grade" --grade-fault corrupt --site harbour
run under-budget --grade-request-count 0 --forbid-grade "$grade" --emulated-fragment-samplers 15 --site harbour
run ordinary --grade-request-count 0 --forbid-grade "$grade" --query '' --no-expect-art --site harbour
python - "$out" <<'PY'
import json
from pathlib import Path
import sys
o=Path(sys.argv[1])
labels=['coupled','old-preview','missing','corrupt','under-budget','ordinary']
id='beaconsfield-measured-frontage-grade'
data={k:json.loads((o/k/'player.json').read_text()) for k in labels}
for k,d in data.items():
    assert len(d)==(2 if k=='coupled' else 1),k
    for p in d.values():
        assert p['art']==(k!='ordinary'),(k,p)
        assert p['artRequests']==int(k!='ordinary'),p
        assert p['gradeRequests']==int(k in ['coupled','missing','corrupt']),p
        assert (id in p['grades'])==(k=='coupled'),p
        assert p['distanceM']>85 and p['targetDistanceM']<160 and p['groundClearanceM']>55,p
        assert p['buildingPaths']==['/world/buildings/index.json','/world/buildings/tiles.pack'],p
        assert p['emulatedFragmentSamplerCapacity']==(15 if k=='under-budget' else None),p
        assert p['controls']==['Cockpit','Pause'] and not p['errors'],p
(o/'player.json').write_text(json.dumps({'scope':'Actual compiled application at project-relative URL; two isolated QA route records are not published departures.', 'cases':data},indent=2)+'\n')
PY
