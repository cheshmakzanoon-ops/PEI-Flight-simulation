"""Private cohort staging from one immutable raw survey; never exports the other cohort."""
import argparse,json
from pathlib import Path
from hashlib import sha256
import numpy as np
from laspy import CopcReader, DecompressionSelection as Sel
from partition import selected
D=Path(__file__).parent
PIN='5d6bde4678294da1b4e94e3769ba4c449ddaee49b50c7da8ad6ef8f014b68087'
def sha(d):return sha256(d).hexdigest()
def main():
 p=argparse.ArgumentParser(description=__doc__)
 for k in ('root','copc','out'):p.add_argument('--'+k,type=Path,required=True)
 p.add_argument('--mode',required=True,choices=['author','hold'])
 p.add_argument('--locked-fit',type=Path)
 a=p.parse_args()
 plan=(D/'plan.json').read_bytes();assert sha(plan)==PIN
 lock=(D/'SHAPE-LOCK.json').read_bytes()
 assert sha(lock)==SHAPE_LOCK_SHA
 prereg=json.loads((D/'partition.json').read_text())
 assert prereg['planSHA256']==PIN and prereg['noZAccess']
 if a.mode=='hold':
  assert a.locked_fit and a.locked_fit.is_file()
  bs=a.locked_fit.read_bytes()
  doc=json.loads(bs);assert doc['shapeLockSHA256']==SHAPE_LOCK_SHA and doc['onlyAuthoredDataRead']
  future=sha(bs)
 else:
  assert not a.locked_fit
  future=None
 o,u,v,W,groups,UV,raw,stamp,bounds=selected(a.root,a.copc,json.loads(plan))
 assert sha(np.asarray(W,'<f8').tobytes())==prereg['ownerRing3979SHA256']
 for g,l in zip(groups,prereg['cohorts']):
  j=g[np.lexsort((stamp[g],raw[g,1],raw[g,0]))]
  a1=np.empty(len(j),dtype=[('x','<i4'),('y','<i4'),('time','<f8')])
  a1['x'],a1['y'],a1['time']=raw[j,0],raw[j,1],stamp[j]
  assert sha(a1.tobytes())==l['canonicalRowsSHA256']
 with CopcReader.open(a.copc,decompression_selection=Sel.XY_RETURNS_CHANNEL|Sel.Z|Sel.GPS_TIME) as f:
  fpoint=f.query(bounds)
  # Random-access envelope may share compression chunks. Expose only chosen
  # cohort indices to the fitter; no unselected return ordinates leave here.
  assert np.array_equal(fpoint.X,raw[:,0]) and np.array_equal(fpoint.Y,raw[:,1])
  assert np.array_equal(fpoint.gps_time,stamp)
  scale=f.header.scales[2];offset=f.header.offsets[2]
 chosen=[('author',groups[0])] if a.mode=='author' else [('held1',groups[1]),('held3',groups[2])]
 paired={}
 for name,t in chosen:
  xyz=np.c_[UV[t],np.asarray(fpoint.Z[t],dtype=float)*scale+offset]
  cell=np.floor(xyz[:,:2]).astype(np.int64)
  uniq,ij,cnt=np.unique(cell,return_inverse=True,return_counts=True,axis=0)
  assert np.min(cnt)>=2
  med=[np.median(xyz[ij==q],axis=0).tolist() for q in range(len(uniq))]
  assert len(med)==next(k['cells'] for k in prereg['cohorts'] if k['cohort']==name)
  paired[name]=med
 report=dict(scope='Numerical selected cohort only; no extrapolated roof or game output',mode=a.mode,
   planSHA256=PIN,shapeLockSHA256=SHAPE_LOCK_SHA,lockedFitSHA256=future,
   widthOriginFrameEPSG3979={'origin':o.tolist(),'u':u.tolist(),'v':v.tolist()},
   cohorts=paired)
 with a.out.open('x') as f:f.write(json.dumps(report,indent=2)+'\n')
 print(a.mode,[(k,len(x)) for k,x in paired.items()])

SHAPE_LOCK_SHA='423ede3848958f0e6e98999e041307b0931e68f0e56c034e31d30f7dbc71c5c0'
if __name__=='__main__':main()
