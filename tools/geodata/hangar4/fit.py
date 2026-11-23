"""Fit only roof zones supported by held 1m samples of the pinned footprint."""
from pathlib import Path
from sys import argv
from scipy.optimize import least_squares
from osgeo import osr
import hashlib,json,numpy as np
D=Path(argv[1]).resolve();r=json.loads((D/'native.json').read_text());raw=np.load(D/'native.npz',allow_pickle=False)
pinned='01f063f87203f0c48382fbd661c10fc72315c2c5a41e5e7bf678ec6dd9bce0e0'
assert r['inputSha']==pinned and hashlib.sha256(
    raw['dsm'].astype('<f4').tobytes()+raw['dtm'].astype('<f4').tobytes()).hexdigest()==pinned
def crs(i):
 s=osr.SpatialReference();s.ImportFromEPSG(i);s.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);return s
osr.UseExceptions()
T=osr.CoordinateTransformation(crs(4326),crs(3979));F=osr.CoordinateTransformation(crs(3979),crs(4326))
P=np.array(T.TransformPoints(r['assertedAEBFootprint']))[:,:2];cen=P.mean(0)
d=np.roll(P,-1,axis=0)-P;dx=d[np.argmax(np.linalg.norm(d,axis=1))];u=dx/np.linalg.norm(dx)
if u[0]<0:u=-u
v=np.array([-u[1],u[0]])
grid=np.stack((raw['xAbs'][raw['fit']],raw['yAbs'][raw['fit']]),axis=1);x,z=((grid-cen)@np.c_[u,v]).T
Y=raw['dsm'][raw['fit']].astype(float)
blocks=np.floor(grid/3).astype(int);hold=(blocks[:,0]*7+blocks[:,1]*3+1)%5==0
T=~hold
# Broad raised roof support in the 1 m surface model. Fix the median plane
# from clear body pixels; nearby ventilation masts and blended discontinuities
# are not independent samples from a smooth roof surface.
filterBody=(x>-19)&(x<51)&(z>-22)&(z<13)&(Y>27.6)&(Y<30.4)&T
def mid(m,xx=x,zz=z):
 a,c,d0,d1,q=m
 return a-np.maximum(0,c-xx)*d0-np.maximum(0,xx-c)*d1+q*(zz+5)
m=least_squares(lambda j:mid(j)[filterBody]-Y[filterBody],[30.04,12.,.036,.036,0],
 bounds=([29.,-1.,.005,.005,-.023],[31.,24.,.08,.08,.023]),loss='soft_l1',f_scale=.08).x
def div(values,selector,levels,lefthigh):
 return min(levels,key=lambda k:int(((values[selector]<k)!=lefthigh[selector]).sum()))
clsMain=Y>=27.65
l=div(x,(x<-16)&(z<14)&(z>-22)&T,np.arange(-24.,-18.,.125),~clsMain)
rgt=div(x,(x>46)&(z<14)&(z>-22)&T,np.arange(48.,56.,.125),clsMain)
annex=div(z,(x>-6)&(x<27)&(z>11)&T,np.arange(14.,19.5,.125),Y>=28.6)
fitIndex=dict(west=(x<l-.45)&T,east=(x>rgt+.55)&T,annex=(z>annex+.45)&(x>l)&(x<rgt)&T)
A=np.c_[np.ones(x.size),x,z]
fitBy={}
for name,used in fitIndex.items():
 y=A[used];h=Y[used]
 fitBy[name]=least_squares(lambda b:y@b-h,[np.median(h),0.,0.],loss='soft_l1',f_scale=.12).x
# The photo confirms two front raised strips; use only raised native cells for
# their in-plan widths and retreat. Height over the roof is measured, not sized
# from the photograph. Reject unrelated roof equipment by height and contiguity.
hoods=[]
for lo,hi in [(-17.,4.),(21.,41.)]:
 part=T&(z<-25.2)&(x>lo)&(x<hi)&(Y-mid(m)>.80)
 xx=x[part];zz=z[part]
 l2,r2=np.quantile(xx,[.012,.988])+[-.6,.6]
 h=np.column_stack([np.ones(part.sum()),xx,zz])
 out=least_squares(lambda p:h@p-Y[part],[26.,0.,-.20],loss='soft_l1',f_scale=.12).x
 hoods.append(dict(x=[float(l2),float(r2)],northLimit=-24.3,rawFit=out.tolist(),n=int(part.sum())))
z0=mid(m)
for zone,select in [('west',x<l),('east',x>rgt),('annex',(z>annex)&(x>l)&(x<rgt))]:z0[select]=A[select]@fitBy[zone]
for q in hoods:
 select=(x>=q['x'][0])&(x<=q['x'][1])&(z<q['northLimit'])
 z0[select]=np.maximum(z0[select],A[select]@np.array(q['rawFit']))
base=raw['dtm'][raw['fit']]+r['predictedHeight']
res=abs(Y-z0)
q={'owner':r['owner'],'windowSHA':r['inputSha'],'centerNative':cen.tolist(),'longAxis':u.tolist(),'perpendicular':v.tolist(),
 'planeBody':m.tolist(),'westBounds':float(l),'eastBounds':float(rgt),'rearBounds':float(annex),
 'otherPlanes':{k:v.tolist()for k,v in fitBy.items()},'hoods':hoods,
 'holdoutCount':int(hold.sum()),'trainingCount':int(T.sum()),'roofErrorsM':{'quantile':[.5,.9,.95,1.],
 'stockPreferredHeight':np.quantile(abs(Y[hold]-base[hold]),[.5,.9,.95,1.]).tolist(),'pilot':np.quantile(res[hold],[.5,.9,.95,1.]).tolist()}}
(D/'pilot-fit.json').write_text(json.dumps(q,indent=2)+'\n')
print(q)
