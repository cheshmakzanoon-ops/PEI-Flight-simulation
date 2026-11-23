#!/usr/bin/env python3
"""Audit geographic farmyard/footprint overlap with full native rings."""
import gzip,hashlib,json,math,struct,argparse
from collections import Counter,defaultdict
from pathlib import Path
import numpy as np
from osgeo import ogr,osr
from scipy.spatial import ConvexHull
ogr.UseExceptions()
osr.UseExceptions()
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--root',type=Path,default=Path('.'))
parser.add_argument('--scratch',type=Path,required=True)
opts=parser.parse_args()
root,p=opts.root,opts.scratch
src=p/'native-clui'
receipt=json.loads((src/'receipt.json').read_text())
if receipt['where']!="landuse = 'AGR' AND subuse = 'FM'":raise ValueError('Expected provincial farmsteads')
agrid=defaultdict(list)
attrs=[]
def check(raw,sha):assert hashlib.sha256(raw).hexdigest()==sha
def area(r):
    r=np.asarray(r)-r[0]
    x,y=r.T
    return .5*(x@np.roll(y,-1)-y@np.roll(x,-1))
def poly(raw):
    g=ogr.Geometry(ogr.wkbPolygon)
    for loop in raw:
        ring=ogr.Geometry(ogr.wkbLinearRing)
        for x,y in loop: ring.AddPoint_2D(x,y)
        ring.CloseRings()
        g.AddGeometry(ring)
    return g
def xyproj(code):
    s=osr.SpatialReference();s.ImportFromEPSG(code);s.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);return s
fmproj=osr.CoordinateTransformation(xyproj(4326),xyproj(2954))
def boxindex(bounds,step):
    return [(i,j) for i in range(math.floor(bounds[0]/step),math.floor(bounds[1]/step)+1) for j in range(math.floor(bounds[2]/step),math.floor(bounds[3]/step)+1)]
for e in receipt['pages']:
    raw=gzip.decompress((src/e['name']).read_bytes());check(raw,e['sha256'])
    for f in json.loads(raw)['features']:
        meta=f['attributes'];rings=sorted(f['geometry']['rings'],key=lambda r:-abs(area(r)))
        assert area(rings[0])<0 and all(area(r)>0 for r in rings[1:])
        g=poly(rings)
        if not g.IsValid():g=g.MakeValid()
        if g.IsEmpty():continue
        attrs.append((g,meta))
        for key in boxindex(g.GetEnvelope(),500):agrid[key].append(len(attrs)-1)
a=root/'public/world/buildings';idx=json.loads((a/'index.json').read_text());pack=(a/'tiles.pack').read_bytes();check(pack,idx['sha256'])
m=6378137*math.pi/180;f=1-.00669437999014*math.sin(math.radians(46.5))**2
scale=np.array([m*math.cos(math.radians(46.5))/math.sqrt(f),-m*(1-.00669437999014)/f**1.5]);origin=np.array([-63.2,46.5])
roads=gzip.decompress((root/'public/world/roads.bin.gz').read_bytes());assert roads[:6]==b'PEIR\0\1'
check(roads,json.loads((root/'public/world/roads.json').read_text())['sha256'])
rgrid=defaultdict(list);segments=[];at=10
for i in range(struct.unpack_from('>I',roads,6)[0]):
    n,flag=struct.unpack_from('>HB',roads,at);at+=3
    ll=np.frombuffer(roads[at:at+8*n],dtype='>u4').astype(float).reshape(-1,2)/1e5+[-65.,45.]
    at+=8*n
    if flag&16:continue
    scene=(ll-origin)*scale
    for A,B in zip(scene,scene[1:]):
        if np.linalg.norm(B-A)<.1:continue
        seg=np.r_[A,B];segments.append(seg)
        for key in boxindex([min(A[0],B[0])-180,max(A[0],B[0])+180,min(A[1],B[1])-180,max(A[1],B[1])+180],500):rgrid[key].append(len(segments)-1)
