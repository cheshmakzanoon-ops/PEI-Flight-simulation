"""Detached exact mesh silhouette-and-diffuse prospect, no renderer/timer control."""
import base64,hashlib,math,json,sys
from pathlib import Path
import numpy as np
baseline,cfg,dest=map(Path,sys.argv[1:])
sha=lambda b:hashlib.sha256(b).hexdigest()
G=baseline.read_bytes();P=cfg.read_bytes();p=json.loads(P)
solid={}
for variant,parts in json.loads(G).items():
 solid[variant]={}
 for role,buffers in parts.items():
  a=[]
  for t in ('position','normal','color'):
   q=buffers[t];b=base64.b64decode(q['words'],validate=True);assert sha(b)==q['sha256']
   a.append(np.frombuffer(b,'<f4').astype(float).reshape(-1,3,3))
  solid[variant][role]=a
def norm(p):return p/np.linalg.norm(p)
aim=np.array([0,9.75,0.]);sun=norm(np.array([-.6,.7,.45]));linear=np.array([.2126,.7152,.0722])
K=4;SIZE=128*K
def paint(model,deg,eyeH,viewH,d):
 rad=math.radians(deg);horiz=math.sqrt(d*d-eyeH*eyeH)
 eye=np.array([math.cos(rad)*horiz,eyeH,math.sin(rad)*horiz])
 front=norm(aim-eye);right=norm(np.cross(front,[0,1,0]));up=np.cross(right,front)
 px=.5*viewH/math.tan(math.radians(p['verticalFOVDeg']/2))*K
 layers={}
 for role,(P,N,C) in model.items():
  d0=(P-eye)@front;assert d0.min()>0
  xy=(np.stack(((P-eye)@right,(P-eye)@-up),axis=2)/d0[:,:,None])*px+.5*SIZE
  assert xy.min()>0 and xy.max()<SIZE
  shade=(C.mean(1)@linear)*(.47+.53*np.maximum(N[:,0]@sun,0))
  facing=np.sum(N[:,0]*(eye-P[:,0]),axis=1)>0
  D=np.zeros((SIZE,SIZE));A=np.zeros_like(D)
  for s in np.flatnonzero(facing):
   q=xy[s];z=1/d0[s];(x,y)=q.min(0).astype(int);(X,Y)=np.ceil(q.max(0)).astype(int)
   if x>=X or y>=Y:continue
   i,j=np.ogrid[y:Y,x:X];dx=j+.5-q[0,0];dy=i+.5-q[0,1];u,v=q[1:]-q[0]
   det=u[0]*v[1]-u[1]*v[0]
   if abs(det)<1e-12:continue
   a0=(dx*v[1]-dy*v[0])/det;a1=(dy*u[0]-dx*u[1])/det
   znow=(1-a0-a1)*z[0]+a0*z[1]+a1*z[2]
   tile=D[y:Y,x:X];mask=(a0>=0)&(a1>=0)&(a0+a1<=1)&(znow>tile)
   tile[mask]=znow[mask];A[y:Y,x:X][mask]=shade[s]
  layers[role]=(D,A)
 Z,A=layers['opaque'];W,B=layers['glass'];see=(W>0)&(W>Z)
 return (Z>0)|see,np.where(see,B*.49+A*.51,A),see
def rect(a):
 y,x=np.where(a);return np.array([x.min(),y.min(),x.max()+1,y.max()+1])/K
rows=[];exits=[]
for view in p['viewportHeightPx']:
 for angle in p['bearingsDeg']:
  for alt in p['cameraHeightM']:
   for d in p['transitionDistanceM']:
    a,A,Ag=paint(solid['near'],angle,alt,view,d);b,B,Bg=paint(solid['middle'],angle,alt,view,d)
    common=a&b&~Ag&~Bg
    def reduce(g):return g.reshape(128,K,128,K).mean((1,3))
    c0=reduce(a&~Ag);c1=reduce(b&~Bg);cp=(c0>=.94)&(c1>=.94)
    exact=np.abs(reduce(A)[cp]-reduce(B)[cp])
    lumaSigned=float(np.mean(reduce(A)[cp]-reduce(B)[cp]))
    bands={name:float(np.mean((reduce(A)-reduce(B))[cp&(mask[:,None])])) if np.any(cp&mask[:,None]) else None for name,mask in [('lower',np.arange(128)>64),('higher',np.arange(128)<=64)]}
    r=dict(viewport=view,bearing=angle,cameraY=alt,rangeM=d,silhouetteXor=float((a^b).sum()/(a|b).sum()),
     boundsDeltaPx=float(np.max(abs(rect(a)-rect(b)))),meanCommonDiffuseLumaDelta=float(np.mean(abs(A[common]-B[common]))),resolvedDifference=float(exact.mean()),resolvedSigned=lumaSigned,bands=bands)
    r['hold']=any(r[k]>v for k,v in p['prospectiveHolds'].items());rows.append(r)
  m,_,_=paint(solid['middle'],angle,90,view,p['removeDistanceM'])
  box=rect(m);exits.append(dict(viewport=view,bearing=angle,screenHeightPx=float(box[3]-box[1]),preExitCoveredPixelArea=float(m.sum()/K**2)))
report={'sourceSHA256':sha(G),'prelockSHA256':sha(P),'holds':sum(x['hold'] for x in rows),'rows':rows,'finalCut':exits,
 'maxTransition':{k:max(r[k] for r in rows) for k in p['prospectiveHolds']},'notNative':True}
with dest.open('x') as f:json.dump(report,f,indent=1)
print('transition',len(rows),report['holds'],report['maxTransition'])
print('exitMaxHeight', {v:max(r['screenHeightPx'] for r in exits if r['viewport']==v) for v in p['viewportHeightPx']})
