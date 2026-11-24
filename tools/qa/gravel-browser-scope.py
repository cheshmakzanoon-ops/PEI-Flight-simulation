"""Mark exact authored triangle projection and score final composed WebGL A/B."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter
import argparse,json,math,numpy as np
p=argparse.ArgumentParser(description=__doc__);p.add_argument('frames',type=Path);a=p.parse_args();base=a.frames
rows=json.loads((base/'observed.json').read_text());results=[]
def clip(verts,W,H):
 raw=[]
 for x,y,z in verts:
  d=-z
  if not math.isfinite(x+y+z):raise ValueError(verts)
  raw.append((d,(x-W*.5)*d,(y-H*.5)*d))
 out=[];near=.081
 for i,u in enumerate(raw):
  v=raw[(i+1)%len(raw)]
  if u[0]>=near:out.append(u)
  if (u[0]>=near)!=(v[0]>=near):
   t=(near-u[0])/(v[0]-u[0]);out.append((near,u[1]+t*(v[1]-u[1]),u[2]+t*(v[2]-u[2])))
 return [(W*.5+x/d,H*.5+y/d) for d,x,y in out]
def color(pixels):
 if not len(pixels):return None
 a=pixels.astype(float)
 return [float(k) for k in np.median(a,axis=0)]
for row in rows:
 name,mode=row['view'],row['mode']
 if mode!='active':continue
 pre=base/f'{name}-{mode}'
 A=np.asarray(Image.open(str(pre)+'-neutral.png').convert('RGB'),dtype=np.int16);B=np.asarray(Image.open(str(pre)+'-art.png').convert('RGB'),dtype=np.int16)
 D=np.abs(A-B).max(2);H,W=D.shape
 triangles=json.loads(Path(str(pre)+'-scope.json').read_text())
 mask=Image.new('L',(W,H));paint=ImageDraw.Draw(mask)
 for t in triangles:
  xy=clip(t,W,H)
  if len(xy)>2:paint.polygon(xy,fill=255)
 metrics={}
 for radius in [0,1,2,4]:
  m=np.asarray(mask if radius==0 else mask.filter(ImageFilter.MaxFilter(radius*2+1)))!=0
  metrics[str(radius)]=dict(scope=int(m.sum()),protected=int((~m).sum()),changedProtected=int(((~m)&(D>0)).sum()), changedProtectedGt2=int(((~m)&(D>2)).sum()),maxProtected=int(D[~m].max(initial=0)))
 affected=D>2
 r=dict(view=name,actualWebGL=True,visiblePixelsAbove2=int(affected.sum()),medianChangedNeutralRGB=color(A[affected]),medianChangedCandidateRGB=color(B[affected]),scopedProtectionByPadPx=metrics,
        sameExactThroughGainToggle=row['againExact'],unmodifiedOtherGeometryDrawTotal=row['stock']['draws'],unmodifiedTriangleTotal=row['stock']['triangles'])
 z=np.asarray(mask.filter(ImageFilter.MaxFilter(9)))!=0
 rgb=B.copy();rgb[~z&(D>2)]=[224,15,204]
 Image.fromarray(rgb.astype('u1')).save(str(pre)+'-scope.webp',quality=80)
 print(json.dumps(r));results.append(r)
(base/'full-game-protected.json').write_text(json.dumps(results,indent=2)+'\n')
