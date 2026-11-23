#!/usr/bin/env python3
"""Continuous gabled and hipped roof planes, evaluated on unseen native DSM blocks."""
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
from collections import Counter
import argparse,json,math,os,runpy
import numpy as np
from osgeo import osr
from scipy.optimize import least_squares
osr.UseExceptions()
P=argparse.ArgumentParser(description=__doc__);P.add_argument('--root',required=True,type=Path);P.add_argument('--scratch',required=True,type=Path);P.add_argument('--jobs',type=int,default=5)
opts=P.parse_args();p=opts.scratch
common=runpy.run_path(str(opts.root/'tools/geodata/fit-farm-profiles.py'))
smask,gfit,old,fingerprint,Tback=(common[k]for k in ('mask_unit','gfit','sample_old','fprint','Tback'))
scale,origin=common['scale'],common['origin']
def sample_area(d,c):
 key=c['tile']+'_'+str(c['i'])
 ss,gg,o=(d[key+'_'+k]for k in ('surface','ground','origin'))
 ring=np.asarray(c['survey']);yy,xx=np.indices(ss.shape);xx,yy=o[0]+xx,o[1]-yy
 inside,margin=smask(ring,xx,yy);apron=inside&(margin>=(.99 if c['width']<=9.0 else 1.20))
 valid=apron&np.isfinite(ss)&np.isfinite(gg)&(gg>-200)&(ss>-200)&(ss-gg>1.0)&(ss-gg<25)
 if valid.sum()<31 or valid.sum()<apron.sum()*.963:return
 pairs=np.c_[xx[valid],yy[valid]]
 uv=np.array(Tback().TransformPoints(pairs.tolist()))[:,:2]
 xy=(uv-origin)*scale-c['world'];ring=(np.asarray(c['fp'])-origin)*scale-c['world']
 block=np.floor_divide(pairs,2.5).astype(int)
 hold=(block[:,0]*7+block[:,1]*3+1)%5==0
 if hold.sum()<8 or (~hold).sum()<24:return
 U,V=np.asarray(c['xy'])-o;V=-V
 a,b=math.floor(U),math.floor(V);x,y=U-a,V-b
 datum=float(np.einsum('j,i,ji',np.array([1-y,y]),np.array([1-x,x]),gg[b:b+2,a:a+2]))
 if not -40<datum<200:return
 return xy,ss[valid].astype(float)-datum,ring,hold,datum,fingerprint(ss,gg)
def pub_form(q):
 return {'gabled':'gable','hipped':'hip','flat':'flat','skillion':'shed'}.get(q)
