"""Bake museum opt-in. Absolute original 1m CGVD2013/DB; immutable Three.js N112 parent; no building, user imagery or native LAS fitting."""
import argparse,gzip,json,math,hashlib,struct
from pathlib import Path
import numpy as np
from scipy.ndimage import map_coordinates,minimum_filter,label,distance_transform_edt
from osgeo import osr,ogr
ogr.UseExceptions();osr.UseExceptions()
P=argparse.ArgumentParser(description=__doc__);P.add_argument('stock',type=Path);P.add_argument('source',type=Path);P.add_argument('out',type=Path);a=P.parse_args();a.out.mkdir(exist_ok=True,parents=True)
M=json.loads((a.stock/'stock-world.json').read_text());g=M['frame'];nx,nz=g['nx'],g['nz'];j,i=np.indices((nz,nx));x0,z0=g['firstVertex'];dx,dz=g['resolutionM'];xx=x0+dx*i;zz=z0+dz*j
hash=lambda b:hashlib.sha256(b).hexdigest();assert M['baseline']=='edb24d27effe41263d21a16df9eed87182e535b8'
def polygon(rings):
 p=ogr.Geometry(ogr.wkbPolygon)
 for a0 in rings:
  r=ogr.Geometry(ogr.wkbLinearRing)
  for p0 in a0:r.AddPoint_2D(*p0)
  r.CloseRings();p.AddGeometry(r)
 return p
def point(a,b):
 g=ogr.Geometry(ogr.wkbPoint);g.AddPoint_2D(a,b);return g
def line(pts):
 l=ogr.Geometry(ogr.wkbLineString)
 for p in pts:l.AddPoint_2D(*p)
 return l
def crs(k):
 s=osr.SpatialReference();s.ImportFromEPSG(k);s.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);return s
T=osr.CoordinateTransformation(crs(4326),crs(3979));L=g['geoOrigin'];S=g['scales'];lo=L['lon']+xx/S[0];la=L['lat']+zz/S[1]
q=np.array(T.TransformPoints(np.c_[lo.flatten(),la.flatten()]))[:,:2].reshape(nz,nx,2)
A=json.loads((a.source/'dtm-source.json').read_text());raw=(a.source/'native-dtm.f32').read_bytes();assert hash(raw)==A['sourceFloat32LESHA256']=='5c9104c2a6efc6e248fe398c207e236879ed151752aa06055fad91a3c2f70384'
src=np.frombuffer(raw,'<f4').reshape(A['dimensionsColsRows'][::-1]);w,n=A['originWestNorth'];dtm=map_coordinates(src,[n-q[:,:,1]-.5,q[:,:,0]-w-.5],order=1,mode='constant',cval=np.nan)
def array(name,h,dtype):
 data=(a.stock/name).read_bytes();assert hash(data)==M['arrays'][h];return np.frombuffer(data,dtype).reshape(nz,nx)
stock=array('drawn-y.f64','stockY','<f8');nativeDry=array('dry-distance.f32','shoreDistance','<f4');col=array('cover.u8','cover','u1');target=polygon([g['modelRing']]);outline=target.Boundary();ex=[]
for row in M['authoritativeObstacles']:
 if row.get('target'):continue
 f=polygon(row['rings']) if 'rings' in row else line(row['line']).Buffer(row['half']+.35)
 margin={'aeb':2.0,'walk':.65,'parking':1.20,'road':2.0}[row['owner']]
 if target.Distance(f)<32:ex.append((f,margin))
rad=math.hypot(dx,dz)+.055;free=np.full_like(xx,-100.);td=np.full_like(xx,100.)
for j,i in np.ndindex(xx.shape):
 p=point(xx[j,i],zz[j,i]);d=target.Distance(p)
 if d>18:continue
 if d==0:d=-outline.Distance(p)
 td[j,i]=d
 free[j,i]=min([15.-d,24.+d]+[f.Distance(p)-reserve for f,reserve in ex])-rad
