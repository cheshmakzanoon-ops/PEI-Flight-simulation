"""Extract three predeclared PEI headland comparisons from one OGL ZIP component."""
from pathlib import Path
from hashlib import sha256
from collections import defaultdict
import struct,zlib,binascii,json,math,subprocess,re
from selective_cancoast import entry,S,tag,url
regions={
 'Prince-North-Cape':[-64.010,47.045,-63.984,47.070],
 'Queens-Cavendish':[-63.458,46.474,-63.398,46.513],
 'Kings-East-Point':[-61.987,46.425,-61.940,46.475],
}
db=Path('ca-material.dbf').read_bytes();shx=Path('ca-material.shx').read_bytes();prj=Path('ca-material.prj').read_bytes()
assert sha256(db).hexdigest()=='810685711a117e2e17c4bd3bd836e235e19c8055dc21a9a2edd26ac9aebc2e95'
assert sha256(shx).hexdigest()=='332104193222643c7004fe785a9817b83f4746077252ef7e0f8e536f501848a2'
assert b'GCS_WGS_1984' in prj
n,hlen,rlen=struct.unpack_from('<IHH',db,4);assert (n,hlen,rlen)==(168326,97,55)
assert len(shx)==100+8*n
def clip(p,q,b):
 x,y=p;xu,yu=q;dx=xu-x;dy=yu-y;a,c=0.,1.
 for z,v in [(-dx,x-b[0]),(dx,b[2]-x),(-dy,y-b[1]),(dy,b[3]-y)]:
  if z==0:
   if v<0:return
   continue
  t=v/z
  if z<0:a=max(a,t)
  else:c=min(c,t)
  if c<=a:return
 return ((x+a*dx,y+a*dy),(x+c*dx,y+c*dy))
def meters(a,b):
 s=math.cos(math.radians(.5*(a[1]+b[1])))
 return 111195.08*math.hypot((b[0]-a[0])*s,b[1]-a[1])
lengths={k:defaultdict(float) for k in regions};edges={k:[] for k in regions}
features={k:set() for k in regions}
def visit(j,p):
 assert p[:4]==struct.pack('<i',3),j
 bb=struct.unpack_from('<4d',p,4)
 slots=[k for k,b in regions.items() if bb[0]<=b[2] and bb[2]>=b[0] and bb[1]<=b[3] and bb[3]>=b[1]]
 if not slots:return
 parts,pts=struct.unpack_from('<ii',p,36)
 assert 0<parts<=pts and len(p)==44+4*parts+16*pts
 index=list(struct.unpack_from('<'+'i'*parts,p,44))+[pts]
 coord=list(struct.iter_unpack('<2d',p[44+4*parts:]))
 record=db[hlen+rlen*(j-1):hlen+rlen*j]
 assert record[0]==0x20 and len(record)==rlen
 genre=record[1:51].decode('cp1252').strip()
 rank=int(record[51:55].decode().strip())
 for lo,hi in zip(index,index[1:]):
  for i in range(lo,hi-1):
   x,y=coord[i:i+2]
   for k in slots:
    t=clip(x,y,regions[k])
    if t:
     lengths[k][genre]+=meters(*t);features[k].add(j)
     edges[k].append({'number':j,'material':genre,'rank':rank,'segment':t})
member='CANCOAST_MATERIAL_V2/CANCOAST_MATERIAL_V2.shp'
a,m,total,expected,kind=entry(member)
assert (m,total,expected,kind)==(185098172,258743364,0x1ee4e0b8,8)
prefix=0;j=0;processed=0;crc=0;carry=bytearray();dec=zlib.decompressobj(-15);compressed=0
head='material-stream.headers'
cmd=['curl','-fsS','--max-time','550','--max-filesize',str(m),'-r',f'{a}-{a+m-1}','-D',head,url]
with subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=open('material-stream.log','wb')) as proc:
 while True:
  x=proc.stdout.read(256*1024)
  if not x:break
  if compressed==0:
   metadata=Path(head).read_text().lower()
   assert ('etag: '+tag.lower()) in metadata
   assert re.search(r'^content-range: bytes '+f'{a}-{a+m-1}/{S}'+r'\s*$',metadata,re.M),metadata
  compressed+=len(x);y=dec.decompress(x);processed+=len(y);crc=binascii.crc32(y,crc);carry.extend(y)
  if prefix==0 and len(carry)>=100:
   assert struct.unpack_from('>i',carry,0)[0]==9994
   assert struct.unpack_from('>i',carry,24)[0]*2==total
   assert struct.unpack_from('<i',carry,32)[0]==3
   del carry[:100];prefix=100
  pos=0
  while len(carry)-pos>=8:
   i,ln=struct.unpack_from('>ii',carry,pos);l=ln*2
   assert i==j+1 and l>=4 and l<=32*1024*1024,(i,j,l)
   if len(carry)-pos<8+l:break
   assert struct.unpack_from('>ii',shx,100+8*j)==(prefix//2,ln)
   visit(i,bytes(carry[pos+8:pos+8+l]))
   prefix+=8+l;pos+=8+l;j+=1
  if pos:del carry[:pos]
  if compressed//(16*1024*1024)!=(compressed-len(x))//(16*1024*1024):
   print('stream MB',compressed//(1024*1024),'verified records',j,flush=True)
 assert proc.wait()==0
assert dec.eof and not carry and j==n and compressed==m and prefix==processed==total and crc==expected
assert all(v for v in edges.values())
headmarks={}
for k,l in lengths.items():
 headmarks[k]={'bboxWgs84':regions[k],'recordsTouched':len(features[k]),'pieceCount':len(edges[k]),
   'metresByClass':dict(sorted((t,round(d,3)) for t,d in l.items()))}
 print(k,headmarks[k],flush=True)
proof={'scope':'Historical national textual material classification for three rectangular reach prospects. Neither current substrate boundary nor scene/water authority.',
 'publisher':'Natural Resources Canada, Geological Survey of Canada', 'catalogue':'https://open.canada.ca/data/en/dataset/73714ed4-a795-a7ae-7e93-36100ce7c242',
 'license':'https://open.canada.ca/en/open-government-licence-canada','sourceETag':tag,
 'component':member,'zlibCRC32':hex(crc),'originalComponentBytes':total,'recordCount':j,'summary':headmarks}
with open('three-headland-prospect.json','x') as f:json.dump(proof,f,indent=2)
with open('private-three-headland-segments.json','x') as f:json.dump(edges,f,separators=(',',':'))
