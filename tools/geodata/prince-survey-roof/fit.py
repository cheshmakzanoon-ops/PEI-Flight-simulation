#!/usr/bin/env python3
"""Fit the existing NRCan AEB q0322/47 footprint to the independent 2020 class-6 TRAIN partition only.
The model deliberately omits facade materials, openings, names and all geometry outside the AEB footprint.
The input file includes no withheld height or test input; relative heights reference one fixed local class-2 datum.
Run with Python/NumPy/SciPy/GDAL (OGR GEOS), using the artifacts from intake.
"""
import argparse,hashlib,json
from pathlib import Path
import numpy as np
from scipy.optimize import least_squares,minimize
from scipy.special import expit
from osgeo import ogr
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--frame',type=Path,default=Path(__file__).resolve().with_name('local-frame.json'))
for arg in ('train','datum','out','receipt'):parser.add_argument('--'+arg,type=Path,required=True)
a=parser.parse_args()
def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def rounded(q):return np.round(np.asarray(q,dtype=float),8).tolist()
frame=read(a.frame);g=frame['grid'];own=frame['owner'];reg=read(a.datum);world=frame['world']
assert sha(a.train)==reg['trainPointArchive']=='f09936dfb61417a24b4f4c4298df33f5076201b908faf5daaddb3ab1fb0c9634'
t=np.load(a.train); ok=t['class_id']==6
basis=np.array(g['independentFootprintBasisUVInGameXZ']); origin=np.array(world['centerWorldXZ']); uv=(t['xz'][ok]-origin)@basis.T
u,v=uv.T; z=t['native_z'][ok]; A=np.c_[np.ones(len(z)),u,v]; V=np.array(g['localFootprintUV'])
def fit(mask):
 # Give a 0.6-m sample cell one vote before robust regression, rather than weighting dense overlapping strips directly.
 q=A[mask];zy=z[mask];key=np.floor(q[:,1:]/.6).astype(int);_,ix=np.unique(key,axis=0,return_inverse=True)
 X=np.array([np.median(q[ix==k],axis=0) for k in range(ix.max()+1)]);y=np.array([np.median(zy[ix==k]) for k in range(ix.max()+1)])
 p=least_squares(lambda h:X@h-y,np.linalg.lstsq(X,y,rcond=None)[0],loss='soft_l1',f_scale=.03).x
 return p
def sep(x,y,group):
 # Boundary x=b0+b1*y separates two clearly different supported returns. Balanced local region only.
 xy=np.c_[np.ones(len(x)),y-np.median(y)]; yc=np.median(y);scale=.13
 def f(w):
  q=(x-xy@w)/scale
  return np.sum(np.logaddexp(0,q)-group*q)+w[1]**2
 def jac(w):
  q=(x-xy@w)/scale
  return -(xy.T@(expit(q)-group))/scale+np.array([0,2*w[1]])
 r=minimize(f,[np.median(x),0],jac=jac,method='BFGS',tol=1e-7).x
 return r[0]-yc*r[1],r[1]
cal=world['groundAtCenter']+.05-reg['nativeZEquals_AUplusBVplusC'][2]
EL=fit((u>13)&(u<20)); ER=fit((u>25)&(u<33)); N=fit((v<-16)&(u>-3)&(u<9.3))
WL=fit((u>-18.4)&(u<-12.5)&(v>-14)&(v<13.6)); WR=fit((u>-9.3)&(u<-4.2)&(v>-14)&(v<13.6))
S1=fit((u<-4.1)&(v>17.5)&(v<23.6));S2=fit((u>-14.2)&(u<-4.1)&(v>25.0)&(v<30.9))
C1=fit((u<-17.4)&(v>24.9)&(v<26.55));C2=fit((u<-17.4)&(v>27.5)&(v<29.35))
C3=fit((u<-17.4)&(v>30.10)&(v<30.78))
sel=(u>-18)&(u<-4.4)&(v>14.)&(v<17.4); Wfit=np.minimum(A@WL,A@WR); Sloc=A@S1
dr,beta=sep(v[sel],u[sel],abs(z[sel]-Sloc[sel])<abs(z[sel]-Wfit[sel])) # v>dr+beta*u is cross wing
sel=(v>25.3)&(v<30.)&(u>-17.6)&(u<-14.0)
cap=np.minimum(A@C1,A@C2); lo=A@S2
cd,alpha=sep(u[sel],v[sel],abs(z[sel]-lo[sel])<abs(z[sel]-cap[sel])) # u>cd+alpha*v is lower face
def ogrpoly(pts):
 c=ogr.Geometry(ogr.wkbLinearRing)
 for x,y in pts:c.AddPoint_2D(float(x),float(y))
 c.CloseRings();p=ogr.Geometry(ogr.wkbPolygon);p.AddGeometry(c);return p
