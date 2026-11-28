"""Reproduce from captured full frames, or verify the delivered lossless crops."""
import argparse, hashlib, json
from pathlib import Path
from PIL import Image

root=Path(__file__).resolve().parent
pin="08624ef315d08c0e72742051b029aea18d6a9d2d24081cd4ff04402d15d101d7"
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(root/"native.json")==pin
receipt=json.loads((root/"native.json").read_bytes())
assert receipt["status"].startswith("PASS ") and len(receipt["views"])==3
PALE=(24,28,34,255)

def data(image):
    a=iter(image.convert("RGBA").tobytes())
    return zip(a,a,a,a,strict=True)

def diff(a,b):
    assert a.size==b.size
    changes=strong=alpha=0
    for v,w in zip(data(a),data(b),strict=True):
        d=max(abs(v[i]-w[i]) for i in range(3))
        changes+=d>0;strong+=d>2;alpha+=v[3]!=w[3]
    return [changes,strong,alpha]

def metrics(images,r):
    stock,neutral,grade=images
    gold=diff(stock,grade)
    outline=diff(stock,neutral)
    lift=diff(neutral,grade)
    assert gold==[r["changed"],r["strong"],0]
    assert outline==[r["neutralChanged"],r["neutralStrong"],0]
    assert lift==[r["causalChanged"],r["causalStrong"],0]
    return [gold,outline,lift]

def generate(original):
    meta={}
    for r in receipt["views"]:
        phase=r["phase"]
        frames=[]
        names=("grade-stock","grade-neutral","grade-art","grade-restore")
        for n in names:
            p=original/f"{phase}-{n}.png"
            assert sha(p)==r["png"][n]
            with Image.open(p) as im:
                assert im.mode=="RGBA" and im.size==(1080,700)
                frames.append(im.copy())
        stock,neutral,grade,restore=frames
        assert stock.tobytes()==restore.tobytes()
        tools=metrics(frames[:3],r)
        if phase=="exit":
            assert r["offscreen"]=="right" and not any(sum(g) for g in tools)
            assert len(r["passes"]["before"]["grounds"])==1
            continue
        indices=[]
        for i,(a,b,c) in enumerate(zip(data(stock),data(neutral),data(grade),strict=True)):
            if a!=b or b!=c:
                indices.append((i%1080,i//1080))
        xmin=min(v[0] for v in indices);xmax=max(v[0] for v in indices)
        ymin=min(v[1] for v in indices);ymax=max(v[1] for v in indices)
        box=(max(0,xmin-22),max(0,ymin-22),min(1080,xmax+23),min(700,ymax+23))
        tiles=[f.crop(box) for f in frames[:3]]
        assert metrics(tiles,r)==tools
        w,h=tiles[0].size
        joined=Image.new("RGBA",(3*w+12,h),PALE)
        for i,tile in enumerate(tiles):joined.paste(tile,((w+6)*i,0))
        dest=root/f"{phase}.webp"
        with dest.open("xb") as f:joined.save(f,"WEBP",lossless=True)
        assert Image.open(dest).convert("RGBA").tobytes()==joined.tobytes()
        meta[phase]={"box":box,"sha256":sha(dest)}
    with (root/"plates.json").open("x") as f:json.dump(meta,f,indent=2);f.write("\n")

def check():
    meta=json.loads((root/"plates.json").read_bytes())
    for r in receipt["views"][:2]:
        phase=r["phase"];m=meta[phase];x,y,x1,y1=m["box"];w,h=x1-x,y1-y;p=root/f"{phase}.webp"
        assert sha(p)==m["sha256"]
        with Image.open(p) as im:
            assert im.size==(w*3+12,h)
            crops=[im.crop((i*(w+6),0,i*(w+6)+w,h)) for i in range(3)]
            print(phase,metrics(crops,r))

p=argparse.ArgumentParser(description=__doc__)
p.add_argument("--from-full",type=Path)
args=p.parse_args()
if args.from_full:generate(args.from_full)
check()
