"""Independent nearest opaque geometry along the registered named-street axis, not program/author role membership alone. CPU, true world triangles. Projection is deliberately orthographic for diagnosing polarity, not a substitute for authentic photos/flight views."""
import argparse,numpy as np,json,math,hashlib
from pathlib import Path as P
p=argparse.ArgumentParser();p.add_argument('--stock',type=P,required=True);p.add_argument('--candidate',type=P,required=True);p.add_argument('--out',type=P,required=True);a=p.parse_args()
H=lambda b:hashlib.sha256(b).hexdigest();J=lambda p:json.loads(p.read_bytes());f=np.array([.731819806619,-.681498180952]);f/=np.linalg.norm(f);r=np.array([f[1],-f[0]]);side=.06;z0=0.0;ug=np.arange(-20+side/2,20,side);ys=np.arange(-.75+side/2,52,side)
uv,yv=np.meshgrid(ug,ys)
def go(src):
 m=J(src/'geometry.json');b=(src/m['file']).read_bytes();assert H(b)==m['dataSHA256'];tri=np.frombuffer(b,dtype='<f8').reshape(-1,3,3).copy();tri-=np.array(m['actualGroupOrigin']); hz=tri[:,:,[0,2]];U=hz@r;V=tri[:,:,1];D=hz@f; roles=['legacyUnsplit'];typ=np.zeros(len(tri),int);rn=np.zeros(len(tri),int)
 for bi,bat in enumerate(m['batches']):
  st=bat['triangleStart'];typ[st:st+bat['triangleCount']]=bi
  for t in bat.get('roles',[]):
   if t['role'] not in roles: roles.append(t['role'])
   rn[st+t['first']:st+t['first']+t['count']]=roles.index(t['role'])
 mats=[bat.get('materialName') or ('wood' if bat['materialColor']=='43312a' else 'legacy:'+bat['materialColor']) for bat in m['batches']]; mi=next(k for k,v in enumerate(mats) if v.split(':')[-1]=='wood')
 wood=typ==mi; q3=tri[wood];norm=np.cross(q3[:,1]-q3[:,0],q3[:,2]-q3[:,0]);area3=np.linalg.norm(norm,axis=1);nx=norm[:,[0,2]];ng=nx@f; frontaligned=abs(ng)>.985*area3
 result={'triangleSHA256':m['dataSHA256'],'trueNearPlanarWoodAreaBothWindsM2':float(area3[frontaligned].sum()*.5),'opposed':{},'localHighest':float(tri[:,:,1].max())}
 for sense in [1,-1]:
  zb=np.full((len(ys),len(ug)),-np.inf); buf=np.full(zb.shape,-1,dtype=np.int32)
  for i in range(len(tri)):
   uu=U[i];vv=V[i];dd=D[i]*sense;jx,kx=uu[1:]-uu[0];jy,ky=vv[1:]-vv[0];det=jx*ky-jy*kx
   if det*sense<1e-8:continue
   k0=int(np.searchsorted(ug,uu.min()-1e-10));k1=int(np.searchsorted(ug,uu.max()+1e-10,side='right'));j0=int(np.searchsorted(ys,vv.min()-1e-10));j1=int(np.searchsorted(ys,vv.max()+1e-10,side='right'))
   if k0>=k1 or j0>=j1:continue
   s=np.s_[j0:j1,k0:k1];xx=uv[s]-uu[0];yy=yv[s]-vv[0];h=(xx*ky-yy*kx)/det;k=(jx*yy-jy*xx)/det;yy2=dd[0]+h*(dd[1]-dd[0])+k*(dd[2]-dd[0]);touch=(h>=-1e-9)&(k>=-1e-9)&(h+k<=1+1e-9)&(yy2>zb[s]);np.copyto(zb[s],yy2,where=touch);np.copyto(buf[s],i,where=touch)
  visited=buf>=0; woodSeen=visited&(typ[buf]==mi); ww=woodSeen.sum(axis=0)>2
  # Evaluate materially visible door bands across all U; allow slim mullions/panel lines inside, collapse gaps under .17m, do not bridge door separation.
  cut=lambda v:np.split(v,np.flatnonzero(np.diff(v)>.18/side+.01)+1) if len(v) else []
  cc=cut(np.flatnonzero(ww)); cc=[idx for idx in cc if (ug[idx[-1]]-ug[idx[0]]+.06)>.42]
  per=[]
  for idx in cc:
   pos=np.nonzero(woodSeen[:,idx]);per.append({'acrossMinMaxM':[float(ug[idx[0]]),float(ug[idx[-1]])],'visibleOakAreaM2':float(len(pos[0])*side**2),'lowHighM':[float(ys[pos[0]].min()),float(ys[pos[0]].max())]})
  def byrole(name):return int(np.sum(visited&(rn[buf]==roles.index(name)))) if name in roles else None
  k='towardNamedGreatGeorge' if sense==1 else 'oppositeRear';result['opposed'][k]={'oakDoorComponents':len(cc),'oakProjectedAreaM2':float(woodSeen.sum()*side**2),'genuineDepthVisibleWood':per,'rolePixels':{n:byrole(n) for n in ['east-front','east-steps','east-left-tower','east-right-tower','western-sanctuary','crossing-lantern']},'referenceSurfaceOutside':'simulated mounted native front renders and exterior photos still independently required'}
 if len(roles)>1:
  summ=[]
  for n in ['east-left-tower','east-right-tower','east-front','western-sanctuary','crossing-lantern']:
   cutt=rn==roles.index(n);t=tri[cutt];z=t[:,:,1];at=z>z.max()-.002;cent=(t[at][:,[0,2]]).mean(axis=0);summ.append({'role':n,'highestRelative':float(z.max()),'summitMeanXZRelative':cent.tolist(),'depthAlongStreetAtSummit':float(cent@f),'lateralAtSummit':float(cent@r)})
  result['trueRoleHighPoints']=summ
 return result
stock=go(a.stock);new=go(a.candidate);rs={'authority':'Independent preregistered documented road normal in true simulator XZ. Reconstructed each actual opaque oriented triangle and nearest front face at 6 cm orthographic spacing. Relative tower heights are old authored game scale, not native elevations or an image silhouette measurement. Optical camera/lighting and protected ground separately tested.','old':stock,'candidate':new}
a.out.write_text(json.dumps(rs,indent=2)+'\n')
for k,v in [('old',stock),('new',new)]:print(k,[(q,t['oakDoorComponents'],t['oakProjectedAreaM2']) for q,t in v['opposed'].items()])
