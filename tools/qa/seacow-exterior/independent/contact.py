"""Compare the eight actually extracted authored footing edges, not a nominal regular polygon, to physically read original terrain triangles."""
from pathlib import Path as P
import argparse,hashlib,json,math
import numpy as np
p=argparse.ArgumentParser();p.add_argument('--site',type=P,required=True);p.add_argument('--foot',type=P,required=True);p.add_argument('--output',type=P,required=True);p.add_argument('--xyz-request',type=P);a=p.parse_args();j=lambda f:json.loads(f.read_bytes());H=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
unit=lambda v:v/np.linalg.norm(v)
def cross(a,b):return a[0]*b[1]-a[1]*b[0]
r=j(a.site/'live-geometry.json')[0];f=j(a.foot);b=np.array(f['actualBottomRingXYZ'],float);s=np.array(f['actualSidingBottomRingXYZ'],float);gal=np.array(f['actualGalleryLevelXYZ'],float)
def facet(v):
 if v.ndim==2 and v.shape[1]==3 and len(v)%8==0:
  segments=len(v)//8;return np.array([[v[(i*segments+j)%len(v)] for j in range(segments+1)]for i in range(8)])
 if v.ndim==3 and v.shape[0]==8 and v.shape[2]==3 and v.shape[1]>=2:
  assert np.max(np.abs(v[:,-1]-np.roll(v[:,0],-1,axis=0)))<1e-4
  return v
 raise ValueError('Expected exact ordered eight oriented closed polygon faces')
b=facet(b);s=facet(s);assert len(gal)>=8 and np.isfinite(np.vstack((b.reshape(-1,3),s.reshape(-1,3),gal))).all()
p0=a.site/'terrain-grid.f32le';i0=a.site/'terrain-grid.u16le';assert H(p0)==r['positionSHA256'] and H(i0)==r['indexSHA256'] and r['glErrors']==0
pos=np.fromfile(p0,dtype='<f4').reshape(-1,3).astype('f8');ids=np.fromfile(i0,dtype='<u2').reshape(-1,3);M=np.array(r['modelMatrix']).reshape(4,4).T
xyz=(np.c_[pos,np.ones(len(pos))]@M.T)[:,:3];tri=xyz[ids];ixz=(0,2);allXZ=tri[:,:,[0,2]];footxz=np.vstack((b.reshape(-1,3)[:,ixz],s.reshape(-1,3)[:,ixz]));small=np.all((allXZ.min(1)<=footxz.max(0)+1.0)&(allXZ.max(1)>=footxz.min(0)-1.0),axis=1)
original_ids=np.nonzero(small)[0];tr=tri[small];q=allXZ[small];B=q[:,1]-q[:,0];C=q[:,2]-q[:,0];det=B[:,0]*C[:,1]-B[:,1]*C[:,0];assert np.abs(det).min()>1e-9
def down(pt):
 rel=pt-q[:,0];u=(rel[:,0]*C[:,1]-rel[:,1]*C[:,0])/det;v=(B[:,0]*rel[:,1]-B[:,1]*rel[:,0])/det
 sel=(u>=-1e-8)&(v>=-1e-8)&(u+v<=1+1e-8);y=tr[:,0,1]+u*(tr[:,1,1]-tr[:,0,1])+v*(tr[:,2,1]-tr[:,0,1]);assert sel.any()
 assert np.ptp(y[sel])<1e-5
 idx=np.where(sel)[0][0];return float(y[idx]),int(original_ids[idx])
def isects(p0,p1):
 d=p1-p0;result=[]
 for tri in q:
  for a0,a1 in zip(tri,np.roll(tri,-1,axis=0)):
   e=a1-a0;den=cross(d,e)
   if abs(den)<1e-11:continue
   t=cross(a0-p0,e)/den;u=cross(a0-p0,d)/den
   if 1e-10<t<1-1e-10 and -1e-9<=u<=1+1e-9:result.append(round(float(t),11))
 return sorted(set(result))
