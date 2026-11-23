#!/usr/bin/env python3
"""Calculate connected, water-qualified deck footprints from the pinned lines.

Widths are nominal visual modeling dimensions, never carried on OSM records.
No network, imagery, maritime collision, ramp, bathymetry or berth data.
"""
import gzip
import hashlib
import itertools
import json
import math
from pathlib import Path
import zlib

import numpy as np
from osgeo import ogr
ogr.UseExceptions()
ROOT=Path(__file__).resolve().parents[2]
WORLD=ROOT/'public/world'
SOURCE=ROOT/'data/odbl/quartermaster/docks.json'
source=json.loads(SOURCE.read_text())
spec=json.loads((ROOT/'src/sim/quartermaster.generated.ts').read_text().split(' = ',1)[1].split(' as const',1)[0])
cover=json.loads((WORLD/'cover.json').read_text())
x0,z0,x1,z1=spec['boundsXZ'];nx,nz=spec['width'],spec['height']
if cover['compressedSha256']!=spec['pinCoverSha256']:raise ValueError('The pinned cover pair changed')
xb,yb=spec['cellMetres']
raw=gzip.decompress((WORLD/spec['asset']).read_bytes())
coarse_serial=(WORLD/cover['file']).read_bytes()
if hashlib.sha256(coarse_serial).hexdigest()!=spec['pinCoverSha256']:raise ValueError('Unexpected province Cover bytes')
coarse=gzip.decompress(coarse_serial)
if hashlib.sha256(raw).hexdigest()!=spec['sha256']:raise ValueError('Unexpected coast inset')
base=np.frombuffer(coarse,'u1').reshape(cover['height'],cover['width'],2)[:,:,1]
mask=np.frombuffer(raw,'u1').reshape(nz,nx,2)
west,south,east,north=cover['bounds'];rad=math.pi/180;e2=6.69437999014e-3;f=1-e2*math.sin(46.5*rad)**2
mx=6378137*rad*math.cos(46.5*rad)/math.sqrt(f);mz=6378137*(1-e2)*rad/f**1.5
origin=np.array([5973.,29830.])
def project(ll):
    return (np.asarray(ll)-[-63.2,46.5])*[mx,-mz]-origin
def pack(b):
    return hashlib.sha256(b).hexdigest()
def interp(data,x,y):
    i,j=np.floor(x).astype(int),np.floor(y).astype(int);u,v=x-i,y-j
    return (1-v)*((1-u)*data[j,i]+u*data[j,i+1])+v*((1-u)*data[j+1,i]+u*data[j+1,i+1])
def water(pts):
    x,z=(np.asarray(pts)+origin).T
    u=(x/mx-63.2-west)/(east-west)*cover['width']-.5
    v=(north-(46.5-z/mz))/(north-south)*cover['height']-.5
    old=2*(interp(base,u,v)-128)
    a,b=(x-x0)/xb,(z-z0)/yb
    if not (np.all(a>=0) and np.all(a<nx-1) and np.all(b>=0) and np.all(b<nz-1)):
        raise ValueError('Pier candidate is outside the pinned local cover inset')
    refined=.25*(interp(mask[:,:,0],a,b)-128);w=interp(mask[:,:,1],a,b)/255
    return old+w*(np.minimum(old,refined)-old)
def polygon(verts):
    g=ogr.Geometry(ogr.wkbLinearRing)
    for x,z in verts:g.AddPoint_2D(float(x),float(z))
    g.CloseRings()
    p=ogr.Geometry(ogr.wkbPolygon);p.AddGeometry(g);return p
def point(p):
    v=ogr.Geometry(ogr.wkbPoint);v.AddPoint_2D(*p);return v
def polygons(g):
    if not g or g.IsEmpty():return
    if g.GetGeometryName()=='POLYGON':
        if g.GetArea()>.0005:yield g
    else:
        for i in range(g.GetGeometryCount()):yield from polygons(g.GetGeometryRef(i))
def coords(g):
    out=[]
    for i in range(g.GetGeometryCount()):
        ring=g.GetGeometryRef(i).GetPoints()[:-1]
        # Skip sub-millimetric holes left when the exact adjacent input edges
        # are rounded by GEOS. Do not round twice inside the polygon overlay.
        if i>0 and polygon([(x,z) for x,z,*_ in ring]).GetArea()<.0005:continue
        out.append([[round(x,3),round(z,3)] for x,z,*_ in ring])
    return out
def box(a,b,n,r):
    return polygon([a+n*r,a-n*r,b-n*r,b+n*r])

W={'spine':1.8,'finger':.92}
# Full-width tests plus a 10 cm lateral design margin; retain a minimum 24
# cm of signed-water clearance even at low-contact classification.
def qualify(line,kind):
    r=W[kind]/2;portion=[]
    for serial,(a,b) in enumerate(zip(line[:-1],line[1:],strict=True)):
        dist=float(np.linalg.norm(b-a))
        if dist<.15:continue
        v=(b-a)/dist;n=np.array([-v[1],v[0]])
        count=max(2,math.ceil(dist/.12)+1);samples=np.linspace(0.,1.,count)
        offsets=np.linspace(-r-.10,r+.10,7)
        rows=a+samples[:,None]*(b-a);probes=(rows[:,None,:]+offsets[None,:,None]*n).reshape(-1,2)
        safe=(water(probes).reshape(count,len(offsets))<-.24).all(1)
        for val,group in itertools.groupby(range(count),key=lambda i:bool(safe[i])):
            ids=list(group)
            if not val or len(ids)<2:continue
            i,j=ids[0],ids[-1];span=(samples[j]-samples[i])*dist
            if span<.42:continue
            start=rows[i];end=rows[j]
            portion.append(dict(g=box(start,end,n,r),a=start,b=end,axis=v,span=span,serial=serial,full=(0==i,count-1==j)))
    return portion
