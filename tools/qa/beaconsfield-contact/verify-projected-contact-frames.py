#!/usr/bin/env python3
"""Inspect true rendered A/B deltas against a conservative projected face envelope."""
import argparse,hashlib,json
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--old',type=Path,required=True);p.add_argument('--candidate',type=Path,required=True)
p.add_argument('--projection',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
a=p.parse_args();Q=json.loads(a.projection.read_text())
w,h=Q['width'],Q['height']
assert (w,h)==(840,540) and Q['ground'] and Q['shadow']
def hull(data):
    pts=sorted(set((p[0],p[1]) for triangle in data for p in triangle))
    assert len(pts)>=3
    assert all(-1.001<=p[2]<=1.001 for triangle in data for p in triangle)
    def z(o,a,b):return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
    lower=[]
    for p in pts:
        while len(lower)>=2 and z(lower[-2],lower[-1],p)<=0:lower.pop()
        lower.append(p)
    upper=[]
    for p in reversed(pts):
        while len(upper)>=2 and z(upper[-2],upper[-1],p)<=0:upper.pop()
        upper.append(p)
    return lower[:-1]+upper[:-1]
envelope=Image.new('L',(w,h));draw=ImageDraw.Draw(envelope)
for cell in Q['ground']+Q['shadow']:
    poly=hull(cell)
    if len(poly)>=3:draw.polygon(poly,fill=255)
# Conservative screen AA allowance, not permission to move an unrelated texture.
E=np.asarray(envelope.filter(ImageFilter.MaxFilter(5)))!=0
A=np.asarray(Image.open(a.old).convert('RGB')).astype(np.int16)
B=np.asarray(Image.open(a.candidate).convert('RGB')).astype(np.int16)
assert A.shape==B.shape==(h,w,3)
d=np.max(np.abs(A-B),axis=2)
out=(d>2)&(~E)
rows,cols=np.where(out)
report=dict(scope='Conservative projected enclosure of actual altered ground/receiver geometry across both positions; not individual pixel ground truth. Outside count is separately reported.',
 rawGroundFaces=len(Q['ground']),rawShadowFaces=len(Q['shadow']),enclosedPixels=int(E.sum()),changedAny=int((d>0).sum()),
 changedOver2=int((d>2).sum()),changedOver2Outside=int(out.sum()),outerFirstExamples=list(zip(cols[:50].tolist(),rows[:50].tolist())),
 outerMaxDelta=int(d[~E].max(initial=0)))
a.out.write_text(json.dumps(report,indent=2)+'\n')
pim=np.full((h,w,3),32,np.uint8);pim[E]=(33,88,72);pim[(d>2)&E]=(171,154,83);pim[out]=(254,85,64)
Image.fromarray(pim).save(a.out.with_suffix('.png'))
