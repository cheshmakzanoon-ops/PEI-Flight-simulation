#!/usr/bin/env python3
"""Inspect the actual Float32 projection and both ends of each parapet face."""
import argparse,json,math
from pathlib import Path
import numpy as np
from osgeo import ogr
ogr.UseExceptions()
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('actual',type=Path)
p.add_argument('--out',type=Path)
a=p.parse_args()
d=json.loads(a.actual.read_text())
origin=np.asarray(d['outline'][0])
def poly(r):
    rr=ogr.Geometry(ogr.wkbLinearRing)
    for x,z in r:rr.AddPoint_2D(x,z)
    rr.CloseRings()
    g=ogr.Geometry(ogr.wkbPolygon);g.AddGeometry(rr)
    return g
envelope=poly(np.asarray(d['outline'])-origin)
multi=ogr.Geometry(ogr.wkbMultiPolygon);area=0.
for tri in d['roof']+d['parapetCaps']:
    g=poly(np.asarray(tri)[:,[0,2]]-origin)
    assert g.GetArea()>1e-6
    multi.AddGeometry(g);area+=g.GetArea()
u=multi.UnionCascaded()
stats=dict(outline=envelope.GetArea(),union=u.GetArea(),gap=envelope.Difference(u).GetArea(),
    spill=u.Difference(envelope).GetArea(),overlap=area-u.GetArea())
assert max(stats[k] for k in ('gap','spill','overlap'))<.002,stats
# Each emitted cap shares one edge with the lower roof via a gutter/parapet
# riser. Cast section samples at both junctions through actual role 43 faces.
face=np.asarray(d['parapetFaces'])
delta=face[:,1:,:]-face[:,:1,:]
norm=np.cross(delta[:,0,:],delta[:,1,:])
norm/=np.linalg.norm(norm,axis=1)[:,None]
def lies(q):
    v=q-face[:,0,:]
    plane=np.abs(np.einsum('ij,ij->i',v,norm))<.0001
    if not plane.any():return False
    f=face[plane];D=delta[plane]
    for i,t in enumerate(f):
        e,b=np.linalg.lstsq(D[i].T,q-t[0],rcond=None)[0]
        if min(e,b)>=-.00017 and e+b<=1.00017:return True
    return False
roof=np.asarray(d['roof']).reshape(-1,3)
isInner=lambda q:bool(np.min(np.linalg.norm(roof[:,[0,2]]-q[[0,2]],axis=1))<.0001)
floor=lambda q:roof[np.argmin(np.linalg.norm(roof[:,[0,2]]-q[[0,2]],axis=1)),1]
probes=0
for r in np.asarray(d['parapetCaps']):
 for v,w in zip(r,np.roll(r,-1,axis=0)):
    if not (isInner(v) and isInner(w)):continue
    n=max(2,math.ceil(np.linalg.norm((v-w)[[0,2]])/.2))
    for k in (.5+np.arange(n))/n:
        q=v+(w-v)*k;y=(1-k)*floor(v)+k*floor(w)
        for t in (.20,.50,.80):
            check=q.copy();check[1]=y+(q[1]-y)*t
            assert lies(check),check
            probes+=1
assert probes>400
report=dict(planSquareMetres=stats,closingInnerParapetSamples=probes)
print(json.dumps(report,indent=2))
if a.out:a.out.write_text(json.dumps(report,indent=2)+'\n')
