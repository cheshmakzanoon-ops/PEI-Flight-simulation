"""Offline Panmure 25-18/N112 packet check: python3 check-topology.py PACKET_DIR STOCK_DIR."""
from pathlib import Path
from collections import defaultdict
from fractions import Fraction
from hashlib import sha256
from json import loads
from struct import iter_unpack, pack, unpack
from sys import argv

a,b=map(Path,argv[1:])
def read(path,digest):
    raw=path.read_bytes()
    if sha256(raw).hexdigest()!=digest: raise ValueError('digest '+path.name)
    return raw
def triples(fmt,blob): return list(iter_unpack('<'+fmt,blob))
r=loads(read(a/'receipt.json','08b817f00a2436156d3a4f1b177080e015b624645ab822c3956a6ab7769c6e82'))
f={k:read(a/k,v['sha256']) for k,v in r['packetLeaves'].items()}
old={k:read(b/n,r['oldWholeAssetSHA256'][k]) for k,n in
     [('position','position.f32le'),('normal','normal.f32le'),('uv','uv.f32le'),('index','index.u16le')]}
p0,p1,N,U=(f[k] for k in ['neutral.p.f32le','active.p.f32le','normal.f32le','uv.f32le'])
M=[1606,1719,1720,1607]; remap=M+list(range(12769,12994))
assert r['borrowOriginalVertexIDsInLocalOrder']==M
for x,k,w in [(p0,'position',12),(p1,'position',12),(N,'normal',12),(U,'uv',8)]:
    assert x[:4*w]==b''.join(old[k][i*w:(i+1)*w] for i in M)
F=triples('HHH',f['replacement.local.i.u16le']); Ii=old['index']
rep=pack('<1356H',*(remap[i] for t in F for i in t))
assert rep==f['replacement.rebased.i.u16le']
assert Ii[19104:19116]==f['old-9552-9558.i.u16le']==pack('<6H',1606,1719,1607,1719,1720,1607)
new=dict(commonEBO=Ii[:19104]+rep+Ii[19116:],activePOS=old['position']+p1[48:],
         neutralPOS=old['position']+p0[48:],nativeNormal=old['normal']+N[48:],nativeUV=old['uv']+U[32:])
assert {k:sha256(v).hexdigest() for k,v in new.items()}==r['fullReconstitutedForQAOnlyVBOHashesNotEmitted']
def cyc(t): return tuple(zip(t,t[1:]+t[:1]))
E=defaultdict(list)
for t in F:
    for u,v in cyc(t): E[tuple(sorted((u,v)))].append((u,v))
assert len(F)==452 and len(E)==680 and {i for t in F for i in t}==set(range(229))
assert sorted(v[0] for v in E.values() if len(v)==1)==[(0,1),(1,2),(2,3),(3,0)]
assert all(len(x)==1 or (len(x)==2 and x[0]==x[1][::-1]) for x in E.values())
J=triples('HHH',Ii)
for (u,v),o in zip(cyc(M),(3183,3408,3186,2961)): assert (v,u) in cyc(J[o])
X0=triples('fff',p0); X1=triples('fff',p1)
assert all((a,c)==(d,f) for (a,_,c),(d,_,f) in zip(X0,X1))
dY=[d-b for (_,b,_),(_,d,_) in zip(X0,X1)]
assert min(dY)==0 and bytes(any(dY[i] for i in t) for t in F)==f['active-triangle-role.u8']
def orient(a,b,c): return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
def f32(x): return unpack('<f',pack('<f',x))[0]
def coord(x,z,dx,dz,Q):
    q=f32(x+dx)*Q,f32(z+dz)*Q
    assert all(v==int(v) for v in q)
    return tuple(map(int,q))
for kind,(dx,dz,Q) in [('local',(0,0,8192)),('world',(57883.79296875,41735.93359375,256))]:
    P=[coord(x,z,dx,dz,Q) for x,_,z in X0]
    assert len(set(P))==229
    assert all(orient(P[u],P[v],p)<=0 for u,v in cyc(list(range(4))) for p in P)
    cross=[orient(*(P[i] for i in t)) for t in F]
    assert max(cross)<0 and sum(cross)==orient(P[0],P[1],P[3])+orient(P[1],P[2],P[3])
    normal=triples('fff',N); uv=triples('ff',U)
    A,B,C,D=P[:4]; t=Fraction(orient(A,C,D),orient(A,B,D)); s=Fraction(orient(A,B,C),orient(A,B,D))
    for aa,bb,cc,dd in zip(*[(X0[i][1],*normal[i],*uv[i]) for i in range(4)]):
        aa,bb,cc,dd=map(Fraction,(aa,bb,cc,dd)); assert aa+t*(bb-aa)+s*(dd-aa)==cc
    k=0; edges=list(E)
    for i,(u,v) in enumerate(edges):
        A,B=P[u],P[v]
        for w,x in edges[i+1:]:
            C,D=P[w],P[x]
            if any(max(min(A[j],B[j]),min(C[j],D[j]))>min(max(A[j],B[j]),max(C[j],D[j])) for j in (0,1)): continue
            k+=1; common={u,v}&{w,x}
            if common:
                p=P[next(iter(common))]; l=P[next(iter({u,v}-common))]; m=P[next(iter({w,x}-common))]
                assert orient(p,l,m)!=0 or sum((l[j]-p[j])*(m[j]-p[j]) for j in (0,1))<0
            else:
                assert orient(A,B,C)*orient(A,B,D)>0 or orient(C,D,A)*orient(C,D,B)>0
    assert k==6152
    print(kind, f'452 faces, {k} narrow edge pairs, area {-sum(cross)/(2*Q*Q):.12f} m²')
print('Detached CPU topology only; no scene, optics, contact or mounting.')
