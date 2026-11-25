from pathlib import Path
import argparse,json,math,hashlib,sys,re
import numpy as np
from osgeo import ogr
from PIL import Image
from scipy.spatial import cKDTree
D=Path(__file__).resolve().parent;J=lambda p:json.loads(p.read_text());H=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
p=argparse.ArgumentParser();p.add_argument('--actual',type=Path,required=True);p.add_argument('--original',type=Path,required=True);p.add_argument('--roster',type=Path,required=True);p.add_argument('--select',nargs='+',required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
O=J(a.original/'registered-original-sources.json');R=J(D/'independent-moving-shadow-gates.json');assert H(a.roster)==R['pinned']['regional-wind.generated.ts']
sourceIDs=re.findall(r'\["((?:WCW|EKW|HCS)\d+)"',a.roster.read_text());assert len(sourceIDs)==74 and 'HCS9'not in sourceIDs
res=J(a.out)if a.out.exists()else{'registration':H(D/'independent-moving-shadow-gates.json'),'sourceOriginal':H(a.original/'registered-original-sources.json'),'method':'Independent optical scope: true same-tick RGB while original on-screen blades and original static mast shading stay active; only new moving contribution zeroed and restored, no warm weather/water variations. Every changed pixel independently cast with 9 camera samples against real mounted N112 triangles. Every plausible donor original unmodified 3D spinner/blades at its displayed source phase projected to original sun direction, with finite-disk support + numerical/grid allowance, not a filled rotor disc or geographic bounding box. Source geometry crosses no real N112 height near blade elevation.','cases':{}}
def rays(P,T,oid,nx,ny):
 xx=P[:,0];yy=P[:,1];cam=np.array(T['camera']);I=np.linalg.inv(np.array(T['viewProjection']).reshape(4,4).T);offset=np.array([(x,y) for x in [-.375,0,.375]for y in [-.375,0,.375]])
 sx=(xx[:,None]+.5+offset[None,:,0]).ravel();sy=(yy[:,None]+.5+offset[None,:,1]).ravel();h=np.stack([2*sx/nx-1,1-2*sy/ny,np.zeros(len(sx)),np.ones(len(sx))],1)@I.T;v=h[:,:3]/h[:,3,None]-cam;v/=np.linalg.norm(v,axis=1)[:,None];dep=np.full(len(sx),np.inf)
 for tri in oid['visibleTerrainTriangles']:
  A,B,C=np.asarray(tri['world']);e1=B-A;e2=C-A;tvec=cam-A;pv=np.cross(v,e2);den=pv@e1;inv=1./np.where(abs(den)>1e-12,den,1.);uu=(pv@tvec)*inv;qv=np.cross(tvec,e1);ww=(v@qv)*inv;tt=e2@qv*inv;valid=(abs(den)>1e-12)&(uu>=-1.e-9)&(ww>=-1.e-9)&(uu+ww<=1.000000001)&(tt>0);dep[valid]=np.minimum(dep[valid],tt[valid])
 return dep,cam+np.where(np.isfinite(dep),dep,0.)[:,None]*v
def hull(t,ks):
 q=t[:,:,[0,2]]-t[:,:,1,None]*ks;g=ogr.Geometry(ogr.wkbMultiPolygon)
 for t1 in q:
  if abs((t1[1,0]-t1[0,0])*(t1[2,1]-t1[0,1])-(t1[1,1]-t1[0,1])*(t1[2,0]-t1[0,0]))<1e-13:continue
  ring=ogr.Geometry(ogr.wkbLinearRing)
  for j,k in t1:ring.AddPoint_2D(float(j),float(k))
  ring.CloseRings();v=ogr.Geometry(ogr.wkbPolygon);v.AddGeometry(ring);g.AddGeometry(v)
 return g.UnionCascaded()
for name in a.select:
 far=name.endswith('warm-far');site=name.split('-')[0];G=O['rows'][site];angrate=G['angleRateFromActualShader'];templ=np.fromfile(a.original/(site+'-rotor.f32'),'<f4').astype('f8').reshape(-1,3);ix=np.fromfile(a.original/(site+'-rotor.u32'),'<u4').reshape(-1,3);M=np.asarray(G['spindle']).reshape(4,4).T;col={};maskpair=[]
 for n in ([1]if far else[1,3]):
  k=name+'-'+str(n);path=a.actual/(k+'-live.json');rt=J(path);bank=J(a.actual/(name+'-1-live.json'));assert rt.get('viewProjection')==bank.get('viewProjection') and rt['camera']==bank['camera']and rt['view']==R['actualViews'][name]
  on=np.asarray(Image.open(a.actual/(k+'-on.png')).convert('RGB'),dtype='i2');off=np.asarray(Image.open(a.actual/(k+'-off.png')).convert('RGB'),dtype='i2');delta=off-on;diff=np.max(abs(delta),2);yy,xx=np.nonzero(diff);NY,NX=diff.shape;maskpair.append(delta)
  m={'fullImageWH':[NX,NY],'frameSHA':rt['frameHashes'],'wholeRGBRestoredExactly':rt['frameHashes']['on']==rt['frameHashes']['restored'],'RGBChanged':int(xx.size),'over2':int((diff>2).sum()),'over8':int((diff>8).sum()),'maxDelta':int(diff.max()),'brightened':int((delta<0).any(axis=2).sum()),'cameraAgreed':True,'sameOrdinaryDraws':rt.get('normal')==rt.get('unshaded') if not far else None,'mainScene':rt.get('normal'),'offscreenSourceInfo':rt['diagnostic'].get('moving'),'fragmentLinks':rt.get('stageBudget',[]),'sourceFileSHA256':H(path),'glErrors':rt['errors']}
  if not far and len(xx):
   dp,P=rays(np.c_[xx,yy],rt,bank,NX,NY);valid=np.isfinite(dp);N=len(dp);sun=np.array(rt['sceneSun']);ks=sun[[0,2]]/sun[1];ids=rt['origins'];keep=np.zeros(N,bool);hard=np.zeros(N,bool);nearest=np.full(N,np.inf);tolHit=np.zeros(N);sides={};pxCloud=P.reshape(-1,9,3);center=pxCloud[:,[4],:];span=np.linalg.norm(pxCloud[:,:,[0,2]]-center[:,:,[0,2]],axis=2);span[~valid.reshape(-1,9)]=0;pixExtra=np.repeat(np.minimum(2.,.36*span.max(1)),9);p=ogr.Geometry(ogr.wkbPoint)
   for o in ids:
    st=o['id'];family=st[:3];localroster=[s for s in sourceIDs if s.startswith(family)];ordinal=localroster.index(st);phase=np.float32(ordinal*math.pi*(3-math.sqrt(5)));theta=float(np.float32(phase-np.float32(np.float32(rt['requestedClock']%600)*np.float32(angrate))));c,s=math.cos(theta),math.sin(theta);vv=templ.copy();vv[:,1]=templ[:,1]*c-templ[:,2]*s;vv[:,2]=templ[:,1]*s+templ[:,2]*c;vv=vv@M[:3,:3].T;orig=np.asarray(o['origin']);rel=P-orig;rawbase=orig[1]-G['hub'];relbase=P[:,1]-rawbase;ixx=np.flatnonzero(valid&(dp<571)&(abs(relbase)<=25.)&(np.sum((P[:,[0,2]]-np.array(o['xz']))**2,axis=1)<=188**2))
    if not len(ixx):continue
    assert np.min(vv[:,1])>rel[ixx,1].max()+.025
    origShape=hull(vv[ix],ks);loX,hiX,loZ,hiZ=origShape.GetEnvelope();Q=rel[ixx][:,[0,2]]-rel[ixx][:,1,None]*ks;near=np.flatnonzero((Q[:,0]>=loX-4)&(Q[:,0]<=hiX+4)&(Q[:,1]>=loZ-4)&(Q[:,1]<=hiZ+4));ss=ixx[near]
    if not len(ss):continue
    d=np.empty(len(ss));
    for ii,(q1,q2)in enumerate(Q[near]):p.SetPoint_2D(0,float(q1),float(q2));d[ii]=p.Distance(origShape)
    # Ground light-plane intercepts expand penumbral radius most along horizontal light direction by sec(sun zenith)^2. Cap limited to the true registered area and observed footprint. Never broad swept-area/disk.
    tol=.00465*np.maximum(0.,vv[:,1].max()-rel[ss,1])/(sun[1]**2)+.32/sun[1]+pixExtra[ss];keep[ss]|=d<=tol;hard[ss]|=d<1e-8;nearest[ss]=np.minimum(nearest[ss],d);tolHit[ss]=np.maximum(tolHit[ss],tol);sides[st]={'tested':len(ss),'hardSubsamples':int((d<1e-8).sum()),'qualifyingFiniteSubsamples':int((d<=tol).sum())}
   b9=lambda x:x.reshape(-1,9);anyGood=b9(keep).any(1);nearD=b9(nearest).min(1);hasValid=b9(valid).any(1);bad=~anyGood;val=diff[yy,xx];m['owner']={'nNativeGroundTriangles':len(bank['visibleTerrainTriangles']),'liveN112Tiles':sorted(set(t['owner']for t in bank['visibleTerrainTriangles'])),'pixelAnyActualNearestOriginalGroundRay':int(hasValid.sum()),'pixelAtLeastOneHardOriginalBladeHit':int(b9(hard).any(1).sum()),'pixelHardCentralOriginalBladeHit':int(b9(hard)[:,4].sum()),'pixelSoftBoundaryOnly':int((~b9(hard).any(1)&anyGood).sum()),'changedOutsideSupportAny':int(bad.sum()),'outsideOver2':int((bad&(val>2)).sum()),'outsideMaxRGB':int(val[bad].max(initial=0)),'maxDistanceToTrueBladeProjectionAtAnyCoveredPointM':None if not np.isfinite(nearD).all()else round(float(nearD.max()),6),'perActiveSourceUnderCamera':sides,'outsideExamples':[(int(x),int(y))for x,y in zip(xx[bad][:8],yy[bad][:8])]}
  col[str(n)]=m
 if len(maskpair)==2:d=np.max(abs(maskpair[0]-maskpair[1]),axis=2);col['temporalOriginalRotorDifferential']={'any':int((d>0).sum()),'gt2':int((d>2).sum()),'maxDeltaAcrossSameLightCounterfactuals':int(d.max()),'rejectLostTick':bool((d>2).sum()>=60)}
 res['cases'][name]=col;a.out.write_text(json.dumps(res,indent=2)+'\n');print(name,[(v['over2'],v['brightened'],v.get('owner',{}).get('outsideOver2'),v.get('owner',{}).get('changedOutsideSupportAny'))for k,v in col.items()if k!='temporalOriginalRotorDifferential'],col.get('temporalOriginalRotorDifferential'),flush=True)
print('receipt',H(a.out))
