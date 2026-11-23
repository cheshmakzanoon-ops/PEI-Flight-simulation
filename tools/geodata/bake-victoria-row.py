#!/usr/bin/env python3
"""Compose the exact Victoria Row envelope from a scoped OSM/NRCan source witness.

Run with Debian GDAL Python: --source <prepared-row-dir> --root <checkout>.
Only the small independently attributed 15-way ODbL subset, roof planes and
observed geometry flow to the game; no photos or map tiles are used.
"""
import argparse, gzip, json, math, runpy
from pathlib import Path
import numpy as np
from osgeo import ogr
ogr.UseExceptions()
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--source',type=Path,required=True)
p.add_argument('--root',type=Path,required=True)
p.add_argument('--verify',action='store_true')
o=p.parse_args();root=o.root;sd=o.source
h=runpy.run_path(str(root/'tools/geodata/fit-farm-profiles.py'))
index=json.loads((root/'public/world/buildings/index.json').read_text())
source=json.loads((root/'data/odbl/victoria-row/building-part-witness.json').read_text())
tile='q12000111';ordinal=3
T=next(t for t in index['tiles'] if t['id']==tile)
with (root/'public/world/buildings/tiles.pack').open('rb') as f:
    f.seek(T['offset'])
    nr=json.loads(gzip.decompress(f.read(T['bytes'])))['features'][ordinal]
D=np.load(sd/'victoria-native-window.npz')
receipt=json.loads((sd/'native-receipt.json').read_text())
assert h['fprint'](D['dsm'],D['dtm'])==receipt['sample_sha']
to_world=lambda p:(np.asarray(p)[:,:2]-h['origin'])*h['scale']
outer=to_world(nr['footprint']);origin=outer.mean(axis=0)
road=to_world(source['streetPortion']['points'])-origin
a,b=road[0],road[-1]
along=(b-a)/np.linalg.norm(b-a);across=np.array([-along[1],along[0]])
PREC=1e-5
# The palette slots are original design families. They do not assert
# modern ownership/tenancy or exact address boundaries or facade materials.
fronts=['204923042','204923048','204923047','204923051','204923049',
        '204923045','204923039','204923041','204923043']
rear=['204923037','204923044','204923046','204923050','250365775','250365778']
keys=set(fronts+rear)
assert keys=={f['id'] for f in source['partWays']}
parts={f['id']:f for f in source['partWays']}

def polygon(points):
    rs=[]
    for pp in points:
        r=ogr.Geometry(ogr.wkbLinearRing)
        for x,z in pp:r.AddPoint_2D(float(x),float(z))
        r.CloseRings();rs.append(r)
    g=ogr.Geometry(ogr.wkbPolygon)
    for r in rs:g.AddGeometry(r)
    return g
def point(p):
    g=ogr.Geometry(ogr.wkbPoint);g.AddPoint_2D(float(p[0]),float(p[1]));return g
def pieces(g):
    if g is None or g.IsEmpty():return
    if g.GetGeometryName()=='POLYGON':
        if g.GetArea()>1e-7:yield g
    else:
        for i in range(g.GetGeometryCount()):yield from pieces(g.GetGeometryRef(i))
def component_rings(g):
    return [[np.asarray(p.GetGeometryRef(i).GetPoints())[:-1,:2] for i in range(p.GetGeometryCount())] for p in pieces(g)]
def render_rings(g):
    return [[np.around(q,6).tolist() for q in poly] for poly in component_rings(g)]
def segs(g):
    for poly in component_rings(g):
        for r in poly:
            for a,b in zip(r,np.roll(r,-1,axis=0)):
                if np.linalg.norm(b-a)>.00004:yield a,b

def overlap(U,W,I,J,tol=3.3e-5):
    d=W-U;L=np.linalg.norm(d);u=d/L;n=np.array([-u[1],u[0]])
    if max(abs((I-U)@n),abs((J-U)@n))>tol:return
    lo,hi=sorted(((I-U)@u,(J-U)@u));lo,hi=max(0.,lo),min(hi,L)
    if hi-lo>=.00007:return lo,hi,u
