"""Pack the signed, independently guarded province map into contiguous immutable blocks."""
from pathlib import Path
import argparse,hashlib,gzip,struct,json
from collections import defaultdict
from itertools import product
import numpy as np
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('input',type=Path,help='Independent strict RG8 core mask (one 256² shard per key)')
p.add_argument('out',type=Path)
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
source=np.load(a.input,allow_pickle=False)
m={tuple(map(int,key.split(','))):np.ascontiguousarray(source[key],dtype='<u2') for key in source.files}
assert m and all(v.shape==(256,256) for v in m.values())
N=256;H=2;START=120_000
hash=lambda b:hashlib.sha256(b).digest()
raw_cells=sum(np.count_nonzero(v) for v in m.values())
def fetch(x,z):
 x0=x*N-H;z0=z*N-H;x1=x0+N+2*H;z1=z0+N+2*H
 a=np.zeros((N+H*2,N+H*2),dtype='<u2')
 for dx,dz in product(range(-1,2),repeat=2):
  X=x+dx;Z=z+dz;b=m.get((X,Z))
  if b is None:continue
  l=max(x0,X*N);r=min(x1,(X+1)*N);n=max(z0,Z*N);s=min(z1,(Z+1)*N)
  a[n-z0:s-z0,l-x0:r-x0]=b[n-Z*N:s-Z*N,l-X*N:r-X*N]
 return a
offered={(x+dx,z+dz) for x,z in m for dx,dz in product(range(-1,2),repeat=2)}
def portable_gzip(data):
 # RFC1952: an explicit 'unknown' OS makes Python 3.11/3.12 match 3.13.
 wire=bytearray(gzip.compress(data,compresslevel=9,mtime=0));wire[9]=255;return bytes(wire)
zones=defaultdict(list);aprons={};seen=0
for x,z in sorted(offered):
 arr=fetch(x,z)
 if not arr.any():continue
 seen+=np.count_nonzero(arr[H:-H,H:-H])
 b=arr.tobytes();zip=portable_gzip(b)
 zones[x//16,z//16].append((x,z,zip,hash(b)))
 aprons[x,z]=(arr[:,:H*2].copy(),arr[:,-H*2:].copy(),arr[:H*2,:].copy(),arr[-H*2:,:].copy())
assert seen==raw_cells
halos={'x':0,'z':0,'diagonal':0}
for (x,z),here in aprons.items():
 right=aprons.get((x+1,z));down=aprons.get((x,z+1));corners=range(-1,2,2)
 if right is not None:assert np.array_equal(here[1],right[0]);halos['x']+=1
 if down is not None:assert np.array_equal(here[3],down[2]);halos['z']+=1
 for move in corners:
  next=aprons.get((x+move,z+1))
  if next is None:continue
  x0=slice(-H*2,None) if move>0 else slice(0,H*2)
  x1=slice(0,H*2) if move>0 else slice(-H*2,None)
  assert np.array_equal(here[3][:,x0],next[2][:,x1]);halos['diagonal']+=1
packs=[];records={};num=0
for k,vals in sorted(zones.items()):
 b=bytearray()
 def save():
  global num
  if not b:return
  f=f'crop-{num:02d}.pack'
  (a.out/f).write_bytes(b)
  packs.append({'file':f,'bytes':len(b),'sha256':hash(b).hex(),'block':list(k)})
  num+=1;b.clear()
 for x,z,enc,raw in sorted(vals):
  if len(b)+len(enc)>START:save()
  offset=len(b);b.extend(enc)
  records[x,z]=struct.pack('<hhHHII32s32s',x,z,num,0,offset,len(enc),hash(enc),raw)
 save()
assert len(packs)<=90
directory=bytearray(struct.pack('<4sHHHH',b'FCR1',1,len(packs),len(records),0))
for d in packs:directory+=struct.pack('<I32s',d['bytes'],bytes.fromhex(d['sha256']))
for _,rec in sorted(records.items()):directory+=rec
archive=portable_gzip(directory)
(a.out/'index.fcr.gz').write_bytes(archive)
metadata={'packedSize':len(archive),'rawSize':len(directory),'packedHash':hash(archive).hex(),'rawHash':hash(directory).hex(),
          'sourceMaskSha':hash(a.input.read_bytes()).hex(),'samples':int(raw_cells),'areaM2':int(raw_cells)*16,
          'options':{'spanM':N*4,'cellM':4,'halo':H,'fixedGpuLayers':4},'haloEquality':halos,'packCount':len(packs),'packBytes':sum(p['bytes'] for p in packs),'packs':packs}
(a.out/'source.json').write_text(json.dumps(metadata,indent=2)+'\n')
print({k:v for k,v in metadata.items()if k!='packs'})