for s in M['roster']:free=np.minimum(free,np.hypot(xx-s[0],zz-s[2])-max(.60,s[4]*.05)-rad)
# A third-party map-derived path and its shoulders are vetoes, never art/data sources.
assert np.all(nativeDry[free>0]>38) and np.all(np.isin(col[free>0],[10,30])) and np.isfinite(dtm[free>0]).all()
band=np.clip(free/.36,0,1);smooth=band*band*(3-2*band);W=np.rint(255*smooth).astype(np.uint8)
# Absolute DTM, not DTM+renderer lift: shifting this target would change the source datum.
want=np.maximum(0,np.nan_to_num(dtm-stock))
D=np.maximum(free-(rad+.38),0);ceiling=.24*(D-.45*(1-np.exp(-D/.45))); # Single C1 shoulder, no steeper than 24% incremental slope.
Q=np.floor(np.minimum(want,ceiling)*100+1e-7).astype('<i2')
# The entire 1-ring of every changed vertex has weight 1: the collider is tied to the exact
# submitted triangle at every physically moved point, and only blends through an undisturbed geometric fringe.
Q[minimum_filter(W,size=3,mode='constant',cval=0)!=255]=0
assert np.any(Q>0)
W[free<=0]=0;W[[0,-1],:]=0;W[:,[0,-1]]=0;assert not np.any(Q[W==0]) and np.all(W[Q>0]==255)
lab,nc=label(Q>0);sizes=sorted(((int(np.sum(lab==k)),k) for k in range(1,nc+1)),reverse=True)
if len(sizes)>1:Q[lab!=sizes[0][1]]=0
# Reconcile physics only where the current, positive top needs it. Distance is to the
# unmodified discrete positive support (never derived from a withheld elevation).
# A full triangle diagonal retains all three vertices of every positive half; the
# additional one-cell smooth shoulder then approaches HANDOFF TO THE OLD COLLIDER.
# Interpolation can extend that final positive byte over its incident triangle.
oldW=W.copy()
dist=distance_transform_edt(Q==0,sampling=(dz,dx))
r0=math.hypot(dx,dz)+1.e-8; r1=r0+min(dx,dz)
a0=np.clip((r1-dist)/(r1-r0),0,1)
W=np.minimum(W,np.rint(255*a0*a0*(3-2*a0)).astype(np.uint8))
first=(Q[:-1,:-1]>0)|(Q[1:,:-1]>0)|(Q[:-1,1:]>0)
second=(Q[1:,:-1]>0)|(Q[1:,1:]>0)|(Q[:-1,1:]>0)
assert np.all((W[:-1,:-1][first]==255)&(W[1:,:-1][first]==255)&(W[:-1,1:][first]==255))
assert np.all((W[1:,:-1][second]==255)&(W[1:,1:][second]==255)&(W[:-1,1:][second]==255))
assert int(first.sum()+second.sum())==3243 and np.all(W<=oldW)
raw=Q.tobytes()+W.tobytes();wire=bytearray(gzip.compress(raw,compresslevel=9,mtime=0));wire[9]=255;NAME='beaconsfield-contact-v1.bin.gz';(a.out/NAME).write_bytes(wire)
spec={k:g[k] for k in ('tileX','tileZ','firstX','firstZ','cellsX','cellsZ','sub')};spec=dict(id='beaconsfield-measured-frontage-grade',kind='inland',**spec,relativeToParent=True,sparseRelative=True,sha256=hash(raw),file=NAME,wireBytes=len(wire),wireSha=hash(wire),decodedBytes=len(raw),terrainSha256=M['source']['terrain'],coverCompressedSha256=M['source']['coverWire'],coverDecodedSha256=M['source']['cover'],maxRelativeDeltaCm=105)
# Source+geometry-derived original receiver roster. Any actual tree not matching the complete roster cancels eligibility.
# Record every deterministic stem intersecting the corrected rectangle, irrespective of alpha/camera.
mix=Q>0;xm,xM=float(xx[mix].min()-dx-.04),float(xx[mix].max()+dx+.04);zm,zM=float(zz[mix].min()-dz-.04),float(zz[mix].max()+dz+.04)
def crosses(st):
 x,y,z,h,w,v,c=st;cx=x+.43*h;cz=z+.21*h
 return cx+.71*w>=xm and cx-.71*w<=xM and cz+.595*w>=zm and cz-.595*w<=zM
ids=[st for st in M['roster'] if crosses(st)]
accepted=[(td>=l)&(td<h) for l,h in [(.75,5),(5,11),(11,18)]]
rep={ 'basis':'real stock N112 Y vs original unadjusted 1m DTM; NOT held out point-cloud results','positiveVertices':int(mix.sum()),'positiveAreaAssociatedM2':float(mix.sum()*dx*dz),'heightImprovedOver35cmAreaM2':float((Q>=35).sum()*dx*dz),'maximumDeltaM':float(Q.max()*.01),'bounds':[xm,zm,xM,zM],'rosterBefore':len(M['roster']),'cardinalityInBoundingRectangle':len(ids),'source':A,'pins':M['source'],'areas':[]}
rep['contactOnlyHandoff']={'distanceToPositiveVertexM':{'allIncidentFull':float(r0),'outerZeroAtVertices':float(r1),'conservativeOuterZeroIncludingInterpolation':float(r1+r0)},'nonzeroWeightVertices':int((W>0).sum()),'physicallyRaisedVertices':int((Q>0).sum()),'retiredNonzeroWeightVerticesFromWideCandidate':int(((oldW>0)&(W==0)).sum()),'verticesNeverIncreaseOverAuthorityMask':True,'positiveHalfCells':int(first.sum()+second.sum())}
for b in accepted:
 err=dtm-stock;rep['areas'].append({'all':int(b.sum()),'positive':int((b&mix).sum()),'substantialOver25cm':int((b&(Q>=25)).sum()),'stockMedianAbsM':float(np.median(abs(err[b]))),'candidateMedianAbsM':float(np.median(abs((err-Q*.01)[b]))),'stockP90AbsM':float(np.quantile(abs(err[b]),.9)),'candidateP90AbsM':float(np.quantile(abs((err-Q*.01)[b]),.9))})
(a.out/'beaconsfield-grade.generated.ts').write_text('// Generated from one native DTM window, current protected geometry, and the original tree generator.\nexport const BEACON_GRADE='+json.dumps(spec,indent=1)+' as const;\nexport const BEACON_RECEIVERS='+json.dumps({'bounds':rep['bounds'],'roster':ids,'fences':{k:M['source'][k] for k in ('allBuildings','owner','roads','sidewalk','parking','art')}},separators=(',',':'))+' as const;\n')
(a.out/'source-design.json').write_text(json.dumps(rep,indent=2)+'\n');print(spec);print(rep['areas']);print('geometry',rep['positiveVertices'],rep['heightImprovedOver35cmAreaM2'],len(ids),rep['bounds'])
