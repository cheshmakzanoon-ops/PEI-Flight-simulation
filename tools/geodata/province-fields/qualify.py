"""Offline geographic qualification for the optional field optics.

Bake native source-backed candidate masks, measure actual stock N112 geometric slopes,
then compare fixed-size halo atlas layouts. Do not redistribute intermediate source geometry.
"""
import json, math, struct, gzip, hashlib, time, os, itertools
from pathlib import Path
from collections import defaultdict, Counter
from osgeo import gdal,ogr,osr
import numpy as np
from scipy.ndimage import binary_erosion,distance_transform_edt,binary_dilation
from matplotlib.path import Path as Poly
gdal.UseExceptions();ogr.UseExceptions();osr.UseExceptions()
D=Path(os.environ['PEI_RECON']);P=Path(os.environ['PEI_WORLD'])
WITNESSES=Path(os.environ.get('PEI_THREE_WITNESSES','.'))
J=lambda p:json.loads(Path(p).read_text())
MET=J(WITNESSES/'actual-stock.json');PIN=MET['pins'];COL,ROW=MET['dims'];N=MET['n'];AX=np.array(MET['axes']['x']);AZ=np.array(MET['axes']['z'])
WID,DEP=MET['tileMetres'];OR=np.array(MET['originXZ'])
HS=np.memmap(WITNESSES/'actual-n112.f32',mode='r',dtype='<f4',shape=(ROW,COL,N+1,N+1))
GT=np.array([WID,DEP]);AEB=J(P/'buildings/index.json');AEBB=(P/'buildings/tiles.pack').read_bytes()
sha=lambda b:hashlib.sha256(b).hexdigest()
assert sha(AEBB)==PIN['aeb']
FIELD=(D/'supported-fields.json').read_bytes();F=json.loads(FIELD)['fields'];assert len(F)==2880
# Authoritative current simulator transform. A second eccentricity formula here
# previously moved real field centroids tens to hundreds of metres.
PP=MET['projection'];scale=np.asarray(PP['scale'],'f8');O=np.asarray(PP['origin'],'f8')
assert O.tolist()==[-63.2,46.5] and scale[0]>0>scale[1] and len(PP['points'])>=9
project=lambda ll:(np.asarray(ll)-O)*scale
lonlat=lambda x:np.asarray(x)/scale+O
for v in PP['points']:
 ref=np.array([v['x'],v['z']]);assert np.max(abs(project(v['ll'])-ref))<1.e-8
 assert np.max(abs(lonlat(ref)-v['ll']))<1.e-12
for nm,check in {'supported-fields.json':'200edddf56e9a6ada5c890c6ac952e967eaf57fe507dd0e8aa59982047e72e83',
 'aci_2025_pe_v1.tif':'d8538b2d567490fa66b9864cb5bb66cff45b6c8cadc654ceb191f49d04d5bd79',
 'aci_2025_pe_confidence_v1.tif':'9a44fffc81e511526dfae1f94d417c38f173ff7e38ba8767f887bcab31bb1258',
 'pe-fields-2023.gpkg':'29008797e85fd50d8a7ca8b0a796161ce49b0af4a0a2761ff70bb651cff85602'}.items():
 assert sha((D/nm).read_bytes())==check,nm
# A linear-filtered 4m texel is positive up to 4m from its centre in each axis.
HALF=4.05
NE=HALF*math.sqrt(2)

def epsg(n):
 s=osr.SpatialReference();s.ImportFromEPSG(n);s.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);return s
cc=gdal.Open(str(D/'aci_2025_pe_v1.tif'));qq=gdal.Open(str(D/'aci_2025_pe_confidence_v1.tif'));SRC=cc.GetGeoTransform()
assert qq.GetGeoTransform()==SRC
CL=cc.ReadAsArray();QC=qq.ReadAsArray();native=cc.GetSpatialRef()
native.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
into=osr.CoordinateTransformation(epsg(4326),native);onto=osr.CoordinateTransformation(native,epsg(4326))
confirmed=(CL==177)&(QC>=80)&(QC<=100)
vector=gdal.OpenEx(str(D/'pe-fields-2023.gpkg'),gdal.OF_VECTOR)
originals=vector.GetLayer(0);originalSRS=originals.GetSpatialRef()
originalSRS.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
nativeToWgs=osr.CoordinateTransformation(originalSRS,epsg(4326))
def original_outline(fid):
 feat=originals.GetFeature(int(fid));g=feat.GetGeometryRef()
 assert g.GetGeometryCount()==1
 shell=g.GetGeometryRef(0);assert shell.GetGeometryCount()==1 and shell.IsValid()
 # The GPKG stores the unsimplified ring; the rounded screening copy is not
 # used to place edges. Densify long Mercator segments to bound curvature.
 shell=shell.Clone();shell.Segmentize(8.)
 wgs=np.asarray(nativeToWgs.TransformPoints(np.asarray(shell.GetGeometryRef(0).GetPoints())[:,:2].tolist()))[:,:2]
 return project(wgs)

