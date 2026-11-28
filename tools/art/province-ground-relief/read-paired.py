"""Read exact bounded CanElevation Float32 windows. No outside track or imagery."""
from pathlib import Path
from hashlib import sha256
import argparse, json, struct, time
from pyproj import Transformer
import numpy as np
import requests
from osgeo import gdal
HERE=Path(__file__).resolve().parent
ORIGIN='https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-lidar/PEI-Prince_Edward_Island_2020-1m'
SRC={
 'dtm':(34973844421,'"9e5249deef1137ddcce504d6f4bca1a9-131"','cc460f169f0da291f44141df45e2ddda8098bdfa66db86f95895ef992f28fdd5'),
 'dsm':(35659211028,'"42e6d17ec9152bd7a5347d13d196dccd-133"','693f18d1350b63dce2f60f693d492f29efc7b40afe7005a9a411418751b01d51')}
BASE={256:(4,1,197442),257:(4,1,108635),258:(3,1,32),259:(3,1,5),262:(3,1,1),
      277:(3,1,1),284:(3,1,1),317:(3,1,1),322:(3,1,512),323:(3,1,512),339:(3,1,3)}
GRID=(2261621,1,0,371370,0,-1)
BLOCK=512
BUDGET=18*1024*1024
NODATA=-32767
W=197442;H=108635
def sha(d):return sha256(d).hexdigest()

class Read:
 def __init__(self,kind,budget,total_requests,deadline,headers,ledger):
  self.ledger=ledger
  self.kind=kind;self.total,self.etag,pin=SRC[kind];self.url=ORIGIN+'-'+kind+'.tif'
  self.budget=budget;self.request_count=total_requests;self.deadline=deadline;self.session=requests.Session();self.blocks={}
  b=(headers/(kind+'.bin')).read_bytes()
  tags=(headers/(kind+'.hdr')).read_text().lower()
  assert ('http/2 206' in tags or 'http/1.1 206' in tags) and f'content-range: bytes 0-8191/{self.total}' in tags
  assert 'etag: '+self.etag in tags and len(b)==8192 and sha(b)==pin
  self.ranges=[{'phase':'initial bounded primary IFD','start':0,'stop':8191,'sha256':pin}]
  assert b[:8]==b'II+\x00\x08\x00\x00\x00'
  off,=struct.unpack_from('<Q',b,8);n,=struct.unpack_from('<Q',b,off);assert off==200 and n==19
  p={t:(f,i,v) for t,f,i,v in [struct.unpack_from('<HHQQ',b,off+8+20*j) for j in range(n)]}
  assert all(p[k]==v for k,v in BASE.items())
  assert p[324]==(16,82218,3328) and p[325]==(4,82218,661072)
  assert struct.unpack_from('<3d',b,p[33550][2])==(1.,1.,0.)
  assert struct.unpack_from('<6d',b,p[33922][2])==(0.,0.,0.,GRID[0],GRID[3],0.)
  assert struct.unpack_from('<32H',b,p[34735][2])[-8:]==(3072,0,1,3979,3076,0,1,9001)
  assert p[42113][2].to_bytes(8,'little')==b'-32767\x00\x00'
  self.table=(p[324][2],p[325][2])

 def range(self,at,n,phase):
  assert 0<n<=self.budget[0] and 0<=at<self.total and at+n<=self.total
  assert self.request_count[0]<74 and time.monotonic()<=self.deadline
  self.request_count[0]+=1
  self.budget[0]-=n
  end=at+n-1
  with self.session.get(self.url,stream=True,allow_redirects=False,timeout=(8,20),headers={
         'Accept-Encoding':'identity','If-Match':self.etag,'Range':f'bytes={at}-{end}'}) as rs:
   expected=f'bytes {at}-{end}/{self.total}'
   assert rs.status_code==206 and rs.headers.get('ETag')==self.etag
   assert rs.headers.get('Content-Range')==expected and rs.headers.get('Content-Length')==str(n)
   assert rs.headers.get('Content-Encoding','identity')=='identity'
   body=rs.raw.read(n+1)
   assert len(body)==n
  self.ranges.append({'phase':phase,'start':at,'stop':end,'sha256':sha(body)})
  (self.ledger/(self.kind+'-incremental-ranges.json')).write_text(json.dumps(self.ranges,indent=2)+'\n')
  return body

 def tile(self,t):
  if t in self.blocks:return self.blocks[t]
  x,=struct.unpack('<Q',self.range(self.table[0]+8*t,8,'tile-offset:'+str(t)))
  n,=struct.unpack('<I',self.range(self.table[1]+4*t,4,'tile-size:'+str(t)))
  assert 0<n<3*1024*1024 and 0<x<self.total
  b=self.range(x,n,'native-LZW:'+str(t))
  self.blocks[t]=b
  return b

def open_mosaic(blocks,nx,ny):
 minimal={**BASE,256:(4,1,nx*BLOCK),257:(4,1,ny*BLOCK),322:(4,1,BLOCK),323:(4,1,BLOCK)}
 N=len(blocks)
 assert N==nx*ny and 1<=N<=4
 header=8+2+12*(len(minimal)+2)+4
 start=header+8*N if N>1 else header
 lens=list(map(len,blocks));offsets=np.cumsum([start]+lens[:-1]).tolist()
 minimal[324]=(4,N,header if N>1 else offsets[0]);minimal[325]=(4,N,header+4*N if N>1 else lens[0])
 head=b'II*\x00\x08\x00\x00\x00'+struct.pack('<H',len(minimal))
 head+=b''.join(struct.pack('<HHII',k,*d) for k,d in sorted(minimal.items()))+b'\x00'*4
 assert len(head)==header
 tables=struct.pack('<'+'I'*(N*2),*offsets,*lens) if N>1 else b''
 return head+tables+b''.join(blocks)

