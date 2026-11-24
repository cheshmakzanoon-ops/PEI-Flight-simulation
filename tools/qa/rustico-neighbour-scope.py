"""Assert changed browser pixels fall within the projected old/new owner envelope."""
import argparse,math,json
from pathlib import Path
import numpy as np
from PIL import Image
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('stock',type=Path);p.add_argument('live',type=Path);p.add_argument('out',type=Path)
a=p.parse_args()
root=Path(__file__).resolve().parents[2]
gen=(root/'src/render/rustico-neighbour.generated.ts').read_text().split('RUSTICO_NEIGHBOUR=',1)[1].removesuffix('\n').removesuffix(' as const;')
ring=json.loads(gen)['record']['footprint']
phi=math.radians(46.5);e=6.69437999014e-3;t=1-e*math.sin(phi)**2;S=math.pi/180*6378137
mx=S*math.cos(phi)/math.sqrt(t);mz=S*(1-e)/t**1.5
project=lambda lon,lat:((lon+63.2)*mx,(46.5-lat)*mz)
old={v['name']:v for v in json.loads((a.stock/'results.json').read_text())}
new={v['name']:v for v in json.loads((a.live/'results.json').read_text())}
def screen(q,A):
 f=np.array(q)-A['eye'];d=f@A['forward']
 if d<=0:raise ValueError('Fixture went behind the camera')
 return np.array([A['width']*.5+f@A['right']/d*A['focal'],A['height']*.5-f@A['up']/d*A['focal']])
result=[]
for n,m in old.items():
 p=new[n];w,h=p['width'],p['height'];assert m['pose']==p['pose']
 d0,d1=m['diag'],p['diag']
 assert d0['drawCalls']==d1['drawCalls'] and d1['triangles']-d0['triangles']==39
 for k in ['x','z','eyeY','baseH','groundY','localGroundGrade','northRusticoLighthouse','detail']:
  assert d0[k]==d1[k],k
 x,z=project(p['pose']['lon'],p['pose']['lat'])
 eye=np.array([d1['x'],d1['eyeY'],d1['z']]);f=np.array([x,d1['baseH'],z])-eye
 f=f/np.linalg.norm(f);r=np.cross(f,[0.,1.,0.]);r=r/np.linalg.norm(r);u=np.cross(r,f)
 A={'eye':eye,'forward':f,'right':r,'up':u,'width':w,'height':h,'focal':h/(2*math.tan(math.radians(53.)*.5))}
 points=np.array([screen([x,y,z],A)for lon,lat in ring for (x,z)in [project(lon,lat)]for y in [.32,7.91]])
 l,t=np.maximum(0,np.floor(points.min(axis=0)).astype(int)-3)
 r,b=np.minimum([w,h],np.ceil(points.max(axis=0)).astype(int)+4)
 I=np.array(Image.open(a.stock/(n+'.png')).convert('RGB')).astype(np.int16)
 J=np.array(Image.open(a.live/(n+'.png')).convert('RGB')).astype(np.int16)
 e=np.max(abs(I-J),axis=2);mask=np.zeros((h,w),bool);mask[t:b,l:r]=True
 assert not np.any(e[~mask]),(n,np.max(e[~mask]))
 result.append({'view':n,'totalPixels':h*w,'measuredOwnerEnvelopeXZScreenLTRB':list(map(int,[l,t,r,b])),
  'protectedPixelsByteExact':int((~mask).sum()),'insidePixelsAbove2RGB':int((e>2).sum()),
  'drawCallsEach':d1['drawCalls'],'triangleDelta':d1['triangles']-d0['triangles']})
print(json.dumps(result,indent=2));a.out.write_text(json.dumps(result,indent=2)+'\n')