validated=binary_erosion(confirmed,np.ones((3,3),bool))
print('AAFC qualified pixels before/after native-cell moat',np.count_nonzero(confirmed),np.count_nonzero(validated),flush=True)
M=J(P/'cover.json');CB=(P/'cover.bin.gz').read_bytes();CBR=gzip.decompress(CB)
assert sha(CB)==PIN['cover']
cov=np.frombuffer(CBR,np.uint8).reshape(M['height'],M['width'],2)
w,s,e,n=M['bounds'];CL0,CL1=project((w,n)),project((e,s));DCL=(CL1-CL0)/[M['width'],M['height']]
dry=(cov[:,:,0]==40)&(cov[:,:,1]>=228)
step=4
assert sha(CBR)=='e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9'
def polygon(path):
 q=ogr.Geometry(ogr.wkbLinearRing)
 for x,z in path:q.AddPoint_2D(x,z)
 q.CloseRings();p=ogr.Geometry(ogr.wkbPolygon);p.AddGeometry(q);return p
def ring(g):return np.asarray(g.GetPoints(),dtype='f8')[:,:2]
def inside(g,X):
 if g.IsEmpty():return np.zeros(len(X),bool)
 if g.GetGeometryName()!='POLYGON':
  y=np.zeros(len(X),bool)
  for i in range(g.GetGeometryCount()):y|=inside(g.GetGeometryRef(i),X)
  return y
 a=Poly(ring(g.GetGeometryRef(0))).contains_points(X)
 for i in range(1,g.GetGeometryCount()):a&=~Poly(ring(g.GetGeometryRef(i))).contains_points(X)
 return a
def bbox(coords):
 return (*coords.min(axis=0),*coords.max(axis=0))
B=defaultdict(list);guards=Counter()
BINS=1024
def put(g,b,name):
 x0,z0,x1,z1=b
 for i in range(math.floor(x0/BINS),math.floor(x1/BINS)+1):
  for j in range(math.floor(z0/BINS),math.floor(z1/BINS)+1):B[i,j].append((g,b,name))
 guards[name]+=1
def pad(b,r):return [b[0]-r,b[1]-r,b[2]+r,b[3]+r]
rbb=gzip.decompress((P/'roads.bin.gz').read_bytes());assert sha(rbb)==PIN['roads']
nroads=struct.unpack_from('>I',rbb,6)[0];at=10
for i in range(nroads):
 n,f=struct.unpack_from('>HB',rbb,at);at+=3
 points=project(np.frombuffer(rbb,offset=at,dtype='>u4',count=n*2).astype('f8').reshape(n,2)/1.e5+[-65,45]);at+=8*n
 for a,b in zip(points,points[1:]):
  if np.linalg.norm(b-a)<.05:continue
  # Full stock width <=6.4m once projected; distance-to-segment guard leaves >13m
  # reserve even at endpoints (and more than 4sqrt2m to all sampling corner supports).
  p=tuple(a)+tuple(b)
  put(p,pad(bbox(np.array([a,b])),20.+NE),'roads')
assert at==len(rbb)
for b in MET['walkway']:put(None,pad(b,13.5+HALF),'sidewalk')
for b in MET['parking']:put(None,pad(b,15.5+HALF),'parking')
for r in MET['runs']:
 p=np.array([r['x'],r['z']]);u=np.array([r['dx'],r['dz']]);v=np.array([-r['dz'],r['dx']]);q=r['width']*.5+42.+NE
 arr=np.array([p+a*u+b*v for a,b in [(-42-NE,-q),(r['length']+42+NE,-q),(r['length']+42+NE,q),(-42-NE,q)]])
 put(Poly(arr),bbox(arr),'runways')