def decode(reader,xy):
 x,y,m,n=map(int,xy)
 assert 0<=x<W and 0<=y<H and 32<=m<=320 and 32<=n<=320 and x+m<=W and y+n<=H
 A=x//BLOCK;B=y//BLOCK;nx=(x+m-1)//BLOCK-A+1;ny=(y+n-1)//BLOCK-B+1
 stride=(W+BLOCK-1)//BLOCK
 ids=[(B+j)*stride+A+i for j in range(ny) for i in range(nx)]
 mem='/vsimem/ground-numerical-chip.tif'
 gdal.FileFromMemBuffer(mem,open_mosaic([reader.tile(i) for i in ids],nx,ny))
 try:
  d=gdal.Open(mem,gdal.GA_ReadOnly); assert d.RasterCount==1
  band=d.GetRasterBand(1);assert band.DataType==gdal.GDT_Float32
  raw=band.ReadAsArray(x-A*BLOCK,y-B*BLOCK,m,n).astype('<f4',copy=False)
  assert raw.shape==(n,m)
  d=None
 finally:gdal.Unlink(mem)
 return raw,ids

def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('--headers',type=Path,required=True);p.add_argument('--plans-sha256',required=True);p.add_argument('--plans',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
 a=p.parse_args()
 pl=a.plans.read_bytes();assert sha(pl)==a.plans_sha256
 plan=json.loads(pl)
 roles={'prince':('7-8','-53:-17'),'queens':('15-17','-1:36'),'kings':('23-16','43:31')}
 geog=Transformer.from_crs(3979,4326,always_xy=True)
 for v in plan['windows']:
  assert roles[v['id']]==(v['terrainTile'],v['grassShard'])
  assert len(v['xywh'])==4 and all(type(x)is int for x in v['xywh'])
  x,y,w,h=v['xywh']; assert 32<=w<=320 and 32<=h<=320 and 0<=x<x+w<=W and 0<=y<y+h<=H
  northwest=[GRID[0]+x,GRID[3]-y];S=northwest[1]-h;E=northwest[0]+w
  X,Z=geog.transform([northwest[0],E,E,northwest[0]],[northwest[1],northwest[1],S,S])
  xs=[(lon+63.2)*76762.59317717304 for lon in X];zs=[(46.5-lat)*111161.08375388647 for lat in Z]
  expected=[min(xs),min(zs),max(xs),max(zs)]
  assert len(v['worldXZBounds'])==4 and all(abs(a-b)<.01 for a,b in zip(v['worldXZBounds'],expected)), (v['id'],expected)
  SX,SZ=map(int,v['grassShard'].split(':'))
  # Whole-window containment may fail with the explicit support halo;
  # signed guard only considers the original interior of the selected shard.
  if not (SX*1024<=expected[0] and expected[2]<(SX+1)*1024 and SZ*1024<=expected[1] and expected[3]<(SZ+1)*1024):
   assert v.get('onlyAdmitPrimaryShardInterior') is True
 assert len(plan['windows'])==3 and len({x['id'] for x in plan['windows']})==3
 assert all(x['id'] in {'prince','queens','kings'} for x in plan['windows'])
 assert not a.out.exists()
 gdal.UseExceptions()
 budget=[BUDGET-2*8192];requestsUsed=[2]; deadline=time.monotonic()+220
 a.out.mkdir();rows={}
 readers={k:Read(k,budget,requestsUsed,deadline,a.headers,a.out) for k in SRC}
 for i,w in enumerate(plan['windows']):
  name=w['id'];row=rows[name]={'xywh':w['xywh'],'firstCentreEPSG3979':[GRID[0]+w['xywh'][0]+.5,GRID[3]-w['xywh'][1]-.5],'files':{}}
  for k,r in readers.items():
   data,ids=decode(r,w['xywh']);b=data.tobytes();nf=name+'-'+k+'.f32le'
   (a.out/nf).write_bytes(b)
   row['files'][k]={'name':nf,'bytes':len(b),'sha256':sha(b),'nativeBlockIDs':ids}
  print(name,w['xywh'], [b['nativeBlockIDs'] for b in row['files'].values()],flush=True)
 record={'scope':'No warping or overview; nothing authored, placed, or measured as plant height.',
  'windowsPlanSHA256':sha(pl),'nativeProjection':'EPSG3979','nominalOrthometricDatum':'CGVD2013',
  'gridFromNativeHeaders':GRID,'nativeNoDataValue':NODATA,'maxRequestedBytes':BUDGET,'requestedBytes':BUDGET-budget[0],'boundedRequests':requestsUsed[0],
  'source':{k:{'publicURL':r.url,'etag':r.etag,'fullOriginalBytes':r.total,'ranges':r.ranges} for k,r in readers.items()},'windows':rows}
 (a.out/'source.json').write_text(json.dumps(record,indent=2)+'\n')
if __name__=='__main__':main()
