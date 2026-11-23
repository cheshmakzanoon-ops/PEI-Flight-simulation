#!/usr/bin/env python3
"""Join exact ordered NRCan building outlines with residential CLUI and tagged house outlines.
No addresses, names, or employee/member identifiers are used. OSM joins remain ODbL.
"""
import gzip,hashlib,json,math,struct,argparse,re
from collections import Counter,defaultdict
from pathlib import Path
import numpy as np
from osgeo import ogr,osr
from scipy.spatial import ConvexHull
ogr.UseExceptions();osr.UseExceptions()
Q=argparse.ArgumentParser(description=__doc__)
Q.add_argument('--root',type=Path,required=True);Q.add_argument('--scratch',type=Path,required=True);opts=Q.parse_args()
root,p=opts.root,opts.scratch
m=6378137*math.pi/180;k=1-.00669437999014*math.sin(math.radians(46.5))**2
scale=np.array([m*math.cos(math.radians(46.5))/math.sqrt(k),-m*(1-.00669437999014)/k**1.5]);origin=np.array([-63.2,46.5])
def fingerprint(b):return hashlib.sha256(b).hexdigest()
def xyproj(code):
 s=osr.SpatialReference();s.ImportFromEPSG(code);s.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);return s
cfg=osr.CoordinateTransformation(xyproj(4326),xyproj(2954))
def boxindex(b,step=300):
 return [(i,j) for i in range(math.floor(b[0]/step),math.floor(b[1]/step)+1) for j in range(math.floor(b[2]/step),math.floor(b[3]/step)+1)]
def area(r):
 r=np.asarray(r)-r[0];x,y=r.T
 return .5*(x@np.roll(y,-1)-y@np.roll(x,-1))
def poly(raw):
 g=ogr.Geometry(ogr.wkbPolygon)
 for loop in raw:
  r=ogr.Geometry(ogr.wkbLinearRing)
  for x,y in loop:r.AddPoint_2D(x,y)
  r.CloseRings();g.AddGeometry(r)
 return g
attrs=[];grid=defaultdict(list)
stamp=json.loads((p/'native-clui/receipt.json').read_text())
for page in stamp['pages']:
 raw=gzip.decompress((p/'native-clui'/page['name']).read_bytes());assert fingerprint(raw)==page['sha256']
 for f in json.loads(raw)['features']:
  rings=sorted(f['geometry']['rings'],key=lambda r:-abs(area(r)))
  if area(rings[0])>=0 or any(area(r)<0 for r in rings[1:]):continue
  G=poly(rings)
  if not G.IsValid():G=G.MakeValid()
  if G.IsEmpty():continue
  row=f['attributes'];attrs.append((G,row))
  for b in boxindex(G.GetEnvelope()):grid[b].append(len(attrs)-1)
print('CLUI full source areas',len(attrs),Counter(v['county'] for G,v in attrs),flush=True)
osmgrid=defaultdict(list);osm=[]
with ogr.Open(str(p/'osm-typed-houses.gpkg')) as d:
 layer=d.GetLayerByIndex(0)
 for v in layer:
  h=v.GetField('building')
  if h not in ('house','detached','semidetached_house','residential'):continue
  F=v.GetGeometryRef()
  if F.GetGeometryCount()!=1 or F.GetGeometryRef(0).GetGeometryCount()!=1:continue
  rings=[np.asarray(F.GetGeometryRef(0).GetGeometryRef(0).GetPoints())[:,:2]]
  ll=rings[0][:-1]
  if not 4<=len(ll)<=28:continue
  G=poly([((ll-origin)*scale).tolist()])
  if not G.IsValid() or not 49<G.GetArea()<570:continue
  way,rel=v.GetField('osm_way_id'),v.GetField('osm_id')
  if bool(way)==bool(rel):continue
  tags=str(v.GetField('other_tags') or '')
  material={}
  for k in ('roof:shape','roof:material','building:material','building:levels','building:colour','roof:colour'):
   vals=re.findall(r'"'+re.escape(k)+r'"=>"([a-zA-Z0-9#._ -]{1,70})"',tags)
   if len(vals)==1:material[k]=vals[0]
  item=dict(osm=('w'+way if way else 'r'+rel),bucket=h,tags=material,outline=ll.round(7).tolist())
  osm.append((G,item))
  for b in boxindex(G.GetEnvelope()):osmgrid[b].append(len(osm)-1)
print('Explicit house polygon tags',len(osm),Counter(v['bucket']for _,v in osm),flush=True)
Rraw=gzip.decompress((root/'public/world/roads.bin.gz').read_bytes())
assert fingerprint(Rraw)==json.loads((root/'public/world/roads.json').read_text())['sha256']
roadway=defaultdict(list);R=[];at=10
for _ in range(struct.unpack_from('>I',Rraw,6)[0]):
 n,f=struct.unpack_from('>HB',Rraw,at);at+=3
 ll=np.frombuffer(Rraw[at:at+8*n],dtype='>u4').astype(float).reshape(-1,2)/1e5+[-65.,45.]
 at+=8*n
 if f&16:continue
 world=(ll-origin)*scale
 for A,B in zip(world,world[1:]):
  if np.linalg.norm(B-A)<.1:continue
  for key in boxindex([min(A[0],B[0])-135,max(A[0],B[0])+135,min(A[1],B[1])-135,max(A[1],B[1])+135]):roadway[key].append(len(R))
  R.append(np.r_[A,B])
