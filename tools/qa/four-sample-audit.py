"""Audit a native pair of final-RGB coverage probes; non-integer pixels mean HOLD."""
import argparse
from collections import deque
from hashlib import sha256
import json
from pathlib import Path

import numpy as np
from PIL import Image


def component_boxes(mask):
    pending=set(map(tuple,np.argwhere(mask)))
    result=[]
    while pending:
        q=deque([pending.pop()])
        count=0
        top,left,bottom,right=q[0][0],q[0][1],q[0][0],q[0][1]
        while q:
            y,x=q.pop()
            top,left,bottom,right=min(top,y),min(left,x),max(bottom,y),max(right,x)
            count+=1
            # Connectivity is diagnostic only and never limits the HOLD mask.
            for dy in (-1,0,1):
                for dx in (-1,0,1):
                    near=(y+dy,x+dx)
                    if near in pending:
                        pending.remove(near)
                        q.append(near)
        result.append({"pixels":count,"boxXYXY":[int(left),int(top),int(right+1),int(bottom+1)]})
    return sorted(result,key=lambda q:(-q["pixels"],q["boxXYXY"]))


def assess(old,a,b,red,blue):
    if old.shape!=a.shape or a.shape!=b.shape or a.ndim!=3 or a.shape[2]!=4:
        raise ValueError("unmatched device RGBA dimensions")
    if not all(np.all((im>=0)&(im<=255)) for im in (old,a,b)):
        raise ValueError("not device byte codes")
    red,blue=np.asarray(red,np.int32),np.asarray(blue,np.int32)
    if red.shape!=(3,) or blue.shape!=(3,) or np.any(red<0) or np.any(blue<0) or np.any(red>255) or np.any(blue>255):
        raise ValueError("invalid literal RGB receipts")
    target=red-blue
    if np.max(abs(target))<9:
        raise ValueError("literal RGB probes do not separate adjacent sample classes")
    rgb0,rgbA,rgbB=(im[:,:,:3].astype(np.int32) for im in (old,a,b))
    actual=4*(rgbA-rgbB)
    count=np.full(a.shape[:2],-1,np.int8)
    for k in range(5):
        good=(abs(actual-k*target)<=4).all(axis=2)
        if np.any(count[good]>=0):
            raise ValueError("overlapping resolved sample classes")
        count[good]=k
    bad=count<0
    alpha=(a[:,:,3]!=old[:,:,3])|(b[:,:,3]!=old[:,:,3])
    zero=(count==0)&(((rgbA!=rgb0)|(rgbB!=rgb0)).any(2))
    complete=(count==4)&(((rgbA!=red)|(rgbB!=blue)).any(2))
    # A fractional projection is useful for a reviewer to inspect the old
    # scene, but does not allow rounding a refused pixel into a sample class.
    if bad.any():
        t=actual[bad]@target/(target@target)
        residual=(actual[bad]-t[:,None]*target)*.25
        fractional={"minMaxProjectedSamples":[float(t.min()),float(t.max())],
                    "codeResidualP90":float(np.quantile(abs(residual).max(axis=1),.9))}
    else:
        fractional=None
    passed=not (bad.any() or alpha.any() or zero.any() or complete.any())
    return {
        "state":"integer sample witness" if passed else "HOLD nonconforming native sample evidence",
        "markedSampleHistogram0to4":[int((count==k).sum()) for k in range(5)],
        "unquantizedPixels":int(bad.sum()),
        "nativeAlphaChanges":int(alpha.sum()),
        "changedZeroCasePixels":int(zero.sum()),
        "nonliteralFullCasePixels":int(complete.sum()),
        "unquantizedComponents":component_boxes(bad),
        "fractionalDiagnosticOnly":fractional,
    }


def rgba(p):
    im=Image.open(p)
    if im.format!="PNG" or im.mode not in ("RGB","RGBA"):
        raise ValueError("use an unresized native PNG")
    return np.asarray(im.convert("RGBA"))


if __name__=="__main__":
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("original",type=Path)
    p.add_argument("probe_a",type=Path)
    p.add_argument("probe_b",type=Path)
    p.add_argument("--a",type=int,nargs=3,required=True)
    p.add_argument("--b",type=int,nargs=3,required=True)
    p.add_argument("--require-integer",action="store_true",help="return 2 for nonconforming native evidence")
    a=p.parse_args()
    inputs=[a.original,a.probe_a,a.probe_b]
    report=assess(*(rgba(f) for f in inputs),a.a,a.b)
    report["frameSHA256"]=[sha256(f.read_bytes()).hexdigest() for f in inputs]
    print(json.dumps(report,indent=2))
    if a.require_integer and report["state"].startswith("HOLD"):
        raise SystemExit(2)
