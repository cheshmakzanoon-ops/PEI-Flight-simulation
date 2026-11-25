import json,hashlib,argparse
from pathlib import Path
from collections import Counter
from osgeo import ogr
import numpy as np
from scipy.spatial import cKDTree
from PIL import Image
D=Path(__file__).resolve().parent;J=lambda p:json.loads(p.read_text());H=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
P=argparse.ArgumentParser();P.add_argument('--actual',type=Path,required=True);P.add_argument('--select',nargs='+',required=True);P.add_argument('--source',type=Path,required=True);P.add_argument('--out',type=Path,required=True);a=P.parse_args();base=J(a.out) if a.out.exists()else{'method':'Fixed ordinary camera, same-renderer on, source wind keeping its original model/phase while only direct-ground shadow zeroed, restore exact. All changed pixel centers plus 8 subsamples checked with independent true uploaded N112 surface triangles and 3D rays toward fixed original sun; count impacts outside a conservative ≥own nearest geometric contour (clipped every 25cm in height, 0.18m source-filter tolerance plus physically bounded angular-source/one-half-pixel penumbra). Real device AA need not share this exact pattern, so subpixel ownership is a conservative support measurement, not a per-sample implementation match.','registration':H(D/'independent-shadow-gates.json'),'cases':{}}
def trim(tri,cut):
 poly=[];prev=tri[-1];a=prev[1]>=cut
 for curr in tri:
  b=curr[1]>=cut
  if a!=b:poly.append(prev+(curr-prev)*((cut-prev[1])/(curr[1]-prev[1])))
  if b:poly.append(curr)
  prev=curr;a=b
 return np.array(poly)
def clippedshape(tris,cut,ks):
 multi=ogr.Geometry(ogr.wkbMultiPolygon)
 for T in tris:
  poly=trim(T,cut)
  if len(poly)<3:continue
  q=poly[:,[0,2]]-poly[:,1,None]*ks;a0=q[1]-q[0];a1=q[2]-q[0];A=a0[0]*a1[1]-a0[1]*a1[0];
  if abs(A)<1.e-10:continue
  ring=ogr.Geometry(ogr.wkbLinearRing)
  for x,z in q:ring.AddPoint_2D(float(x),float(z))
  ring.CloseRings();g=ogr.Geometry(ogr.wkbPolygon);g.AddGeometry(ring);multi.AddGeometry(g)
 return multi.UnionCascaded()if multi.GetGeometryCount()else None
def truthRay(P,tris,K):
 q=P[:,[0,2]]-P[:,1,None]*K;tr=cKDTree(q);sg=tris[:,:,[0,2]]-tris[:,:,1,None]*K;top=np.full(len(P),-np.inf)
 for T,Q in zip(tris,sg):
  low=Q.min(0);hi=Q.max(0);ids=np.asarray(tr.query_ball_point((low+hi)*.5,float((hi-low).max()*.5+1e-8),p=np.inf),int)
  if not len(ids):continue
  v=Q[1]-Q[0];w=Q[2]-Q[0];den=v[0]*w[1]-w[0]*v[1]
  if abs(den)<1e-10:continue
  T0=q[ids]-Q[0];b=(T0[:,0]*w[1]-T0[:,1]*w[0])/den;c=(v[0]*T0[:,1]-v[1]*T0[:,0])/den;g=(b>=-1e-9)&(c>=-1e-9)&(b+c<=1+1.e-9);inds=ids[g];top[inds]=np.maximum(top[inds],T[0,1]+b[g]*(T[1,1]-T[0,1])+c[g]*(T[2,1]-T[0,1]))
 return q,top
