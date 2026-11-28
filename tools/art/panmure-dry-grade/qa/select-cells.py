"""Select a connected rectilinear native cell subset of one old Game face."""
from collections import defaultdict
import hashlib,json,sys
from pathlib import Path
d=Path(sys.argv[1]);s=d/'stock-screen.json'
rows=json.loads(s.read_bytes())['matches']
m={tuple(x['native']):x for x in rows}
steps=((1,0),(-1,0),(0,1),(0,-1))
by=defaultdict(set)
for x,y in m:
    corners=[m.get((x+dx,y+dy)) for dx,dy in ((0,0),(1,0),(1,1),(0,1))]
    if all(q is not None for q in corners) and len({q['face'] for q in corners})==1:
        by[corners[0]['face']].add((x,y))
def components(remaining):
    rest=set(remaining)
    while rest:
        current={min(rest)};rest-=current
        stack=list(current)
        while stack:
            x,y=stack.pop()
            for dx,dy in steps:
                p=x+dx,y+dy
                if p in rest:
                    rest.remove(p);current.add(p);stack.append(p)
        yield current
age=sorted(((len(c),k,c) for k,r in by.items() for c in components(r)),
           key=lambda r:(-r[0],r[1],min(r[2])))
n,face,cell=age[0]
assert n>=100
boundary=set()
for x,y in cell:
    corners=[(x,y),(x+1,y),(x+1,y+1),(x,y+1)]
    for p,q in zip(corners,corners[1:]+corners[:1]):
        if (q,p) in boundary:boundary.remove((q,p))
        else:boundary.add((p,q))
out={p:q for p,q in boundary}
assert len(out)==len(boundary) and len(set(out.values()))==len(boundary)
start=min(out);path=[start];q=out[start]
while q!=start:
    assert q not in path
    path.append(q);q=out[q]
assert len(path)==len(boundary)
nodes=sorted({(x+dx,y+dy) for x,y in cell for dx,dy in ((0,0),(1,0),(1,1),(0,1))})
assert all(m[q]['face']==face and m[q]['delta']>=.45 for q in nodes)
spec={'screen':hashlib.sha256(s.read_bytes()).hexdigest(),'oldStockFace':face,
      'nativeCells':sorted(cell),'nodes':nodes,'boundary':path,
      'nativePositive':[min(m[q]['delta'] for q in nodes),max(m[q]['delta'] for q in nodes)],
      'worldBounds':[min(m[q]['scene'][0] for q in nodes),min(m[q]['scene'][1] for q in nodes),
                     max(m[q]['scene'][0] for q in nodes),max(m[q]['scene'][1] for q in nodes)]}
with (d/'cell-selection.json').open('x') as w:json.dump(spec,w,indent=2);w.write('\n')
print(face,n,len(nodes),len(path),spec['nativePositive'],spec['worldBounds'])
