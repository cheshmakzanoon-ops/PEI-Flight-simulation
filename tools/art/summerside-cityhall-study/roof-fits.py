"""Source-only roof station fits for detached authoring. These are not address or deployment data."""
from pathlib import Path
import json
import numpy as np
from scipy.optimize import least_squares
from argparse import ArgumentParser
cli=ArgumentParser()
cli.add_argument('frame',type=Path,help='NPZ with points as local X, local Z, absolute CGVD, LAS class; source not bundled')
args=cli.parse_args()
A=np.load(args.frame)['points'];A=A[A[:,3]==6,:3]
cells=np.floor(A[:,:2]*4).astype(np.int32);_,idx=np.unique(cells,axis=0,return_inverse=True)
P=np.array([np.median(A[idx==j],axis=0) for j in range(int(idx.max())+1)])
x,z,h=P.T; hold=((np.floor(x).astype(int)*5+np.floor(z).astype(int)*3)%7)<2
registry={};model={}
def flat(a,x,z):return a[0]+a[1]*x+a[2]*z
def hip(a,x,z):
 hw=(a[1]-a[0])*a[6];hz=(a[3]-a[2])*a[7]; l,r,n,s,e,cap,xs,zs=a
 return np.minimum.reduce([e+(x-l)*xs,e+(r-x)*xs,e+(z-n)*zs,e+(s-z)*zs,np.ones(len(x))*cap])
def record(label,d,predict,initial,bounds=(-np.inf,np.inf)):
 tr=P[d&~hold];v=P[d&hold]; rr=least_squares(lambda p:predict(p,tr[:,0],tr[:,1])-tr[:,2],initial,bounds=bounds,loss='soft_l1',f_scale=.10)
 a=rr.x;e=np.abs(predict(a,v[:,0],v[:,1])-v[:,2]);registry[label]=dict(train=len(tr),hold=len(v),geometry=dict(yModel='linear' if predict==flat else 'min of four eave planes and cap',fitParameters=a.tolist()),p50=float(np.median(e)),p90=float(np.quantile(e,.9)),maximum=float(e.max()),scope=np.quantile(P[d],[.0,.5,1],axis=0).round(6).tolist());model[label]=a.tolist()
record('mainMembrane',(x>0)&(x<17.72)&(z>-4.4)&(z<6.35)&(h>22.9)&(h<23.56),flat,[23.25,0,0])
record('westMezzanine',(x>-11.22)&(x<-8.85)&(z>-4.64)&(z<1.8)&(h>27.82)&(h<28.35),flat,[28.05,0,0])
record('annexHippedSlates',(x>-8.85)&(x<-1.55)&(z>10.1)&(z<20.4)&(h>13.65)&(h<16.26),hip,[-8.65,-1.53,8.70,20.20,14.08,15.90,.54,.59],([-9.4,-2.25,7.5,19.64,13.6,15.30,.30,.25],[-8.02,-1.2,11.1,20.85,14.75,16.35,.85,.97]))
record('secondarySouthLeanTo',(x>2.5)&(x<7.2)&(z>9.4)&(z<12.2)&(h>14.69)&(h<15.04),flat,[14.75,.0,.0])
out={'originCGVD2013':9.553423881530762,'rawClass6Count':len(A),'source25cmMedians':len(P),'scope':'four selected roof zones; not current proof, exact exterior plan or full roof accuracy','holdRule':'No coefficient from 1m cells where (5 floor(x)+3 floor(z)) mod 7 < 2','panels':registry}
w=Path(__file__).parent
(w/'proof/independent-fits.json').write_text(json.dumps(out,indent=2)+'\n')
(w/'src/cityhall-survey.ts').write_text('// Four selected detached roof surfaces; metre frame only.\nexport const surveyed='+json.dumps({'base':out['originCGVD2013'],**model},separators=(',',':'))+' as const;\n')
for k,v in registry.items(): print(k,v['geometry']['fitParameters'],v['train'],v['hold'],v['p90'],v['maximum'])
