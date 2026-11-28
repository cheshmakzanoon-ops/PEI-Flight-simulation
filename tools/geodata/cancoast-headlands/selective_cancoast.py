"""Read only official ZIP byte ranges. Keep only explicitly requested small files or filtered SHP features."""
import struct,re,zlib,json,io,binascii,hashlib,subprocess,tempfile
from pathlib import Path
S=2420416878;tag='"0x8DB570AB981AF92"'
url=json.loads(Path('be99155c-0c4b-40e9-8f50-fb72ffee57b7.json').read_text())['_links']['content']['href']
d=Path('zip-tail.bin').read_bytes();p=d.rfind(b'PK\x05\x06');assert p>=0
_,_,_,n,m,sz,off,cm=struct.unpack_from('<4sHHHHIIH',d,p);assert n==m
c=off-(S-len(d));entries={}
for _ in range(n):
 r=struct.unpack_from('<4sHHHHHHIIIHHHHHII',d,c)
 sig,_,_,flags,method,_,_,crc,packed,size,nm,extra,comment,_,_,_,offset=r
 assert sig==b'PK\x01\x02'
 s=d[c+46:c+46+nm].decode()
 entries[s]=(offset,packed,size,crc,method)
 c+=46+nm+extra+comment
def part(lo,hi):
 # This HTTP endpoint served standard prefix/tail ranges, but refused the
 # tiny 30-byte urllib probe. Read a bounded complete 4 KiB minimum range.
 end=min(S-1,max(hi,lo+4095))
 with tempfile.NamedTemporaryFile() as log:
  cmd=['curl','-fsS','--max-time','40','--max-filesize',str(end-lo+1),'-r',f'{lo}-{end}','-D',log.name,url]
  p=subprocess.run(cmd,capture_output=True,check=True)
  headers=Path(log.name).read_text().lower()
  assert re.search(r'^content-range: bytes '+f'{lo}-{end}/{S}'+r'\s*$',headers,re.M)
  assert ('etag: '+tag.lower()) in headers and len(p.stdout)==end-lo+1
  return io.BytesIO(p.stdout[:hi-lo+1])

def entry(name):
 o,m,n,crc,kind=entries[name]
 with part(o,o+29) as r:d=r.read(30)
 assert len(d)==30 and d[:4]==b'PK\x03\x04'
 nm,extra=struct.unpack_from('<HH',d,26)
 a=o+30+nm+extra
 return a,m,n,crc,kind
def exact_file(name,dest):
 a,m,n,crc,t=entry(name)
 assert m<1024*1024 and n<16*1024*1024
 with part(a,a+m-1) as r:v=r.read(m+1)
 assert len(v)==m
 v=zlib.decompress(v,-15) if t==8 else v
 assert len(v)==n and binascii.crc32(v)==crc
 with open(dest,'xb') as f:f.write(v)
 return hashlib.sha256(v).hexdigest()
if __name__=='__main__':
 root='CANCOAST_MATERIAL_V2/CANCOAST_MATERIAL_V2.'
 for s in ('prj','dbf','shp.xml','shx'):
  p=Path('ca-material.'+s)
  if not p.exists():print(s,exact_file(root+s,p),flush=True)
