"""Check actual emitted full front tread and true 112m subdivision mesh; compute the complete cross-slope toe, not just three registered inputs."""
import json,numpy as np,hashlib,argparse
from pathlib import Path as P
p=argparse.ArgumentParser();p.add_argument('--trial',type=P,required=True);p.add_argument('--ground',type=P,required=True);p.add_argument('--out',type=P,required=True);a=p.parse_args()
J=lambda f:json.loads(f.read_bytes());m=J(a.trial/'geometry.json');raw=(a.trial/m['file']).read_bytes();assert hashlib.sha256(raw).hexdigest()==m['dataSHA256'];t=np.frombuffer(raw,dtype='<f8').reshape(-1,3,3);o=np.array(m['actualGroupOrigin'][::2]);g=J(a.ground);ang=np.array([.731819806619,-.681498180952]);ang/=np.linalg.norm(ang)
def segment(k,d):
 for b in m['batches']:
  if b['materialName'].split(':')[-1]!=k:continue
  for v in b['roles']:
   if v['role']==d:yield from t[b['triangleStart']+v['first']:b['triangleStart']+v['first']+v['count']]
def points(v):
 dx=v[:,1]-v[:,0];dy=v[:,2]-v[:,0];n=np.cross(dx,dy);return v[(n[:,1]>1e-4)&(abs(n[:,0])+abs(n[:,2])<.00001*abs(n[:,1]))]
surf=points(np.array(list(segment('stone','east-steps'))));assert len(surf)==12; levels=np.unique(np.round(surf[:,:,1].mean(axis=1),5));assert len(levels)==6
true=np.array(g['localRows']);xz=true[:,:,[0,2]];aa=xz[:,1]-xz[:,0];bb=xz[:,2]-xz[:,0];det=aa[:,0]*bb[:,1]-aa[:,1]*bb[:,0]
def ground(pt):
 q=pt-xz[:,0];u=(q[:,0]*bb[:,1]-q[:,1]*bb[:,0])/det;v=(aa[:,0]*q[:,1]-aa[:,1]*q[:,0])/det;sel=np.flatnonzero((u>=-1e-9)&(v>=-1e-9)&(u+v<=1+1e-9));assert len(sel);i=sel[0];return true[i,0,1]+u[i]*(true[i,1,1]-true[i,0,1])+v[i]*(true[i,2,1]-true[i,0,1])
result=[]
for height in sorted(levels):
 faces=surf[abs(surf[:,:,1].mean(axis=1)-height)<.00001];xz3=np.unique(faces[:,:,[0,2]].reshape(-1,2),axis=0);assert len(xz3)==4
 # True lengthwise tread edges ~13m, not axis approximation side-to-side. Choose both longest adjacent edges by orthogonal short-depth links; farthest midpoint toward documented street is true toe.
 vecs=xz3[:,None,:]-xz3[None,:,:];dist=np.linalg.norm(vecs,axis=-1);edges=[(xz3[i],xz3[j]) for i in range(4) for j in range(i) if 12<dist[i,j]<13.125];assert len(edges)==2,(dist,edges)
 lo,hi=max(edges,key=lambda p:((p[0]+p[1])*.5-o)@ang)
 xy=np.linspace(lo,hi,201)-o;realY=g['gameBase']+float(faces[:,:,1].mean())-m['actualGroupOrigin'][1]
 grade=np.array([ground(p) for p in xy]);gap=realY-grade
 result.append({'exposedStoneTreadTopGameY':realY,'toeDepthAlongNamedStreetM':float(xy.mean(axis=0)@ang),'widthM':float(np.linalg.norm(hi-lo)),'supportGapOver201PeakSamples':list(map(float,[gap.min(),np.median(gap),gap.max()])),'belowGradeSamples':int((gap<0).sum()),'toeEndpointsGameXZRelative':[xy[0].tolist(),xy[-1].tolist()]})
deltas=np.diff([i['exposedStoneTreadTopGameY'] for i in result]);assert (abs(deltas-.15)<.00001).all();assert result[0]['toeDepthAlongNamedStreetM']>result[-1]['toeDepthAlongNamedStreetM'];rise=result[0]['supportGapOver201PeakSamples'];assert 0<rise[0] and rise[-1]<.30
r={'sourceSHA':m['dataSHA256'],'groundFromOriginalN112':g['positions'],'gameRootY':g['gameBase'],'purpose':'Actual lowest outward edge of each emitted upward stone tread after removing only trim/rail from this semantic subtest, 201 equally spaced true game-ground downrays per tread. Physical story is original artistic stair scale, not historical or surveyed architecture. Full optical group visibility tested separately. Deep below-grade skirt is not a walking collision.','count':6,'actualRiserHeightRangeM':[float(deltas.min()),float(deltas.max())],'lowestTreadClearanceM':rise,'lowestStepVisibleThroughGroundAllAlongToe':True,'treads':result}
a.out.write_text(json.dumps(r,indent=2)+'\n');print('actual 6×201, toe low/median/high',rise,'rises',r['actualRiserHeightRangeM'])