for i,j in set(tuple(r)for r in MET['tilesProtected'])|{(28,14)}:
 x,z=OR+GT*[i,j];put(None,pad((x,z,x+WID,z+DEP),45.),'customTerrainHold')
for r in MET['special']:
 put(None,pad([r['x'],r['z'],r['x'],r['z']],420.),'customPlaceHold')
for t in AEB['tiles']:
 rr=AEBB[t['offset']:t['offset']+t['bytes']];assert sha(rr)==t['sha256']
 for row in json.loads(gzip.decompress(rr))['features']:
  if len(row['footprint'])<3:continue
  put(None,pad(bbox(project(row['footprint'])),15.5+HALF),'building')
current=J(WITNESSES/'actual-current-owners.json')
CF=current['fence'];wire=(P/CF['path']).read_bytes();rr=gzip.decompress(wire)
assert sha(wire)==CF['wireSha'] and sha(rr)==CF['rawSha']
fx,fz,fw,fh,fstep,_,nr=struct.unpack_from('<iiHHHHI',rr,4)
assert [fx,fz,fw,fh,fstep]==[CF[k] for k in ('x0','z0','width','height','strideM')]
bounds=np.frombuffer(rr,'<u4',fh+1,24);segs=np.frombuffer(rr,'<u2',2*nr,24+4*(fh+1)).reshape(-1,2)
blocked=np.zeros((fh,fw),bool)
for j in range(fh):
 for lo,hi in segs[bounds[j]:bounds[j+1]]:blocked[j,lo:int(hi)+1]=True
def clear_current_fence(xy):
 mi=np.floor((xy-HALF-[fx,fz])/fstep).astype(int)
 ma=np.floor((xy+HALF-[fx,fz])/fstep).astype(int)
 assert np.all(mi>=0) and np.all(ma<[fw,fh]) and np.all(ma-mi<=1)
 return ~(blocked[mi[:,1],mi[:,0]]|blocked[mi[:,1],ma[:,0]]|blocked[ma[:,1],mi[:,0]]|blocked[ma[:,1],ma[:,0]])
# Each of these boxes encloses both edges of an actual clipped Trail bed quad.
# Testing bbox intersection (rather than the centreline) errs only toward withholding.
for quad in current['trail']:put(None,pad(bbox(np.array(quad)),HALF+.05),'trail')
assert len(current['trail'])==3141
put(None,pad(current['pastureBounds'],HALF+.05),'panmurePasture')
for receiver in current['localBounds']:
 box=receiver['bounds']; assert len(box)==4 and box[0]<box[2] and box[1]<box[3]
 put(None,pad(box,HALF+.05),'currentLocalReceiver')
def protected_mask(src,name,origin,size,raw,expected):
 assert sha(raw)==expected and len(raw)==size[0]*size[1]
 mask=np.frombuffer(raw,np.uint8).reshape(size[1],size[0])>0
 # Summed area permits exact all-cell overlap tests with the enclosing 5.05m
 # bilinear support of every nonzero source texel. Never only check centres.
 b=np.zeros((size[1]+1,size[0]+1),np.int64);b[1:,1:]=mask.cumsum(0).cumsum(1)
 ox,oz=origin;k=HALF+5.05
 put((ox,oz,size,b),pad([ox,oz,ox+5*size[0],oz+5*size[1]],k),name)
def overlap_mask(g,points):
 ox,oz,size,ii=g;q=(points-[ox,oz])/5-.5;r=(HALF+5.05)/5
 mn=np.ceil(q-r).astype(int);mx=np.floor(q+r).astype(int)
 a=np.maximum(0,mn);b=np.minimum(mx,np.asarray(size)-1)
 ok=np.all(a<=b,axis=1);x,z=a[ok].T;X,Z=b[ok].T
 v=np.zeros(len(points),bool)
 v[ok]=(ii[Z+1,X+1]-ii[z,X+1]-ii[Z+1,x]+ii[z,x])>0
 return v
