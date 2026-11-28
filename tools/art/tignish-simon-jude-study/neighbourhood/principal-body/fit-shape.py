"""Fit only the author slabs; a separate mode evaluates the single frozen form."""
from pathlib import Path
from hashlib import sha256
import argparse,json
import numpy as np
from scipy.optimize import least_squares

LOCK='423ede3848958f0e6e98999e041307b0931e68f0e56c034e31d30f7dbc71c5c0'
PLAN='5d6bde4678294da1b4e94e3769ba4c449ddaee49b50c7da8ad6ef8f014b68087'
HERE=Path(__file__).resolve().parent
def digest(b):return sha256(b).hexdigest()
def fit_value(par,q,kind):
 u,v=q.T
 if kind=='constant':return np.full(len(q),par[0]),np.zeros(len(q),int)
 if kind=='plane':return par[0]+par[1]*u+par[2]*v,np.zeros(len(q),int)
 h,ux,a,b,k=par[:5]
 off=u-ux-k*v
 h1=h+a*off;h2=h-b*off
 channels=[h1,h2]
 if kind in ('hip-near','hip-both'):
  near,w=par[5:7];channels.append(h+w*(v-near))
 if kind in ('hip-far','hip-both'):
  far,w=par[-2:];channels.append(h+w*(far-v))
 full=np.asarray(channels)
 return np.min(full,axis=0),np.argmin(full,axis=0)

def stats(e):
 return {'signedMedian':float(np.median(e)),'medianAbs':float(np.median(np.abs(e))),
         'p90Abs':float(np.quantile(np.abs(e),.9)),'maxAbs':float(np.max(np.abs(e)))}
def fit(train):
 q,z=train[:,:2],train[:,2]
 accepted=[]
 def record(k,x,min_count):
  y,rows=fit_value(x,q,k);count=np.bincount(rows,minlength=2+(0 if k=='ridge' else (2 if k=='hip-both' else 1)))
  if min_count and int(count.min())<min_count:return
  st=stats(y-z)
  complexity={'constant':0.,'plane':.02,'ridge':.04,'hip-near':.085,'hip-far':.085,'hip-both':.13}[k]
  score=.6*st['medianAbs']+.4*st['p90Abs']+complexity
  accepted.append((score,k,dict(kind=k,params=list(map(float,x)),trainStats=st,authorFacetCellCounts=count.tolist(),trainScore=float(score))))
 record('constant',[float(np.median(z))],0)
 A=np.c_[np.ones(len(z)),q]
 plane=least_squares(lambda x:A@x-z,[float(np.median(z)),0.,0.],loss='soft_l1',f_scale=.23)
 record('plane',plane.x,0)
 # Candidate shape has no vertical shift; all height values stay in survey datum.
 fits=[]
 for u in [4.5,6.4,8.4]:
  for k in [-.06,0.,.06]:
   seeds=[float(np.quantile(z,.90)),u,.63,.58,k]
   lo=[24,3.1,.18,.18,-.12];hi=[40,9.9,1.6,1.6,.12]
   if not lo[0]<seeds[0]<hi[0]:continue
   obj=least_squares(lambda x:fit_value(x,q,'ridge')[0]-z,seeds,bounds=(lo,hi),
                     loss='soft_l1',f_scale=.22,max_nfev=140)
   if not obj.success:continue
   fits.append((float(obj.cost),obj.x))
 if fits:
  g=min(fits,key=lambda x:x[0])[1]
  record('ridge',g,7)
  for kind in ('hip-near','hip-far','hip-both'):
   best=None
   for near in (.9,2.9,4.0):
    for far in (9.7,11.4,12.7):
     new=[];lo=[24,3.1,.18,.18,-.12];hi=[40,9.9,1.6,1.6,.12]
     if kind!='hip-far': new.extend([near,.65]);lo.extend([.2,.18]);hi.extend([5.,1.60])
     if kind!='hip-near':new.extend([far,.65]);lo.extend([8.0,.18]);hi.extend([13.5,1.60])
     obj=least_squares(lambda x:fit_value(x,q,kind)[0]-z,[*g,*new],bounds=(lo,hi),
       loss='soft_l1',f_scale=.22,max_nfev=180)
     c=np.bincount(fit_value(obj.x,q,kind)[1],minlength=4 if kind=='hip-both' else 3)
     if not obj.success or min(c)<7:continue
     if best is None or obj.cost<best[0]:best=(float(obj.cost),obj.x)
   if best:record(kind,best[1],7)
 models=[r[2] for r in sorted(accepted,key=lambda x:(x[0],x[1]))]
 choice=next((m for m in models if m['kind'] not in ('constant','plane')),None)
 return models,choice

