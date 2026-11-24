"""Compare runtime optical masks including one-texel bilinear neighbour support."""
from pathlib import Path
import gzip, json, struct, sys, hashlib
from functools import lru_cache
import numpy as np
base=Path(sys.argv[1])
def groups(folder):
    b=gzip.decompress((folder/'index.fcr.gz').read_bytes())
    magic,v,npacks,ncells,flags=struct.unpack_from('<4s4H',b)
    assert (magic,v,flags)==(b'FCR1',1,0) and len(b)==12+36*npacks+80*ncells
    result={}
    for k in range(ncells):
        x,z,p,reserved,o,n,wh,rh=struct.unpack_from('<hhHHII32s32s',b,12+36*npacks+80*k)
        assert (x,z) not in result and reserved==0
        result[x,z]=(p,o,n,wh,rh)
    @lru_cache(maxsize=6)
    def pack(p):
        r=(folder/f'crop-{p:02}.pack').read_bytes()
        size,h=struct.unpack_from('<I32s',b,12+p*36)
        assert len(r)==size and hashlib.sha256(r).digest()==h
        return r
    def data(xz):
        p,o,n,wh,rh=result[xz]
        packed=pack(p)[o:o+n]
        assert hashlib.sha256(packed).digest()==wh
        arr=gzip.decompress(packed)
        assert len(arr)==260*260*2 and hashlib.sha256(arr).digest()==rh
        return np.frombuffer(arr,np.uint8).reshape((260,260,2))[:,:,1]
    return result, data
grass,g=groups(base/'grass-study')
fields,f=groups(base/'fields-province')
common=set(grass)&set(fields)
exact=0
maybe=0
boundary=0
hits=[]
for xy in sorted(common):
    a,b=g(xy),f(xy)
    oa,ob=a[2:258,2:258],b[2:258,2:258]
    overlap=(oa>0)&(ob>0)
    # A GPU bilinear patch uses the same 2×2 texel support for both layers.
    # Patch lower-left indices 1..257 include 2m across every boundary.
    def support(alpha):
        return (alpha[1:258,1:258]>0)|(alpha[2:259,1:258]>0)|(alpha[1:258,2:259]>0)|(alpha[2:259,2:259]>0)
    bilinear=support(a)&support(b)
    n=int(np.count_nonzero(overlap))
    m=int(np.count_nonzero(bilinear))
    if m:
        hits.append([*xy,n,m,int(np.minimum(oa,ob).max())])
    exact+=n
    maybe+=m
    boundary+=int(np.count_nonzero(bilinear[:1])+np.count_nonzero(bilinear[-1:])+np.count_nonzero(bilinear[1:-1,:1])+np.count_nonzero(bilinear[1:-1,-1:]))
print(json.dumps(dict(grassShards=len(grass),farmlandShards=len(fields),sameShard=len(common),overlapExactCentres=exact,overlapBilinearPatches=maybe,edgePatchOccurrences=boundary,rankedHits=sorted(hits,key=lambda p:-p[3])[:50],maxOverlapAreaSquareMetres=maybe*16),indent=2))
