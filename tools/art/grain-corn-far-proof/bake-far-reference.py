"""Capture native original geometry for angular pages, unseen views and motion truth."""
import argparse
from pathlib import Path
import json, sys

import numpy as np

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parent/"grain-corn-atlas"))
from atlas_gpu import digest, driver, open_capture

p=argparse.ArgumentParser(description=__doc__)
p.add_argument("mode",choices=("source","holdout","moving"))
p.add_argument("output",type=Path)
a=p.parse_args()
if a.output.exists():
    p.error("output exists")
lock=json.loads((HERE/"dense-low-angle-prelock.json").read_bytes())
moving=json.loads((HERE/"dense-moving-prelock.json").read_bytes())
J=json.load(sys.stdin); frame=J["frame"]
assert frame==[256,256]

if a.mode=="moving":
    angles=[]
    for _ in moving["spans"]:
        for s in moving["sweeps"]:
            for i in range(moving["framesPerSweep"]):
                q=i/(moving["framesPerSweep"]-1)
                angles.append(tuple(d[0]*(1-q)+d[1]*q for d in (s["az"],s["elev"])))
elif a.mode=="source":
    angles=[(360*i/lock["yawCount"], e) for e in lock["elevations"] for i in range(lock["yawCount"])]
else:
    angles=lock["holdout"]
expected=[(f"variant-{v}",e,az,5.2) for v in range(lock["wholeClusterVariants"]) for az,e in angles]
capture=open_capture(J,expected)
a.output.mkdir()
rows=[]
for i,c in enumerate(J["cams"]):
    img=capture(c);assert np.array_equal(img,capture(c))
    alpha=img[:,:,3]
    assert set(map(int,np.unique(alpha))).issubset({0,64,128,191,255})
    assert (img[:,:,:3]<=alpha[:,:,None]).all()
    y,x=np.where(alpha>0)
    border=int(min(x.min(),y.min(),255-x.max(),255-y.max()))
    assert border>=8
    if a.mode=="moving":
        raw=img.tobytes()
        (a.output/f"truth-{i:03d}.rgba").write_bytes(raw)
        rows.append(dict(i=i,sha256=digest(raw),pose={k:c[k]for k in ("variant","elevation","az","placement")}))
        continue
    dims=(256,32,16) if a.mode=="holdout" else (32,16,8,4)
    outputs=[]
    for n in dims:
        h=256//n
        tex=np.rint(img.astype(np.float64).reshape(n,h,n,h,4).mean((1,3))).astype("u1")
        raw=tex.tobytes(); name=f"angle-{i:03d}-{n:03d}.rgba"
        (a.output/name).write_bytes(raw)
        outputs.append(dict(name=name,sha=digest(raw),length=len(raw)))
    rows.append(dict(id=i,pose={v:c[v]for v in ("variant","elevation","az")},
                     borderPx=border,coverage=int(len(y)),outputs=outputs))
data={"scope":"Detached actual original 4x, no physics, placement or scenery", "driver":driver,"nativeSamples":4,
      ("rows" if a.mode=="moving" else "pages"):rows}
(a.output/"receipt.json").write_text(json.dumps(data,indent=2)+"\n")
