"""Feasibility only: source metre-grade normals vs exact CPU ground reference."""
from pathlib import Path
from hashlib import sha256
import argparse, gzip, importlib.util, json
import numpy as np
from scipy.ndimage import distance_transform_edt, convolve1d
HERE=Path(__file__).parent
EXPECTED='8ce3bffd6b2a8c787aa54e48ce8bdbe729c68262d31b0b54cb6f7fa67ca08d15'
ROI_PIN='3db20dbe3b1280158651ddaa850e4c4036d41122fc823fcbe022577ae9fdecb5'
def sha(b):return sha256(b).hexdigest()
f=HERE/'analyze-whole-aabb.py';spec=importlib.util.spec_from_file_location('source_guards',f)
S=importlib.util.module_from_spec(spec);spec.loader.exec_module(S)
def stock_gradient(b,cfg,x,z):
 O=np.asarray(cfg['origin'],float)
 P=np.frombuffer(b,'<f4').reshape(113,113,3)
 X=np.add(P[0,:,0],np.float32(O[0])).astype(float)
 Z=np.add(P[:,0,2],np.float32(O[2])).astype(float)
 Y=P[:,:,1].astype(float)
 i=np.searchsorted(X,x)-1;j=np.searchsorted(Z,z)-1
 assert np.all((i>=0)&(j>=0)&(i<112)&(j<112))
 dx=X[i+1]-X[i];dz=Z[j+1]-Z[j]
 u=(x-X[i])/dx;v=(z-Z[j])/dz
 a,b,c,d=Y[j,i],Y[j,i+1],Y[j+1,i],Y[j+1,i+1]
 return np.where(u+v<=1,(b-a)/dx,(d-c)/dx),np.where(u+v<=1,(c-a)/dz,(d-b)/dz)
def dgrad(H,east,north):
 k=np.array([1,4,6,4,1],float)/16
 G=convolve1d(convolve1d(H,k,axis=0,mode='nearest'),k,axis=1,mode='nearest')
 horiz=(np.roll(G,-4,axis=1)-np.roll(G,4,axis=1))/8
 vert=(np.roll(G,-4,axis=0)-np.roll(G,4,axis=0))/8
 xa,za=S.native_to_world(east+.5,north);xb,zb=S.native_to_world(east-.5,north)
 xd,zd=S.native_to_world(east,north-.5);xe,ze=S.native_to_world(east,north+.5)
 c1,c2,d1,d2=xa-xb,za-zb,xd-xe,zd-ze
 det=c1*d2-c2*d1;assert np.min(abs(det))>.90
 return (horiz*d2-vert*c2)/det,(vert*c1-horiz*d1)/det
def native_normal(g,h):
 n=np.stack((-g,np.ones_like(g),-h),axis=2)
 return n/np.linalg.norm(n,axis=2,keepdims=True)