def polys(f):
 if f is None or f.IsEmpty():return []
 if f.GetGeometryName()=='POLYGON':return [f] if f.GetArea()>1e-8 else []
 if f.GetGeometryName() in ('GEOMETRYCOLLECTION','MULTIPOLYGON'):return [j for i in range(f.GetGeometryCount()) for j in polys(f.GetGeometryRef(i))]
 return []
def clip(ps,p): # p0+p1*u+p2*v <= 0, intersection, preserving disconnected parts
 # Clip broad convex square to this halfspace. OGR then clips the possibly concave source region.
 rect=np.array([[-100,-100],[100,-100],[100,100],[-100,100]],float); d=p[0]+rect@p[1:];verts=[]
 for i in range(4):
  j=(i+1)%4
  if d[i]<=0:verts.append(rect[i])
  if (d[i]<0 and d[j]>0) or(d[i]>0 and d[j]<0):verts.append(rect[i]+(rect[j]-rect[i])*(d[i]/(d[i]-d[j])))
 if len(verts)<3:return []
 h=ogrpoly(verts); return [x for poly in ps for x in polys(poly.Intersection(h))]
faces=[]
def add(ps,plane,label):
 for p in ps:
  assert p.GetGeometryCount()==1 and p.IsValid()
  r=p.GetGeometryRef(0);pts=np.asarray(r.GetPoints())[:,:2][:-1]
  faces.append(dict(id=label,plane=(plane+np.array([cal,0,0])).tolist(),uv=pts.tolist()))
def lower2(ps,p,q,n1,n2):
 add(clip(ps,p-q),p,n1);add(clip(ps,q-p),q,n2)
E=[ogrpoly(V[[6,7,8,9,10]])];N0=[ogrpoly(V[[3,4,5,6,10,11]])];W=[ogrpoly(V[[11,12,13,0,1,2,3]])]
domain=ogrpoly(V);ds=[*E,*N0,*W];assert abs(sum(s.GetArea() for s in ds)-domain.GetArea())<1e-7
lower2(E,EL,ER,'broad-west-face','broad-east-face');add(N0,N,'north-connector')
cut=np.array([-dr,-beta,1.]);west=clip(W,cut);south=clip(W,-cut);lower2(west,WL,WR,'western-west-face','western-east-face')
cut=np.array([-cd,1.,-alpha]);shelter=clip(south,-cut);cross=clip(south,cut);lower2(shelter,S1,S2,'cross-north-face','cross-south-face')
# Western raised segment resolves four slopes, not a guessed rounded/gambrel prefab.
# Each break is the intersection of neighbouring robustly fitted planes.
far=clip(cross,C1-S1);add(far,S1,'cross-north-west')
rem=clip(cross,S1-C1);lower=clip(rem,C1-C2);add(lower,C1,'raised-north-face')
rem=clip(rem,C2-C1);lower=clip(rem,C2-C3);add(lower,C2,'raised-south-face')
rem=clip(rem,C3-C2);lower=clip(rem,S2-C3);add(lower,C3,'raised-south-bevel');add(clip(rem,C3-S2),S2,'south-low-rim')
# Subdivide shared edges at every actual incident face vertex. Internal walls only close vertical jumps.
G=[ogrpoly(np.array(f['uv'])) for f in faces];assert abs(sum(p.GetArea() for p in G)-domain.GetArea())<1.e-6
for i,p in enumerate(G):
 assert p.Difference(domain).GetArea()<1e-7
 for j in range(i):assert sum(q.GetArea() for q in polys(p.Intersection(G[j])))<1e-7
corners=np.array([x for f in faces for x in f['uv']]);keys={}
def key(p):return tuple(np.rint(p*1e6).astype(int).tolist())
for i,f in enumerate(faces):
 ring=np.array(f['uv'])
 for l,r in zip(ring,np.roll(ring,-1,axis=0)):
  delta=r-l; span=np.linalg.norm(delta);unit=delta/span;fr=(corners-l)@unit;sep=np.abs((corners[:,0]-l[0])*unit[1]-(corners[:,1]-l[1])*unit[0]);c=sorted(set([0.,1.,*(round(x/span,11) for x in fr[(sep<2e-7)&(fr>2e-7)&(fr<span-2e-7)])]))
  for aa,bb in zip(c,c[1:]):
   p,q=l+delta*aa,l+delta*bb
   if np.linalg.norm(p-q)<.00001:continue
   if key(q)<key(p):p,q=q,p
   keys.setdefault((key(p),key(q)),[]).append((i,p,q))
