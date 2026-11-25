"""Authenticate the authored physical contact feature locators against real submitted world vertices rather than re-generating ideal form."""
from pathlib import Path as P
import argparse,json,hashlib,numpy as np
p=argparse.ArgumentParser();p.add_argument('input',type=P);p.add_argument('out',type=P);a=p.parse_args();root=a.input.parent;doc=json.loads(a.input.read_bytes());H=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
sets=[];x=[]
for role in doc['roles']:
 path=root/role['file'];assert H(path)==role['sha256'];p=np.fromfile(path,dtype='<f4').reshape(-1,3).astype('f8');assert len(p)==role['vertices'];M=np.asarray(role['matrixWorld']).reshape(4,4).T
 sets.append((np.c_[p,np.ones(len(p))]@M.T)[:,:3]);x.append({'buffer':role['sha256'],'triangles':role['triangles'],'name':role['role']})
v=np.concatenate(sets);assert len(v)==3*doc['allTriangles']
def check(raw):
 raw=np.asarray(raw,float);pts=raw.reshape(-1,3);d=[]
 for q in pts:d.append(float(np.min(np.linalg.norm(q-v,axis=1))))
 assert max(d)<1e-7,('Not a true emitted vertex',max(d));return raw.tolist()
base=check(doc['actualBaseEdgesWorld']);sid=check(doc['actualSidingStartWorld']);gl=check(doc['actualGalleryLevelWorld']);thr=check([q['p']for q in doc['actualThreshold']])
bottomStep=[]
for top in np.array(thr):
 coll=v[np.linalg.norm(v[:,[0,2]]-top[[0,2]],axis=1)<1e-7];low=coll[np.argmin(coll[:,1])];assert low[1]<top[1]-.04
 bottomStep.append(low.tolist())
out={'actualThresholdBottomXYZ':bottomStep,'geometryIdentity':{'summaryInputSHA256':H(a.input),'roles':x,'allSelectedPointersMatchActualVerticesWithinM':1e-7},'actualBottomRingXYZ':base,'actualSidingBottomRingXYZ':sid,'actualGalleryLevelXYZ':gl,'actualThresholdXYZ':thr,'actualTipXYZ':[v[np.argmax(v[:,1])].tolist()]};a.out.write_text(json.dumps(out,separators=(',',':'))+'\n');print('actual emitted vertex/tri counts',len(v),doc['allTriangles'],len(thr),'complete span Y',v[:,1].min(),v[:,1].max());np.asarray(v,dtype='<f8').tofile(a.out.parent/'cpu-new-triangles.f64le');(a.out.parent/'cpu-new-triangles.json').write_text(json.dumps({'file':'cpu-new-triangles.f64le','trianglesCount':len(v)//3,'sha256':H(a.out.parent/'cpu-new-triangles.f64le')})+'\n')
