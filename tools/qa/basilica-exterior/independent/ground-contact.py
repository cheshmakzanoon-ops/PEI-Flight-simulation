"""Rasterize actual opaque stock/candidate triangles into fixed top-down metre-pixels WITHOUT changing geometry. Physical lower-envelope only, low eaves vs intentional bracket must be identified optically."""
import numpy as np,json,hashlib,argparse,math
from pathlib import Path as P
p=argparse.ArgumentParser();p.add_argument('--stock',type=P,required=True);p.add_argument('--ground',type=P,required=True);p.add_argument('--trial',type=P);p.add_argument('--out',type=P,required=True);a=p.parse_args()
j=lambda f: json.loads(f.read_bytes());sh=lambda b:hashlib.sha256(b).hexdigest()
g=j(a.ground);o=np.array([g['origin']['x'],g['origin']['z']]);actual=g['gameBase']; dx=.25;coord=np.arange(-40+dx/2,40,dx);N=len(coord);X,Z=np.meshgrid(coord,coord)
def raster(tri):
 low=np.full((N,N),np.inf);hi=np.full((N,N),-np.inf)
 for verts in tri:
  q=verts[:,[0,2]];b,c=q[1:]-q[0];det=b[0]*c[1]-b[1]*c[0]
  if abs(det)<1e-8:continue
  lo=q.min(axis=0);up=q.max(axis=0);ix0=max(0,int(np.searchsorted(coord,lo[0]-1e-8)));iz0=max(0,int(np.searchsorted(coord,lo[1]-1e-8)));ix1=min(N,int(np.searchsorted(coord,up[0]+1e-8,side='right')));iz1=min(N,int(np.searchsorted(coord,up[1]+1e-8,side='right')))
  if ix0>=ix1 or iz0>=iz1:continue
  sl=np.s_[iz0:iz1,ix0:ix1];xx=X[sl]-q[0,0];zz=Z[sl]-q[0,1];u=(xx*c[1]-zz*c[0])/det;v=(b[0]*zz-b[1]*xx)/det; keep=(u>=-1e-8)&(v>=-1e-8)&(u+v<=1+1e-8);y=verts[0,1]+u*(verts[1,1]-verts[0,1])+v*(verts[2,1]-verts[0,1]);np.minimum(low[sl],y,out=low[sl],where=keep);np.maximum(hi[sl],y,out=hi[sl],where=keep)
 return low,hi
grade,_=raster(np.array(g['localRows']));assert np.isfinite(grade).all()
def load(f):
 m=j(f/'geometry.json');b=(f/m['file']).read_bytes();assert sh(b)==m['dataSHA256'];v=np.frombuffer(b,dtype='<f8').reshape(-1,3,3).copy();v[:,:,[0,2]]-=o;v[:,:,1]+=actual-m['actualGroupOrigin'][1];return raster(v),m
(sl,ss),sm=load(a.stock)
def report(lo,hi,old=False):
 present=np.isfinite(lo);gap=lo-grade;low=present&(lo<actual+1.51);coords=lambda mask:[{'xz':[float(X[t]),float(Z[t])],'gapToTrueGrade':float(gap[t]),'oldGapSameXY':float((sl-grade)[t]) if math.isfinite(sl[t]) else None,'verticalOpaqueRange':[float(lo[t]),float(hi[t])]}for t in zip(*np.where(mask))][:3]
 def A(v):return round(v.sum()*dx**2,5)
 def vals(v):return {'areaM2':A(v),'minMaxGapM':[float(gap[v].min()),float(gap[v].max())] if v.any() else [],'gapAbove30cmM2':A(v&(gap>.3)),'gapAbove20cmM2':A(v&(gap>.2)),'genuineLowClearanceExamples':coords(v&(gap>.3))}
 low0=np.isfinite(sl)&(sl<actual+1.51)
 out={'fullOpaqueGroundProjectionAreaM2':A(present),'lowEmittedFoundationOrStep':vals(low),'within1cmOfTrueTerrainM2':A(low&(abs(gap)<=.01)),'allExistingProjectedMatterCoveredByTrueGroundM2':A(present&(hi<grade))}
 if not old:
  delta=np.zeros_like(sl);np.subtract(lo,sl,out=delta,where=low&low0);prevRemoved=low0&~low
  out.update({'newLowAreaOverOldEmptyOrNonLow':vals(low&(~low0)),'oldLowAreaNoLongerLowM2':A(prevRemoved),'unsharedFootIsGenuinelyAbove30cm':coords(low&(~low0)&(gap>.3)),'retainedLowArea':vals(low&low0),'newlyRaisedLowestByMore30cmAndNowAboveGrade30cmM2':A(low&low0&(delta>.3)&(gap>.3)),'inheritedAbove30NowAtOrBelow30M2':A(low&low0&((sl-grade)>.3)&(gap<=.3))})
 return out
out={'sampling':'0.25 m horizontal grid centers, all actual submitted opaque triangles, 80×80 m fixed old game axes. min/max actual game-Y at each covered XY. Low defined prior to trial as min Y below original base+1.51m. An exposed low eave or intentionally suspended ornament is NOT automatically a floating foundation. No newly measured survey Y; original terrain/neighbor independently checked. Fine-grained counts are diagnostic, not a replacement for actual contact and frames.','groundSamples':N*N,'stockTrianglesSHA256':sm['dataSHA256'],'stock':report(sl,ss,True)}
if a.trial:
 (cl,ch),cm=load(a.trial);out.update({'trialTrianglesSHA256':cm['dataSHA256'],'trial':report(cl,ch)})
a.out.write_text(json.dumps(out,indent=2)+'\n');print(out.get('trial',out['stock']))