def connect(part,level):
    """At source joints, cover microscopic geometric gaps without lengthening either axis.
    No cap can extend a cut at the water margin."""
    if level!='spine':return part
    out=part.copy()
    for a,b in zip(part[:-1],part[1:],strict=True):
        if b['serial']!=a['serial']+1 or not a['full'][1] or not b['full'][0] or np.linalg.norm(a['b']-b['a'])>.0001:continue
        c=a['b'];r=W[level]/2
        # Only the radius of the existing widths at a verified original joint.
        fo=np.linspace(0,2*math.pi,32,endpoint=False)
        probe=c+np.column_stack((np.cos(fo),np.sin(fo)))*(r+.10)
        if np.max(water(probe))<-.24:
            # Bevel a surveyed change of bearing with the four existing side
            # endpoints. A circular cap wastes triangles inside flat decks and
            # protrudes a fraction of the width into otherwise empty space.
            u,v=a['axis'],b['axis']
            n,m=np.array([-u[1],u[0]])*r,np.array([-v[1],v[0]])*r
            join=polygon([c+n,c+m,c-n,c-m]).ConvexHull()
            if join.GetGeometryName()=='POLYGON' and join.GetArea()>.0001:
                out.append(dict(g=join,a=c,b=c,axis=a['axis'],span=0))
    return out

def chain_steps(parts):
    clusters=[]
    for piece in parts:
        g=piece['g']
        hits=[(i,q) for i,q in enumerate(clusters) if q['geom'].Distance(g)<.025]
        if not hits:
            clusters.append(dict(geom=g,parts=[piece],length=piece['span']))
            continue
        q=dict(geom=g,parts=[piece],length=piece['span'])
        for _,a in hits:q['geom']=q['geom'].Union(a['geom']);q['parts']+=a['parts'];q['length']+=a['length']
        clusters=[a for i,a in enumerate(clusters) if i not in {i for i,_ in hits}]+[q]
    return clusters

top=[];statistics=[];hull=None;spine_decks={}
for w in source['ways']:
    line=project(w['coordinates']);role=w['role']
    pieces=connect(qualify(line,role),role)
    candidates=chain_steps(pieces)
    if role=='spine':
        if not candidates:raise ValueError('Expected supported portions of all three main docks')
        selected=[max(candidates,key=lambda q:q['length'])]
        spine_decks[w['id']]=selected[0]['geom'].Clone()
    else:
        at=w['junctions'][0][1];junction=w['junctions'][0][0]
        parent=spine_decks.get(junction)
        if not parent or parent.Distance(point(line[at]))>.015:continue
        selected=[q for q in candidates if q['geom'].Intersection(parent).GetArea()>.024]
        if not selected:continue
    kept=sum(q['length'] for q in selected);total=float(np.linalg.norm(np.diff(line,axis=0),axis=1).sum())
    statistics.append(dict(id=w['id'],role=role,sourceM=round(total,3),qualifiedM=round(kept,3)))
    for group in selected:
        for v in group['parts']:
            g=v['g'];remaining=g if hull is None else g.Difference(hull)
            for shape in polygons(remaining.SetPrecision(.001)):
                top.append([w['id'],coords(shape),[round(float(a),8) for a in v['axis']],[round(float(a),3) for a in v['a']]])
            hull=g.Clone() if hull is None else hull.Union(g)
if not hull or not hull.IsValid():raise ValueError('Expected a valid, shared outer hull')
snapped=hull.SetPrecision(.001)
if not snapped.IsValid():raise ValueError('Pier polygons do not survive millimetre quantization')
hull_data=[coords(o)for o in polygons(snapped)]
payload=dict(schema=1,id='quartermaster-floating-docks-v1',coastSha256=spec['sha256'],originXZ=origin.tolist(),
             authoredNominalWidthM=W,lossyGeometryRoundM=.001,deckFaces=top,hull=hull_data,renderedWays=statistics)
data=(json.dumps(payload,separators=(',',':'))+'\n').encode()
blob=bytearray(gzip.compress(data,compresslevel=9,mtime=0));blob[9]=255
asset='harbour/odbl/v1/quartermaster-docks.json.gz';(WORLD/asset).write_bytes(blob)
m=dict(asset=asset,decodedBytes=len(data),compressedBytes=len(blob),crc32=f'{zlib.crc32(data):08x}',sha256=pack(data),
       geometrySha256=pack(SOURCE.read_bytes()),coastSha256=spec['sha256'],topPatches=len(top),
       hullComponents=len(hull_data),acceptedSpines=sum(w['role']=='spine' for w in statistics),
       acceptedFingers=sum(w['role']=='finger' for w in statistics),planAreaM2=round(snapped.GetArea(),3))
(ROOT/'src/render/quartermaster-docks.generated.ts').write_text('// Generated by tools/terrain/bake-quartermaster-docks.py.\nexport const QUARTERMASTER_DOCKS = '
    +json.dumps(m,indent=2)+' as const;\n')
print(json.dumps(m,indent=2))
print(json.dumps(statistics,indent=2))