def matching(g0,g1):
    seen=set()
    for u,v in segs(g0):
        for p,q in segs(g1):
            U,W,I,J=(u,v,p,q) if np.sum((v-u)**2)>=np.sum((q-p)**2) else (p,q,u,v)
            t=overlap(U,W,I,J)
            if t is None:continue
            l,r,e=t;c,d=U+l*e,U+r*e
            k=tuple(sorted([tuple(np.round(c,4)),tuple(np.round(d,4))]))
            if k not in seen:seen.add(k);yield c,d

w=np.around((outer-origin)/PREC)*PREC
outer_area=polygon([w]).SetPrecision(PREC)
raw={k:outer_area.Intersection(polygon([to_world(r)-origin for r in f['rings']])).SetPrecision(PREC) for k,f in parts.items()}
assigned={};r=outer_area.Clone()
for k in sorted(keys):
    g=r.Intersection(raw[k]).SetPrecision(PREC)
    assert g.GetArea()>110
    assigned[k]=g;r=r.Difference(g).SetPrecision(PREC)
raw_gap=r.GetArea()
# Source outlines slightly disagree. Close only the narrow residual inside
# the NRCan shell by local monotonically expanding adjacency. Every fallback
# roof height comes from cells measured in the owned spatial region.
for radius in (.16,.32,.49,.68,.88,1.10,1.35,1.65,2.,2.45,2.95,3.6,4.4,5.25,6.5):
    if r.IsEmpty():break
    for k in sorted(keys,key=lambda k: (fronts.index(k) if k in fronts else rear.index(k)+9),reverse=round(radius*100)%2==1):
        if r.IsEmpty():break
        dd=r.Intersection(raw[k].Buffer(radius,2)).SetPrecision(PREC)
        if dd.GetArea()>1e-7:
            assigned[k]=assigned[k].Union(dd).SetPrecision(PREC)
            r=r.Difference(dd).SetPrecision(PREC)
    tail=r.GetArea()
    if tail<.00002:break
# Any residual is assigned whole as a tiny sliver to its nearest input part.
for q in list(pieces(r)):
    c=q.PointOnSurface();k=min(keys,key=lambda k:raw[k].Distance(c))
    assigned[k]=assigned[k].Union(q).SetPrecision(PREC)
coverage=sum(g.GetArea() for g in assigned.values())
assert abs(coverage-outer_area.GetArea())<.002,(coverage,outer_area.GetArea())
E,N=np.meshgrid(D['X']+np.arange(D['dsm'].shape[1]),D['Y']-np.arange(D['dsm'].shape[0]))
native=np.c_[E.ravel(),N.ravel()]
v=to_world(h['Tback']().TransformPoints(native.tolist()))-origin
z=D['dsm'].ravel().astype(float);g=D['dtm'].ravel().astype(float);delta=z-g
valid=np.isfinite(z)&np.isfinite(g)&(g>-200)&(delta>1.6)&(delta<32)
block=np.floor_divide(native,3).astype(np.int64)
hold=(block[:,0]*13+block[:,1]*7+3)%5==0

def mask(g):
    m=np.zeros(len(v),dtype=bool)
    for poly in component_rings(g):
        a,j=h['mask_unit'](poly[0],v[:,0],v[:,1])
        for ring in poly[1:]:a &= ~h['mask_unit'](ring,v[:,0],v[:,1])[0]
        m |= a
    return m
whole,margin=h['mask_unit'](w,v[:,0],v[:,1])
guard=whole&(margin>=1.05)&valid
M=json.loads((root/'public/world/terrain.json').read_text())
H=np.frombuffer(gzip.decompress((root/'public/world/height.bin.gz').read_bytes()),'<i2').reshape(M['height'],M['width'])
G=to_world([[M['bounds'][0],M['bounds'][3]],[M['bounds'][2],M['bounds'][1]]])
i,j=(origin-G[0])/(G[1]-G[0])*[M['width'],M['height']]-.5
x,y=math.floor(i),math.floor(j);u,f=i-x,j-y;a0=H[y:y+2,x:x+2]
W=np.array([[1-f],[f]])*np.array([[1-u,u]])
oldRoof=float((a0*W).sum()/W.sum()+.05+nr['height'])
def err(dx):
    a=np.abs(dx)
    return dict(n=len(a),p50=round(float(np.quantile(a,.5)),4),p90=round(float(np.quantile(a,.9)),4),p95=round(float(np.quantile(a,.95)),4))
