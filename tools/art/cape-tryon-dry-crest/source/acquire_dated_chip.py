#!/usr/bin/env python3
"""Private no-image height range reader; 4 native compressed blocks, never full TIFF."""
from __future__ import annotations
import hashlib, json, struct, sys
from pathlib import Path
import numpy as np
import requests
from osgeo import gdal

# Bounded, pre-existing public origin and exact raw native crop, no alternatives.
URL='https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-lidar/PEI-Prince_Edward_Island_2020-1m-dtm.tif'
TAG='"9e5249deef1137ddcce504d6f4bca1a9-131"'; SIZE=34973844421
EXPECTED='e25dd8e9ce83d801828c560d71804903069b2071088c11381d35c7d6bcd191c2'
CROP=(80509,54659,516,448)
LIMIT=6*1024*1024
PROBE_BYTES=8192 # Independently authenticated exploratory head ranges already used in this task.
def h(q):return hashlib.sha256(q).hexdigest()
def check(ok,why):
 if not ok:raise ValueError(why)
class ExactSubset:
 def __init__(self):
  self.budget=LIMIT-PROBE_BYTES
  self.ranges=[]
  self.session=requests.Session()
 def read(self,at,n,kind):
  check(0<n<=self.budget and at>=0 and at+n<=SIZE,'range outside hard transport budget')
  end=at+n-1;decl=f'bytes {at}-{end}/{SIZE}'
  # Charge the intended complete response before opening; no retries.
  self.budget-=n
  with self.session.get(URL,stream=True,allow_redirects=False,timeout=(8,20),headers={
   'If-Match':TAG,'Range':f'bytes={at}-{end}','Accept-Encoding':'identity',
  }) as x:
   check(x.status_code==206 and x.headers.get('ETag')==TAG and x.headers.get('Content-Range')==decl and
         x.headers.get('Content-Length')==str(n) and x.headers.get('Content-Encoding','identity')=='identity','source identity/range refused')
   b=x.raw.read(n+1);check(len(b)==n,'short/framing mismatch')
  self.ranges.append({'kind':kind,'at':at,'n':n,'contentRange':decl,'sha256':h(b)})
  return b

def envelope(sub):
 head=sub.read(0,8192,'head/primary IFD/GeoKeys')
 check(head[:8]==b'II+\x00\x08\x00\x00\x00','expected native little-endian BigTIFF')
 iff=struct.unpack_from('<Q',head,8)[0]
 count=struct.unpack_from('<Q',head,iff)[0]
 check(iff==200 and count==19,'unexpected TIFF directory layout')
 d={t:(f,n,z) for t,f,n,z in (struct.unpack_from('<HHQQ',head,iff+8+20*i) for i in range(count))}
 for tag,expected in {256:(4,1,197442),257:(4,1,108635),258:(3,1,32),259:(3,1,5),
  262:(3,1,1),277:(3,1,1),284:(3,1,1),317:(3,1,1),322:(3,1,512),323:(3,1,512),339:(3,1,3)}.items():
  check(d.get(tag)==expected,('native TIFF packing drift',tag))
 for tag,typ,n in [(33550,12,3),(33922,12,6),(34735,3,32),(34737,2,48),(42113,2,7)]:
  check(d[tag][:2]==(typ,n),('geotag packing drift',tag))
 scale=struct.unpack_from('<3d',head,d[33550][2])
 tie=struct.unpack_from('<6d',head,d[33922][2])
 keys=struct.unpack_from('<32H',head,d[34735][2])
 kv={keys[i]:keys[i+1:i+4] for i in range(4,len(keys),4)}
 no=d[42113][2].to_bytes(8,'little')
 check(scale==(1.,1.,0.) and tie==(0.,0.,0.,2261621.,371370.,0.) and kv[3072]==(0,1,3979) and kv[1025]==(0,1,1) and no==b'-32767\x00\x00','native CRS, grid or NoData drift')
 check(d[324]==(16,82218,3328) and d[325]==(4,82218,661072),'native tile tables drift')
 return d