walls=[]
def h(i,p):
 f=faces[i]['plane'];return f[0]+f[1]*p[0]+f[2]*p[1]
for k,refs in keys.items():
 assert len(refs) in (1,2),(k,refs)
 i,p,q=refs[0]
 if len(refs)==1:
  segment=ogr.Geometry(ogr.wkbLineString);segment.AddPoint_2D(*p);segment.AddPoint_2D(*q)
  assert segment.Distance(domain.Boundary())<2e-6 and all(domain.Boundary().Distance(ogr.CreateGeometryFromWkt(f'POINT ({r[0]} {r[1]})'))<2e-6 for r in [p,q]), (k,refs)
  walls.append(dict(t='outer',a=p,b=q,high=[h(i,p),h(i,q)]));continue
 j=refs[1][0];e0=h(i,p)-h(j,p);e1=h(i,q)-h(j,q)
 if max(abs(e0),abs(e1))<.000003:continue
 intervals=[0.,1.] if e0*e1>=0 else [0.,e0/(e0-e1),1.]
 for f0,f1 in zip(intervals,intervals[1:]):
  pp=p+(q-p)*f0;qq=p+(q-p)*f1
  if np.linalg.norm(pp-qq)<.00001:continue
  lo,hi=(j,i) if h(i,(pp+qq)*.5)>=h(j,(pp+qq)*.5) else (i,j)
  walls.append(dict(t='interior',a=pp,b=qq,low=[h(lo,pp),h(lo,qq)],high=[h(hi,pp),h(hi,qq)]))
# Calculate fit errors on training for diagnosis only; withheld pulse and block validation is independent.
err=np.full(len(z),np.nan)
def inside(points,ring):
 x0,y0=points.T;hit=np.zeros(len(x0),bool)
 for l,r in zip(ring,np.roll(ring,-1,axis=0)):
  if abs(l[1]-r[1])>1e-11:hit^=((l[1]>y0)!=(r[1]>y0))&(x0<(r[0]-l[0])*(y0-l[1])/(r[1]-l[1])+l[0])
 return hit
for f in faces:
 m=inside(uv,np.array(f['uv']));err[m]=np.abs(A[m]@np.array(f['plane'])-cal-z[m])
def stats(x):return dict(n=len(x),median=round(float(np.median(x)),4),p90=round(float(np.quantile(x,.9)),4),p99=round(float(np.quantile(x,.99)),4))
assert np.isfinite(err).all()
for line in walls:
 for k in ['a','b','low','high']:
  if k in line:line[k]=rounded(line[k])
for f in faces:
 f['uv']=rounded(f['uv']);f['plane']=rounded(f['plane'])
out=dict(atlas=own['sourcePackSha'],chunk=own['sourceTileSha'],tile=own['tile'],ordinal=own['ordinal'],record=own['owner'],base=round(world['groundAtCenter']+.05,8),
 shape=dict(anchorXZ=origin.tolist(),axesXZ=basis.tolist(),roof=faces,walls=walls))
a.out.write_text('// Rebuild with tools/geodata/prince-survey-roof/fit.py. Relative 2020 relief; facade unsurveyed.\nexport const PRINCE_SURVEY_ROOF='+json.dumps(out,separators=(',',':'))+' as const;\n')
e=dict(trainingRows=len(z),roofPulseOnlyScope='training only; not independent validation',trainingRelativeVerticalError=stats(err),strata={str(k):stats(err[t['zone'][ok]==k]) for k in np.unique(t['zone'][ok])},areasM2={f['id']:round(q.GetArea(),4) for f,q in zip(faces,G)},roofFaces=len(faces),walls=len(walls),areas=dict(parentM2=round(domain.GetArea(),5),sumM2=round(sum(q.GetArea() for q in G),5),aperturesAdded=0),groundOffset=cal,cutGeometry={'lowerCrossVEquals':[float(dr),float(beta)],'raisedSectionUEquals':[float(cd),float(alpha)]},frozenSourceSha=sha(a.train),generatedTS=sha(a.out))
a.receipt.write_text(json.dumps(e,indent=2)+'\n');print(json.dumps(e))
