#!/usr/bin/env python3
"""Held-out 1 m native DSM-supported roof partitions for six exact Water Street atlas shells."""
import argparse,gzip,hashlib,json,math,runpy
from collections import Counter
from pathlib import Path
import numpy as np
from osgeo import ogr,osr
ogr.UseExceptions();osr.UseExceptions()
P=argparse.ArgumentParser(description=__doc__)
P.add_argument('--root',required=True,type=Path)
P.add_argument('--source',required=True,type=Path)
D=P.parse_args();R=D.root;S=D.source
X=runpy.run_path(str(R/'tools/geodata/fit-farm-profiles.py'))
DATA=np.load(S/'water-street-dsm-dtm.npz')
O=np.array([float(DATA['X']),float(DATA['Y'])])
source=json.loads((S/'water-street-source-audit.json').read_text())
f=[r for r in source if r['id'] in (108,132,137,172,267,326)]
proj=X['Tback']()
scale,origin=X['scale'],X['origin'];to_world=lambda ll:(np.asarray(ll)[:,:2]-origin)*scale
TILE='q032001'
PREC=1e-5
conf={
 108:dict(role='mixed masonry',type=0),
 132:dict(role='historic commercial masonry',type=0),
 137:dict(role='mixed low shop fronts',type=1),
 172:dict(role='registered rounded masonry and annex',type=0),
 267:dict(role='service and office masonry',type=2),
 326:dict(role='registered utilitarian vault wing',type=3),
}
# Exact OSM Water Street centreline, used only for facing/spacing, not
# replacing the existing road map.
road_source=ogr.Open(str(S/'water-street-roads.gpkg'))
road_way={}
for e in road_source.GetLayer(0):
    g=e.GetGeometryRef()
    if g is not None and g.GetGeometryName()=='LINESTRING':
        road_way[e.GetField('osm_id')]=np.asarray(g.GetPoints())[:,:2]
road=[to_world(q) for q in road_way.values()]
axes=np.array([.984,.178]),np.array([-.178,.984])
street_input=ogr.Open(str(S/'water-street-osm.gpkg'))
osm={}
for e in street_input.GetLayer(0):
    id=e.GetField('osm_way_id') or e.GetField('osm_id')
    g=e.GetGeometryRef().Clone()
    def gather(g):
        if g.GetGeometryName()=='POLYGON':
            return [np.asarray(g.GetGeometryRef(0).GetPoints())[:-1,:2]]
        return [r for i in range(g.GetGeometryCount()) for r in gather(g.GetGeometryRef(i))]
    osm[id]=gather(g)

TM=json.loads((R/'public/world/terrain.json').read_text())
H=np.frombuffer(gzip.decompress((R/'public/world/height.bin.gz').read_bytes()),'<i2').reshape(TM['height'],TM['width'])
bounds=to_world([[TM['bounds'][0],TM['bounds'][3]],[TM['bounds'][2],TM['bounds'][1]]])
atlas=json.loads((R/'public/world/buildings/index.json').read_text())['sha256']

def sha(b):return hashlib.sha256(b).hexdigest()
def gz(b):return gzip.compress(b,mtime=0,compresslevel=9)
def source_ground(world):
    i,j=(world-bounds[0])/(bounds[1]-bounds[0])*[TM['width'],TM['height']]-.5
    x,y=int(i),int(j);u,v=i-x,j-y
    weights=(np.array([[1-v],[v]])*np.array([[1-u,u]]))
    a=H[y:y+2,x:x+2]
    return np.sum(np.where(a!=-32768,a,0)*weights)/np.sum(weights*(a!=-32768))+.05

def poly(points):
    o=ogr.Geometry(ogr.wkbLinearRing)
    for x,z in points:o.AddPoint_2D(float(x),float(z))
    o.CloseRings();g=ogr.Geometry(ogr.wkbPolygon);g.AddGeometry(o)
    return g

def line(points):
    o=ogr.Geometry(ogr.wkbLineString)
    for x,z in points:o.AddPoint_2D(float(x),float(z))
    return o