G=current['grass'];pack=(P/'dune-grass/v1/authority.pack').read_bytes();assert sha(pack)==G['sha256']
for t in G['index']:
 w=pack[t['offset']:t['offset']+t['wire']];data=gzip.decompress(w)
 assert sha(w)==t['wireSHA256'] and sha(data)==t['decodedSHA256'] and data[:4]==b'DGL1'
 assert list(struct.unpack_from('<2i',data,4))==t['grid'] and list(struct.unpack_from('<2H',data,12))==t['cells'] and list(struct.unpack_from('<2H',data,16))==t['tile']
 protected_mask(t,'duneGrassMask',t['uvOrigin'],t['cells'],data[20:],sha(data[20:]))
for t in current['sand']['variants']:
 w=(P/'dune-sand/v1'/t['file']).read_bytes();assert sha(w)==t['wireSha']
 data=gzip.decompress(w);assert sha(data)==t['decodedSha'] and data[:4]==b'SND1'
 assert list(struct.unpack_from('<2i',data,4))==t['offset'] and list(struct.unpack_from('<2H',data,12))==t['size'] and list(struct.unpack_from('<2H',data,16))==t['tile']
 protected_mask(t,'duneSandMask',t['outputOrigin'],t['size'],data[20:],sha(data[20:]))
for t in current['marsh']:
 w=(P/'coastal-marsh'/(t['id']+'.red.gz')).read_bytes();assert sha(w)==t['sha256']
 protected_mask(t,'marshMask',t['origin'],[t['width'],t['height']],gzip.decompress(w),t['decodedSha'])
