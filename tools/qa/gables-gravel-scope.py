"""Check matched path pixels against a conservative source-bounded prism."""
import argparse,itertools,json,math
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from scipy.spatial import ConvexHull
from scipy.ndimage import binary_dilation

p=argparse.ArgumentParser(description=__doc__)
for name in ('stock','live','out'):p.add_argument(name,type=Path)
a=p.parse_args()
phi=math.radians(46.5);k=1-.00669437999014*math.sin(phi)**2
SX=6378137*math.pi/180*math.cos(phi)/math.sqrt(k)
SZ=6378137*math.pi/180*(1-.00669437999014)/k**1.5
L2=np.array([14.306,22.351])
raw=np.array([[-63.3819114,46.4882988],[-63.3818888,46.4884252],[-63.3818595,46.4884939]])
m=raw[1]
start=raw[0]+(m-raw[0])*(7.625/L2[0]);end=m+(raw[2]-m)*((15.5-L2[0])/(L2[1]-L2[0]))
x=(np.array([start[0],m[0],end[0]])+63.2)*SX;z=(46.5-np.array([start[1],m[1],end[1]]))*SZ
cube=np.array(list(itertools.product([x.min()-.78,x.max()+.78],[11.2,17.2],[z.min()-.78,z.max()+.78])))
def region(q):
    d,pose=q['diag'],q['pose'];w,h=q['width'],q['height']
    eye=np.array([d['x'],d['eyeY'],d['z']]);aim=np.array([(pose['lon']+63.2)*SX,d['baseH']+pose['h']/2,(46.5-pose['lat'])*SZ])
    f=aim-eye;f/=np.linalg.norm(f);r=np.cross(f,[0,1,0]);r/=np.linalg.norm(r);u=np.cross(r,f)
    delta=cube-eye
    depth=delta@f
    if depth.min()<=.1:raise ValueError('Cannot validly bound this near camera projection.')
    slope=math.tan(math.radians(53/2))
    qx=(1+(delta@r)/(depth*slope)*h/w)*w/2;qy=(1-(delta@u)/(depth*slope))*h/2
    poly=np.column_stack((qx,qy))
    mask=Image.new('L',(w,h))
    ImageDraw.Draw(mask).polygon([tuple(c)for c in poly[ConvexHull(poly).vertices]],fill=1)
    return binary_dilation(np.asarray(mask,dtype=bool),iterations=3)
lookup=lambda d:{q['name']:q for q in json.loads((d/'results.json').read_text())}
S,L=map(lookup,(a.stock,a.live))
out={}
for name,pair in S.items():
    ds,dl=pair['diag'],L[name]['diag']
    for f in ['orthoIds','positions','drawCalls','triangles','greenGablesReview','greenGablesBarnReview','localGroundGrade']:
        assert ds[f]==dl[f],(name,f)
    px=lambda d:np.asarray(Image.open(d/(name+'.png')).convert('RGB'),dtype=np.int16)
    delta=np.max(abs(px(a.stock)-px(a.live)),axis=2)
    if 'long' in name:
        assert not delta.any(),name
        out[name]={'distanceFade':True,'fullyUnchanged':int(delta.size)}
        continue
    permitted=region(pair)
    outside=~permitted
    off=int((delta[outside]>0).sum());changed=int((delta>2).sum())
    assert not off and changed>60,(name,off,changed)
    out[name]={'pixels':int(delta.size),'protectedPixels':int(outside.sum()),'protectedChangedPixels':off,
               'changedAbove2':changed,'samePhysicalProbes':True,'sameDrawAndTriangles':True}
a.out.write_text(json.dumps(out,indent=2)+'\n')
print(out)
