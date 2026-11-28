"""Count exactly representable neutral seam points between old Panmure facets.

A split must lie on the literal old segment under both the CPU local and the
actual single-add Float32 shader transform. Because at least one old UV
channel varies, the exact interpolation parameter is common to both bases.
The screen is deliberately separate from immutable V5; it never moves a
point to qualify, emits no mesh and authorizes no render or contact changes.
"""
from pathlib import Path
from fractions import Fraction as F
from hashlib import sha256
from math import gcd
from struct import unpack,pack
import argparse,json
import numpy as np

PINS={'position':'585c694d35fc234f25dcc4d3df547ee9859d3274bb73830c047acf819edc139b',
      'normal':'25c0b802f5de393db35a237c1df4fa7cb66db176d9d923248c40c231bd906f11',
      'uv':'921c8110c89ee6188a4970a0ccc6d4b15398b2e2ce02bceeef525b91b84cb959',
      'index':'33871cac1ee31a2c5e4cb22b35de67f6cf10e53758d3c0784b83790caee5fffa'}
FACES=[2961,2962,2963,3184,3185,3186,3187,3408,3409,3410,3632,3633]
TRANS=(57883.79296875,0.,41735.93359375)
QUANT=256    # critical-world coordinates all share this binade in the domain
def f32(x): return unpack('<f',pack('<f',float(x)))[0]
def exact(x):return F(f32(x))==x
def edges(t): return zip(t,t[1:]+t[:1])
def legal_points(a,b):
    prior=np.array([[f32(f32(i)+dt) for i,dt in zip(row[:3],TRANS)] for row in (a,b)])
    p,q=[tuple(F(float(x)) for x in row) for row in (a,b)]
    w,z=[tuple(F(float(x)) for x in row) for row in prior]
    assert 32768 < w[0] <65536 and 32768<w[2]<65536 and 32768<z[0]<65536 and 32768<z[2]<65536
    candidates=[(z[i]-w[i])*QUANT for i in (0,2)]
    assert all(t.denominator==1 for t in candidates) and p[3:5]!=q[3:5]
    n=gcd(*[abs(int(f)) for f in candidates])
    good=[]; audit=dict(candidateCommonGrid=n-1,exactLocalAllChannels=0,exactLocalAndGPU=0)
    for j in range(1,n):
        t=F(j,n)
        l=[u+(v-u)*t for u,v in zip(p,q)]
        # Equality, not a tolerance, for Y, U, V, N as well as CPU X/Z.
        if not all(exact(k) for k in l): continue
        audit['exactLocalAllChannels']+=1
        pp=[F(f32(float(x)+dt)) for x,dt in zip(l[:3],TRANS)]
        if all(pp[i]==w[i]+(z[i]-w[i])*t for i in range(3)):
            good.append(t)
    audit['exactLocalAndGPU']=len(good)
    return audit,good

def main():
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--stock',type=Path,required=True)
    cli.add_argument('--out',type=Path,required=True)
    arg=cli.parse_args()
    ary={}
    for k,sh in PINS.items():
        end='u16le' if k=='index' else 'f32le'
        raw=(arg.stock/(k+'.'+end)).read_bytes()
        assert sha256(raw).hexdigest()==sh
        ary[k]=np.frombuffer(raw,'<u2' if k=='index' else '<f4').reshape(-1,2 if k=='uv' else 3)
    hood={}
    for face in FACES:
        for u,v in edges(ary['index'][face].tolist()):
            hood.setdefault(tuple(sorted((u,v))),[]).append((face,u,v))
    assert sum(len(c)==1 for c in hood.values())==10
    assert sum(len(c)==2 for c in hood.values())==13
    P=np.c_[ary['position'],ary['uv'],ary['normal']]
    result=[]
    for (u,v),occ in sorted(hood.items()):
        if len(occ)!=2:continue
        assert occ[0][1:]==occ[1][1:][::-1]
        stats,c=legal_points(P[u],P[v])
        points=[F(0),*c,F(1)]
        mx=max(b-a for a,b in zip(points,points[1:]))
        result.append({'stockEdge':[u,v],'owningFaces':[x[0] for x in occ],**stats,
                       'lowestExactInternalT':str(c[0]) if c else None,
                       'highestExactInternalT':str(c[-1]) if c else None,
                       'exactQuarterFractionsPresent':[str(t) for t in (F(1,4),F(1,2),F(3,4)) if t in c],
                       'maximumUnsplitLengthMetres':float(mx)*float(np.linalg.norm(P[v,[0,2]].astype(float)-P[u,[0,2]].astype(float)))})
    with arg.out.open('x') as f:json.dump({'scope':'coordinate feasibility only; no exterior edges split, no geometry or runtime changed','sources':PINS,'edges':result},f,indent=2);f.write('\n')
    for r in result:print(r['stockEdge'],r['owningFaces'],r['exactLocalAndGPU'],r['exactQuarterFractionsPresent'],round(r['maximumUnsplitLengthMetres'],4))

if __name__=='__main__':main()