assert at==len(roads)
segments=np.array(segments)
allbuilds=[];collection=defaultdict(list)
def closest(pt):
    cand=segments[rgrid[tuple(np.floor(pt/500).astype(int))]]
    if not len(cand):return (1e6,None)
    C,D=cand[:,:2],cand[:,2:];V=D-C
    Q=C+np.clip(np.sum((pt-C)*V,axis=1)/np.sum(V*V,axis=1),0,1)[:,None]*V
    dist=np.linalg.norm(pt-Q,axis=1);j=np.argmin(dist)
    return float(dist[j]),Q[j].tolist()
counts=Counter()
for t in idx['tiles']:
    at,n=t['offset'],t['bytes'];fs=json.loads(gzip.decompress(pack[at:at+n]))['features']
    for i,feat in enumerate(fs):
        ll=np.array(feat['footprint']);G=poly([((ll-origin)*scale).tolist()])
        nearby=dict(tile=t['id'],i=i,ctr=ll.mean(axis=0).tolist())
        for key in boxindex(G.GetEnvelope(),500):collection[key].append(len(allbuilds))
        allbuilds.append((G,nearby))
candidates=[]
for j,(g,e) in enumerate(allbuilds):
    if g.GetArea()<115:continue
    ll=np.asarray(g.GetGeometryRef(0).GetPoints())[:-1,:2]/scale+origin
    xy=np.array(fmproj.TransformPoints(ll.tolist()))[:,:2]
    ctr=(ll.mean(axis=0)-origin)*scale
    key=tuple(np.floor(xy.mean(axis=0)/500).astype(int))
    hits=[]
    native=poly([xy.tolist()])
    for k in agrid[key]:
        F,meta=attrs[k]
        if F.Intersects(native):
            overlap=F.Intersection(native).GetArea()/native.GetArea()
            if overlap>=.95: hits.append((overlap,F,meta))
    if len(hits)!=1:continue
    ov,F,meta=hits[0]
    counts[('covered',meta['county'])]+=1
    if not g.IsValid() or len(ll)>10:continue
    areaM=g.GetArea();h=ConvexHull((ll-origin)*scale)
    hull=h.points[h.vertices];d=np.diff(np.r_[hull,hull[:1]],axis=0)
    norm=d/np.linalg.norm(d,axis=1)[:,None];perp=norm[:,::-1]*[-1,1]
    L,W=np.ptp(hull@norm.T,axis=0),np.ptp(hull@perp.T,axis=0)
    a=np.argmin(L*W);wid,lng=float(min(L[a],W[a])),float(max(L[a],W[a]))
    axis=(norm if W[a]<=L[a] else perp)[a]
    r=float(areaM/(L[a]*W[a]))
    if r<.91 or not(7<=wid<=42 and 17<=lng<=120) or not(140<=areaM<=5500 and (lng/wid>=1.45 or areaM>=335)):continue
    ds,close=closest(ctr)
    if ds>180:continue
    near=set(sum((collection[k] for k in boxindex(g.GetEnvelope(),500)),[]))-{j}
    if any(g.Intersects(allbuilds[k][0]) and g.Intersection(allbuilds[k][0]).GetArea()>.05 for k in near):continue
    counts[('eligible',meta['county'])]+=1
    candidates.append(dict(**e,fp=ll.round(6).tolist(),world=ctr.tolist(),farm=meta['objectid'],county=meta['county'],coverage=float(ov),length=lng,width=wid,area=areaM,boxFill=r,roadDistance=ds, roadPoint=close,axis=axis.tolist()))
# attach exact features, check that grouping by planar input didn't silently discard any holes
features={}
for t in idx['tiles']:
    at,n=t['offset'],t['bytes'];features[t['id']]=json.loads(gzip.decompress(pack[at:at+n]))['features']
out=[]
for c in candidates:
    f=features[c['tile']][c['i']]
    if not 2.9<=f['height']<=17 or f.get('holes'):continue
    c.update(h=f['height'],lo=f.get('minHeight',0))
    counts[('final',c['county'])]+=1
    out.append(c)
print('Farmyards',Counter(a['county']for _,a in attrs), 'covered/eligible/final', dict(counts))
print('farm group counts',Counter(Counter(x['farm'] for x in out).values()))
(p/'candidate-shells.json').write_text(json.dumps(out,separators=(',',':'))+'\n')