def polys(g):
    if g is None or g.IsEmpty():return
    if g.GetGeometryName()=='POLYGON':
        if g.GetArea()>1e-6:yield g
    else:
        for i in range(g.GetGeometryCount()):yield from polys(g.GetGeometryRef(i))

def lines(g):
    if g is None or g.IsEmpty():return
    if g.GetGeometryName()=='LINESTRING':
        p=np.asarray(g.GetPoints())[:,:2]
        for a,b in zip(p,p[1:]):
            if np.linalg.norm(a-b)>.008:yield a,b
    elif g.GetGeometryName() in ('GEOMETRYCOLLECTION','MULTILINESTRING'):
        for i in range(g.GetGeometryCount()):yield from lines(g.GetGeometryRef(i))

def rings(g):
    return [[[[round(x,5),round(z,5)] for x,z,*_ in q.GetGeometryRef(i).GetPoints()[:-1]] for i in range(q.GetGeometryCount())] for q in polys(g)]

def err(e):
    v=np.abs(e)
    return dict(p50=round(float(np.quantile(v,.5)),5),p90=round(float(np.quantile(v,.9)),5),
        p95=round(float(np.quantile(v,.95)),5),count=len(v))

def loss(e):
    v=np.abs(e)
    return .48*np.quantile(v,.5)+.52*np.quantile(v,.90)

def location(r):
    x0,z0,x1,z1=r['bounds']
    xx,yy=np.meshgrid(np.arange(x0,x1),np.arange(z0,z1))
    a,b=xx-int(DATA['rasterU']),yy-int(DATA['rasterV'])
    Z=DATA['dsm'][b,a];G=DATA['dtm'][b,a]
    xx=O[0]+a;yy=O[1]-b
    carry,margin=X['mask_unit'](np.asarray(r['survey']),xx,yy)
    valid=carry&(margin>=1.12)&np.isfinite(Z)&np.isfinite(G)&(Z-G>1.15)&(Z-G<38)
    cells=np.c_[xx[valid],yy[valid]]
    return cells,to_world(proj.TransformPoints(cells.tolist())),Z[valid].astype(float)

def model(p,z):
    # Unconstrained tiny slopes on almost planar source segments create
    # false roof tilt. A plane must be materially supported by the sample.
    a=np.c_[np.ones(len(p)),p]
    med=float(np.median(z));e=loss(z-med)
    par,pe=X['gfit'](a,z,1)
    if par is not None and .017<np.linalg.norm(par[1:])<.44 and e-loss(pe)>.07:
        return par
    return np.array([med,0.,0.])

def height(p,coef):
    return coef[0]+np.asarray(p)@coef[1:]

def split_space(g,n,h):
    d=np.array([-n[1],n[0]]);c=n*h
    a,b=c-d*400,c+d*400
    return (g.Intersection(poly([a,b,b-800*n,a-800*n])).SetPrecision(PREC),
            g.Intersection(poly([a,b,b+800*n,a+800*n])).SetPrecision(PREC))

