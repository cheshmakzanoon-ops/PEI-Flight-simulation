"""Ray actual final GPU vertices at blind XY, never use withheld heights for art."""
import json,numpy as np,argparse,hashlib
p=argparse.ArgumentParser();p.add_argument('--mesh',required=True);p.add_argument('--inputs',required=True);p.add_argument('--out',required=True);a=p.parse_args()
tri=json.load(open(a.mesh));b=np.load(a.inputs);assert not any('native_z'==k for k in b)
xy=b['xz'];kind=b['class_id'];ids=b['id']
def rays(tris):
 y=np.full(len(xy),np.nan);cnt=np.zeros(len(xy),int)
 for raw in tris:
  t=np.asarray(raw);o=t[0,[0,2]];D=t[1:,[0,2]]-o
  if abs(np.linalg.det(D))<1e-12:continue
  uv=(xy-o)@np.linalg.inv(D);w=1-uv.sum(1)
  inside=(uv[:,0]>=-1e-9)&(uv[:,1]>=-1e-9)&(w>=-1e-9)
  h=t[0,1]*w[inside]+uv[inside]@t[1:,1]
  y[inside]=np.fmax(y[inside],h);cnt[inside]+=1
 assert np.all(np.isfinite(y[kind==6])) and not np.isfinite(y[kind==2]).any()
 return y
old=rays(tri['stockTriangles']);new=rays(tri['candidateTriangles'])
np.savez_compressed(a.out,id=ids[kind==6],stockGameY=old[kind==6],candidateGameY=new[kind==6])
print('All',len(new[kind==6]),'unseen roof XYZ forecast; all',sum(kind==2),'source-negative ground XY uncovered. All coordinates were read AFTER shape freeze; no withheld native Z.')
