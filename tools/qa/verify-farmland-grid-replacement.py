import argparse
import gzip
import hashlib
import json
import math
import struct
from pathlib import Path
import numpy as np

parser = argparse.ArgumentParser(description='Compare authenticated legacy and corrected farmland grid centers without writing assets.')
parser.add_argument('--old', type=Path, required=True, help='Original fields-province archive directory')
parser.add_argument('--corrected-mask', type=Path, required=True, help='Corrected qualification NPZ on the four-metre lattice')
args = parser.parse_args()
old, new = args.old, args.corrected_mask
before=gzip.decompress((old/'index.fcr.gz').read_bytes())
assert hashlib.sha256(before).hexdigest()=='061f4917037dc66a73cf3ab078e93e99d7bebf90a93a151fbc13b88107bb6563'
assert before[:4]==b'FCR1'
_, npack,ncell=struct.unpack_from('<HHH',before,4)
packlist=[(old/f'crop-{i:02d}.pack').read_bytes() for i in range(npack)]
for i,wire in enumerate(packlist):
    at=12+36*i
    assert struct.unpack_from('<I',before,at)[0]==len(wire)
    assert before[at+4:at+36]==hashlib.sha256(wire).digest()
current=np.load(new,allow_pickle=False)
old_seen=set()
count=dict(both=0,oldOnly=0,newOnly=0,oldHalf=0,newHalf=0,sharedHalf=0)
keys=set(current.files)
def m(q):
    return (((current[q]>>8)&255).astype('u1')) if q in keys else np.zeros((256,256),dtype='u1')

for i in range(ncell):
    at=12+36*npack+80*i
    x,z,p,_,s,n=struct.unpack_from('<hhHHII',before,at)
    key=f'{x},{z}'
    old_seen.add(key)
    wire=packlist[p][s:s+n]
    assert hashlib.sha256(wire).digest()==before[at+16:at+48]
    raw=gzip.decompress(wire)
    assert hashlib.sha256(raw).digest()==before[at+48:at+80]
    a=np.frombuffer(raw,dtype=np.uint8).reshape(260,260,2)[2:-2,2:-2,1]
    b=m(key)
    count['both']+=int(np.count_nonzero((a>0)&(b>0)))
    count['oldOnly']+=int(np.count_nonzero((a>0)&(b==0)))
    count['newOnly']+=int(np.count_nonzero((a==0)&(b>0)))
    count['sharedHalf']+=int(np.count_nonzero((a>=128)&(b>=128)))
    count['oldHalf']+=int(np.count_nonzero(a>=128))
    count['newHalf']+=int(np.count_nonzero(b>=128))
for q in keys-old_seen:
    b=m(q)
    count['newOnly']+=int(np.count_nonzero(b))
    count['newHalf']+=int(np.count_nonzero(b>=128))

positions={'roadShoulder':(-46442.54430323091,7081.2188283115565),'forest':(-92202,-23222),
           'built':(-90346,-19886)}
witness={}
def get(col,row):
    data=m(f'{col//256},{row//256}')
    return int(data[row%256,col%256])
for name,(x,z) in positions.items():
    i=math.floor(x/4-.5);j=math.floor(z/4-.5)
    corners=[get(i+a,j+b) for a in (0,1) for b in (0,1)]
    witness[name]={'xz':[x,z],'fourCorrectedContributors':corners}
    assert corners==[0,0,0,0],(name,corners)
data={'scope':'Exact before/after-positive lattice, 4m grid, not visible acreage or unique source polygons. Survey date and geographic eligibility are separate.',
      'populations':count,'representedKm2':{k:v*.000016 for k,v in count.items()},'threeHeldoutOldDefectLocations':witness}
print(json.dumps(data,indent=2))
