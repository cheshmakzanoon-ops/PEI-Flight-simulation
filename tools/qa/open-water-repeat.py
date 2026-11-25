#!/usr/bin/env python3
"""World-space autocorrelation of an actual fixed nadir Three.js capture."""
from pathlib import Path
from PIL import Image
from scipy.ndimage import map_coordinates, gaussian_filter
import argparse, json, math
import numpy as np
H,W=600,1000
F=H/2/math.tan(math.radians(53)/2)
eye=np.array([0.,183.,12.])
look=-eye; look/=np.linalg.norm(look)
R=np.cross(look,[0,1,0]);R/=np.linalg.norm(R)
U=np.cross(R,look)
S=.5
X,Z=np.meshgrid(np.arange(-143.,144.,S),np.arange(-80.,92.,S))
raw=np.stack((X,np.full_like(X,-.055),Z),axis=2)-eye
Xpix=W/2-.5+F*(raw@R)/(raw@look);Ypix=H/2-.5-F*(raw@U)/(raw@look)
mask=(Xpix>=40)&(Ypix>=40)&(Xpix<W-40)&(Ypix<H-40)
assert mask.sum()>120000
def corr(of):
 im=np.asarray(Image.open(of).convert('RGB'),float)
 L=im@np.array([.2126,.7152,.0722])
 v=map_coordinates(L,[Ypix,Xpix],order=1,mode='nearest')
 filtered=v-gaussian_filter(v,8)
 rows={}
 for k,(a,b)in {'east86':(86,0),'south86':(0,86),
  'east43':(43,0),'south43':(0,43),'rotE43':(43*.724,-43*.689),
  'rotS43':(43*.689,43*.724),'offE74':(74,0),'offE93':(93,0),
  'offS78':(0,78),'offS95':(0,95)}.items():
  yy,xx=np.indices(mask.shape)
  front=map_coordinates(filtered,[yy+b/S,xx+a/S],order=1,mode='nearest')
  join=map_coordinates(mask.astype(float),[yy+b/S,xx+a/S],order=1,mode='constant')>.999
  supported=join&mask
  rows[k]={'luminanceCorrelation':round(float(np.corrcoef(filtered[supported],front[supported])[0,1]),4),'samples':int(supported.sum())}
 return {'pairs':rows,'lumaStDev':float(filtered[mask].std())}

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('--frames',type=Path,required=True)
 p.add_argument('--out',type=Path,required=True)
 p.add_argument('--phase',type=float,nargs='+',default=[12.,26.])
 a=p.parse_args()
 result={}
 for phase in a.phase:
  pairs={k:corr(a.frames/f'wind-spectrum-nadir-{phase:g}-{k}.png') for k in ['stock','live']}
  for axis in ['east86','south86']:
   stock=pairs['stock']['pairs'][axis]['luminanceCorrelation']
   new=pairs['live']['pairs'][axis]['luminanceCorrelation']
   assert stock>.22 and abs(new)<.2*stock,(axis,stock,new)
  contrast=pairs['live']['lumaStDev']/pairs['stock']['lumaStDev']
  assert .92<contrast<1.08,'water contrast should not disappear or become harsher'
  result[str(phase)]=pairs
 a.out.write_text(json.dumps(result,indent=2)+'\n')