def model_tree(p,z,g,angles,split_lines,depth=0):
    a=model(p,z);base=loss(z-height(p,a))
    if depth>=3 or len(z)<110 or base<.38:return dict(area=g,beta=a)
    bound=max(38,min(125,len(z)//9))
    candidates=[]
    for n in angles:
        x=p@n
        at=np.quantile(x,np.linspace(.14,.86,15))
        d=np.array([h for n2,h in split_lines if abs(n2@n)>.995])
        if d.size:at=np.r_[at,d]
        for h in sorted(set(round(float(d),2) for d in at)):
            m=x<=h
            if min(m.sum(),(~m).sum())<bound:continue
            med_lo=np.median(z[m]);med_hi=np.median(z[~m])
            if abs(med_lo-med_hi)<.32:continue
            bounds=model(p[m],z[m]);up=model(p[~m],z[~m])
            pred=np.where(m,height(p,bounds),height(p,up))
            score=loss(z-pred)+.095
            if score<base*.77 and score<base-.24:
                candidates.append((score,n,h,m,pred))
    for score,n,h,m,pred in sorted(candidates,key=lambda c:c[0]):
        u,v=split_space(g,n,h)
        if min(u.GetArea(),v.GetArea())<31.:continue
        return dict(n=n,h=h,children=(model_tree(p[m],z[m],u,angles,split_lines,depth+1),
          model_tree(p[~m],z[~m],v,angles,split_lines,depth+1)))
    return dict(area=g,beta=a)

def leaves(tree):
    if 'area' in tree:return [tree]
    return [l for child in tree['children'] for l in leaves(child)]

def guess(tree,p):
    if 'beta' in tree:return height(p,tree['beta'])
    n,h=tree['n'],tree['h'];a,b=tree['children']
    return np.where(p@n<=h,guess(a,p),guess(b,p))

def closest(a,b,p):
    c=b-a
    f=np.clip((p-a)@c/(c@c),0,1)
    return a+c*f

def frontage(a,b,anchor,flip):
    p=(a+b)/2+anchor
    q=min([closest(ra,rb,p)for r in road for ra,rb in zip(r,r[1:]) if np.linalg.norm(rb-ra)>.05],key=lambda q: np.linalg.norm(q-p))
    delta=q-p;sr=np.linalg.norm(delta)
    e=b-a;l=np.linalg.norm(e)
    n=np.array([e[1],-e[0]])/l*flip
    # Recesses only on the public-facing elevation near the street axis.
    return bool(1.15<sr<23.5 and n@delta/sr>.52 and l>3.25)

def unbox(ids,anchor):
    out=[]
    for a in ids:
        for p in osm.get(a,[]):
            q=to_world(p)-anchor
            out.append((a,q,poly(q).SetPrecision(PREC)))
    return out

def frontage_spans(a,b,parts):
    e=b-a;L=np.linalg.norm(e);u=e/L;n=np.array([-u[1],u[0]])
    if L<9:return [a,b]
    breaks=[0.]
    stations=[]
    for _,p,_ in parts:
        proj=(p-a)@u
        on=(np.abs((p-a)@n)<2.15)&(proj>3.3)&(proj<L-3.3)
        stations.extend(proj[on].tolist())
    for d in sorted(stations):
        if d-breaks[-1]>3.3:breaks.append(d)
    breaks.append(L)
    return [a+u*d for d in breaks]

def front_identity(r,point,parts,n):
    if r==326:return 3
    candidates=[]
    for id,q,g in parts:
        pt=ogr.Geometry(ogr.wkbPoint);pt.AddPoint_2D(float(point[0]),float(point[1]))
        gdist=g.Distance(pt)
        candidates.append((gdist,id))
    if candidates:
        v,id=sorted(candidates)[0]
        if v<3.7 and id=='1390507939':return 4 # documented rounded historic brick
        if v<3.7 and id=='749553417':return 5 # modern 2006 addition
        if v<3.7 and id=='1323446922':return 3 # utilitarian brick vault
        if v<2.3 and id=='749554529':return 6 # compact historic bank
        if v<3.7 and id in ('1220592173','1220592178','1220592177'):return 1
    return n

def border_segments(tree,a,b):
    if 'area' in tree:
        yield a,b,tree['beta']
        return
    n,h=tree['n'],tree['h']
    da,db=a@n-h,b@n-h
    if min(da,db)>=0:
        yield from border_segments(tree['children'][1],a,b)
    elif max(da,db)<=0:
        yield from border_segments(tree['children'][0],a,b)
    else:
        c=a+(b-a)*(da/(da-db))
        side=int(da>0)
        yield from border_segments(tree['children'][side],a,c)
        yield from border_segments(tree['children'][1-side],c,b)

def ring_segments(a):
    for poly in polys(a):
        for i in range(poly.GetGeometryCount()):
            r=np.asarray(poly.GetGeometryRef(i).GetPoints())[:-1,:2]
            for p,q in zip(r,np.roll(r,-1,axis=0)):
                if np.linalg.norm(p-q)>.008:yield p,q


def common_segments(a,b):
    # A canonical split is shared geometrically. Independent GEOS rounding
    # can put a partial edge 5-10 microns off its longer neighbor; taking
    # exact polygon-boundary intersection then loses a real closing face.
    # Project intervals at a stricter-than-Float32 coordinate tolerance.
    seen=set()
    for u,v in ring_segments(a):
        d=v-u;L=np.linalg.norm(d);w=d/L
        for p,q in ring_segments(b):
            h=q-p;K=np.linalg.norm(h);V=h/K
            if abs(w@V)<.99999:continue
            U,W,I,J=(u,v,p,q) if L>=K else (p,q,u,v)
            B=W-U;M=np.linalg.norm(B);E=B/M
            e=np.array([-E[1],E[0]])
            if max(abs((I-U)@e),abs((J-U)@e))>3.2e-5:continue
            lo,hi=sorted(((I-U)@E,(J-U)@E))
            lo,hi=max(0.,lo),min(M,hi)
            if hi-lo<.008:continue
            q0,q1=U+lo*E,U+hi*E
            key=tuple(sorted([tuple(np.round(q0,4)),tuple(np.round(q1,4))]))
            if key in seen:continue
            seen.add(key);yield q0,q1

def output(r,tree,world,anchor,srcparts,basis):
    ls=leaves(tree);exterior=poly(world).SetPrecision(PREC)
    ring=(np.round(world/PREC)*PREC).tolist()
    # Original normalized rings are clockwise in XZ for most members.
    w=np.asarray(ring);area=np.sum(w[:,0]*np.roll(w,-1,axis=0)[:,1]-np.roll(w,-1,axis=0)[:,0]*w[:,1])
    ringdir=1 if area>0 else -1
    walls=[];roofs=[];steps=[]
    for i,l in enumerate(ls):
        g,v=l['area'],l['beta']
        roofs.append(dict(p=rings(g),y=np.round(v,7).tolist()))
        if i==0:
            for j,(a,b) in enumerate(zip(w,np.roll(w,-1,axis=0))):
                if np.linalg.norm(b-a)<.025:continue
                for p,q,beta in border_segments(tree,a,b):
                    if ringdir<0:p,q=q,p
                    whole_front=frontage(p,q,anchor,1)
                    spans=frontage_spans(p,q,srcparts) if whole_front else [p,q]
                    for u,v0 in zip(spans,spans[1:]):
                        p2,q2=np.round(u,5).tolist(),np.round(v0,5).tolist()
                        if p2==q2:continue
                        fac=front_identity(r['id'],(u+v0)/2,srcparts,conf[r['id']]['type'])
                        front=whole_front and fac!=3
                        walls.append([p2,q2,round(float(height(u,beta)),5),round(float(height(v0,beta)),5),fac,int(front)])
        for j in range(i):
            p=ls[j]
            for c,d in common_segments(g,p['area']):
                x=height(np.array([c,d]),p['beta']);y=height(np.array([c,d]),v)
                da,db=x-y
                if np.max(np.abs(x-y))<.012:continue
                if da*db<0:
                    t=da/(da-db);s=c+(d-c)*t
                    cross=(x[0]+(x[1]-x[0])*t+y[0]+(y[1]-y[0])*t)*.5
                    repl=[(c,s,[x[0],cross],[y[0],cross]),(s,d,[cross,x[1]],[cross,y[1]])]
                else:repl=[(c,d,x,y)]
                for e,f,X,Y in repl:
                    if np.linalg.norm(e-f)<.008:continue
                    steps.append([np.round(e,5).tolist(),np.round(f,5).tolist(),np.round(X,5).tolist(),np.round(Y,5).tolist()])
    # OGR exact plan union check: unlike a raster shell, all distributed leaves inherit this exact outer ring.
    g=ls[0]['area'].Clone()
    for l in ls[1:]:g=g.Union(l['area'])
    total=sum(l['area'].GetArea() for l in ls)
    assert g.IsValid() and abs(total-exterior.GetArea())<.02
    assert abs(total-g.GetArea())<.02
    faces_length=sum(np.linalg.norm(np.asarray(v[0])-np.asarray(v[1])) for v in walls)
    assert abs(faces_length-exterior.Boundary().Length())<.025,(r['id'],faces_length,exterior.Boundary().Length())
    return dict(i=r['id'],source=r['outline'],originXZ=anchor.tolist(),floorGround=round(float(basis),4),
                roofs=roofs,walls=walls,steps=steps)

models=[];reports=[];heldout=[];sources={}
for r in f:
    a=r['id'];x,to,z=location(r)
    world=to_world(r['outline'])
    anchor=np.rint(world.mean(axis=0));world-=anchor;to-=anchor
    region=poly(world).SetPrecision(PREC)
    fold=(np.floor_divide(x[:,0],3).astype(int)*19+np.floor_divide(x[:,1],3).astype(int)*7)%5
    keep=(fold==0);coords=to[~keep];values=z[~keep]
    n1,n2=axes;angles=[n1/np.linalg.norm(n1),n2/np.linalg.norm(n2)]
    d=np.roll(world,-1,axis=0)-world;maj=d[np.argmax(np.linalg.norm(d,axis=1))]
    angles.extend([maj/np.linalg.norm(maj),np.array([-maj[1],maj[0]])/np.linalg.norm(maj)])
    support=[id for match,inside,kind,id,tags in r['osm'] if inside>.50 and match>.027]
    srcparts=unbox(support,anchor)
    split=[]
    for id,g,_ in srcparts:
        sources[id]=dict(type=next(o[2]for o in r['osm']if o[3]==id),rings=[p.tolist()for p in osm[id]])
        d=np.roll(g,-1,axis=0)-g
        for c,uv in zip(g,d):
            L=np.linalg.norm(uv)
            if L<4.5:continue
            n=np.array([-uv[1],uv[0]])/L
            for N in angles:
                if abs(N@n)>.995:split.append((N,float(c@N)))
    old_ground=source_ground(anchor+world.mean(axis=0))
    # Fitted model uses absolute CGVD2013 roof heights. Its walls still
    # start on the existing terrain, not an invented site regrade.
    t=model_tree(coords,values,region,angles,split)
    p=guess(t,to[keep])
    oldroof=X['sample_old'](to[keep],world,dict(h=r['height'],lo=r['minHeight']))
    old=err(old_ground+oldroof-z[keep]);new=err(p-z[keep])
    v=dict(id=a,old=old,candidate=new,training=len(coords),roofAreas=[round(l['area'].GetArea(),4)for l in leaves(t)],
      sampleDigest=r['sha'],accepted=(old['p90']-new['p90']>.52 and new['p90']<1.85))
    print(v,flush=True);reports.append(v)
    if not v['accepted']:continue
    # Freeze a genuinely blind, spatially blocked fit for output as well.
    model_out=output(r,t,world,anchor,srcparts,old_ground)
    models.append(model_out)
    heldout.append([a,[[int(a-.5),int(b-.5),round(float(c),4)]for (a,b),c in zip(x[keep],z[keep])]])
assert len(models)>=4
pack={'atlasSha256':atlas,'tile':TILE,'shells':models}
out=R/'src/render/water-street.generated.ts'
blob=json.dumps(pack,separators=(',',':'))
out.write_text('// Generated by tools/geodata/bake-water-street-split.py from pinned native evidence.\n'
              +'export const WATER_STREET_PLAN='+blob+' as const;\n')
(R/'data/water-street').mkdir(exist_ok=True);d=R/'data/water-street'
(d/'roof-audit.json').write_text(json.dumps(dict(schema=1,modelSha256=sha(blob.encode()),
     rasterWindowSha256=sha((S/'water-street-dsm-dtm.npz').read_bytes()),gates=reports),
    indent=2)+'\n')
(d/'native-blind-cells.json.gz').write_bytes(gz(json.dumps(heldout,separators=(',',':')).encode()))
source=(R/'data/odbl/water-street');source.mkdir(parents=True,exist_ok=True)
(source/'building-part-support.json.gz').write_bytes(gz(json.dumps(dict(parts=sources,referenceRoads=[dict(id=k,coordinates=v.tolist())for k,v in road_way.items()]),separators=(',',':')).encode()))
