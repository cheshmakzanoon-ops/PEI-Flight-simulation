"""Check the dated water's matched AABB projection and fault-frame invariance."""
import argparse
import itertools
import json
import math
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from scipy.spatial import ConvexHull
p=argparse.ArgumentParser(description=__doc__)
for field in ('stock','live','bad','meta','out'):p.add_argument(field,type=Path)
a=p.parse_args()
lookup=lambda folder:{q['name']:q for q in json.loads((folder/'results.json').read_text())}
old,new,broken=map(lookup,(a.stock,a.live,a.bad))
spec=json.loads(a.meta.read_text())
def png(folder,name):
    return np.asarray(Image.open(folder/(name+'.png')).convert('RGB')).astype(np.int16)
fov=math.tan(math.radians(53/2))
phi=math.radians(46.5);esq=.00669437999014;t=1-esq*math.sin(phi)**2
sx=6378137*math.pi/180*math.cos(phi)/math.sqrt(t)
sz=6378137*math.pi/180*(1-esq)/t**1.5
bounds=(spec['left']-1,spec['left']+spec['width']*spec['step']+1,
        spec['top']-1,spec['top']+spec['height']*spec['step']+1)
def screen_polygon(base):
    info,pose=base['diag'],base['pose']
    eye=np.array([info['x'],info['eyeY'],info['z']])
    look=np.array([(pose['lon']+63.2)*sx,info['baseH']+pose['h']/2,(46.5-pose['lat'])*sz])
    f=look-eye;f/=np.linalg.norm(f)
    side=np.cross(f,[0,1,0]);side/=np.linalg.norm(side)
    up=np.cross(side,f)
    width,height=base['width'],base['height']
    corners=np.array(list(itertools.product(bounds[:2],[-.2,10.],bounds[2:])))-eye
    depth=corners@f
    if min(depth)<1:return None
    x=(1.+(corners@side)/(depth*fov*width/height))*width/2
    y=(1.-(corners@up)/(depth*fov))*height/2
    pts=np.column_stack((x,y))
    return pts[ConvexHull(pts).vertices]
proof={}
for name,q in old.items():
    assert q['diag']['orthoTiles']==new[name]['diag']['orthoTiles']==broken[name]['diag']['orthoTiles']
    first,last,fault=png(a.stock,name),png(a.live,name),png(a.bad,name)
    changed=np.max(np.abs(first-last),axis=2)
    fallback=np.max(np.abs(first-fault),axis=2)
    assert not fallback.any(),(name,int((fallback>0).sum()))
    assert (changed>2).any(),name
    row={'pixels':changed.size,'changeAbove2':int((changed>2).sum()),'faultChangedPixels':0}
    clip=screen_polygon(q)
    if clip is not None:
        w,h=q['width'],q['height']
        im=Image.new('L',(w,h))
        ImageDraw.Draw(im).polygon([tuple(v)for v in clip],fill=1)
        mask=np.asarray(im,dtype=bool)
        # Explicit three-pixel projection reserve for MSAA support, not a
        # comparison threshold. Outside it every channel must be exact.
        from scipy.ndimage import binary_dilation
        scope=binary_dilation(mask,iterations=3);off=~scope
        row.update(projectedConservativeMaskPixels=int(scope.sum()),protectedPixels=int(off.sum()),
                   changedProtectedPixels=int((changed[off]>0).sum()))
        assert not row['changedProtectedPixels'],(name,row)
    proof[name]=row
assert any('protectedPixels' in r for r in proof.values()),'No bounded camera could verify the outside scope.'
a.out.write_text(json.dumps(proof,indent=2)+'\n')
print(proof)