def line(ring,i,label):
 face=ring[i];A=face[0];B=face[-1];gaps=[];arena=[];samples=[]
 lengths=np.linalg.norm(np.diff(face[:,[0,2]],axis=0),axis=1);cum=np.r_[0,np.cumsum(lengths)]/np.sum(lengths)
 assert np.max(np.abs(((face[:,0]-A[0])*(B[2]-A[2])-(face[:,2]-A[2])*(B[0]-A[0]))))<1e-3
 crosses=sorted(set(round(float(cum[k]+v*(cum[k+1]-cum[k])),11) for k in range(len(lengths))for v in isects(face[k,[0,2]],face[k+1,[0,2]])))
 for t in sorted(set([j/16 for j in range(17)]+crosses+list(cum))):
  k=min(len(lengths)-1,max(0,int(np.searchsorted(cum,t,side='right'))-1));u=(t-cum[k])/(cum[k+1]-cum[k]);pt=(1-u)*face[k]+u*face[k+1];y,it=down(pt[[0,2]]);gap=float(pt[1]-y)
  item={'t':t,'xz':[float(pt[0]),float(pt[2])],'featureY':float(pt[1]),'originalActualTriangleIndex':it,'trueDisplayedGroundY':y,'gapFeatureMinusGroundM':gap,'registered136':t in {j/16 for j in range(17)}};samples.append(item);arena.append(y);gaps.append(gap)
 return {'ordinal':i,'role':label,'edgeLengthXZ':float(np.linalg.norm((B-A)[[0,2]])),'rangeFeatureToGroundM':[min(gaps),max(gaps)],'trueLocalGradeMinMaxM':[min(arena),max(arena)],'extraN112EdgeCrossings':crosses,'samples':samples}
bot=[line(b,i,'actual low seat') for i in range(8)];sid=[line(s,i,'actual first siding')for i in range(8)];rows=lambda gg:[r for v in gg for r in v['samples']];pts=rows(bot)
def ext(rr,k):out=[r[k]for r in rr];return [float(min(out)),float(np.median(out)),float(max(out))]
rangeY=ext(pts,'trueDisplayedGroundY');botG=ext(pts,'gapFeatureMinusGroundM');sidG=ext(rows(sid),'gapFeatureMinusGroundM');sides=[x['edgeLengthXZ']for x in bot];reg=[r for r in pts if r['registered136']];assert len(reg)==136
# xyz-request is the compact stable 136 + every actually intersected triangle edge for the native ground/collider follow-up; duplicated eight corners remain in registered set.
if a.xyz_request:a.xyz_request.write_text(json.dumps([r['xz']for r in pts])+'\n')
# Known VBO-native downray check on fixed stock patch before any lighthouse art.
checks=[];ray0=np.array(r['downRays']);vv=np.vstack((b.reshape(-1,3),s.reshape(-1,3)));lim=vv[:,[0,2]].min(0);hi=vv[:,[0,2]].max(0)
for rx in ray0:
 x,z,y=rx[:3]
 if np.all([x,z]>=lim)and np.all([x,z]<=hi):g,_=down(np.array([x,z]));checks.append(abs(g-y))
