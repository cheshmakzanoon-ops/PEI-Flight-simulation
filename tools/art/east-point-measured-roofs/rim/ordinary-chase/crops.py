"""Verify both public native-size East Point crops; optionally reproduce from raw."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent
PIN = "010a1a714f1dc331342070e602544bba6b879674f2f3388d7912fd4de44670bb"
assert hashlib.sha256((ROOT/"native.json").read_bytes()).hexdigest() == PIN
RECEIPT = json.loads((ROOT/"native.json").read_bytes())
assert RECEIPT["status"].startswith("PASS ") and RECEIPT["gates"] == [True, True, True]
def pixels(im):
    it=iter(im.convert("RGBA").tobytes())
    return zip(it,it,it,it,strict=True)
def score(a,b,m):
    assert a.size == b.size == m.size
    changed=strong=outside=alpha=r0=r1=0
    for p,q,v in zip(pixels(a),pixels(b),pixels(m),strict=True):
        red,green=v[0]>0,v[1]>0
        assert v[0] in (0,255) and v[1] in (0,255) and v[2:]==(0,255)
        d=max(abs(p[k]-q[k]) for k in range(3))
        changed+=d>0;strong+=d>2;outside+=d>0 and not (red or green);alpha+=p[3]!=q[3]
        r0+=d>2 and red and not green;r1+=d>2 and green and not red
    return [changed,strong,outside,alpha,[r0,r1]]
def load(folder,phase,role):
    with Image.open(folder/f"{phase}-{role}.png") as im:
        assert im.mode=="RGBA"
        return im.copy()
a=argparse.ArgumentParser(description=__doc__)
a.add_argument("--from-native",type=Path)
n=a.parse_args()
for phase in (0,1):
    row=RECEIPT["views"][phase]
    x0,y0,x1,y1=row["cropBox"];size=(x1-x0,y1-y0)
    if n.from_native:
        def raw(role):return load(n.from_native,phase,role)
        left,right=raw("original"),raw("candidate")
        assert left.tobytes()==raw("originalRestore").tobytes()
        assert right.tobytes()==raw("candidateRestore").tobytes()
        od,ow,cd,cw=(raw(role) for role in ("originalRoleDark","originalRoleWhite","candidateRoleDark","candidateRoleWhite"))
        mask=Image.new("RGBA",size)
        mask.putdata([(255*int(o[0]!=p[0] or c[0]!=d[0]),255*int(o[1]!=p[1] or c[1]!=d[1]),0,255)
                      for o,p,c,d in zip(pixels(od),pixels(ow),pixels(cd),pixels(cw),strict=True)])
        pair=Image.new("RGBA",(2*size[0]+6,size[1]),(21,24,29,255))
        pair.paste(left,(0,0));pair.paste(right,(size[0]+6,0))
        for img,path,fmt,opts in [(pair,ROOT/f"{phase}-matched.webp","WEBP",{"lossless":True}),
                                  (mask,ROOT/f"{phase}-scope.png","PNG",{"optimize":True})]:
            with path.open("xb") as f:img.save(f,fmt,**opts)
            assert Image.open(path).convert("RGBA").tobytes()==img.tobytes()
    with Image.open(ROOT/f"{phase}-matched.webp") as pair, Image.open(ROOT/f"{phase}-scope.png") as mask:
        w,h=size
        assert pair.size==(2*w+6,h) and mask.size==size
        got=score(pair.crop((0,0,w,h)),pair.crop((w+6,0,2*w+6,h)),mask)
        assert got==[row["changed"],row["strong"],row["outside"],row["alpha"],row["byExclusiveRoof"]]
        print(phase,got)
exit_view=RECEIPT["views"][2]
assert not any(exit_view[k] for k in ("changed","strong","outside","alpha"))
