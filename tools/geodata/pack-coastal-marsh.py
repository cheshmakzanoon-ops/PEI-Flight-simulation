#!/usr/bin/python3
"""Pack only exact already allowed footprints; no provider photos."""
import argparse,gzip,json,hashlib
from pathlib import Path
import numpy as np
from scipy import ndimage
ap=argparse.ArgumentParser(description=__doc__)
ap.add_argument('--qualified',type=Path,required=True)
ap.add_argument('--out',type=Path,required=True)
a=ap.parse_args()
p=a.qualified;out=a.out
out.mkdir(parents=True,exist_ok=True)
rec=json.loads((p/'dry-footprint-intake.json').read_text())
data=[]
for name in ('cascumpec','tracadie','morell'):
 r=np.load(p/f'{name}-exact.npz')
 m=r['mask']>0
 l,_=ndimage.label(m); b=np.bincount(l.ravel()); b[0]=0; m=l==int(b.argmax())
 x,z,step,ncol,nrow=r['grid']
 weights=ndimage.distance_transform_edt(m)*step
 # Draw a taper *inside* this vetted class, never using invalid cells.
 w=np.floor(np.clip((weights-1.25)/13.75,0,1)*255+.5).astype(np.uint8)
 assert np.all((w>0)<=m)
 j,i=np.where(w>0)
 x0=int(i.min()-2);x1=int(i.max()+3)
 z0=int(j.min()-2);z1=int(j.max()+3)
 assert x0>=0 and z0>=0 and x1<=ncol and z1<=nrow
 w=w[z0:z1,x0:x1]
 assert not w[0].any() and not w[-1].any() and not w[:,0].any() and not w[:,-1].any()
 b=w.tobytes()
 # Python 3.11–3.12 can copy zlib's host OS ID into gzip byte 9 when
 # mtime=0. Use the portable 'unknown' value (RFC 1952, OS=255) emitted
 # by Python 3.13+, so the exact pinned wire image also rebuilds there.
 wire=bytearray(gzip.compress(b,compresslevel=9,mtime=0))
 wire[9]=255
 wz=bytes(wire)
 (out/(name+'.red.gz')).write_bytes(wz)
 digest=lambda b:hashlib.sha256(b).hexdigest()
 data.append(dict(id=name,origin=[float(x+x0*step),float(z+z0*step)],step=step,
  width=x1-x0,height=z1-z0,cells=len(j),decoded=len(b),decodedSha=digest(b),compressed=len(wz),sha256=digest(wz)))
print([(q['id'],q['width'],q['height'],q['cells'],q['compressed']) for q in data])
(out/'mask-candidate.json').write_text(json.dumps(data,indent=2)+'\n')