def select_model(c,x,z,h,ring,hold):
 ss=h[~hold]
 oldErr=np.abs(old(np.c_[x,z],ring,c)-h)
 if not np.isfinite(oldErr).all(): return 'old footprint gap'
 tau=math.atan2(c['axis'][0],-c['axis'][1])
 obs=np.c_[np.ones(len(h)),x,z]
 def score(err):
  return .7*np.quantile(err[~hold],.5)+.3*np.quantile(err[~hold],.9)
 options=[]
 def record(fam,planes,conf=[]):
  pred=obs@planes.T
  ids=np.argmin(pred,axis=1)
  est=pred[np.arange(len(h)),ids]
  er=np.abs(est-h)
  p=np.min(np.c_[np.ones(len(ring)),ring]@planes.T,axis=1)
  if p.min()<1.85 or p.max()>c['h']+1.4 or est.max()<c['h']-2.9: return
  if fam=='hip' and (any((~hold&(ids==x)).sum()<6 for x in range(4)) or np.ptp(p)>1.36):return
  pen={'flat':.0,'shed':.045,'gable':.036,'hip':.074}[fam]
  options.append((score(er)+pen,fam,planes,er,ids,conf))
 val=np.median(ss)
 record('flat',np.array([[val,0,0]]))
 b,er=gfit(obs[~hold],ss,3)
 if b is not None and .09<np.linalg.norm(b[1:])<.53:record('shed',b.reshape((1,3)))
 trial=[]
 for dt in [-7.,-4.,-2.,0.,2.,4.,7.]:
  a=tau+math.radians(dt);normal=np.array([math.cos(a),math.sin(a)]);along=np.array([-normal[1],normal[0]])
  U=obs[:,1:]@normal;V=obs[:,1:]@along
  r=ring@normal;s=ring@along;lo,hi,back,front=r.min(),r.max(),s.min(),s.max()
  if hi-lo<5.7:continue
  for ratio in [.38,.42,.46,.50,.54,.58,.62]:
   def evaluate():
    bis=lo+(hi-lo)*ratio;L=U-bis
    if min((L[~hold]<-.75).sum(),(L[~hold]>.75).sum())<8:return
    Z=np.c_[np.ones(len(h)),np.minimum(L,0),-np.maximum(L,0)]
    beta,e=gfit(Z[~hold],ss,2)
    if beta is None or min(beta[1:])<.14 or max(beta[1:])>1.73:return
    off,ld,rd=beta
    planes=np.array([[off-ld*bis,*(ld*normal)],[off+rd*bis,*(-rd*normal)]])
    record('gable',planes,[dt,ratio])
    rank=.7*np.quantile(e,.5)+.3*np.quantile(e,.9)
    trial.append((rank,U,V,normal,along,lo,hi,back,front,bis,off,ld,rd,dt,ratio))
   evaluate()
 if trial:
  # A real hipped form must explain independent points on each of its end
  # planes. Derive likely pitch from the observed two long roof sides.
  for chosen in sorted(trial,key=lambda r:r[0])[:3]:
   rank,U,V,n,a,le,ri,back,front,bis,y0,k0,k1,delta,fract=chosen
   x1=(U-bis)[~hold];v1=(V-back)[~hold];v2=(front-V)[~hold]
   ua0=bis-le;ua1=ri-bis;basis=y0-(k0*ua0+k1*ua1)*.5;k=(k0+k1)*.5
   A= [y0,k0,k1,basis,k,basis,k]
   lower=[y0-1.45,.13,.13,basis-1.75,.115,basis-1.75,.115]
   upper=[y0+1.45,1.83,1.83,basis+1.8,2.3,basis+1.8,2.3]
   def test(m):
    H,p0,p1,L,q,R,s=m
    return np.minimum.reduce([H+p0*x1,H-p1*x1,L+q*v1,R+s*v2])-ss
   try: model=least_squares(test,A,loss='soft_l1',f_scale=.17,bounds=(lower,upper),max_nfev=40,xtol=2e-5)
   except ValueError:continue
   H,s0,s1,L,t0,R,t1=model.x
   # Without cover at both ends this is a gable, not a half-hip invented by the optimizer.
   f0=(H-L)/t0;f1=(H-R)/t1
   if min(f0,f1)<.19*(ri-le) or f0+f1>front-back+1.8:continue
   planes=np.array([[H-s0*bis,*(s0*n)],[H+s1*bis,*(-s1*n)],
     [L-t0*back,*(t0*a)],[R+t1*front,*(-t1*a)]])
   record('hip',planes,[delta,fract])
 if not options:return 'no measured form'
 opt=sorted(options,key=lambda r:r[0])[0]
 _,kind,A,er,ids,shape=opt
 expected=pub_form(c.get('osmMatch',{}).get('tags',{}).get('roof:shape'))
 if expected and expected!=kind: return 'dated typed-roof disagreement'
 q90=float(np.quantile(er[hold],.9));med=float(np.quantile(er[hold],.5));q95=float(np.quantile(er[hold],.95))
 if q90>.42 or med>.19 or q95>.54 or np.quantile(er,.99)>.91:return 'roof residual'
 if kind=='hip' and min((hold&(ids==i)).sum()for i in range(4))<1:return 'insufficient withheld hips'
 p90=float(np.quantile(oldErr[hold],.9))
 if q90>p90+.043:return 'unsupported regression'
 if q90>=p90-.14 and q90>.20:return 'small evidence'
 return dict(kind=kind,planes=A.round(7).tolist(),p90=round(q90,5),p50=round(med,5),olderP90=round(p90,5),support=[int((ids==i).sum())for i in range(len(A))])
def run(group):
 file,records=group
 with np.load(file,allow_pickle=False) as f:
  result=[]
  for c in records:
   s=sample_area(f,c)
   if s is None:r='few valid roof cells'
   else:
    xy,h,ring,hold,datum,sha=s
    r=select_model(c,xy[:,0],xy[:,1],h,ring,hold)
    if isinstance(r,dict):r={**c,**r,'n':len(h),'nHold':int(hold.sum()),'datum':datum,'windowSHA':sha}
   result.append(r)
 return result
if __name__=='__main__':
 candidates=json.loads((p/'sample-plan.json').read_text())
 lookup={r['tile']+'_'+str(r['i']):r for r in candidates}
 files=sorted((p/'windows').glob('group-*.npz'))
 tasks=[]
 for f in files:
  with np.load(f,allow_pickle=False) as d:rec=[lookup[k[:-7]]for k in d.files if k.endswith('_origin') and k[:-7] in lookup]
  if rec:tasks.append((f,rec))
 count=sum(len(v)for _,v in tasks)
 print(count,'planned',len(candidates),'accepted windows',len(tasks),flush=True)
 assert count==len(candidates)
 with ProcessPoolExecutor(max_workers=max(1,min(6,opts.jobs))) as exe:
  value=[r for out in exe.map(run,tasks) for r in out]
 passed=[v for v in value if isinstance(v,dict)]
 print('Forms:',Counter(v['kind']for v in passed),'Districts:',Counter(v['city']for v in passed),'County:',Counter(v['county']for v in passed),
       'rejected:',Counter(v for v in value if isinstance(v,str)),flush=True)
 print('DOM',int(sum(v['nHold']for v in passed)),np.quantile([v['olderP90']for v in passed],[.5,.9]),np.quantile([v['p90']for v in passed],[.5,.9]),flush=True)
 (p/'residential-shapes.json').write_text(json.dumps(passed,separators=(',',':'))+'\n')
