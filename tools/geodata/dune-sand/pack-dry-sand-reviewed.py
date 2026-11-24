#!/usr/bin/env python3
"""Bounded detached terrain-material mask pack. Raster samples at 5 m centers."""
import argparse,gzip,hashlib,json,struct
from collections import defaultdict
from math import cos,sin,pi,sqrt
from pathlib import Path
import numpy as np
from scipy.ndimage import distance_transform_edt
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--qualified',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
a=p.parse_args();g=np.load(a.qualified);o=a.out;o.mkdir(parents=True,exist_ok=True)
phi=46.5*pi/180;e=.00669437999014;a=6378137;t=1-e*sin(phi)**2
mlon=a*pi/180*cos(phi)/sqrt(t);mlat=a*(1-e)*pi/180/t**1.5
left=(-64.47+63.2)*mlon;top=(46.5-47.1)*mlat
w=2.54*mlon/32;d=1.16*mlat/22;STEP=5
existingCoastalSurvey={(1,9),(31,12)}
samples=np.unique(np.concatenate([g[k]for k in g.files]),axis=0)
t={};cuts=0
for i,j in samples:
 x=left+(int(i)+.5)*STEP;z=top+(int(j)+.5)*STEP
 tx,tz=int((x-left)//w),int((z-top)//d)
 if (tx,tz) in existingCoastalSurvey:
  cuts+=1;continue
 if min(x-left-tx*w,left+(tx+1)*w-x,z-top-tz*d,top+(tz+1)*d-z)<2*STEP:
  cuts+=1;continue
 t.setdefault((tx,tz),[]).append((int(i),int(j)))
result=[]
SHA=lambda a:hashlib.sha256(a).hexdigest()
for (tx,tz),seq in sorted(t.items()):
 if len(seq)<8:
  cuts+=len(seq);continue
 rc=np.array(seq);x0,z0=rc.min(0)-2;x1,z1=rc.max(0)+2
 nx=x1-x0+1;nz=z1-z0+1
 assert 3<=nx<=1230 and 3<=nz<=1170 and nx*nz<=1_450_000
 src=np.zeros((nz,nx),dtype=bool);src[rc[:,1]-z0,rc[:,0]-x0]=True
 n=distance_transform_edt(src)
 a=np.uint8(np.minimum(255,np.rint(255*np.clip((n-.40)/3.5,0,1))))
 head=struct.pack('<4siiHHHH',b'SND1',x0,z0,nx,nz,tx,tz)
 raw=head+a.tobytes();zip=bytearray(gzip.compress(raw,mtime=0,compresslevel=9));zip[9]=3
 path=f'{tx}-{tz}.g05.gz';(o/path).write_bytes(zip)
 result.append(dict(tile=[tx,tz],file=path,offset=[int(x0),int(z0)],size=[int(nx),int(nz)],number=int(np.count_nonzero(a)),wire=len(zip),wireSha=SHA(zip),decoded=len(raw),decodedSha=SHA(raw),outputOrigin=[left+x0*STEP,top+z0*STEP]))
meta=dict(samples=int(len(samples)),retained=int(len(samples)-cuts),cuts=int(cuts),excludedCoastalSurveyOwners=sorted(existingCoastalSurvey),gridOrigin=[left,top],pixelMetres=STEP,variants=result,worldTileSize=[w,d])
(o/'manifest.json').write_text(json.dumps(meta,indent=2)+'\n')
print('packed',len(result),'world tiles',meta['retained'],'nodes',sum(a['wire']for a in result),'wire bytes',max(a['decoded']for a in result),'largest decoded')