assert not checks or max(checks)<1e-7
galY=gal[:,1];tops=f.get('actualTipXYZ',[]);td=[float(np.max(np.array(tops)[:,1]))]if len(tops) else[]
plan=b[:,0,:][:,[0,2]];A=abs(float((np.dot(plan[:,0]-plan[0,0],np.roll(plan[:,1]-plan[0,1],-1))-np.dot(plan[:,1]-plan[0,1],np.roll(plan[:,0]-plan[0,0],-1)))*.5))
out={'scope':'Source documentary silhouette, not native Z: current render-only exact supports. Emit each authored real lower corner at native output transform; independently raycast 17 samples per real edge plus every exact native triangle-edge crossing between them. Where a finite edge is linear on a triangle, extremum occurs at endpoints of these subedges. All actual GL 8–14 buffers unchanged; this is not a survey of the real site. Duplicate shared corners included in 136.','nativeOriginalTerrain':{'tile':r['tile'],'lod':r['lod'],'ntri':len(ids),'positionSHA256':H(p0),'indexSHA256':H(i0),'readbackMethod':r['method'],'errorAtIndependentThreeRaysM':max(checks)if checks else None,'countCrosscheckedBeforeArt':len(checks)},'geometryInputSHA256':H(a.foot),'geometryIdentity':f.get('geometryIdentity',{}),'actualSideLengthsM':sides,'actualProjectedFootprintM2':A,'actualBaseDiameterFarCornerM':float(np.max(np.linalg.norm(plan[:,None,:]-plan[None,:,:],axis=2))),'actualTipYWorld':td,'actualGalleryHeightSpanM':float(np.ptp(galY)),'registeredBaseSamples':len(reg),'actualBaseSegmentsPerFace':b.shape[1]-1,'uniqueBaseSamplesIncludingSharedCornersOnce':len(set(tuple(tuple(float(round(v,8))for v in r['xz']))for r in pts)),'samplesIncludingExtraTriangleIntersectionsAndRepeatedCorners':len(pts),'terrainMinMedianMaxM':rangeY,'lowerGapMinMedianMaxM':botG,'sidingAboveGradeMinMedianMaxM':sidG,'noUnsupportedGapOver3cm':bool(botG[2]<=.03),'sidingExposureRangeWithinLocalSpreadPlus20cm':bool(sidG[2]-sidG[0]<=rangeY[2]-rangeY[0]+.20),'levelGalleryWithin1mm':bool(np.ptp(galY)<=.001),'bottomFaces':bot,'sidingFaces':sid,'surveyQualification':'One original scan only; no numeric LAS Z opened; no newer terrain or changed collider.'}
if 'actualThresholdBottomXYZ'in f:
 lower=np.asarray(f['actualThresholdBottomXYZ']);upper=np.asarray(f['actualThresholdXYZ']);assert lower.shape==upper.shape==(4,3) and np.max(np.abs(lower[:,[0,2]]-upper[:,[0,2]]))<1e-7
 steps=[]
 for a0,b0,a1,b1 in zip(lower,np.roll(lower,-1,axis=0),upper,np.roll(upper,-1,axis=0)):
  for t in sorted(set([j/16 for j in range(17)]+isects(a0[[0,2]],b0[[0,2]]))):
   pp=(1-t)*a0+t*b0;pq=(1-t)*a1+t*b1;gy,tid=down(pp[[0,2]]);steps.append({'visibleRiserFootGap':float(pp[1]-gy),'stepTopAboveTrueGround':float(pq[1]-gy),'sourceTriangle':tid})
 out['threshold']={'actualFourRisersSourceGeometry':True,'samplesInclSharedCorners':len(steps),'baseMinusVisibleGradeMinMedianMaxM':ext(steps,'visibleRiserFootGap'),'topAboveOriginalVisibleGradeMinMedianMaxM':ext(steps,'stepTopAboveTrueGround'),'realTopLevelSpreadM':float(upper[:,1].ptp()) if hasattr(upper[:,1],'ptp') else float(np.ptp(upper[:,1])),'noRiserFloats':max(s['visibleRiserFootGap']for s in steps)<=.03}
a.output.write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({k:v for k,v in out.items()if k in ('actualSideLengthsM','actualProjectedFootprintM2','lowerGapMinMedianMaxM','sidingAboveGradeMinMedianMaxM','noUnsupportedGapOver3cm','sidingExposureRangeWithinLocalSpreadPlus20cm','levelGalleryWithin1mm','registeredBaseSamples','terrainMinMedianMaxM','samplesIncludingExtraTriangleIntersectionsAndRepeatedCorners')}))