def height(p,beta):return beta[0]+np.asarray(p)@beta[1:]
def loss(a):
    e=np.abs(a)
    return .64*np.quantile(e,.50)+.36*np.quantile(e,.90)
def model(p,z):
    floor=np.array([float(np.median(z)),0.,0.])
    coeff,pe=h['gfit'](np.c_[np.ones(len(p)),p],z,4)
    if coeff is not None and .014<np.linalg.norm(coeff[1:])<.36 and loss(z-floor[0])-loss(pe)>.054:
        return coeff
    return floor
def halves(g,n,at):
    d=np.array([-n[1],n[0]]);c=n*at
    a,b=c-d*250,c+d*250
    return tuple(g.Intersection(polygon([[a,b,b+side*500*n,a+side*500*n]])).SetPrecision(PREC) for side in (-1,1))
def fitted(g,P,Z,depth=0):
    p=model(P,Z);e=loss(Z-height(P,p))
    if depth>=2 or len(Z)<72 or e<.32:return [(g,p)]
    options=[]
    for u in (along,across,
       along*math.cos(.17)+across*math.sin(.17),across*math.cos(.17)-along*math.sin(.17),
       along*math.cos(.17)-across*math.sin(.17),across*math.cos(.17)+along*math.sin(.17)):
        r=P@u
        for c in np.quantile(r,np.linspace(.18,.82,14)):
            s=r<=c
            if min(s.sum(),(~s).sum())<max(21,min(45,len(Z)//6)):continue
            # Prefer meaningful persistent level changes to exaggerated shelves
            # following a handful of roof catches or attic obstructions.
            if abs(np.median(Z[s])-np.median(Z[~s]))<.35:continue
            ua,ub=model(P[s],Z[s]),model(P[~s],Z[~s])
            score=loss(Z-np.where(s,height(P,ua),height(P,ub)))+.085
            if score<e*.76 and score<e-.21:options.append((score,u,c,s))
    for score,u,c,s in sorted(options,key=lambda q:q[0])[:8]:
        lo,hi=halves(g,u,c)
        if min(lo.GetArea(),hi.GetArea())<16:continue
        if not all(len(list(pieces(h))) for h in (lo,hi)):continue
        return fitted(lo,P[s],Z[s],depth+1)+fitted(hi,P[~s],Z[~s],depth+1)
    return [(g,p)]
leaves=[];zone={};seen=np.zeros(len(v),dtype=int);newY=np.full(len(v),np.nan)
for k,g in assigned.items():
    kMask=mask(g)
    seen+=kMask.astype(int);supported=guard&kMask
    fit=supported&~hold
    blind=supported&hold
    assert fit.sum()>25 and blind.sum()>5
    R=fitted(g,v[fit],z[fit])
    for q,beta in R:
        # Bound plane extrapolation at the perimeter to coherent evidence from
        # this part; clipped top rings are still in absolute CGVD2013.
        P=np.array([p for pp in component_rings(q) for ring in pp for p in ring])
        iz=height(P,beta)
        if np.ptp(iz)>1.65+np.ptp(z[fit]) or min(iz)<10. or max(iz)>27.5:
            s=fit&mask(q);beta=np.array([np.median(z[s if s.any() else fit]),0.,0.])
        inside=mask(q)&kMask
        newY[inside]=height(v[inside],beta)
        leaves.append((q,beta,k))
    assert np.isfinite(newY[blind]).all()
    zone[k]=dict(front=(fronts.index(k)+1 if k in fronts else 0),
        leaves=len(R),area=round(g.GetArea(),4),old=err(z[blind]-oldRoof),new=err(z[blind]-newY[blind]))
assert np.max(seen[guard])==1 and np.min(seen[guard])==1
blind=hold&guard
assert np.isfinite(newY[blind]).all()
steps=[]
for i,(g,beta,k) in enumerate(leaves):
    for q,other,k0 in leaves[:i]:
        for a0,b0 in matching(g,q):
            if np.linalg.norm(b0-a0)<.00007:continue
            points=np.array([a0,b0]);p=height(points,beta);r=height(points,other)
            d,e=p-r
            if max(abs(d),abs(e))<.012:continue
            if d*e<0:
                u=d/(d-e);m=a0+(b0-a0)*u;y=float(height(m,beta))
                build=((a0,m,[p[0],y],[r[0],y]),(m,b0,[y,p[1]],[y,r[1]]))
            else:build=((a0,b0,p,r),)
            for a1,b1,p,r in build:
                if np.linalg.norm(b1-a1)>.000055:
                    steps.append([np.round(a1,6).tolist(),np.round(b1,6).tolist(),
                       np.round(p,5).tolist(),np.round(r,5).tolist()])
walls=[]
signed=.5*np.sum(w[:,0]*np.roll(w,-1,axis=0)[:,1]-w[:,1]*np.roll(w,-1,axis=0)[:,0])
if signed<0:w=w[::-1]
wall_edges=0
for a0,b0 in zip(w,np.roll(w,-1,axis=0)):
    u=(b0-a0);L=np.linalg.norm(u);u/=L;n=np.array([-u[1],u[0]])
    edge_selector=[];endpoints={0.,L}
    for i,(g,beta,k) in enumerate(leaves):
        for c,d in segs(g):
            x=overlap(a0,b0,c,d)
            if x is not None:
                l,r,_=x;edge_selector.append((l,r,i));endpoints.update([l,r])
    f=sorted(endpoints)
    batches=[]
    for l,r in zip(f,f[1:]):
        if r-l<.00002:continue
        m=(l+r)/2
        step=point(a0+u*m+.00030*n)
        idx=[i for x,y,i in edge_selector if x-.00025<=m<=y+.00025]
        if not idx:idx=list(range(len(leaves)))
        i=min(idx,key=lambda i:leaves[i][0].Distance(step))
        if batches and i==batches[-1][2]:batches[-1]=(batches[-1][0],r,i)
        else:batches.append((l,r,i))
    active=[]
    for l,r,i in batches:
        g,beta,k=leaves[i]
        A,B=(a0+u*l),(a0+u*r)
        front=bool(k in fronts and ((A+B)/2-a)@across<15.0 and n@across>.45)
        sty=fronts.index(k)+1 if k in fronts else 0
        if front and r-l>.025:wall_edges+=1
        active.append([np.round(A,6).tolist(),np.round(B,6).tolist(),round(float(height(A,beta)),5),
            round(float(height(B,beta)),5),sty,int(front)])
    walls.extend(active)
assert wall_edges>=9,wall_edges
output=dict(atlasSha256=index['sha256'],tile=tile,ordinal=ordinal,source=nr['footprint'],
   originXZ=origin.round(11).tolist(),roofs=[dict(p=render_rings(g),y=beta.round(8).tolist(),variant=(fronts.index(k)+1 if k in fronts else 0)) for g,beta,k in leaves],
   walls=walls,steps=steps)
full=dict(rawGap=round(raw_gap,5),unassignedAfterDirectedApproach=round(tail,5),guardedCells=int(guard.sum()),
    oldRoof=round(oldRoof,5),traditionalFrontWalls=wall_edges,area=round(coverage,5),leaves=len(leaves),wallSegments=len(walls),
    stepSegments=len(steps),old=err(z[blind]-oldRoof),new=err(z[blind]-newY[blind]),parts=zone,receipt=receipt)
paths={
 root/'src/render/victoria-row.generated.ts':'// Generated by tools/geodata/bake-victoria-row.py; do not hand edit.\nexport const VICTORIA_ROW='+json.dumps(output,separators=(',',':'))+' as const;\n',
 root/'data/victoria-row/native-validation.json':json.dumps(full,indent=2)+'\n'}
for dest,content in paths.items():
    if o.verify:assert dest.read_text()==content,dest
    else:dest.write_text(content)
W=np.c_[native[blind],v[blind]+origin,z[blind],newY[blind]]
np.savetxt(sd/'victoria-heldout-points.csv',W,delimiter=',',fmt='%.10f',header='epsg3979_e,epsg3979_n,world_x,world_z,native_y,fitted_y',comments='')
print(json.dumps(full,indent=2))
