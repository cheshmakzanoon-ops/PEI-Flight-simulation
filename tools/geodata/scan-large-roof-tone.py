"""Detached audit of usable *large-roof* 2025 color support. Never edits atlas."""
import argparse,gzip,hashlib,io,json,math
from functools import lru_cache
from pathlib import Path
from collections import Counter
import numpy as np
from PIL import Image
cli=argparse.ArgumentParser(description=__doc__)
cli.add_argument('--root',type=Path,required=True)
cli.add_argument('--out',type=Path,required=True)
arg=cli.parse_args()
R=arg.root/'public/world';W=arg.out;W.mkdir(parents=True,exist_ok=True)
m=6378137*math.pi/180.;v=1-.00669437999014*math.sin(math.radians(46.5))**2
P=np.array([m*math.cos(math.radians(46.5))/math.sqrt(v),-m*(1-.00669437999014)/v**1.5]);O=np.array([-63.2,46.5])
sha=lambda data:hashlib.sha256(data).hexdigest()
index=json.loads((R/'buildings/index.json').read_text());src=(R/'buildings/tiles.pack').read_bytes();assert sha(src)==index['sha256']
D=R/'detail';raw=(D/'index.json').read_bytes();tiles=json.loads(raw);n=tiles['tilePixels'];cols=tiles['columns'];rows=tiles['rows']
west,south,east,north=tiles['bounds'];dx=(east-west)/(cols*n);dy=(north-south)/(rows*n)
packs=[]
for p in tiles['packs']:
 content=(D/p['file']).read_bytes();assert sha(content)==p['sha256'];packs.append(content)
@lru_cache(maxsize=12)
def image(a,b):
 q=tiles['tiles'].get(f'{a}-{b}')
 if not q:return None
 z=packs[q['pack']][q['offset']:q['offset']+q['bytes']];assert sha(z)==q['sha256']
 return np.asarray(Image.open(io.BytesIO(z)).convert('RGB'))
counts=Counter(); records=[]
def count(q):counts[q]+=1
for T in index['tiles']:
 v=src[T['offset']:T['offset']+T['bytes']];assert sha(v)==T['sha256']
 bits=json.loads(gzip.decompress(v))
 for slot,building in enumerate(bits['features']):
  q=building['footprint'];
  if len(q)<4 or building.get('holes') or building['height']<2.8:continue
  lonlat=np.asarray(q);ring=(lonlat-O)*P
  if min(np.ptp(ring,axis=0))<=31:continue
  x=ring[:,0];y=ring[:,1]
  area=abs(x@np.roll(y,-1)-y@np.roll(x,-1))*.5
  if area<1300:continue
  count('largeOriginalPlan')
  lo,hi=np.min(lonlat,axis=0),np.max(lonlat,axis=0)
  a,b=int(max(0,(lo[0]-west)/dx)),int(min(cols*n-1,(hi[0]-west)/dx))+1
  c,d=int(max(0,(north-hi[1])/dy)),int(min(rows*n-1,(north-lo[1])/dy))+1
  if b-a>140 or d-c>140:count('largeUnbounded');continue
  uv=np.stack(np.meshgrid(np.arange(a,b),np.arange(c,d)),axis=-1).reshape(-1,2)
  probes=(np.stack([west+(uv[:,0]+.5)*dx,north-(uv[:,1]+.5)*dy],axis=1)-O)*P
  ins=np.zeros(len(probes),dtype=bool);edge=np.full(len(probes),np.inf)
  px,py=probes.T
  for h,i in zip(ring,np.roll(ring,-1,axis=0)):
   dr=i-h;length=dr@dr
   if length<1e-12:continue
   slope=np.clip((probes-h)@dr/length,0,1)
   edge=np.minimum(edge,np.linalg.norm(probes-h-slope[:,None]*dr,axis=1))
   if dr[1]!=0: ins^=((h[1]>py)!=(i[1]>py))&(px<h[0]+(py-h[1])*dr[0]/dr[1])
  samples=[]
  for k in np.flatnonzero(ins&(edge>=16)):
   A,B=uv[k];I=image(int(A//n),int(B//n))
   if I is not None:
    val=I[B%n,A%n]
    # Extreme black/white could be hard roof glare, a bad pixel, or shadow.
    if 38<int(min(val))<=int(max(val))<246:samples.append([int(A),int(B),round(float(edge[k]),4),[int(r)for r in val]])
  if len(samples)<4:count('tooFewDeepPixels');continue
  S=np.array([s[3]for s in samples]);center=np.median(S,axis=0)
  # No aggressive colour for dominant green in a roof plan. At this scale it
  # may be canopy contamination or a roof condition unsupported by geometry.
  if center[1]>max(center[0],center[2])*1.12:count('greenUnresolved');continue
  eps=np.abs(S-center).max(1)
  if float(np.quantile(eps,.85))>29:count('unstableColor');continue
  records.append(dict(owner=T['id'],row=slot,areaM2=round(area,3),centerLonLat=lonlat.mean(0).tolist(),byteRgb=center.tolist(),
   err85=float(np.quantile(eps,.85)),sampleCount=len(samples),depthMinimumM=min(s[2]for s in samples),pixels=samples))
print(len(records),counts)
for r in sorted(records,key=lambda x: x['sampleCount'],reverse=True)[:16]:print({k:v for k,v in r.items()if k!='pixels'})
receipt={'dependency':'Original roof silhouettes only; broad spectral support, not material type, age, roof safety or current sharp image.',
 'atlasSha':index['sha256'],'imageryIndexSha':sha(raw),'siteCount':len(records),'filterCounts':dict(counts),'records':records}
(W/'2025-large-roof-tone-receipt.json').write_text(json.dumps(receipt,separators=(',',':'))+'\n')
