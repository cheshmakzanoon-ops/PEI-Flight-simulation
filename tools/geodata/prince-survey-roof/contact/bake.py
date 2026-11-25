#!/usr/bin/env python3
"""Rebuild the three-face-family, 14m sky-blockage field from the unchanged actual owner mesh.
Uses no photographic inputs and never reads or changes the shipped geometry.
"""
from pathlib import Path
import argparse,hashlib,json,subprocess,tempfile
import numpy as np
P=Path(__file__).resolve().parent
p=argparse.ArgumentParser(description=__doc__)
for name in ('checkout','mesh','out','receipt'):p.add_argument('--'+name,required=True,type=Path)
a=p.parse_args()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
expected='a0822ee965721b930c229dd58214a888a3e9a1dc36b978b3eeceb1dfb0499974'
assert sha(a.mesh)==expected
code=a.checkout/'src/render/prince-survey-roof.generated.ts'
assert sha(code)=='06ea4b85bd5e2b20065cfa035ef1b6db8a825fb72517eee57c0bab61466872a9'
r=json.loads(code.read_text().split('export const PRINCE_SURVEY_ROOF=')[1].split(' as const;')[0])
B=np.asarray(r['shape']['axesXZ']);O=np.asarray(r['shape']['anchorXZ']);y0=8.276841056647675
s=np.loadtxt(a.mesh,skiprows=1);tri=s[:,1:].reshape(-1,3,3);u=tri[:,:,[0,2]]@B.T
roles=[('connector',['north-connector']),('cross-north',['cross-north-face','cross-north-west']),('cross-south',['cross-south-face','south-low-rim'])]
def closest(uv,T):
 vec=T[1:]-T[0]; b=(uv-T[0])@np.linalg.inv(vec);p=np.r_[1-b.sum(),b]
 if p.min()>=0:return uv
 dist=float('inf');out=None
 for a,b in zip(T,np.roll(T,-1,axis=0)):
  v=b-a; k=np.clip(np.dot(uv-a,v)/np.dot(v,v),0,1);q=a+k*v;dd=np.sum((q-uv)**2)
  if dd<dist:dist=dd;out=q
 return out
samples=[];charts=[]
ds=.65
for name,labs in roles:
 f=[q for q in r['shape']['roof'] if q['id'] in labs];plane=np.asarray(f[0]['plane']);assert all(tuple(q['plane'])==tuple(plane) for q in f)
 h=lambda uv:plane[0]+uv@plane[1:];eligible=np.where((s[:,0]==1)&(np.abs((tri[:,:,1]+y0)-h(u)).max(axis=1)<.003))[0]
 pts=u[eligible].reshape(-1,2)
 lo=np.floor(pts.min(0)/ds)*ds-ds;hi=np.ceil(pts.max(0)/ds)*ds+ds; wh=np.rint((hi-lo)/ds+1).astype(int)
 charts.append(dict(name=name,indices=eligible.tolist(),plane=plane.tolist(),lo=lo.tolist(),wh=wh.tolist(),index=len(samples),step=ds))
 normal=np.r_[-plane[1:]@B,1][[0,2,1]];normal/=np.linalg.norm(normal)
 for j in range(wh[1]):
  for i in range(wh[0]):
   x=lo+ds*np.array([i,j]); t0=None;n=1e10
   for f in eligible:
    z=closest(x,u[f]);v=np.sum((z-x)**2)
    if v<n:n=v;t0=f;p=z
   # A chart's exterior texels extend its own measured surface, not a different adjacent elevation.
   # For a clamped boundary, evaluate a few millimetres to the inside to avoid an ambiguous ray origin.
   if n>1e-12:
    c=u[t0].mean(axis=0);p+=.025*(c-p)/max(.025,np.linalg.norm(c-p))
   world=p@B;Y=h(p)-y0;samples.append([t0,world[0],Y,world[1],*normal])
with tempfile.TemporaryDirectory(prefix='pei-prince-sky-') as scratch:
 tmp=Path(scratch)
 np.savetxt(tmp/'chart-probes.txt',samples,fmt=['%d']+['%.9f']*6,header=str(len(samples)),comments='')
 subprocess.run(['c++','-std=c++17','-O3',str(P/'trace.cpp'),'-o',str(tmp/'trace')],check=True)
 with a.mesh.open('rb') as f, (tmp/'values.txt').open('wb') as out:subprocess.run([str(tmp/'trace')],stdin=f,stdout=out,cwd=tmp,check=True)
 q=np.clip(np.rint(np.loadtxt(tmp/'values.txt')*84),0,63).astype(np.uint8)
p=dict(charts=charts,anchor=O.tolist(),basis=B.tolist())
ab='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
charts=[{k:v for k,v in c.items() if k not in ('indices',)} for c in p['charts']]
for c in charts:
 d=np.array(c['plane'][1:])@np.array(p['basis']);N=np.array([-d[0],1,-d[1]]);c['normal']=(N/np.linalg.norm(N)).tolist()
data={'shapeSHA256':'06ea4b85bd5e2b20065cfa035ef1b6db8a825fb72517eee57c0bab61466872a9','anchor':p['anchor'],'basis':p['basis'],'charts':charts,'cells':len(q),'samples6':'','quantization':84}
data['samples6']=''.join(ab[v] for v in q)
s='// Local angular sky obstruction from the frozen q0322/47 receiver geometry, not a roof image.\nexport const PRINCE_SKY_FIELD='+json.dumps(data,separators=(',',':'))+' as const;\n'
a.out.write_text(s)
result={'sourceTriangleTextSHA256':expected,'generatedShapeSHA256':sha(code),'underlyingTriangles':98,'samples':len(q),'base6BitSamplesSHA256':hashlib.sha256(q.tobytes()).hexdigest(),'basis':'768 fixed cosine-weighted hemisphere rays per chart node against both sides of the existing 98 triangles.','cutoffsM':[5,14],'sourceArea':'Only connector and low cross-wing north/south planes.','hardwareFieldBytes':((len(q)+19)//20)*16,'glUniformVec4Slots':(len(q)+19)//20,'computation':'Offline only; no new mesh, texture, sampler or runtime ray trace.','generatedTsSHA256':sha(a.out)}
a.receipt.write_text(json.dumps(result,indent=2)+'\n'); print(json.dumps(result))
