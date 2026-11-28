"""Bake linear associated source light and coverage with the original Three.js program."""
from pathlib import Path
import json
import sys

import numpy as np
from PIL import Image
from atlas_gpu import digest as hash, driver, level_words, open_capture

def linear_to_display(x):
    return np.where(x<=0.0031308,x*12.92,1.055*np.maximum(x,0)**(1/2.4)-.055)

if len(sys.argv) != 2:
    raise SystemExit("usage: bake-atlas.py NEW_OUTPUT < original-packet.json")
D = Path(sys.argv[1])
J = json.load(sys.stdin)
W,H = J["frame"]
capture = open_capture(J)
D.mkdir()
rows=[]
sheet=Image.new('RGBA',(4*W,4*H))
for i,c in enumerate(J['cams']):
    a=capture(c)
    assert np.array_equal(a,capture(c))
    ac=a[:,:,3]
    assert set(map(int,np.unique(ac))).issubset({0,64,128,191,255})
    assert not a[:,:,:3][ac==0].any() and np.max(a[:,:,:3]) < 128
    yy,xx=np.nonzero(ac)
    bbox=[int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)]
    assert min(bbox[0],bbox[1],W-bbox[2],H-bbox[3])>=20
    assert 2500<len(yy)<40000
    rgba=a.astype(np.float64)
    source_mean=rgba.mean(axis=(0,1))
    mo=[]
    while len(rgba)>=4:
        lvl=level_words(rgba);words0=lvl.tobytes()
        name='angle-%02d-%03d.rgba'%(i,len(lvl))
        (D/name).write_bytes(words0)
        mean=rgba.mean(axis=(0,1))
        assert np.max(abs(mean-source_mean))<1e-10
        assert np.max(abs(lvl.astype(np.float64).mean(axis=(0,1))-source_mean))<=.5
        mo.append({'length':len(rgba),'bytes':len(words0),'sha256':hash(words0),'words':name})
        groups=len(rgba)//2
        rgba=rgba.reshape(groups,2,groups,2,4).mean(axis=(1,3))
    al=a[:,:,3:4].astype(np.float64)/255
    straight=np.divide(a[:,:,:3]/255,al,out=np.zeros((*ac.shape,3)),where=al!=0)
    visual=np.dstack((np.rint(255*np.clip(linear_to_display(straight),0,1)).astype(np.uint8),ac))
    sheet.paste(Image.fromarray(visual),((i%4)*W,(i//4)*H))
    rows.append({'index':i,**{k:c[k]for k in ('variant','az','elevation','orthographicSpanM')},'rgbaSHA':hash(a.tobytes()),
                 'native4xSamples':4,'coveredPixels':len(yy),'bbox':bbox,
                 'alphaMeanPerCode':float(source_mean[3]),'levels':mo})
sheet.save(D/'orthographic-original-clusters.webp',lossless=True,exact=True)
(D/'receipt.json').write_text(json.dumps({'scope':'Source-driven detached impostor bake only; no runtime seating, mixture of view angles or release.',
 'driver':driver,'three':J['three'],'shade':'Linear-sRGB radiance plus coverage preserved as premultiplied RGBA8; original buffers and orthographic view; no tonal or lighting match to public route.',
 'projection':'Two authored clusters each with 2 look bands and 4 yaw sectors. Source plot not a map or agronomic measurement.',
 'repeatByteExact':True,'rangesDistinct':len(set(x['rgbaSHA']for x in rows)),'sheets':rows},indent=2)+'\n')
