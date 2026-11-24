#!/usr/bin/env python3
"""Native 1m DSM–DTM structural canopy proxies, scoped to two source polygons."""
import argparse, hashlib, json, runpy
import numpy as np
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--stands',type=Path,required=True)
p.add_argument('--out',type=Path,required=True)
a=p.parse_args()
T=a.out;T.mkdir(parents=True,exist_ok=True)
raw=a.stands.read_bytes()
PIN='46a00e994e75a342523d284f30b36f4b7a7457b968f0335ec183d5ef46d9c5b7'
if hashlib.sha256(raw).hexdigest()!=PIN:
 raise ValueError('Unexpected CLUI geometry revision')
M=runpy.run_path(str(Path(__file__).with_name('roof-fit-pilot.py')))
dsm,dtm,gt,tr=M['open_models']()
st=json.loads(raw)
out=[]
for f in st['features']:
 rings=[np.array(tr.TransformPoints([(x,y) for x,y,*_ in r]))[:,:2] for r in f['geometry']['coordinates']]
 a,b=rings[0].min(axis=0),rings[0].max(axis=0)
 x0=int(np.floor(a[0]-gt[0]))-1;x1=int(np.ceil(b[0]-gt[0]))+1
 y0=int(np.floor(gt[3]-b[1]))-1;y1=int(np.ceil(gt[3]-a[1]))+1
 nx,ny=x1-x0,y1-y0
 assert max(nx,ny)<650 and nx*ny<300000
 X,Y=np.meshgrid(gt[0]+x0+.5+np.arange(nx),gt[3]-y0-.5-np.arange(ny))
 def in_polygon(r):
  inside=np.zeros(X.shape,dtype=bool)
  for (u,v),(w,z) in zip(r,np.roll(r,-1,axis=0)):
   if v!=z:inside^=((v>Y)!=(z>Y))&(X<(Y-v)*(w-u)/(z-v)+u)
  return inside
 m=in_polygon(rings[0])
 for r in rings[1:]:m&=~in_polygon(r)
 d,g=(s.GetRasterBand(1).ReadAsArray(x0,y0,nx,ny) for s in (dsm,dtm))
 ok=m&np.isfinite(d)&np.isfinite(g)&(d>-500)&(g>-500)
 h=d-g
 code=f['properties']['fieldid']
 be=hashlib.sha256(np.asarray([d,g],dtype='<f4').tobytes()).hexdigest()
 ths={str(k):round(float((h[ok]>k).mean()),5) for k in (2,3,4,5,6,8,10,12)}
 rec=dict(fieldid=code,sourceWindow=[x0,y0,nx,ny],cluiCrown=f['properties']['crown'],valid=int(ok.sum()),area=int(m.sum()),quantiles=np.quantile(h[ok],[0,.1,.25,.5,.75,.9,1]).round(2).tolist(),
  structuralShare=ths,bothRawSHA256=be)
 print(json.dumps(rec),flush=True);out.append(rec)
(T/'source-occupancy.json').write_text(json.dumps(out,indent=2)+'\n')