def tiff_rehouse(packets):
 """Expose same compressed UInt8 blocks to the native TIFF LZW decoder, no warp/quantize."""
 # Fresh local cropped Classic TIFF; its georeference is intentionally *absent*.
 # Placement/packing is linked separately by the primary signed BigTIFF tags.
 base={256:(4,1,1024),257:(4,1,1024),258:(3,1,32),259:(3,1,5),262:(3,1,1),
  277:(3,1,1),284:(3,1,1),317:(3,1,1),322:(4,1,512),323:(4,1,512),339:(3,1,3)}
 off0=8+2+(len(base)+2)*12+4;n=len(packets);check(n==4,'require complete 2 by 2')
 base[324]=(4,n,off0);base[325]=(4,n,off0+n*4)
 offsets=[];sizes=[];cur=off0+n*8
 for b in packets:offsets.append(cur);sizes.append(len(b));cur+=len(b)
 head=b'II*\x00\x08\x00\x00\x00'+struct.pack('<H',len(base))
 head+=b''.join(struct.pack('<HHII',t,*d) for t,d in sorted(base.items()))+b'\x00'*4
 check(len(head)==off0,'local image packing bug')
 return head+struct.pack('<8I',*(offsets+sizes))+b''.join(packets)

def decode(source):
 d=envelope(source)
 pos=CROP
 ti=(pos[0]//512,pos[1]//512)
 allw=(197442+511)//512
 ids=[(ti[1]+y)*allw+ti[0]+x for y in range(2) for x in range(2)]
 check(ids==[41073,41074,41459,41460],'nonlocked tile support')
 query=[]
 for iy in ids[::2]:
  offset=struct.unpack('<2Q',source.read(d[324][2]+8*iy,16,'selected native LZW offsets'))
  count=struct.unpack('<2I',source.read(d[325][2]+4*iy,8,'selected native LZW byte counts'))
  query.extend(zip(offset,count))
 check(len(query)==4 and sum(n for _,n in query)<=source.budget and len(set(query))==4,'compressed blocks exceed cap or ambiguous')
 packets=[source.read(a,n,f'native_1m_tile_{i}') for (a,n),i in zip(query,ids)]
 mem='/vsimem/cape_tryon_no_raster_extraction_local.tif'
 gdal.UseExceptions();gdal.FileFromMemBuffer(mem,tiff_rehouse(packets))
 try:
  ds=gdal.Open(mem,gdal.GA_ReadOnly)
  check(ds is not None and ds.RasterCount==1 and ds.GetRasterBand(1).DataType==gdal.GDT_Float32,'local standard LZW decoder failed')
  raw=ds.GetRasterBand(1).ReadAsArray(pos[0]-ti[0]*512,pos[1]-ti[1]*512,*pos[2:]).astype('<f4',copy=False)
  ds=None
 finally:gdal.Unlink(mem)
 check(raw.shape==(448,516) and h(raw.tobytes())==EXPECTED,'not the original signed native full 516×448 chip')
 return raw,ids

def main():
 where=Path(sys.argv[1]);check(not where.exists(),'refuse existing output')
 source=ExactSubset();r,ids=decode(source)
 where.mkdir()
 (where/'cape-tryon-native-516x448.f32le').write_bytes(r.tobytes())
 rec={'publicOrigin':URL,'sourceObjectBytes':SIZE,'exactHeaderETag':TAG,'firstProbeBytesAccountedSeparately':PROBE_BYTES,
  'consumedBytes':sum(a['n'] for a in source.ranges)+PROBE_BYTES,'maxBytes':LIMIT,'ranges':source.ranges,'nativeFullMipIDs':ids,
  'chipXYWH':CROP,'crs':3979,'nativeGrid':[2261621,1,0,371370,0,-1],'nodata':-32767,
  'verticalDatum':'CGVD2013 orthometric (published product; not a water datum)',
  'chipSHA256':EXPECTED,'chipBytes':r.nbytes,'nativeExact':True,'realTilesNoOverviewOrWarp':True,
  'scope':'Numeric source only. No current material, wet line, survey of flight terrain, visual art or operation inferred.'}
 (where/'source-custody.json').write_text(json.dumps(rec,indent=2)+'\n')
 print(json.dumps(rec,indent=2))
if __name__=='__main__':main()
