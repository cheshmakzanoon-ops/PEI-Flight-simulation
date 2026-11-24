"""Real renderer exact-pixel scope checks for the conservative dry-surface envelope."""
import argparse,math,json
from pathlib import Path
from PIL import Image
import numpy as np
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('stock',type=Path);p.add_argument('live',type=Path);p.add_argument('out',type=Path)
a=p.parse_args()
O=np.array([-7059.451783730272,4968.451195266424])
basis=np.array([[.7350564016815042,-.6773796960051186],[-.67793974813776,-.7356641573842353]])
inv=np.linalg.inv(basis);radius=np.array([17.5,14.4]);center=np.array([-4.1,1.85])
old={x['name']:x for x in json.loads((a.stock/'results.json').read_text())}
new={x['name']:x for x in json.loads((a.live/'results.json').read_text())}
results=[]
for key,left in old.items():
 right=new[key];eye=np.array([right['diag']['x'],right['diag']['eyeY'],right['diag']['z']])
 target=np.array([O[0],right['diag']['baseH'],O[1]])
 forward=target-eye;forward/=np.linalg.norm(forward)
 side=np.cross(forward,[0.,1.,0.]);side/=np.linalg.norm(side);up=np.cross(side,forward)
 assert left['pose']==right['pose']
 m1,m2=left['diag'],right['diag']
 for k in ('x','z','eyeY','baseH','groundY','localGroundGrade','northRusticoLighthouse','rusticoMassingReview','detail'):
  assert m1.get(k)==m2.get(k),k
 width,height=right['width'],right['height']
 P=np.array(Image.open(a.stock/(key+'.png')).convert('RGB'),np.int16)
 Q=np.array(Image.open(a.live/(key+'.png')).convert('RGB'),np.int16)
 delta=np.abs(P-Q).max(axis=2);mask=np.zeros((height,width),bool)
 scale=math.tan(math.radians(53)*.5)/(height*.5)
 # Wide enough for visible color and all bounded tufts; do not mistake
 # building/sky on the rest of the drawn frame for affected support.
 E=((eye[[0,2]]-O)@inv.T-center)/radius
 for dx in (-1.5,0.,1.5):
  for dy in (-1.5,0.,1.5):
   Y,X=np.mgrid[0:height,0:width]
   rays=forward+(X+.5+dx-width*.5)[:,:,None]*scale*side+(height*.5-Y-.5+dy)[:,:,None]*scale*up
   dy_=rays[:,:,1];nz=(np.abs(dy_)>1.e-8)
   bot=(1.86-eye[1])/np.where(nz,dy_,1.);top=(3.52-eye[1])/np.where(nz,dy_,1.)
   lo=np.maximum(np.minimum(bot,top),0.);hi=np.maximum(bot,top)
   valid=nz&(hi>=lo)
   R=rays[:,:,[0,2]]@inv.T/radius
   t=np.clip(-(R@E)/np.maximum((R*R).sum(axis=2),1.e-8),lo,np.maximum(lo,hi))
   q=E+t[:,:,None]*R
   mask|=valid&((q*q).sum(axis=2)<1.075**2)
 assert not np.any(delta[~mask]),(key,np.count_nonzero(delta[~mask]),int(delta.max()))
 results.append({'view':key,'pixels':width*height,'pixelsChangedAbove2':int((delta>2).sum()),
  'outsideConservativeDryEnvelopeRGBExact':int((~mask).sum()),
  'clumps':m2['rusticoDryTussocks'],'addedDraws':m2['drawCalls']-m1['drawCalls'],'addedTriangles':m2['triangles']-m1['triangles']})
print(json.dumps(results,indent=2));a.out.write_text(json.dumps(results,indent=2)+'\n')
