#!/usr/bin/python3
"""Local roof-only eave and ridge hypothesis for the two exact East Point survey fits."""
import gzip,hashlib,json,math,runpy,sys
from pathlib import Path
import numpy as np
from osgeo import osr
osr.UseExceptions()
r,d=map(Path,sys.argv[1:3])
p=json.loads((d/'roof-scout.json').read_bytes())
selected=[q['ordinal'] for q in p['results'] if q.get('stable')]
assert selected==[48,49]
sha=lambda b:hashlib.sha256(b).hexdigest()
pack=(r/'public/world/buildings/tiles.pack').read_bytes()
assert sha(pack)==p['worldAtlasSHA']
w=pack[3260377:3269449+1]
assert sha(w)==p['wireTileSHA']
rows=json.loads(gzip.decompress(w))['features']
W,_,_,N,_,_=p['registration']['grid'];width,height=p['registration']['dimensions']
def read(name):
 q=gzip.decompress((d/(name+'.f32le.gz')).read_bytes())
 assert len(q)==width*height*4 and sha(q)==p['sourcePins'][name]['localExactF32SHA256']
 return np.frombuffer(q,'<f4').reshape(height,width)
S,T=read('dsm'),read('dtm')
xx,yy=np.meshgrid(W+np.arange(width)+.5,N-np.arange(height)-.5)
A,B=osr.SpatialReference(),osr.SpatialReference()
for q,n in ((A,4326),(B,3979)):
 q.ImportFromEPSG(n);q.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
proj=osr.CoordinateTransformation(A,B)
source=runpy.run_path(str(r/'tools/qa/roof-fit-pilot.py'))
data=[]
for slot in selected:
 f=rows[slot];ll=np.asarray(f['footprint']);P=np.array([proj.TransformPoint(float(x),float(y))[:2] for x,y in ll])
 z=np.full(xx.shape,np.inf);i=np.zeros(xx.shape,dtype=bool);E=np.roll(P,-1,axis=0)-P
 for s,e in zip(P,E):
  ux,uy=e
  l=e@e
  if l==0:continue
  if uy!=0:i^=((s[1]>yy)!=(s[1]+uy>yy))&(xx<(yy-s[1])*ux/uy+s[0])
  t=np.clip(((xx-s[0])*ux+(yy-s[1])*uy)/l,0,1)
  z=np.minimum(z,np.hypot(xx-s[0]-ux*t,yy-s[1]-uy*t))
 m=i&(z>1.5)&np.isfinite(S)&np.isfinite(T)&(S!=-32767)&(T!=-32767)&(S-T>1)&(S-T<100)
 px,py,v=xx[m],yy[m],S[m].astype(float)
 fresh=source['classify'](px,py,v,P);assert fresh['stable'] and fresh['n']==next(q['n'] for q in p['results'] if q['ordinal']==slot)
 xc,yc=px.mean(),py.mean()
 angles=np.unique(np.r_[np.arange(12)*math.pi/12,np.round(np.arctan2(E[:,1],E[:,0])%math.pi,2)])
 candidates=[]
 for angle in angles:
  u=np.array([math.cos(angle),math.sin(angle)])
  t=(px-xc)*u[0]+(py-yc)*u[1]
  if np.ptp(t)<3:continue
  for offset in (.35,.425,.5,.575,.65):
   x0=t.min()+offset*np.ptp(t)
   if (t<x0-1).sum()<6 or (t>x0+1).sum()<6:continue
   g=np.c_[np.ones(len(t)), -abs(t-x0)]
   c,median=source['robust_fit'](g,v,np.ones(len(t),dtype=bool))
   if .12<=c[1]<=1.73:candidates.append((median,float(angle),float(x0),float(c[0]),float(c[1])))
 cost,theta,off,peak,slope=min(candidates)
 u=np.array([math.cos(theta),math.sin(theta)])
 across=(P-[xc,yc])@u-off
 q=peak-slope*abs(across)
 crossings=[]
 for a,b,s,t in zip(P,np.roll(P,-1,axis=0),across,np.roll(across,-1)):
  if s*t<0:
   point=a+(b-a)*s/(s-t);crossings.append(point.tolist())
 assert len(crossings)==2,(slot,crossings)
 # Measure the signed EN function in the engine's local east/south metre frame.
 lon,lat=ll.mean(axis=0)
 phi=math.radians(46.5);a=6378137.;e2=6.69437999014e-3;rad=math.pi/180
 k=1-e2*math.sin(phi)**2
 perlon=a*rad*math.cos(phi)/math.sqrt(k); perlat=a*(1-e2)*rad/k**1.5
 def cross_world(lon_,lat_):
  e,n,_=proj.TransformPoint(float(lon_),float(lat_))
  return float((np.array([e,n])-[xc,yc])@u-off)
 g=np.array([(cross_world(lon+1/perlon,lat)-cross_world(lon-1/perlon,lat))*.5,
             (cross_world(lon,lat-1/perlat)-cross_world(lon,lat+1/perlat))*.5])
 magnitude=float(np.linalg.norm(g));sign=cross_world(lon,lat)
 assert .92<magnitude<1.08,magnitude
 local=(ll-[lon,lat])*[perlon,-perlat]
 localProjectionError=max(abs(local@g+sign-across))
 assert localProjectionError<.001
 normal=g/magnitude
 plane={'anchorLonLat':[lon,lat],'unitAcrossXZ':normal.tolist(),
        'ridgeOriginLocalXZ':(-sign/magnitude*normal).tolist(),'slopePerLocalMetre':slope*magnitude,
        'peakMOrtho':peak,'maxLinearAcrossErrorM':float(localProjectionError),'lambertAcrossToFrameScale':magnitude}
 row={'sourceOrdinal':slot,'stockReportedHeightM':f['height'],'worldPlanEPSG3979':P.tolist(),'sourceOuterRingWGS84':ll.tolist(),
  'axisOriginEN':[xc,yc],'acrossUnitEN':u.tolist(),'ridgeSignedOffsetM':off,'roofRidgeEN':crossings,
  'hypothesisHeightMOrthoAtOldPlanVertices':q.tolist(),'ridgeAbsHeightM':peak,'pitchRisePerMetre':slope,
  'fitMedianAbsoluteM':cost,'fullFitHeldShapeFromSourceComparison':fresh,
  'projectionLocal':plane,'condition':'Single two-plane fit only. Old wall bases, current condition, exact roof edge and mount not established.'}
 data.append(row)
 print(slot,'ridge',round(peak,4),'pitch',round(slope,4),'orig-edge',list(np.round(q,4)),
 'endpoints',[(round(x,3),round(z,3)) for x,z in crossings],flush=True)
with (d/'two-roof-hypotheses.json').open('x') as f:
 f.write(json.dumps(data,indent=2)+'\n')
