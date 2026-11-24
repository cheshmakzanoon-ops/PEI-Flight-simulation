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
scale=math.pi/180*6378137;lat=math.radians(46.5);E=.00669437999014e-3;S=1-E*math.sin(lat)**2
scale=np.array([scale*math.cos(lat)/math.sqrt(S),-scale*(1-E)/S**1.5]);O=np.array([-63.2,46.5])
project=lambda ll:(np.asarray(ll)-O)*scale
lonlat=lambda x:np.asarray(x)/scale+O
def epsg(n):
 s=osr.SpatialReference();s.ImportFromEPSG(n);s.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);return s
cc=gdal.Open(str(D/'aci_2025_pe_v1.tif'));qq=gdal.Open(str(D/'aci_2025_pe_confidence_v1.tif'));SRC=cc.GetGeoTransform()
assert qq.GetGeoTransform()==SRC
CL=cc.ReadAsArray();QC=qq.ReadAsArray();native=cc.GetSpatialRef()
native.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
into=osr.CoordinateTransformation(epsg(4326),native);onto=osr.CoordinateTransformation(native,epsg(4326))
confirmed=(CL==177)&(QC>=80)&(QC<=100)
validated=binary_erosion(confirmed,np.ones((3,3),bool))
print('AAFC qualified pixels before/after native-cell moat',np.count_nonzero(confirmed),np.count_nonzero(validated),flush=True)
M=J(P/'cover.json');CB=(P/'cover.bin.gz').read_bytes();CBR=gzip.decompress(CB)
assert sha(CB)==PIN['cover']
cov=np.frombuffer(CBR,np.uint8).reshape(M['height'],M['width'],2)
w,s,e,n=M['bounds'];CL0,CL1=project((w,n)),project((e,s));DCL=(CL1-CL0)/[M['width'],M['height']]
dry=(cov[:,:,0]==40)&(cov[:,:,1]>=228)
step=4
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
  put(p,pad(bbox(np.array([a,b])),20.),'roads')
assert at==len(rbb)
for b in MET['walkway']:put(None,pad(b,13.5),'sidewalk')
for b in MET['parking']:put(None,pad(b,15.5),'parking')
for r in MET['runs']:
 p=np.array([r['x'],r['z']]);u=np.array([r['dx'],r['dz']]);v=np.array([-r['dz'],r['dx']]);q=r['width']*.5+42.
 arr=np.array([p+a*u+b*v for a,b in [(-42,-q),(r['length']+42,-q),(r['length']+42,q),(-42,q)]])
 put(Poly(arr),bbox(arr),'runways')
for i,j in set(tuple(r)for r in MET['tilesProtected']):
 x,z=OR+GT*[i,j];put(None,pad((x,z,x+WID,z+DEP),45.),'customTerrainHold')
for r in MET['special']:
 put(None,pad([r['x'],r['z'],r['x'],r['z']],420.),'customPlaceHold')
for t in AEB['tiles']:
 rr=AEBB[t['offset']:t['offset']+t['bytes']];assert sha(rr)==t['sha256']
 for row in json.loads(gzip.decompress(rr))['features']:
  if len(row['footprint'])<3:continue
  put(None,pad(bbox(project(row['footprint'])),15.5),'building')
print('all pinned stock guards',dict(guards),len(B),flush=True)
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
GRADE_LEVELS=np.array([.04,.06,.08,.10,.12,.14,.16,.20,.25])
SNC=np.zeros((2,len(GRADE_LEVELS)),np.int64)
for f in F:
 p=polygon(project(f['outline']));assert p.IsValid()
 region=p.Buffer(-13.25,8)
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
 # Full world bilinear tent remains over dry stock crop-category.
 I0=np.floor((X[ids]-step-CL0)/DCL).astype(int);I1=np.floor((X[ids]+step-CL0)/DCL).astype(int)
 assert np.all(np.abs(I1-I0)<=1)
 ph=np.ones(len(ids),bool)
 for a,b in itertools.product([0,1],[0,1]):
  u,v=(I0[:,0] if not a else I1[:,0]),(I0[:,1] if not b else I1[:,1])
  ph &= dry[v,u]
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
   reject=(d*d).sum(axis=1)<20.**2
  elif name=='runways':reject=g.contains_points(X[active])
  else:reject=np.ones(len(active),bool)
  Y[active[reject]]=False;ST['protected:'+name]+=int(reject.sum())
 nY=int(Y.sum());ST['protectedSurvivors']+=nY
 if not nY:ST['fieldNoSupportAfterStockGuard']+=1;continue
 base=into.TransformPoint(*f['center'])[:2];axis=f['axisRad'];v=np.array([math.cos(axis),math.sin(axis)])*30.
 t=project(onto.TransformPoint(*(base+v))[:2])-project(onto.TransformPoint(*(base-v))[:2]);t/=np.linalg.norm(t)
 a=np.array([-t[1],t[0]])
 ids=np.flatnonzero(Y)
 grad=gradients(X[ids]);updown=np.abs(grad@t);cross=np.abs(grad@a)
 z=np.hypot(updown,cross)
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
 if len(fieldRes)%650==0:print('field progress',len(fieldRes),dict(ST),round(time.monotonic()-TSTART,1),flush=True)
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
assert cutCount==15274
NOWN=np.zeros(65536,dtype='i8')
for k,v in Sparse.items():NOWN+=np.bincount(Owners[k][v!=0],minlength=len(NOWN))
assert not NOWN[0]
for f in fieldRes:f['finalPositiveAfterConflicts']=int(NOWN[f['id']])
ST['finalFieldsAfterConflicts']=int(np.count_nonzero(NOWN))
ST['finalPositiveAfterConflicts']=int(NOWN.sum())
ST['uniqueDuplicateCentresBeforeExtraCollar']=sum(len(set(q))for q in Conflicts.values())
ST['fieldSightCohortWithAtLeast125AfterConflicts']=int(np.count_nonzero(NOWN>=125))
S={'state':'Private projection/layout witness, no production pack or spatial proof beyond these pinned revisions.', 'inputShas':{'candidate':sha(FIELD),'crop':sha((D/'aci_2025_pe_v1.tif').read_bytes()),'confidence':sha((D/'aci_2025_pe_confidence_v1.tif').read_bytes()),'fieldBoundaries':sha((D/'pe-fields-2023.gpkg').read_bytes()),**PIN},'stockGuards':dict(guards),'terrainTiles':len(MET['coveredTiles']),'fieldCountIn':len(F),
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