R=np.asarray(R)
def nearest(p):
 F=R[roadway[tuple(np.floor(p/300).astype(int))]]
 if not len(F):return (1e9,None)
 a,b=F[:,:2],F[:,2:];d=b-a
 v=a+np.clip(np.sum((p-a)*d,axis=1)/np.sum(d*d,axis=1),0,1)[:,None]*d
 q=np.linalg.norm(v-p,axis=1);j=q.argmin()
 return float(q[j]),v[j].tolist()
def district(p):
 lon,lat=p
 for name,xy,d in [('Summerside',[-63.783,46.402],3300),('Montague',[-62.651,46.169],3400),('Charlottetown',[-63.132,46.257],5800)]:
  if np.linalg.norm((p-np.asarray(xy))*scale)<d:return name
 return 'other'
dir=root/'public/world/buildings';index=json.loads((dir/'index.json').read_text());pack=(dir/'tiles.pack').read_bytes()
assert fingerprint(pack)==index['sha256']
out=[];counts=Counter();positions=defaultdict(list);prepared=[]
for t in index['tiles']:
 a,n=t['offset'],t['bytes']
 ft=json.loads(gzip.decompress(pack[a:a+n]))['features']
 for i,f in enumerate(ft):
  ll=np.asarray(f['footprint']);proj=(ll-origin)*scale;fpoly=poly([proj.tolist()])
  if fpoly.GetArea()<20:continue
  for z in boxindex(fpoly.GetEnvelope()):positions[z].append(len(prepared))
  prepared.append((t['id'],i,f,ll,proj,fpoly))
for n,(tid,i,f,ll,world,G) in enumerate(prepared):
 if not 52<=G.GetArea()<=520 or not 3.25<=f['height']<=14.8 or len(ll)>10 or len(ll)<4 or f.get('holes') or not G.IsValid():continue
 city=district(ll.mean(axis=0))
 key=tuple(np.floor(world.mean(axis=0)/300).astype(int))
 native=np.array(cfg.TransformPoints(ll.tolist()))[:,:2]
 C=poly([native.tolist()]);key2=tuple(np.floor(native.mean(axis=0)/300).astype(int))
 seen=[];gArea=C.GetArea();aArea=G.GetArea()
 for k in grid[key2]:
  A,nm=attrs[k]
  if A.Intersects(C):
   q=A.Intersection(C).GetArea()/gArea
   if q>=.945:seen.append((q,nm))
 overlap=len(seen)==1
 if not overlap and city=='other':continue
 counts['CLUI plan size']+=int(overlap)
 cov,a=seen[0] if overlap else (0,{'objectid':None,'county':'PRINCE' if city=='Summerside' else 'KINGS' if city=='Montague' else 'QUEENS'})
 matches=[]
 for k in osmgrid[key]:
  A,v=osm[k]
  if not A.Intersects(G):continue
  a2=A.GetArea();inter=G.Intersection(A).GetArea()
  if v['bucket']=='residential' and (not overlap or aArea>265):continue
  agree=inter/(aArea+a2-inter)
  shared=min(inter/aArea,inter/a2)
  close=G.Centroid().Distance(A.Centroid())
  # For the sparsely matched Montague patch, reject aggressive geometric shifts
  # but allow a cadastral roof/eave extent difference when centroids agree closely.
  strict=shared>=.73 and agree>=.66
  quasi=city=='Montague' and v['bucket']!='residential' and (overlap or close<1.5) and shared>=.69 and agree>=.572 and close<=2.15
  if not strict and not quasi:continue
  matches.append((agree,v,close,'exact overlap' if strict else 'aligned centre'))
 if len(matches)!=1:continue
 s,matched,centreDiff,matchBasis=matches[0]
 counts['mapped type and source plan']+=1
 near=set(sum((positions[z]for z in boxindex(G.GetEnvelope())),[]))-{n}
 if any(G.Intersects((fN:=prepared[j][-1])) and G.Intersection(fN).GetArea()>.031 for j in near):
  counts['adjacency excluded']+=1;continue
 E=G.GetArea()
 C=world.mean(axis=0)
 hh=ConvexHull(world)
 h=world[hh.vertices];d=np.diff(np.r_[h,h[:1]],axis=0);u=d/np.linalg.norm(d,axis=1)[:,None];v=u[:,::-1]*[-1,1]
 L,W=np.ptp(h@u.T,axis=0),np.ptp(h@v.T,axis=0)
 i2=int(np.argmin(L*W));width,length=float(min(L[i2],W[i2])),float(max(L[i2],W[i2]))
 axis=(u if W[i2]<=L[i2] else v)[i2]
 boxFill=E/(L[i2]*W[i2])
 if not 5.9<=width<=21 or not 7.1<=length<=31 or boxFill<.83 or hh.volume/E>1.074:continue
 road,end=nearest(C)
 if not 6<=road<=131:continue
 city=district(ll.mean(0))
 counts[city]+=1
 out.append(dict(tile=tid,i=i,ctr=ll.mean(0).tolist(),fp=f['footprint'],world=C.tolist(),zone=a['objectid'],county=a['county'],
  coverage=cov,osmMatch=matched,osmIoU=s,osmCenterDelta=centreDiff,mappingBasis=matchBasis,area=E,length=length,width=width,boxFill=boxFill,roadDistance=road,roadPoint=end,axis=axis.tolist(),
  h=f['height'],lo=f['minHeight'],city=city))
print('Conservative house evidence',dict(counts), Counter(r['county']for r in out),flush=True)
unique=Counter(x['osmMatch']['osm']for x in out)
out=[r for r in out if unique[r['osmMatch']['osm']]==1]
print('Unique overlap house plans',len(out), Counter(r['city']for r in out),flush=True)
(p/'candidate-shells.json').write_text(json.dumps(out,separators=(',',':'))+'\n')
