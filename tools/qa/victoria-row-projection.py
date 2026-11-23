#!/usr/bin/env python3
"""GEOS roof projection and physical closure of visible roof transitions."""
import argparse,json,math
from pathlib import Path
import numpy as np
from osgeo import ogr
ogr.UseExceptions()
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('plan',type=Path)
p.add_argument('actual',type=Path)
p.add_argument('--out',type=Path)
args=p.parse_args()
plan=json.loads(args.plan.read_text().split('VICTORIA_ROW=')[1].split(' as const;')[0])
mesh=json.loads(args.actual.read_text())
origin=np.asarray(plan['originXZ'])
m=6378137*math.pi/180;f=1-.00669437999014*math.sin(math.radians(46.5))**2
scale=np.array([m*math.cos(math.radians(46.5))/math.sqrt(f),-m*(1-.00669437999014)/f**1.5])
outer=(np.asarray(plan['source'])-[-63.2,46.5])*scale-origin
def poly(r):
    rr=ogr.Geometry(ogr.wkbLinearRing)
    for a,b in r:rr.AddPoint_2D(a,b)
    rr.CloseRings()
    o=ogr.Geometry(ogr.wkbPolygon);o.AddGeometry(rr)
    return o
envelope=poly(outer)
ss=[]
for tr in mesh['roof']:
    pts=np.array(tr)[:,[0,2]]-origin
    g=poly(pts)
    if g.GetArea()>1e-10:ss.append(g)
rg=ogr.Geometry(ogr.wkbMultiPolygon)
for g in ss:rg.AddGeometry(g)
u=rg.UnionCascaded()
coverage=dict(area=envelope.GetArea(),triangleArea=sum(g.GetArea() for g in ss),union=u.GetArea(),
    gap=envelope.Difference(u).GetArea(),spill=u.Difference(envelope).GetArea())
coverage['overlap']=coverage['triangleArea']-coverage['union']
assert max(coverage[k] for k in ('gap','spill','overlap'))<.003,coverage
def edges(r):
    r=np.asarray(r)
    for a,b in zip(r,np.roll(r,-1,axis=0)):
        if np.linalg.norm(b-a)>.00004:yield a,b
planes=[(np.asarray(q['y']),list(e for pg in q['p'] for rr in pg for e in edges(rr)))for q in plan['roofs']]
def dist(a,b,p):
    d=b-a
    if (d@d)<1e-14:return 10000.
    t=np.clip((p-a)@d/(d@d),0.,1.)
    return float(np.linalg.norm(p-a-d*t))
def y(beta,r):return float(beta[0]+r@beta[1:])
wv=np.asarray(mesh['walls']);wv[:,:,[0,2]]-=origin
# Each wall triangle lies on a vertical strip. Project onto the longest
# xz side of that triangle; use barycentric containment in the strip plane.
A=wv[:,0,:];B=wv[:,1,:];C=wv[:,2,:]
ends=np.array([a[[0,2]] for a in A])
ab=(B-A)[:,[0,2]];ac=(C-A)[:,[0,2]]
dirs=np.where((np.linalg.norm(ab,axis=1)>np.linalg.norm(ac,axis=1))[:,None],ab,ac)
ln=np.maximum(1e-12,np.linalg.norm(dirs,axis=1));dirs=dirs/ln[:,None]
norm=np.c_[-dirs[:,1],dirs[:,0]]
b1=np.einsum('ij,ij->i',ab,dirs);b2=(B-A)[:,1]
c1=np.einsum('ij,ij->i',ac,dirs);c2=(C-A)[:,1]
det=b1*c2-b2*c1
def closed(p,level):
    xp=p-ends
    x=np.einsum('ij,ij->i',xp,dirs)
    delta=(level-A[:,1])
    valid=(abs(np.einsum('ij,ij->i',xp,norm))<.000085)&(abs(det)>1e-9)
    u=np.divide(x*c2-delta*c1,det,out=np.zeros_like(det),where=valid)
    v=np.divide(b1*delta-b2*x,det,out=np.zeros_like(det),where=valid)
    return bool(np.any(valid&(u>=-.001)&(v>=-.001)&(u+v<=1.001)))
checks=0;missing=[];pairs=0
for i,(beta,segs) in enumerate(planes):
    for other,near in planes[:i]:
        for a,b in segs:
            n=max(1,math.ceil(np.linalg.norm(b-a)/.28))
            for t in (.5+np.arange(n))/n:
                v=a+(b-a)*t
                if not any(dist(c,d,v)<.000062 for c,d in near):continue
                lo,hi=sorted((y(beta,v),y(other,v)))
                if hi-lo<.06:continue
                pairs+=1
                for level in (lo+.20*(hi-lo),(lo+hi)*.5,lo+.80*(hi-lo)):
                    checks+=1
                    if not closed(v,level):missing.append((v.tolist(),lo,hi))
report=dict(plan=coverage,sharedRoofStations=pairs,closingTriangleSamples=checks,missing=missing[:18],missingCount=len(missing))
print(json.dumps(report,indent=2))
if args.out:args.out.write_text(json.dumps(report,indent=2)+'\n')
assert not missing,missing[:4]