for case in a.select:
 P=a.actual;F=P/(case+'-live.json');R=J(F);on=np.asarray(Image.open(P/(case+'-on.png')).convert('RGB'),dtype='i2');off=np.asarray(Image.open(P/(case+'-off.png')).convert('RGB'),dtype='i2');delta=on-off;A=np.max(abs(delta),axis=2);yy,xx=np.nonzero(A);site=case.split('-')[0];ny,nx=A.shape
 row={'worldProgramSources':R['programSource'],'capturedTerrainReceivers':R['tiles'],'readyBuildings':R['readyBuildingTiles'],'actualStaticReceiver':R['diagnostic'],'graphicsCap':R['measuredCaps'],'stageSpecificLinkedBudget':[{k:t[k]for k in ('fragmentSamplerUnits','fragmentRegisterConservativeUpper','liveCasters','liveFirstCaster')}for t in R['stageBudget']],'sameDrawAndTriangleCount':R['normal']==R['unshaded'],'drawBudget':R['normal'],'restoredFrameExact':R['frameHashes']['on']==R['frameHashes']['restored'],'nativeErrors':R['errors'],'changedPixelsAny':len(xx),'changedPixelsOver2':int((A>2).sum()),'changedPixelsOver8':int((A>8).sum()),'peakRGB':int(A.max()),'brightenedPixelsAny':int((delta>0).any(axis=2).sum()),'inputRawAcquisitionSHA256':H(F),'images':R['frameHashes']}
 if len(xx):
  sun=np.array(R['realSun']);ks=sun[[0,2]]/sun[1];v=np.fromfile(a.source/(site+'.f64'),'<f8').reshape(-1,3);ix=np.fromfile(a.source/(site+'.u32'),'<u4').reshape(-1,3);tris=v[ix];tri=np.asarray([tr['world']for tr in R['nativeTerrainTriangles']]);assert len(tri)>0
  offsets=np.array([(x,y)for x in [-.375,0,.375]for y in[-.375,0,.375]]);I=np.linalg.inv(np.array(R['viewProjection']).reshape(4,4).T);origin=np.asarray(R['camera']);sx=(xx[:,None]+.5+offsets[None,:,0]).ravel();sy=(yy[:,None]+.5+offsets[None,:,1]).ravel();N=len(sx);hom=np.stack((2*sx/nx-1,1-2*sy/ny,np.zeros(N),np.ones(N)),axis=1)@I.T;dirs=hom[:,:3]/hom[:,3,None]-origin;dirs/=np.linalg.norm(dirs,axis=1,keepdims=True);depth=np.full(len(dirs),np.inf)
  # Moller-Trumbore down the actual mounted camera ray, nearest independently stored receiver of any registered tile.
  for T in tri:
   e=T[1]-T[0];f=T[2]-T[0];pv=np.cross(dirs,f);det=pv@e;ok=abs(det)>1.e-9;inv=1/np.where(ok,det,1.);tvec=origin-T[0];u=(pv@tvec)*inv;qvec=np.cross(tvec,e);w=(dirs@qvec)*inv;distance=(f@qvec)*inv;m=ok&(u>=-1.e-9)&(w>=-1.e-9)&(u+w<=1.000000001)&(distance>0);depth[m]=np.minimum(depth[m],distance[m])
  hit=np.isfinite(depth);g=origin+np.where(hit,depth,0)[:,None]*dirs;anchor=np.asarray(R['rawMasts']);XZ=np.linalg.norm(g[:,None,[0,2]]-anchor[None,:,[0,2]],axis=2);idx=np.argmin(XZ,axis=1);relative=g-anchor[idx];hit&=(XZ[np.arange(N),idx]<105);bounds=np.full(N,np.inf);physical=np.zeros(N,bool);quan={};HIG=float(v[:,1].max());Z=relative[hit];qq,top=truthRay(Z,tris,ks);physical[hit]=top>Z[:,1]+.025;slo=np.floor(4*Z[:,1])/4.-.025;dist=np.zeros(len(Z));grads={}
  for y in np.unique(slo):
   inds=np.flatnonzero(slo==y);polygon=clippedshape(tris,y,ks)
   if polygon is None:dist[inds]=np.inf;continue
   pt=ogr.Geometry(ogr.wkbPoint)
   for i in inds:pt.SetPoint_2D(0,float(qq[i,0]),float(qq[i,1]));dist[i]=pt.Distance(polygon)
  bounds[hit]=dist
  # At the least, reject positive pixels outside the conservative local physically possible emitter-angle plus maximum half-pixel radius and finite source footprint.
  tol=np.clip(np.maximum(.065,.00465*np.maximum(0.,HIG-relative[:,1])/sun[1])+.35,.065,1.1)+.18;eligible=hit&(bounds<=tol)&(depth<571);ss=lambda x:x.reshape(-1,len(offsets));entire=ss(eligible).any(1);original=ss(physical).any(1);M=A[yy,xx];D0=ss(bounds).min(axis=1);oo=~entire
  centers=ss(physical)[:,4];row['originalNumericalOpticalSupport']={'allObservedRGBPixels':N//len(offsets),'subsamplesPerPixel':len(offsets),'rawOriginalWorldTrianglesRead':len(tri),'actualGroundAtSomeSubpixel':int(ss(hit).any(1).sum()),'actualOriginalStaticDirectRayAtSomeSubpixel':int(original.sum()),'actualOriginalStaticDirectRayAtCenter':int(centers.sum()),'softEdgeOnlyAtTestedSubsamples':int((~original&entire).sum()),'outsideConservativeOriginalBoundAny':int(oo.sum()),'outsideBoundOver2':int((oo&(M>2)).sum()),'worstOutsideRGB':int(M[oo].max(initial=0)),'worstMeasuredDistanceToIndependentClippedOriginalProjectionM':None if not np.isfinite(D0).all()else round(float(D0.max()),6),'outsideExampleXY':[tuple(map(int,z))for z in list(zip(xx[oo],yy[oo]))[:8]]}
  if row['originalNumericalOpticalSupport']['outsideBoundOver2']>0:print('CHECK EXTERIOR',case,[(int(x),int(y))for x,y in zip(xx[oo][:12],yy[oo][:12])])
 base['cases'][case]=row;print(case,'changed',row['changedPixelsOver2'],'bright',row['brightenedPixelsAny'],row.get('originalNumericalOpticalSupport'),flush=True);a.out.write_text(json.dumps(base,indent=2)+'\n')