def evaluate(held,author):
 assert held['lockedFitSHA256']==digest(author)
 j=json.loads(author);best=j['frozenCurvedCandidate']
 assert best and j['shapeLockSHA256']==LOCK and j['onlyAuthoredDataRead']
 result=[];allerr=[];baselineErr={k:[] for k in ('constant','plane')};holds=[]
 for name in ('held1','held3'):
  ux=np.array(held['cohorts'][name])
  pr,m=fit_value(best['params'],ux[:,:2],best['kind']);z=ux[:,2]
  err=pr-z;st=stats(err);allerr.extend(err)
  rank=[int(np.count_nonzero(m==i)) for i in (0,1)]
  row={'slab':name,'cells':len(z),'heldSideCounts':rank,'candidate':st,'baselines':{}}
  if len(z)<25 or min(rank)<5 or abs(st['signedMedian'])>.12 or st['p90Abs']>.50:
   holds.append(name+' residual or coverage')
  for parent in (v for v in j['allAuthorModels'] if v['kind'] in baselineErr):
   pred,_=fit_value(parent['params'],ux[:,:2],parent['kind'])
   e=pred-z;baselineErr[parent['kind']].extend(e)
   row['baselines'][parent['kind']]=stats(e)
  result.append(row)
 e=stats(allerr);b={k:stats(v) for k,v in baselineErr.items()}
 if e['p90Abs']>.36:holds.append('pooled held P90')
 if min(v['p90Abs'] for v in b.values())-e['p90Abs']<.20:holds.append('held benefit over physical flat and tilted baselines')
 return {'status':'HOLD' if holds else 'PASS bounded principal interior hypothesis only','holds':holds,
  'pooledHeld':e,'pooledBaseline':b,'perSlab':result,'shapeLockSHA256':LOCK,'modelSHA256':digest(author),
  'nativeDatum':'same point acquisition, no horizontal or height offset','canBuildFullRoofOrWalls':False}

def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('--data',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
 p.add_argument('--locked-fit',type=Path)
 a=p.parse_args()
 assert digest((HERE/'SHAPE-LOCK.json').read_bytes())==LOCK
 raw=a.data.read_bytes();j=json.loads(raw)
 assert j['shapeLockSHA256']==LOCK and j['planSHA256']==PLAN
 if not a.locked_fit:
  assert j['mode']=='author' and list(j['cohorts'])==['author'] and len(j['cohorts']['author'])==68
  models,chosen=fit(np.array(j['cohorts']['author']))
  doc={'scope':'No withheld values seen during fit, bounded interior not a complete roof.',
       'shapeLockSHA256':LOCK,'onlyAuthoredDataRead':True,'authorDataSHA256':digest(raw),
       'allAuthorModels':models,'frozenCurvedCandidate':chosen}
 else:
  assert j['mode']=='hold' and list(j['cohorts'])==['held1','held3']
  doc=evaluate(j,a.locked_fit.read_bytes())
 with a.out.open('x') as f:f.write(json.dumps(doc,indent=2)+'\n')
 if a.locked_fit:print(doc['status'],doc['holds'],doc['pooledHeld'])
 else:
  print('Frozen',doc['frozenCurvedCandidate'])
if __name__=='__main__':main()
