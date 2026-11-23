#!/usr/bin/env python3
"""Check projected union and each discontinuous physical wall in the actual Float32 render."""
import argparse,json,math
from pathlib import Path
import numpy as np
from osgeo import ogr
ogr.UseExceptions()

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--model',type=Path,default=Path(__file__).resolve().parents[2]/'src/render/montague-macdonald.generated.ts')
p.add_argument('actual',type=Path)
p.add_argument('--out',type=Path)
a=p.parse_args()
m=json.loads(a.model.read_text().split('MONTAGUE_MACDONALD=')[1].split(' as const;')[0])
origin=np.asarray(m['originXZ']);d=json.loads(a.actual.read_text())
def poly(points):
    rr=ogr.Geometry(ogr.wkbLinearRing)
    for x,z in points:rr.AddPoint_2D(x,z)
    rr.CloseRings()
    g=ogr.Geometry(ogr.wkbPolygon);g.AddGeometry(rr)
    return g
src=poly(np.asarray(d['outline'])-origin)
g=ogr.Geometry(ogr.wkbMultiPolygon);area=0.
for q in d['roof']:
    f=poly(np.asarray(q)[:,[0,2]]-origin)
    assert f.GetArea()>1e-8
    g.AddGeometry(f);area+=f.GetArea()
u=g.UnionCascaded()
stats=dict(outline=src.GetArea(),union=u.GetArea(),gap=src.Difference(u).GetArea(),
           spill=u.Difference(src).GetArea(),overlap=max(0.,area-u.GetArea()))
assert max(stats[k] for k in ('gap','spill','overlap'))<.002,stats

walls=np.asarray(d['walls'])
walls[:,:,[0,2]]-=origin
D=walls[:,1:,:]-walls[:,:1,:]
norm=np.cross(D[:,0,:],D[:,1,:]);mag=np.linalg.norm(norm,axis=1)
good=mag>1e-8;walls=walls[good];D=D[good];norm=norm[good]/mag[good,None]
def lies(q):
    V=q-walls[:,0,:]
    for j in np.where(np.abs(np.einsum('ij,ij->i',V,norm))<.00016)[0]:
        al,be=np.linalg.lstsq(D[j].T,V[j],rcond=None)[0]
        if min(al,be)>=-.00025 and al+be<=1.00025:return True
    return False
profiles=0;hits=0
for A,B,C,E in np.asarray(m['steps']):
    n=max(1,math.ceil(np.linalg.norm((A-B)[:2])/.125))
    for t in (.5+np.arange(n))/n:
        hi=A+(B-A)*t;low=C+(E-C)*t
        if abs(hi[2]-low[2])<.003:continue
        profiles+=1
        for k in (.10,.30,.50,.7,.9):
            q=hi+(low-hi)*k
            assert lies(q[[0,2,1]]),(q,k)
            hits+=1
out=dict(projectedPlanSquareMetres=stats,shoulderStations=profiles,
         interiorStepSamples=hits,threeRoofTriangles=len(d['roof']))
print(json.dumps(out,indent=2))
if a.out:a.out.write_text(json.dumps(out,indent=2)+'\n')
