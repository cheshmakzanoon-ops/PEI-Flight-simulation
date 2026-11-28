"""Independently verify every source page and mip with integer reductions."""
import argparse
from hashlib import sha256
import json
from pathlib import Path

import numpy as np

PAGE=256
LAYERS=16
DIMENSIONS=(256,128,64,32,16,8,4)
digest=lambda raw:sha256(raw).hexdigest()


def file_words(root, name, meta, k, channels):
    if "/" in name or "\\" in name or name in (".",".."):
        raise ValueError("not an atlas filename")
    if not (root / name).resolve().is_relative_to(root.resolve()):
        raise ValueError("nonlocal atlas word path")
    raw=(root/name).read_bytes()
    if len(raw)!=k*k*channels or len(raw)!=meta["bytes"] or digest(raw)!=meta["sha256"]:
        raise ValueError(f"{name}: incorrect hash or byte size")
    return np.frombuffer(raw,np.uint8).reshape(k,k,channels)


def exact_mip(a,k):
    if k not in DIMENSIONS or a.shape[0]!=PAGE or a.shape[1]!=PAGE:
        raise ValueError("mip geometry not supported")
    s=PAGE//k
    r=a.astype(np.int64).reshape(k,s,k,s,a.shape[2]).sum(axis=(1,3))
    divisor=s*s
    q,m=r//divisor,r%divisor
    return (q+((2*m>divisor)|((2*m==divisor)&(q%2!=0)))).astype(np.uint8)


def verify(rgb_dir,z_dir):
    raw=(rgb_dir/"receipt.json").read_bytes()
    colour=json.loads(raw)
    depth=json.loads((z_dir/"receipt.json").read_bytes())
    if depth["atlasInputReceiptSHA256"]!=digest(raw):
        raise ValueError("nonmatching native colour/depth source")
    if len(colour["sheets"])!=LAYERS or len(depth["depthPages"])!=LAYERS:
        raise ValueError("expected 16 views of both depth and colour")
    if (depth["orthographicNearAndFarM"]!=[.05,40.]
            or depth["encodedDepthBeforeNormalizationM"]!=[7.4,12.6]
            or depth["channels"]!=["associated eye-depth moment R8","coverage U8"]):
        raise ValueError("depth unit or channel contract differs")
    if len({p["rgbaSHA"] for p in colour["sheets"]})!=LAYERS:
        raise ValueError("repeated or missing views")
    gaze=[(f"variant-{v}",e,a,5.2) for v in range(2)
          for e in (25,64) for a in (19,109,199,289)]
    margins=[]
    total_bytes=0
    for i,(rgb,z) in enumerate(zip(colour["sheets"],depth["depthPages"],strict=True)):
        expected=tuple(rgb[k] for k in ("variant","elevation","az","orthographicSpanM"))
        if (rgb["index"]!=i or z["page"]!=i or rgb["native4xSamples"]!=4 or expected!=gaze[i]
                or rgb["rgbaSHA"]!=rgb["levels"][0]["sha256"]):
            raise ValueError("wrong locked view/coverage or base hash custody")
        if tuple(s["length"] for s in rgb["levels"])!=DIMENSIONS or tuple(s["extent"] for s in z["mips"])!=DIMENSIONS:
            raise ValueError("missing exact mip geometry")
        for k,cm,zm in zip(DIMENSIONS,rgb["levels"],z["mips"],strict=True):
            c_name,z_name=f"angle-{i:02d}-{k:03d}.rgba",f"depth-{i:02d}-{k:03d}.rg"
            if cm["words"]!=c_name or zm["words"]!=z_name:
                raise ValueError("wrong indexed word path")
            c=file_words(rgb_dir,c_name,cm,k,4)
            d=file_words(z_dir,z_name,zm,k,2)
            if not np.array_equal(c[:,:,3],d[:,:,1]) or np.any(c[:,:,:3]>c[:,:,3:]) or np.any(d[:,:,0]>d[:,:,1]):
                raise ValueError(f"{i}/{k}: invalid associated words or native peer")
            if k==PAGE:
                base_c,base_d=c,d
                if not set(map(int,np.unique(c[:,:,3]))).issubset({0,64,128,191,255}):
                    raise ValueError("native 4x coverage contains other alpha codes")
                y,x=np.where(c[:,:,3]>0)
                if len(y)!=rgb["coveredPixels"] or len(y)!=z["valid"]:
                    raise ValueError("wrong covered root count")
                margins.append(int(min(x.min(),y.min(),PAGE-1-x.max(),PAGE-1-y.max())))
                if margins[-1]<20:
                    raise ValueError("unstated original page border")
            else:
                if not np.array_equal(c,exact_mip(base_c,k)) or not np.array_equal(d,exact_mip(base_d,k)):
                    raise ValueError(f"{i}/{k}: independent full-resolution block mismatch")
            total_bytes+=c.nbytes+d.nbytes
    return {
        "status":"Verified source atlas only, no moving view, terrain or runtime",
        "sourceLayers":LAYERS,
        "nativeSamples":4,
        "levels":DIMENSIONS,
        "matchedPairedFiles":LAYERS*len(DIMENSIONS),
        "totalRGBAandRGBytes":total_bytes,
        "minimumBaseBorderPx":min(margins),
        "rawMipRounding":"nearest even using independent integer block sums",
        "colourReceiptSHA256":digest(raw),
        "depthReceiptSHA256":digest((z_dir/"receipt.json").read_bytes()),
    }


if __name__=="__main__":
    a=argparse.ArgumentParser(description=__doc__)
    a.add_argument("radiance",type=Path)
    a.add_argument("depth",type=Path)
    p=a.parse_args()
    print(json.dumps(verify(p.radiance,p.depth),indent=2))
