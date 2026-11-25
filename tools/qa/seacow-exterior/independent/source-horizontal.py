"""Optional original horizontal-only audit for the already identified tower: explicit LAZ selective read, bounded and byte-pinned, no point elevations."""
from pathlib import Path as P
import argparse,json,hashlib,sys,struct,subprocess,tempfile
import numpy as np
from laspy import DecompressionSelection
from laspy.copc import CopcReader,Bounds,load_octree_for_query
p=argparse.ArgumentParser();p.add_argument('--out',type=P,required=True);p.add_argument('--cache',type=P,required=True);p.add_argument('--receipt',type=P);args=p.parse_args();D=P(__file__).resolve().parent
reg=json.loads((D/'independent-pre-native-and-appearance.json').read_bytes());receipt=json.loads((args.receipt or D.parents[3]/'docs/qa/seacow-exterior/source-eligibility.json').read_bytes())
s=reg['source'];known={(e['start'],e['end']):e['sha256']for e in receipt['intake']['ranges']};bounds=np.array(reg['nativeXY']['boundedXY2961']);o=reg['identity']['utmEPSG2961'];args.cache.mkdir(parents=True,exist_ok=True);H=lambda b:hashlib.sha256(b).hexdigest();log=set()
class ByteSource:
 def __init__(self):self.o=0
 def tell(self):return self.o
 def close(self):pass
 def seek(self,off,ref=0):
  self.o=off+(self.o if ref==1 else s['objectBytes']if ref==2 else 0);assert 0<=self.o<=s['objectBytes']
 def read(self,n):
  if n==0:return b''
  pair=(self.o,self.o+n-1);key=known.get(pair);assert key and 0<n<4e6,'Unexpected span; use documented laspy/lazrs or inspect before broadening'
  t=str(pair[0])+'-'+str(pair[1]);f=args.cache/(t+'.bin')
  if f.exists():d=f.read_bytes()
  else:
   from urllib.request import Request,urlopen
   req=Request(s['url'],headers={'Range':'bytes='+t,'If-Match':s['etag'],'Accept-Encoding':'identity'})
   with urlopen(req,timeout=30)as resp:
    assert resp.status==206 and resp.headers.get('Content-Range')==f'bytes {t}/{s["objectBytes"]}'and resp.headers.get('ETag')==s['etag'];d=resp.read(n+1)
   assert len(d)==n and H(d)==key;f.write_bytes(d)
  assert len(d)==n and H(d)==key;log.add(pair);self.o+=n;return d
src=ByteSource();select=(DecompressionSelection.base().decompress_classification().decompress_flags().decompress_point_source_id().decompress_gps_time());assert not (select&DecompressionSelection.Z)
with CopcReader(src,close_fd=False,http_num_threads=1,decompression_selection=select) as reader:
 w=reader.header.vlrs.get('WktCoordinateSystemVlr')[0].string.rstrip('\0');assert H(w.encode())=='6f15a566bdf98f65f06c99fc8877fe2a4b7fe4a2ebeb17238b8923a8ca673a40'
 b=Bounds(*bounds).ensure_3d(reader.header.mins,reader.header.maxs);nodes=load_octree_for_query(src,reader.copc_info,reader.root_page,query_bounds=b,level_range=None);raw=reader._fetch_and_decompress_points_of_nodes(nodes)
 lo,hi=np.rint((bounds-reader.header.offsets[:2])/reader.header.scales[:2]).astype('i4')
 a=raw[(lo[0]<=raw.X)&(raw.X<=hi[0])&(lo[1]<=raw.Y)&(raw.Y<=hi[1])];q=np.c_[a.x,a.y];rad=np.linalg.norm(q-o,axis=1);c=np.asarray(a.classification);sf=np.asarray(a.point_source_id);ch=np.asarray(a.scanner_channel);g=np.asarray(a.gps_time)
 assert not np.any(np.asarray(a.withheld,dtype=bool)|np.asarray(a.synthetic,dtype=bool)|np.asarray(a.key_point,dtype=bool)|np.asarray(a.overlap,dtype=bool))
 pulse=np.unique(np.rec.fromarrays((sf,ch,g.view('<u8')),names='line,channel,gps',formats=['<u2','u1','<u8']))
 out={'rawReadsPinned':len(log),'deduplicatedRangeBytes':sum(hi-lo+1 for lo,hi in log),'pointXYZRead':False,'lazrsMask':int(select),'rows':len(a),'pulses':len(pulse),'ids':np.unique(sf).astype(int).tolist(),'channels':np.unique(ch).astype(int).tolist(),'seconds':float(np.ptp(g)),'rawClass6Tower':int(((rad<=5.5)&(c==6)).sum()),'rawClass6Core':int(((rad<=2)&(c==6)).sum()),'rawClass2Ground':int(((rad>=8)&(rad<=24)&(c==2)).sum())}
assert (out['rows'],out['pulses'],out['ids'],out['channels'],out['rawClass6Tower'],out['rawClass6Core'],out['rawClass2Ground'])==(63000,59707,[16275],[0],452,129,6614);args.out.write_text(json.dumps(out,indent=2)+'\n');print(out)
