"""Bounded DHDEM witness for the original Hangar 4 atlas footprint only."""
from pathlib import Path
from sys import argv
import gzip,hashlib,json,numpy as np,runpy
r=Path(argv[2]).resolve();o=Path(argv[1]).resolve()
H=runpy.run_path(str(r/'tools/qa/roof-fit-pilot.py'))
S,T,g,P=H['open_models']()
A=r/'public/world/buildings';i=json.loads((A/'index.json').read_text());b=(A/'tiles.pack').read_bytes()
assert hashlib.sha256(b).hexdigest()==i['sha256']
t=next(x for x in i['tiles'] if x['id']=='q032022')
p=b[t['offset']:t['offset']+t['bytes']];assert hashlib.sha256(p).hexdigest()==t['sha256']
assert i['sha256']=='538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557'
f=json.loads(gzip.decompress(p))['features'][0]
assert not f.get('holes')
ll=np.array(f['footprint'])
ring=np.array(P.TransformPoints(ll.tolist()))[:,:2]
r0=(ring-np.array([g[0],g[3]]))*[1,-1]
a,c=np.floor(r0.min(0)-8).astype(int);b,d=np.ceil(r0.max(0)+8).astype(int)
h=S.ReadAsArray(int(a),int(c),int(b-a),int(d-c));terrain=T.ReadAsArray(int(a),int(c),int(b-a),int(d-c))
yp,xp=np.mgrid[c:d,a:b]+.5;native=np.stack([xp,yp],axis=-1)
inside=np.zeros(h.shape,dtype=bool);edge=np.full(h.shape,np.inf)
for u,v in zip(r0,np.roll(r0,-1,axis=0)):
 z=v-u;delta=native-u
 if z[1]!=0:inside^=((u[1]>yp)!=(v[1]>yp))&(xp<u[0]+(yp-u[1])*z[0]/z[1])
 off=np.clip(np.einsum('...i,i->...',delta,z)/(z@z),0,1)
 edge=np.minimum(edge,np.linalg.norm(delta-off[...,None]*z,axis=-1))
ok=inside&(edge>1.3)&(h>-200)&(terrain>-200)&np.isfinite(h)&np.isfinite(terrain)
pinned='01f063f87203f0c48382fbd661c10fc72315c2c5a41e5e7bf678ec6dd9bce0e0'
assert hashlib.sha256(h.astype('<f4').tobytes()+terrain.astype('<f4').tobytes()).hexdigest()==pinned, 'Source DEM window did not match pinned sample'
center=ring.mean(0)
_,_,pca=np.linalg.svd(ring-center,full_matrices=False)
pointGrid=(native*[1,-1]+[g[0],g[3]]-center)@pca.T
A,B=pointGrid[:,:,0],pointGrid[:,:,1]
absolute=pca.tolist()
bands=[]
for axis,v in [('long',A),('short',B)]:
 for lo in np.arange(int(v[ok].min())-1,int(v[ok].max())+1,5):
  p=ok&(v>=lo)&(v<lo+5)
  if p.sum():bands.append(dict(axis=axis,span=[int(lo),int(lo+5)],n=int(p.sum()),median=float(np.median(h[p])),p10=float(np.quantile(h[p],.1)),p90=float(np.quantile(h[p],.9))))
q={'owner':'q032022/0','assertedAEBFootprint':f['footprint'],'atlasSha':i['sha256'],'native':H['ROOT']+'/'+H['ITEM'],
   'window':[int(a),int(c),int(b-a),int(d-c)],'grid':[g[0],g[3]],'inputSha':hashlib.sha256(h.astype('<f4').tobytes()+terrain.astype('<f4').tobytes()).hexdigest(),
   'axes':absolute,'c':center.tolist(),'fitScope':int(ok.sum()),'boundsM':np.ptp((ring-center)@pca.T,axis=0).tolist(),'predictedHeight':float(f['height']),
   'roofQuantiles':np.quantile(h[ok],[0,.1,.5,.9,1]).tolist(),'groundQuantiles':np.quantile(terrain[ok],[0,.1,.5,.9,1]).tolist(),'bands':bands}
(o/'native.json').write_text(json.dumps(q,indent=2)+'\n')
np.savez_compressed(o/'native.npz',dsm=h,dtm=terrain,fit=ok,xAbs=xp+g[0],yAbs=g[3]-yp,A=A,B=B)
print(q)
