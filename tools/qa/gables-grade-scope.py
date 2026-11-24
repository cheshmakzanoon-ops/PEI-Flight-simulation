"""Quantify protected same-camera terrain and named art alongside the grade."""
import argparse,itertools,json,math
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from scipy.spatial import ConvexHull
from scipy.ndimage import binary_dilation

p=argparse.ArgumentParser(description=__doc__)
for name in ('stock','live','bad','terrain','mesh','out'):p.add_argument(name,type=Path)
a=p.parse_args()
phi=math.radians(46.5);t=1-.00669437999014*math.sin(phi)**2
sx=6378137*math.pi/180*math.cos(phi)/math.sqrt(t)
sz=6378137*math.pi/180*(1-.00669437999014)/t**1.5
w,s,e,n=json.loads(a.terrain.read_text())['bounds']
X,Z=(w+63.2)*sx,(46.5-n)*sz
info=json.loads(a.mesh.read_text())['shape']
dx,dz=(e-w)*sx/32/112,(n-s)*sz/22/112
gx=X+(info['tileX']*112+info['firstX'])*dx;gz=Z+(info['tileZ']*112+info['firstZ'])*dz
cage=((gx-dx,gx+(info['cellsX']+1)*dx),(8.,22.),(gz-dz,gz+(info['cellsZ']+1)*dz))
hx,hz=(-63.38206436+63.2)*sx,(46.5-46.48778937)*sz
house=((hx-16,hx+16),(10.,26.),(hz-16,hz+16))
def read(folder,name):
 return np.asarray(Image.open(folder/(name+'.png')).convert('RGB'),dtype=np.int16)
def records(folder):
 return {x['name']:x for x in json.loads((folder/'results.json').read_text())}
def mask_at(item,prism):
 d,p=item['diag'],item['pose']
 eye=np.array([d['x'],d['eyeY'],d['z']])
 target=np.array([(p['lon']+63.2)*sx,d['baseH']+p['h']*.5,(46.5-p['lat'])*sz])
 f=target-eye;f/=np.linalg.norm(f)
 r=np.cross(f,[0,1,0]);r/=np.linalg.norm(r);u=np.cross(r,f)
 cube=np.array(list(itertools.product(*prism)))-eye
 pts=np.c_[cube@r,cube@u,cube@f]
 corners=[a for a in pts if a[2]>.1]
 for i,j in itertools.combinations(range(len(pts)),2):
  if (i^j) not in (1,2,4):continue
  k,l=pts[i],pts[j]
  if (k[2]>.1)==(l[2]>.1):continue
  corners.append(k+(l-k)*(.1-k[2])/(l[2]-k[2]))
 out=Image.new('L',(item['width'],item['height']))
 if len(corners)<3:return np.asarray(out,dtype=bool)
 values=np.array(corners);w,h=item['width'],item['height'];span=math.tan(math.radians(53/2))
 x=(1+values[:,0]/values[:,2]/span*h/w)*w/2
 y=(1-values[:,1]/values[:,2]/span)*h/2
 coords=np.c_[x,y];coords=coords[ConvexHull(coords).vertices]
 ImageDraw.Draw(out).polygon([tuple(x)for x in coords],fill=1)
 return binary_dilation(np.asarray(out,dtype=bool),iterations=3)
old,new,fail=map(records,(a.stock,a.live,a.bad));output={}
for key,r in old.items():
 assert r['diag']['orthos']==new[key]['diag']['orthos']==fail[key]['diag']['orthos']
 stock,live,bad=(read(root,key)for root in [a.stock,a.live,a.bad])
 d=np.max(abs(stock-live),axis=2);e=np.max(abs(stock-bad),axis=2)
 assert not e.any() and (d>2).any()
 inside=mask_at(r,cage);green=mask_at(r,house)
 off=~inside;shown=(green&~inside)
 row=dict(pixels=d.size,localChangeAbove2=int((d>2).sum()),malformedFullyExact=True,
          protectedPixels=int(off.sum()),protectedPixelsAnyChange=int((d[off]>0).sum()),protectedPixelsAbove2=int((d[off]>2).sum()),
          houseFenceExclusive=int(shown.sum()),houseFenceChanged=int((d[shown]>0).sum()))
 assert not row['protectedPixelsAnyChange'],(key,row)
 assert r['diag']['drawCalls']==new[key]['diag']['drawCalls']==fail[key]['diag']['drawCalls']
 for p,q in zip(r['diag']['controlWitnesses'],fail[key]['diag']['controlWitnesses'],strict=True):assert p==q
 output[key]=row
a.out.write_text(json.dumps(output,indent=2)+'\n')
print(output)
