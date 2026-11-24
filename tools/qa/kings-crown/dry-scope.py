"""Conservative source/actor exclusion screen, not a scenery runtime or new mask."""
from pathlib import Path
import json,math
import numpy as np
from scipy.ndimage import binary_erosion,distance_transform_edt,label
from scipy.spatial import cKDTree
D=Path('.')
A=np.load(D/'dry-2112-native.npz');Wspec=json.loads((D/'dry-2112-source.json').read_text());I=json.loads((D/'protected-near.json').read_text())
raw,DSM=A['dtm'].astype('f8'),A['dsm'].astype('f8')
shape=raw.shape
P=np.fromfile(D/'dry-2112-world-centres.f64','<f8').reshape(*shape,2);x,z=P.transpose(2,0,1)
signed,phys,vis,nt,classes=np.fromfile(D/'dry-2112-stock.f64','<f8').reshape(*shape,5).transpose(2,0,1)
S=np.hypot(*np.gradient(raw));delta=raw+.12-vis
def quant(a):return [float(z) for z in np.quantile(a,[0,.1,.5,.9,.99,1])] if a.size else None
def diag(mask):
 return {'cells':int(mask.sum()),'errorAbs':[float(z) for z in np.quantile(abs(delta[mask]),[.5,.9])] if mask.any() else None,
 'nativeSteepCount':int(np.count_nonzero((S>.45)&mask)),
 'highCliffCount':int(np.count_nonzero((raw>15)&mask)),
 'deckAbove3m':int(np.count_nonzero((abs(delta)>3)&mask))}
def distanceSeg(a,b):
 a=np.asarray(a);b=np.asarray(b);d=b-a
 if np.dot(d,d)<1e-12:return np.linalg.norm(P-a,axis=2)
 t=np.clip((d[0]*(x-a[0])+d[1]*(z-a[1]))/np.dot(d,d),0,1)
 return np.hypot(x-a[0]-t*d[0],z-a[1]-t*d[1])
dist_road=np.full(shape,20000.);dist_roadplan=dist_road.copy();dist_walk=dist_road.copy()
for route in I['packedNearRows']:
 p=route['points'];w=[2.,2.8,3.6,4.8,6.4][route['flags']&7]
 for a,b in zip(p,p[1:]):dist_road=np.minimum(dist_road,distanceSeg(a,b)-w)
# exact stock submitted triangles, conservative outside-distance via include test
for tri in I['drawRoadTriangles']:
 p=tri['vertices'];a,b,c=np.asarray(p)
 v0=b-a;v1=c-a;det=np.linalg.det(np.vstack([v0,v1]))
 if abs(det)<1e-5:continue
 u=((x-a[0])*v1[1]-(z-a[1])*v1[0])/det
 v=(v0[0]*(z-a[1])-v0[1]*(x-a[0]))/det
 inside=(u>=0)&(v>=0)&(u+v<=1)
 for k,j in [(a,b),(b,c),(c,a)]:dist_roadplan=np.minimum(dist_roadplan,np.where(inside,0,distanceSeg(k,j)))
for route in I['sidewalkPaths']:
 p=route['points']
 for a,b in zip(p,p[1:]):dist_walk=np.minimum(dist_walk,distanceSeg(a,b)-route['width']/2)
def rect_dist(b):
 a,c,d,e=b
 return np.hypot(np.maximum(0,np.maximum(a-x,x-d)),np.maximum(0,np.maximum(c-z,z-e)))
objs=np.full(shape,np.inf)
for b in (I['buildingsNear']+I['parkingTiles']):objs=np.minimum(objs,rect_dist(b['box']))
roots=I['treeRootsAndShadowBounds']
treed=cKDTree(np.array([r['xz'] for r in roots])).query(P.reshape(-1,2))[0].reshape(shape)
shadow=np.full(shape,np.inf);forestPoss=np.full(shape,np.inf)
for r in roots:
 shadow=np.minimum(shadow,rect_dist(r['stockShadowBox']))
 xx,zz=r['xz']
 # Confirmed stock shader footprint expanded for any later stand-height
 # value up to 30m, using canonical maximum phase and max shape ratio.
 forestPoss=np.minimum(forestPoss,rect_dist([xx-12.24,zz-14.76,xx+38.04,zz+27.36]))
n0=raw>1.5
sourceDry=binary_erosion(n0,iterations=2)&(signed>42)&(signed<180)
geology=sourceDry&(abs(delta)>3)
lanes=(dist_road>=3.5)&(dist_roadplan>=3.5)&(dist_walk>=3.5)&(objs>=3.5)
coh={
 'dryFewBasicOnly':sourceDry,
 'dryLosAfterRoad':sourceDry&lanes,
 'stockPlantsAndShadowsReserve':sourceDry&lanes&(treed>=3)&(shadow>=2),
 'futureForestShadowGuaranteed':sourceDry&lanes&(treed>=3)&(forestPoss>=2),
 'openCoverOnlyStockShadow':sourceDry&lanes&(treed>=3)&(shadow>=2)&(classes!=10),
}
out={'scope':'Dry-only conservative study finding. Known mapped paths absent in packed data, no claim public trail completeness. No terrain, tree, road or ocean edits.',
 'upperBoundDryBeforeAnyLaneMasks':diag(sourceDry),
 'majorCliffAffectedRoadMask':int((geology&~lanes).sum()),
 'rawGeologyAgainstTreeAnchorsAndShadowAABBs':{
  'q50q90NativeLiftAtExistingRootMeters':None,
  'majorCliffAffectedForestAndShadeAny':int((geology&((treed<3)|(shadow<2))).sum())},
 'cohorts':{}}
interested=sourceDry&(S>.45)
for k,m in coh.items():
 d=distance_transform_edt(m)
 setk={'allow':diag(m),'maxWholeInteriorDistanceM':float(d.max()),'coreWhereMoreThan':{str(t):diag(d>t) for t in [6,10,15,20,25,35,50,65]},
 'coherentSteepCapturedOfAll':float((m&interested).sum()/interested.sum()),
 'upperTaperChanges':[]}
 for taper in [15,25,35,50]:
  u=np.clip((d-2)/taper,0,1);q=u*u*(3-2*u)
  adjusted=vis+delta*q;pred=np.hypot(*np.gradient(adjusted));future=(m&(d>1)&(d<taper+2))
  artificiallySteep=future&(S<.12)&(pred>.35)
  setk['upperTaperChanges'].append({'widthM':taper,'retainedCorrectionNativeSteepMedianWeight':float(np.median(q[interested])),'eligibleNativeSteepP90HeightAfter':float(np.quantile(abs((raw+.12-adjusted)[interested]),.9)),
  'maxArtificialSlopeMperMWhereDTMBelow12pct':float(pred[artificiallySteep].max()) if artificiallySteep.any() else 0,
  'artificiallySteepNewTaperCells':int(artificiallySteep.sum()),
  'proportions':diag(q>.995)})
 out['cohorts'][k]=setk
Path('dry-scope.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({k:{'allow':v['allow']['cells'],'steepCaptured':v['coherentSteepCapturedOfAll'],'max':v['maxWholeInteriorDistanceM'],'core25':v['coreWhereMoreThan']['25'],'tapers':v['upperTaperChanges']} for k,v in out['cohorts'].items()},indent=2))
np.savez_compressed('dry-scope-fields.npz',signed=signed,future=forestPoss,road=np.minimum(dist_road,dist_roadplan),stockShadow=shadow,root=treed,vis=vis,p=P,allow=coh['futureForestShadowGuaranteed'])