print('all pinned stock and current guards',dict(guards),len(B),flush=True)
ST=Counter();gp=[];gradRes=[];fieldRes=[]
COVERAGE_MIN=.50;PGRADE_ALONG=.08;PGRADE_ACROSS=.10
# Private local witness only. Fixed 1km sparse map for combined estimation.
N1K=256;Sparse={};Conflicts={};Owners={};TSTART=time.monotonic()
def store(xi,zi,gain,angle,owner):
 D=np.column_stack([xi//N1K,zi//N1K])
 for q in np.unique(D,axis=0):
  k=tuple(q.tolist());g=Sparse.get(k)
  if g is None:
   g=np.zeros((N1K,N1K),np.uint16);Sparse[k]=g;Owners[k]=np.zeros((N1K,N1K),np.uint16)
  ok=np.all(D==q,axis=1);rows,cols=zi[ok]%N1K,xi[ok]%N1K
  was=g[rows,cols]!=0
  if was.any():
   pts=Conflicts.setdefault(k,[])
   pts.extend(zip(rows[was].tolist(),cols[was].tolist()))
  g[rows,cols]=((gain[ok].astype(np.uint16)<<8)|angle)
  Owners[k][rows,cols]=owner
def gradients(X):
 ww=((X-OR)/GT);tx,tz=np.floor(ww).astype(np.int32).T
 assert np.all((tx>=0)&(tx<COL)&(tz>=0)&(tz<ROW))
 assert set((tz*COL+tx).tolist()).issubset(set(MET['coveredTiles']))
 rel=X-(OR+(np.c_[tx,tz]+.5)*GT)
 i=np.clip(np.searchsorted(AX,rel[:,0],side='right')-1,0,N-1);j=np.clip(np.searchsorted(AZ,rel[:,1],side='right')-1,0,N-1)
 width=AX[i+1]-AX[i];dep=AZ[j+1]-AZ[j]
 q=(rel[:,0]-AX[i])/width+(rel[:,1]-AZ[j])/dep<=1.
 a,b,c,d=[HS[tz,tx,j+dz,i+dx].astype(np.float64)for dz,dx in [(0,0),(1,0),(1,1),(0,1)]]
 return np.c_[np.where(q,d-a,c-b)/width,np.where(q,b-a,c-d)/dep]
def swept_grades(X,t,a):
 # Exact source facets intersecting the closed sampler square. A line can
 # cross a triangle whose centre is outside; enumerate both diagonals, up
 # to four lattice cells per point. Boundary collars ensure one parent.
 tt=np.floor((X-OR)/GT).astype(int);tx,tz=tt.T
 assert np.all(tt>=0) and np.all(tt<[COL,ROW])
 assert set((tz*COL+tx).tolist()).issubset(set(MET['coveredTiles']))
 rel=X-(OR+(tt+.5)*GT);lo=rel-HALF;hi=rel+HALF
 i0=np.searchsorted(AX,lo[:,0],side='left')-1;i1=np.searchsorted(AX,hi[:,0],side='right')-1
 j0=np.searchsorted(AZ,lo[:,1],side='left')-1;j1=np.searchsorted(AZ,hi[:,1],side='right')-1
 assert np.all(i0>=0)&np.all(j0>=0)&np.all(i1<N)&np.all(j1<N)&np.all(i1-i0<=1)&np.all(j1-j0<=1)
 g=np.zeros((len(X),3),'f8');count=np.zeros(len(X),np.int16)
 for di,dj in itertools.product((0,1),repeat=2):
  i=i0+di;j=j0+dj;sel=(i<=i1)&(j<=j1)
  if not np.any(sel):continue
  rows=np.flatnonzero(sel);i=i[sel];j=j[sel]
  sx1=AX[i+1]-AX[i];sz1=AZ[j+1]-AZ[j]
  lower=np.maximum(0,(lo[sel,0]-AX[i])/sx1)+np.maximum(0,(lo[sel,1]-AZ[j])/sz1)
  upper=np.minimum(1,(hi[sel,0]-AX[i])/sx1)+np.minimum(1,(hi[sel,1]-AZ[j])/sz1)
  v00,v01,v11,v10=[HS[tz[sel],tx[sel],j+dz,i+dx].astype('f8')for dz,dx in ((0,0),(1,0),(1,1),(0,1))]
  for valid,dx,dz in [(lower<=1.+1e-9,(v10-v00)/sx1,(v01-v00)/sz1),
                       (upper>=1.-1e-9,(v11-v01)/sx1,(v11-v10)/sz1)]:
   r=rows[valid];along=abs(dx[valid]*t[0]+dz[valid]*t[1]);across=abs(dx[valid]*a[0]+dz[valid]*a[1])
   g[r]=np.maximum(g[r],np.column_stack([along,across,np.hypot(along,across)]));count[r]+=1
 assert np.all(count>=1) and np.all(np.isfinite(g))
 return tuple(g.T)
GRADE_LEVELS=np.array([.04,.06,.08,.10,.12,.14,.16,.20,.25])
SNC=np.zeros((2,len(GRADE_LEVELS)),np.int64)
for f in F:
 p=polygon(original_outline(f['id']));assert p.IsValid()
 # Preserve the 13.25m field-edge reserve for every corner, not just a texel centre.
 region=p.Buffer(-(13.25+NE+.05),16)
 if region.IsEmpty():ST['fieldErodedEmpty']+=1;continue
 xl,xu,zl,zu=region.GetEnvelope()
 i,j=np.floor(np.array([xl,zl])/step).astype(int)-4;k,l=np.ceil(np.array([xu,zu])/step).astype(int)+4
 yy,xx=np.mgrid[j:l,i:k];Z=np.c_[xx.ravel(),yy.ravel()];X=(Z+.5)*step
 Y=inside(region,X)
 ST['shapeInboardSamples']+=int(Y.sum())
 if not Y.any():ST['zero4mCells']+=1;continue
 ids=np.flatnonzero(Y)
 nn=np.asarray(into.TransformPoints(lonlat(X[ids]).tolist()))[:,:2]
 ii,jj=np.floor((nn-[SRC[0],SRC[3]])/[30,-30]).astype(int).T
 good=((0<=ii)&(ii<validated.shape[1])&(0<=jj)&(jj<validated.shape[0]))
 nm=np.zeros(len(nn),bool);nm[good]=validated[jj[good],ii[good]]
 Y[ids]&=nm;ST['classConfidenceSurvivors']+=int(Y.sum());ids=np.flatnonzero(Y)
 if not len(ids):ST['fieldNoDatedConfirmedCore']+=1;continue
 # Candidate centre is in an eroded 3x3 native Class-177/confidence core.
 # Check all four enclosing corners stay in that confirmed neighbourhood.
 centres=np.asarray(into.TransformPoints(lonlat(X[ids]).tolist()))[:,:2]
 CI=np.floor((centres-[SRC[0],SRC[3]])/[30,-30]).astype(int);cg=np.ones(len(ids),bool)
 for dx,dz in itertools.product([-HALF,HALF],repeat=2):
  pt=np.asarray(into.TransformPoints(lonlat(X[ids]+[dx,dz]).tolist()))[:,:2]
  IJ=np.floor((pt-[SRC[0],SRC[3]])/[30,-30]).astype(int)
  inbounds=(IJ[:,0]>=0)&(IJ[:,1]>=0)&(IJ[:,0]<CL.shape[1])&(IJ[:,1]<CL.shape[0])
  okay=np.zeros(len(IJ),bool);okay[inbounds]=confirmed[IJ[inbounds,1],IJ[inbounds,0]]
  cg&=np.all(abs(IJ-CI)<=1,axis=1)&okay
 Y[ids]&=cg;ids=np.flatnonzero(Y)
 if not len(ids):continue
 # Categorical Cover uses nearest texel. Its signed coast-distance field
 # uses hardware-style bilinear interpolation around pixel centres (uv*size-.5).
 # At every point in the closed footprint require all contributors to be dry.
 I0=np.floor((X[ids]-HALF-CL0)/DCL).astype(int);I1=np.floor((X[ids]+HALF-CL0)/DCL).astype(int)
 assert np.all(np.abs(I1-I0)<=1)
 # The approved province is well inside this immutable atlas. A single
 # out-of-range sample must stop certification, not wrap through NumPy.
 assert np.all(I0>=0) and np.all(I1<[M['width'],M['height']]),'outside Cover'
 ph=np.ones(len(ids),bool)
 for a,b in itertools.product([0,1],[0,1]):
  u,v=(I0[:,0] if not a else I1[:,0]),(I0[:,1] if not b else I1[:,1])
  ph &= dry[v,u]
 D0=np.floor((X[ids]-HALF-CL0)/DCL-.5).astype(int);D1=np.floor((X[ids]+HALF-CL0)/DCL-.5).astype(int)+1
 assert np.all(D1-D0<=2)
 assert np.all(D0>=0) and np.all(D1<[M['width'],M['height']]),'outside interpolated Cover'
 for a,b in itertools.product(range(3),repeat=2):
  u=np.minimum(D0[:,0]+a,D1[:,0]);v=np.minimum(D0[:,1]+b,D1[:,1]);ph&=cov[v,u,1]>=228
 ph&=clear_current_fence(X[ids])
 # Exclude parent terrain boundary collars so a single, known N112 mesh
 # covers every subsequently tested 4m linear tent.
 pos=np.remainder(X[ids]-OR,GT);ph&=np.minimum(pos,GT-pos).min(axis=1)>HALF+.03
 Y[ids]&=ph;old=int(Y.sum());ST['wholeTentCoverSurvivors']+=old
 if not old:ST['fieldNoSafeCover']+=1;continue
 grd=[]
 for a in range(math.floor(xl/BINS),math.floor(xu/BINS)+1):
  for b in range(math.floor(zl/BINS),math.floor(zu/BINS)+1):grd.extend(B.get((a,b),[]))
 for g,b,name in grd:
  if b[2]<xl or b[0]>xu or b[3]<zl or b[1]>zu:continue
  active=np.flatnonzero(Y&(X[:,0]>=b[0])&(X[:,0]<=b[2])&(X[:,1]>=b[1])&(X[:,1]<=b[3]))
  if not len(active):continue
  if name=='roads':
   av=np.array(g[:2]);bv=np.array(g[2:]);v=bv-av;sp=X[active]-av
   d=sp-np.clip((sp@v)/np.dot(v,v),0.,1.)[:,None]*v
   reject=(d*d).sum(axis=1)<(20.+NE)**2
  elif name.endswith('Mask'):reject=overlap_mask(g,X[active])
  elif name=='runways':reject=g.contains_points(X[active])
  else:reject=np.ones(len(active),bool)
  Y[active[reject]]=False;ST['protected:'+name]+=int(reject.sum())
 nY=int(Y.sum());ST['protectedSurvivors']+=nY
 if not nY:ST['fieldNoSupportAfterStockGuard']+=1;continue
 base=into.TransformPoint(*f['center'])[:2];axis=f['axisRad'];v=np.array([math.cos(axis),math.sin(axis)])*30.
 t=project(onto.TransformPoint(*(base+v))[:2])-project(onto.TransformPoint(*(base-v))[:2]);t/=np.linalg.norm(t)
 a=np.array([-t[1],t[0]])
 ids=np.flatnonzero(Y)
 updown,cross,z=swept_grades(X[ids],t,a)
 # Sanity against the independently addressed single centre triangle.
 cg=gradients(X[ids]);assert np.all(updown+1e-10>=abs(cg@t)) and np.all(cross+1e-10>=abs(cg@a))
 for n,gr in enumerate([updown,cross]):SNC[n]+=np.count_nonzero(gr[:,None]>GRADE_LEVELS,axis=0)
 gradRes.append(np.stack([updown,cross,z],axis=1).astype('f4'))
 q=np.quantile(np.column_stack([updown,cross,z]),[.5,.9,.95,.99,1],axis=0)
 weights=distance_transform_edt(Y.reshape(xx.shape)).ravel()
 u0=np.clip((weights-1.99)/5.5,0.,1.)
 nonSlope=np.round(255*u0*u0*(3.-2.*u0)).astype(np.uint8)>0
 # Explicit illustrative safety veto; not a line about agronomic limits.
 # One surveyed native gradient is not a present field's row bearing.
 noSteepArea=np.mean((updown>.12)|(cross>.15)|(z>.20))
 hardHold=(q[2,0]>PGRADE_ALONG or q[2,1]>PGRADE_ACROSS or q[2,2]>.20 or noSteepArea>.05)
 # Do not paint bands of isolated residual field strips as full rows.
 footprintRatio=Y.sum()/max(1,int(np.count_nonzero(inside(region,X))))
 apronHere=int(np.count_nonzero(Y & nonSlope))
 poorCohesion=apronHere<125 or footprintRatio<COVERAGE_MIN
 if hardHold:ST['entireFieldGradeHold']+=1
 if poorCohesion:ST['entireFieldVerySparseHold']+=1
 ST['preSlopeFeatherCenters']+=apronHere
 info={'id':f['id'],'centroidWGS':f['center'],'fieldErodedFractionCovered':float(footprintRatio),'n':nY,'positiveNoSlope':apronHere,'qPctGrades':(q*100.).round(3).tolist(),
    'steepFraction':float(noSteepArea),'gradeHold':bool(hardHold),'sparseHold':bool(poorCohesion)}
 if not(hardHold or poorCohesion):
  goodGrade=(updown<=.12)&(cross<=.15)&(z<=.20)
  Q=Y.copy();Q[ids[~goodGrade]]=False
  # True 4m-centre map keeps solid support with a continuous safety collar. Never extrapolate a mask.
  u=np.clip((distance_transform_edt(Q.reshape(xx.shape)).ravel()-1.99)/5.5,0.,1.)
  w=np.round(255*u*u*(3.-2.*u)).astype(np.uint8)
  Z1=Z[w>0,:]
  if len(Z1)>=125:
   ang=int(np.floor((math.atan2(t[1],t[0])%math.pi)*256./math.pi))%256
   info['finalPositive']=int(len(Z1))
   ST['finalPositiveBeforeConflicts']+=len(Z1);ST['finalFields']+=1
   store(Z1[:,0],Z1[:,1],w[w>0],ang,f['id'])
  else:ST['fieldRankAfterGradeFade']+=1
 fieldRes.append(info)
 if len(fieldRes)%200==0:print('field progress',len(fieldRes),dict(ST),round(time.monotonic()-TSTART,1),flush=True)
print('full grade census complete',dict(ST),len(Sparse),round(time.monotonic()-TSTART,1),flush=True)
gr=np.concatenate(gradRes,axis=0)
quant=np.quantile(gr,[.5,.9,.95,.99,.999,1],axis=0)*100
ths=GRADE_LEVELS*100
# Zero exact shared target ambiguity plus a 2-cell collar across region edges. This
# never fills a rejected location and costs very little because independent valid fields inset.
for k,ls in Conflicts.items():
 x,y=k;rr,cc=np.array(ls,dtype=int).T
 for i,j in itertools.product(range(-2,3),repeat=2):
  ii,jj=cc+i,rr+j
  for dx,dz in itertools.product(range(-1,2),repeat=2):
   g=Sparse.get((x+dx,y+dz));q=(ii//N1K==dx)&(jj//N1K==dz)
   if g is not None and q.any():g[jj[q]%N1K,ii[q]%N1K]=0
ST['collisionAndOverlapGuardReduction']=ST['finalPositiveBeforeConflicts']-sum(int(np.count_nonzero(v))for v in Sparse.values())
# The main runtime excludes the entire default Souris daylight owner. This is a final
# monotonically removing rebind, not a newly interleaved source/feather pass.
ownersToRemove={(28,14)}
assert tuple(sorted(ownersToRemove))==((28,14),)
cutCount=0;cutBright=0;insideEdge=0
for (sx,sz),values in Sparse.items():
 zz,xx=np.where(values>0)
 X=np.c_[(sx*N1K+xx+.5)*step,(sz*N1K+zz+.5)*step]
 ij=np.floor((X-OR)/GT).astype(np.int16)
 for owner in ownersToRemove:
  q=np.all(ij==owner,axis=1)
  if not q.any():continue
  xx1,zz1=xx[q],zz[q]
  p0=OR+np.array(owner)*GT
  delta=X[q]-p0
  insideEdge+=int(np.count_nonzero(np.minimum(delta,GT-delta).min(axis=1)<=16.))
  cutCount+=len(xx1);cutBright+=int(np.count_nonzero((values[zz1,xx1]>>8)>=128))
  values[zz1,xx1]=0
ST['defaultSourisOwnerRemovedPositiveCentres']=cutCount
ST['defaultSourisOwnerRemovedAtLeastHalfStrength']=cutBright
ST['defaultSourisOwnerOriginalInside16mSupport']=insideEdge
# The fixed projection produces a different geographic population. Never pin
# a previously misregistered count. The expanded source veto removes the
# entire Souris terrain owner, including its edge collar, before packing.
assert cutCount==0,cutCount
NOWN=np.zeros(65536,dtype='i8')
for k,v in Sparse.items():NOWN+=np.bincount(Owners[k][v!=0],minlength=len(NOWN))
assert not NOWN[0]
for f in fieldRes:f['finalPositiveAfterConflicts']=int(NOWN[f['id']])
ST['finalFieldsAfterConflicts']=int(np.count_nonzero(NOWN))
ST['finalPositiveAfterConflicts']=int(NOWN.sum())
ST['uniqueDuplicateCentresBeforeExtraCollar']=sum(len(set(q))for q in Conflicts.values())
ST['fieldSightCohortWithAtLeast125AfterConflicts']=int(np.count_nonzero(NOWN>=125))
S={'state':'Source qualification of selected field optics on the pinned stock world. Not a survey, production acreage or present-day crop map.', 'inputShas':{'candidate':sha(FIELD),'crop':sha((D/'aci_2025_pe_v1.tif').read_bytes()),'confidence':sha((D/'aci_2025_pe_confidence_v1.tif').read_bytes()),'fieldBoundaries':sha((D/'pe-fields-2023.gpkg').read_bytes()),**PIN},'currentOwnerSignature':current['ownerSignature'],'stockGuards':dict(guards),'terrainTiles':len(MET['coveredTiles']),'fieldCountIn':len(F),
    'thresholds':{'fieldsP95HoldAxes':[8.,10.,20.],'min2000m2AfterFeathers':125,'minimumInboardSupportedFraction':COVERAGE_MIN,'notAgronomy':True},
    'statsSamples':dict(ST),'areasM2':{k:int(v)*step**2 for k,v in ST.items()if k in ('shapeInboardSamples','classConfidenceSurvivors','wholeTentCoverSurvivors','protectedSurvivors','preSlopeFeatherCenters','finalPositiveBeforeConflicts','finalPositiveAfterConflicts')},
    'samplesBeforeSlope':len(gr),'gradesQuantilePercent':{'probs':[.5,.9,.95,.99,.999,1],'columns':['authoredAlong','authoredAcross','magnitude'],'values':quant.round(4).tolist()},
    'gradesFractionsBeyondThreshold':{'thresholdPercent':ths.tolist(),'along':(SNC[0]/len(gr)).tolist(),'across':(SNC[1]/len(gr)).tolist()},
    'runtimeSampling':'actual submitted N112 Three triangle, matching first triangle indices [0,113,1,113,114,1]; assumes no adaptive or survey geometry',
}
Path('field-slope-receipt.json').write_text(json.dumps(S,indent=2)+'\n')
Path('field-slope-by-owner.json').write_text(json.dumps(fieldRes,separators=(',',':'))+'\n')
np.savez_compressed('private-1km-mask.npz',**{f'{x},{z}':w for (x,z),w in Sparse.items() if np.any(w)})
print(json.dumps({**S,'sparse':len(Sparse)},indent=2),flush=True)
