"""Signed road/roof distance context; does not establish crop or fence truth."""
import argparse,gzip,hashlib,json,math,struct
from pathlib import Path

args=argparse.ArgumentParser(description=__doc__)
args.add_argument('--checkout',type=Path,default=Path.cwd())
args.add_argument('--source',required=True,type=Path,help='A verified signed-source receipt from verify-eastern-aerial-sources.py')
a=args.parse_args()
root=a.checkout/'public/world'
receipt=json.loads(a.source.read_text())
def pin(raw,expected):
 assert hashlib.sha256(raw).hexdigest()==expected
 return raw
def pj(lon,lat):
 a=6378137.;e2=6.69437999014e-3;g=math.radians(46.5);t=1-e2*math.sin(g)**2
 return ((lon+63.2)*a*math.pi/180*math.cos(g)/t**.5,(46.5-lat)*a*(1-e2)*math.pi/180/t**1.5)
def rect(q):
 x,z=map(int,q['owners'][0].split('-'));a,b,_,d=q['window']
 if q['axis']=='x':
  u=(x+1-1.25/640,x+1+1.25/640);v=(z+a/640,z+d/640)
 else:
  u=(x+a/640,x+d/640);v=(z+1-1.25/640,z+1+1.25/640)
 coords=[-64.47+2.54*u[0]/32,47.1-1.16*v[1]/22,-64.47+2.54*u[1]/32,47.1-1.16*v[0]/22]
 return coords,(*pj(coords[0],coords[3]),*pj(coords[2],coords[1]))
cases=[(q['name'],*rect(q)) for q in receipt['windows']]
nearest=[[400.,400.] for _ in cases]
def sq(p,a,b):
 ux,uz=b[0]-a[0],b[1]-a[1]; n=ux*ux+uz*uz
 t=min(1.,max(0.,((p[0]-a[0])*ux+(p[1]-a[1])*uz)/n)) if n else 0.
 return (p[0]-a[0]-t*ux)**2+(p[1]-a[1]-t*uz)**2
def segment_dist2(a,b,R):
 x0,z0,x1,z1=R
 lo,hi=0.,1.
 for start,end,left,right in ((a[0],b[0],x0,x1),(a[1],b[1],z0,z1)):
  d=end-start
  if not d:
   if not left<=start<=right: lo,hi=1.,0.
   continue
  first,last=sorted(((left-start)/d,(right-start)/d))
  lo=max(lo,first);hi=min(hi,last)
 if lo<=hi:return 0.
 point_rect=lambda p:max(x0-p[0],p[0]-x1,0.)**2+max(z0-p[1],p[1]-z1,0.)**2
 return min(point_rect(a),point_rect(b),*(sq(p,a,b) for p in ((x0,z0),(x0,z1),(x1,z0),(x1,z1))))
def inside(p,ring):
 x,z=p; state=False
 for a,b in zip(ring,ring[1:]+ring[:1]):
  if (a[1]>z)!=(b[1]>z) and x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]:
   state=not state
 return state
def check(idx,outer,holes=()):
 X,Z=zip(*outer)
 bounds=(min(X),min(Z),max(X),max(Z))
 for i,(_,_,clip) in enumerate(cases):
  x0,z0,x1,z1=clip;r=nearest[i][idx]
  if bounds[2]<x0-r or bounds[0]>x1+r or bounds[3]<z0-r or bounds[1]>z1+r:
   continue
  if idx==1 and inside((x0,z0),outer) and not any(inside((x0,z0),h) for h in holes):
   nearest[i][idx]=0.;continue
  rings=(outer,*holes)
  edges=[e for ring in rings for e in zip(ring,ring[1:]+(ring[:1] if idx else []))]
  nearest[i][idx]=min(r,min(segment_dist2(a,b,clip) for a,b in edges)**.5)
nrn=json.loads((root/'roads.json').read_text())
roads=pin(gzip.decompress((root/'roads.bin.gz').read_bytes()),'72528a1b26b68ee345e5047f30f2c9b49a3c18edeaccaf3e759ead296d3276c1')
assert nrn['sha256']==hashlib.sha256(roads).hexdigest()
magic,version,count=struct.unpack_from('>4sHI',roads); assert magic==b'PEIR' and version==1 and count==19465
off=10
for _ in range(count):
 n,flags=struct.unpack_from('>HB',roads,off);off+=3
 pts=[pj(lon/100000-65,lat/100000+45) for lon,lat in struct.iter_unpack('>II',roads[off:off+n*8])];off+=n*8
 check(0,pts)
assert off==len(roads)
bi=json.loads((root/'buildings/index.json').read_text())
building=pin((root/'buildings/tiles.pack').read_bytes(),'538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557')
assert len(building)==bi['bytes'] and hashlib.sha256(building).hexdigest()==bi['sha256']
count=0
for tile in bi['tiles']:
 raw=pin(building[tile['offset']:tile['offset']+tile['bytes']],tile['sha256'])
 fs=json.loads(gzip.decompress(raw))['features'];assert len(fs)==tile['count'];count+=len(fs)
 for q in fs:
  check(1,[pj(*x) for x in q['footprint']],[[pj(*p) for p in h] for h in (q.get('holes') or [])])
assert count==bi['count']==85866
assert all(a>6.4 and b>0 for a,b in nearest)
print(json.dumps(dict(maxReportDistanceM=400,scope='Signed road centreline and dated footprint distance; not verified boundary, hedge or crop conditions.',
NRN=nrn['sha256'],AEB=bi['sha256'],cases=[dict(name=n,exactStripLonLat=c,roadClippedDistance=round(r,3),buildingClippedDistance=round(b,3)) for (n,c,_),(r,b) in zip(cases,nearest)]),indent=2))
