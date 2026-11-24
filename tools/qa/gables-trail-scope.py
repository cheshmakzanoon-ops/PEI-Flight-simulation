"""Check matched gravel connection pixels against a conservative source-bounded prism."""
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
spec=Path(__file__).resolve().parents[2]/'src/render/cavendish-trail.generated.ts'
generated=json.loads(spec.read_text().split('=',1)[1].split(' as const',1)[0])
vertices=np.asarray(generated['derivedLineWgs84'])
x=(vertices[:,0]+63.2)*SX;z=(46.5-vertices[:,1])*SZ
cube=np.array(list(itertools.product([x.min()-.88,x.max()+.88],[6.,22.],[z.min()-.88,z.max()+.88])))
def region(q):
    d,pose=q['diag'],q['pose'];w,h=q['width'],q['height']
    eye=np.array([d['x'],d['eyeY'],d['z']]);aim=np.array([(pose['lon']+63.2)*SX,d['baseH']+pose['h']/2,(46.5-pose['lat'])*SZ])
    f=aim-eye;f/=np.linalg.norm(f);r=np.cross(f,[0,1,0]);r/=np.linalg.norm(r);u=np.cross(r,f)
    delta=cube-eye
    corners=np.column_stack((delta@r,delta@u,delta@f))
    clip=[q for q in corners if q[2]>.1]
    for i,j in itertools.combinations(range(len(corners)),2):
        if i^j not in (1,2,4):continue
        x,y=corners[i],corners[j]
        if (x[2]>.1)==(y[2]>.1):continue
        clip.append(x+(y-x)*(.1-x[2])/(y[2]-x[2]))
    coords=np.array(clip)
    slope=math.tan(math.radians(53/2))
    qx=(1+coords[:,0]/(coords[:,2]*slope)*h/w)*w/2;qy=(1-coords[:,1]/(coords[:,2]*slope))*h/2
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
    if 'far' in name:
        assert not delta.any(),name
        out[name]={'distanceFade':True,'fullyUnchanged':int(delta.size)}
        continue
    permitted=region(pair)
    outside=~permitted
    off=int((delta[outside]>0).sum());changed=int((delta>2).sum())
    assert not off and changed>450,(name,off,changed)
    out[name]={'pixels':int(delta.size),'protectedPixels':int(outside.sum()),'protectedChangedPixels':off,
               'changedAbove2':changed,'samePhysicalProbes':True,'sameDrawAndTriangles':True}
a.out.write_text(json.dumps(out,indent=2)+'\n')
print(out)
