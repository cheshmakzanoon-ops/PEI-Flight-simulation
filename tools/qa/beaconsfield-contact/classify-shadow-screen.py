#!/usr/bin/env python3
"""Classify paired scene pixels with ordinary canopy shade enabled and disabled."""
import argparse,json
from pathlib import Path
import numpy as np
from PIL import Image
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--stock',type=Path,required=True);p.add_argument('--candidate',type=Path,required=True)
p.add_argument('--out',type=Path,required=True);p.add_argument('--view',default='veranda-oblique')
a=p.parse_args()
def read(d,k):return np.asarray(Image.open(d/(a.view+'-shadow-witness-'+k+'.png')).convert('RGB')).astype(np.int16)
S,N,S0,N0=read(a.stock,'before'),read(a.candidate,'before'),read(a.stock,'noTrees'),read(a.candidate,'noTrees')
assert S.shape==N.shape==S0.shape==N0.shape==(540,840,3)
D=np.abs(S-N).max(axis=2)
I=np.abs(S0-N0).max(axis=2)
RS=(S-S0).max(axis=2)
RN=(N-N0).max(axis=2)
x0,y0,x1,y1=110,448,237,509
r=(slice(y0,y1+1),slice(x0,x1+1))
def quantity(d):
    return dict(changedOver2=int((d>2).sum()),changedOver8=int((d>8).sum()),peak=int(d.max(initial=0)))
result=dict(view=a.view,cutRegion=[x0,y0,x1,y1],
  treeShadeNormal=quantity(D),samePairWithoutOnlyTreeShadows=quantity(I),
  cutNormal=quantity(D[r]),cutWithoutOnlyTreeShadows=quantity(I[r]),cutChangesDisappearingWithoutShadows=int(((D[r]>8)&(I[r]<=2)).sum()))
a.out.write_text(json.dumps(result,indent=2)+'\n')
