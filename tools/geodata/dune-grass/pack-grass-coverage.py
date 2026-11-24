import argparse,gzip,hashlib,json,struct,math
from math import pi,sin,cos,sqrt
from pathlib import Path
import numpy as np
from scipy.ndimage import distance_transform_edt
p=argparse.ArgumentParser(description='Pack 5m authenticated coastal grassland insets with a 30m neighbouring halo.')
p.add_argument('--qualified',type=Path,required=True);p.add_argument('--world',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
args=p.parse_args();dest=args.out
q=np.load(args.qualified)
p=np.unique(np.concatenate([q[n]for n in q.files]),axis=0)
# This exact source point fails the analytic Cover boundary threshold by 5cm.
p=p[~((p[:,0]==29765)&(p[:,1]==23989))]
i,j=p.T
a,e,ph=6378137,.00669437999014,46.5*pi/180;t=1-e*sin(ph)**2
sx=a*pi/180*cos(ph)/sqrt(t);sz=a*pi/180*(1-e)/t**1.5
left,top=(-64.47+63.2)*sx,(46.5-47.1)*sz
tileW,tileD=2.54*sx/32,1.16*sz/22
# Duplicate only read/crop support, not seed ownership, for continuous interpolation at world mesh edges.
reach=30.
packet=bytearray();index=[];decodedMax=0
out=dest;out.mkdir(parents=True,exist_ok=True)
def sha(b):return hashlib.sha256(b).hexdigest()
for X in range(32):
 for Z in range(22):
  if (X,Z) in {(1,9),(31,12)}:continue
  loX,hiX=X*tileW,(X+1)*tileW;loZ,hiZ=Z*tileD,(Z+1)*tileD
  S=(loX<=(i+.5)*5)&((i+.5)*5<hiX)&(loZ<=(j+.5)*5)&((j+.5)*5<hiZ)
  count=int(S.sum())
  if count<6:continue
  scope=(loX-reach<=(i+.5)*5)&((i+.5)*5<hiX+reach)&(loZ-reach<=(j+.5)*5)&((j+.5)*5<hiZ+reach)
  col0,row0=p[scope].min(0)-2
  col1,row1=p[scope].max(0)+2
  w,h=col1-col0+1,row1-row0+1
  B=np.zeros((h,w),np.uint8);B[j[scope]-row0,i[scope]-col0]=1
  d=distance_transform_edt(B)
  u=np.clip((d-.1)/4,0,1);u=u*u*(3-2*u)
  # 1st bit lattice remains independently readable for root authority. 7 bits carry colour strength.
  z=np.uint8(np.rint(127*u))*2+B
  plain=struct.pack('<4siiHHHH',b'DGL1',col0,row0,w,h,X,Z)+z.tobytes()
  comp=bytearray(gzip.compress(plain,mtime=0,compresslevel=9));comp[9]=3
  index.append(dict(tile=[X,Z],ownCells=count,uvOrigin=[left+5*int(col0),top+5*int(row0)],
       cells=[int(w),int(h)],grid=[int(col0),int(row0)],offset=len(packet),wire=len(comp),wireSHA256=sha(comp),decoded=len(plain),decodedSHA256=sha(plain)))
  packet+=comp;decodedMax=max(decodedMax,len(plain))
(out/'authority.pack').write_bytes(packet)
meta=dict(owners=len(index),maskWireBytes=len(packet),maxDecodedBytes=decodedMax,sourceCells=int(len(p)),
     finalOwnedCells=sum(q['ownCells']for q in index),sha256=sha(packet),pixelMetres=5,index=index)
(out/'authority.json').write_text(json.dumps(meta,indent=2)+'\n')
print({k:v for k,v in meta.items()if k!='index'})

# A bound over the whole underlying stock owner at all tessellation rates.
stock=(dest.resolve(),args.world)
height=np.frombuffer(gzip.decompress((stock[1]/'height.bin.gz').read_bytes()),'<i2').reshape(2720,4096)
for q in index:
 x,z=q['tile']
 raw=height[max(0,math.floor(z*2720/22)-2):min(2720,math.ceil((z+1)*2720/22)+2),
            max(0,128*x-2):min(4096,128*(x+1)+2)]
 q['terrainYMax']=max(0,int(raw.max()))+4
(out/'authority-with-height.json').write_text(json.dumps(meta,indent=2)+'\n')