def cases(a,lock):
 plan=json.loads(a.plan.read_bytes());w=sha(a.plan.read_bytes());assert plan['prelockBeforeNativeReads']==S.PIN
 source=json.loads((a.source/'source.json').read_bytes());assert source['windowsPlanSHA256']==w
 stock=json.loads((a.stock/'stock.json').read_bytes());pre=json.loads((HERE/'PRELOCK.json').read_bytes())
 l=np.asarray(lock['sunUnitBeforeNormalization'],float);l/=np.linalg.norm(l)
 results={}
 def case(case,rec,X,Z,A,B,G,base):
  name=case['id']
  sig=stock['owners'][name]
  assert sig['stockTile']==case['terrainTile']
  word=sig['files']['position'];b=(a.stock/word['name']).read_bytes()
  assert len(b)==word['size'] and sha(b)==word['sha256']
  # Recheck literal compressed source EBO before evaluating the two regular triangles.
  t=sig['files']['index'];idx=(a.stock/t['name']).read_bytes()
  assert sha(idx)==t['sha256']==sig['files']['index']['sha256'] and len(idx)==75264*2
  u=np.frombuffer(idx,'<u2').reshape(-1,6)
  I=(113*np.arange(112)[:,None]+np.arange(112)[None,:]).ravel()
  assert np.array_equal(u,np.stack([I,I+113,I+1,I+113,I+114,I+1],axis=1))
  bg,bh=stock_gradient(b,sig,X,Z);ng,nh=dgrad(G,A,B)
  dist=distance_transform_edt(np.pad(base,1))[1:-1,1:-1]
  # Four metres of half-span plus two source low-pass cells and a 1m guard.
  eligible=base&(dist>7)&(np.hypot(ng,nh)<=lock['maxSourceSlope'])
  raw=native_normal(ng,nh);old=native_normal(bg,bh)
  t=np.clip((dist-7)/(lock['partialBoundaryRadiusMetres']-7),0,1);f=t*t*(3-2*t)
  blend=old+(raw-old)*f[:,:,None]
  blend/=np.linalg.norm(blend,axis=2,keepdims=True)
  angle=np.rad2deg(np.arccos(np.clip(np.sum(blend*old,axis=2),-1,1)))
  signal=np.abs(np.maximum(old@l,0)-np.maximum(blend@l,0))
  raw=(a.roi/'manifest.json').read_bytes();assert sha(raw)==ROI_PIN
  meta=json.loads(raw)['roles'][name]
  assert meta['actualProjectionSource']==case['artistROISHA256']
  assert sha((a.roi/(name+'-projection.json')).read_bytes())==case['artistROISHA256']
  numeric=[];seen=[]
  for tick in lock['stationTicks']:
   row=meta['frames'][str(tick)]
   wire=(a.roi/row['leaf']).read_bytes();assert sha(wire)==row['archiveSHA256']
   data=gzip.decompress(wire)
   assert sha(data)==row['contentSHA256'] and len(data)==row['bytes']
   n=np.frombuffer(data,'<u2').reshape(row['height'],row['width'])
   assert n.shape==G.shape and int(n.sum())==row['rays'] and int((n>0).sum())==row['independentNativeCells']
   seen.append(n>0)
   keep=eligible&(n>0)
   sample=np.argwhere(keep)
   y,x=tuple(sample.T)
   independent=np.unique((sample+np.array(rec['xywh'][:2][::-1]))//8,axis=0)
   aa,ss=S.quant(angle[y,x]),S.quant(signal[y,x])
   good=(len(independent)>=lock['minRoleSupportedIndependentRegistrationBlocksEachStation'] and
          aa['p90']>=lock['minNormalChangeAtP90Degrees'] and ss['p90']>=lock['minShadeCosineDeltaAtP90'])
   numeric.append({'tick':tick,'fixedRolePixels':int(n.sum()),'supportedPixels':int(n[keep].sum()),
    'uniqueNativeCells':len(sample),'eightMetreRegistrationBlocks':len(independent),
    'P50ToP90NormalChangeDeg':aa,'p90ShadeCosineAbsDelta':None if ss is None else ss['p90'],
    'normalFeasibilityOnly':bool(good)})
  assert not (seen[0]&seen[1]).any()
  r=meta['originalPixelsSHA256']
  results[name]={'stockPositionSha':word['sha256'],'privateRayCustodySHA256':r,
      'staticExtraWarning':'Full resolution raw P from current CPU initial mesh; native far seams may differ.',
      'fullCropEligibleCellCount':int(eligible.sum()),'actualDetachedRayRegistrationStats':numeric,
      'qualifiedAtBothPhysicalStations':all(n['normalFeasibilityOnly'] for n in numeric)}
 S.fields(a,plan,source,json.loads(a.peer.read_bytes()),json.loads((a.mask/'mask-receipt.json').read_bytes()),pre,case)
 return {'scope':lock['scope'],'lock':EXPECTED,'pairSourceSHA':sha((a.source/'source.json').read_bytes()),'results':results}
def main():
 p=argparse.ArgumentParser(description=__doc__)
 for arg in ['source','plan','peer','mask','repo','stock','roi','out']:p.add_argument('--'+arg,type=Path,required=True)
 a=p.parse_args()
 b=(HERE/'DTM-OPTIC-PRELOCK.json').read_bytes();assert sha(b)==EXPECTED
 out=cases(a,json.loads(b))
 with a.out.open('x') as f:f.write(json.dumps(out,indent=2)+'\n')
 for name,data in out['results'].items():print(name,data['actualDetachedRayRegistrationStats'])
if __name__=='__main__':main()
