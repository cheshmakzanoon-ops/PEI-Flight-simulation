#!/usr/bin/env bash
set -euo pipefail
S="$(cd "$(dirname "$0")" && pwd)"
before="${1:?Old matched frames}"
after="${2:?Verified mounted grade frames}"
old_toggles="${3:?Exact stock same-tick shadow controls}"
out="${4:?New receipt dir}"
mkdir -p "$out"
for view in veranda-oblique west-closure harbour-context; do
 python "$S/verify-projected-contact-frames.py" --old "$before/$view.png" --candidate "$after/$view.png" --projection "$after/$view-projected-support.json" --out "$out/$view.json"
done
python "$S/classify-shadow-screen.py" --stock "$old_toggles" --candidate "$after" --out "$out/foreground-shade-classification.json"
python "$S/compare-beaconsfield-grade-rays.py" --old "$old_toggles/results.json" --candidate "$after/results.json" --out "$out/actual-rendered-ground-rays.json" --mode coupled
python - "$before" "$after" "$out" <<'PY'
from pathlib import Path
import json,sys
from PIL import Image
import numpy as np
b,a,o=map(Path,sys.argv[1:])
names=['veranda-oblique','west-closure','harbour-context']
orig=json.loads((b/'results.json').read_text())
new=json.loads((a/'results.json').read_text())
assert len(orig)==len(new)==3
k='beaconsfield-measured-frontage-grade'
results=[]
for r,t in zip(orig,new,strict=True):
    n=r['name'];assert n==t['name'] and n in names
    assert r['diag']['baseH']==t['diag']['baseH'] and r['diag']['eyeY']==t['diag']['eyeY']
    assert r['diag']['buildingTiles']==t['diag']['buildingTiles']
    assert t['diag']['beaconsfieldReview'] and r['diag']['beaconsfieldReview']
    assert t['diag']['drawCalls']-r['diag']['drawCalls']==1
    assert k not in r['diag']['localGroundGrades'] and k in t['diag']['localGroundGrades']
    assert not r['errors'] and not t['errors']
    q=json.loads((o/(n+'.json')).read_text())
    assert q['changedOver2Outside']==0 and q['outerMaxDelta']==0,(n,q)
    assert q['changedOver2']>100,(n,q)
    clean=lambda d:{k:v for k,v in d.items() if k not in ['outerFirstExamples']}
    results.append(dict(name=n,oldSHA=r['fileSha256'],newSHA=t['fileSha256'],camera=t['pose'],
             scope=clean(q),streaming=t['diag']['buildingTiles'],adjacentDrawDelta=t['diag']['drawCalls']-r['diag']['drawCalls'],
             triangleDelta=t['diag']['triangles']-r['diag']['triangles']))
x0,y0,x1,y1=67,428,265,535
old=np.asarray(Image.open(b/'veranda-oblique.png').convert('RGB'),dtype=np.int16)[y0:y1,x0:x1]
updated=np.asarray(Image.open(a/'veranda-oblique.png').convert('RGB'),dtype=np.int16)[y0:y1,x0:x1]
light=(updated-old).min(axis=2)
nearEdge=dict(crop=[x0,y0,x1,y1],brightAllChannelsOver10=int((light>10).sum()),brightAllChannelsOver24=int((light>24).sum()))
assert nearEdge['brightAllChannelsOver24']==0,nearEdge
note=dict(scope='Three matched actual Three.js WebGL2 frames with local streamed buildings fully resident and exact old/new camera. Render scope is a conservative projection from actual submitted ground and canopy receiver geometry and a two-pixel antialias allowance. Software renderer, not a hardware benchmark.',
  frames=results,preregisteredPunctureCheck=nearEdge,
  actualGroundRayChecks=json.loads((o/'actual-rendered-ground-rays.json').read_text()))
(o/'independent-frames.json').write_text(json.dumps(note,indent=2)+'\n')
PY
