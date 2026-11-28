"""Eligibility-only independent pass metadata. This program cannot fit heights."""
from pathlib import Path
import argparse,hashlib,json,struct,subprocess,urllib.request,os,math
from collections import Counter,defaultdict
import laspy,lazrs,numpy as np

expected=((4017123,4099608,14732),(28780922,29046186,41011),
 (47081323,47462570,49928),(55308110,56076991,86456),(56809735,57221708,36116))
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--fixtures',type=Path,default=Path(__file__).parent/'fixtures')
parser.add_argument('--out',type=Path,help='new eligibility receipt; required for the explicit bounded network run')
parser.add_argument('--network',action='store_true',help='allow exactly five point-information byte ranges; no Z layer')
parser.add_argument('--projection-python',help='optional Python executable with pyproj; otherwise use this interpreter')
args=parser.parse_args()
if not __debug__:
 parser.error("validation requires Python assertions; do not use -O or PYTHONOPTIMIZE")
if args.network and args.out is None:
 parser.error("--network requires a new --out")
output=args.out.resolve() if args.out else None
assert output is None or not output.exists()
os.chdir(args.fixtures.resolve())
tag='"8652076b4b4eb63c907739411bcc930f-7"'
total=57235056
cellsha='b82b17674b6b9d865cb5ed64c132ac54d344ab5d54d334b33ead451b8d939c10'
pth=Path('.')
sha=lambda raw:hashlib.sha256(raw).hexdigest()
mfile=pth/'metadata-only.json';m=json.loads(mfile.read_bytes())
assert m['etag']==tag and m['originalFileBytes']==total and m['projection']['horizontalEPSG']==2961
cellsraw=Path('pass-only-halfmetre-xy.json').read_bytes()
assert sha(cellsraw)==cellsha
roster=[tuple(x) for x in json.loads(cellsraw)]
assert len(roster)==len(set(roster))==197
roster=set(roster)
root=Path('root-hierarchy.bin').read_bytes()
assert sha(root)==m['metadataRanges'][2]['sha256']
nodes=[struct.unpack_from('<iiiiQii',root,n) for n in range(0,len(root),32)]
loX,loY,hiX,hiY=m['exactStockOutlineBoxInNativeMeters']
cx,cy,_=m['meta']['centre'];half=m['meta']['halfsize']
def near(node):
 level,i,j,*_=node
 d=2*half/(2**level)
 x=cx-half+i*d;y=cy-half+j*d
 return x<=hiX and x+d>=loX and y<=hiY and y+d>=loY
eligible=[r for r in nodes if near(r) and r[-1]!=0]
assert all(n[-1]>0 for n in eligible)
assert tuple(sorted((a,a+n-1,c) for *_,a,n,c in eligible))==expected
head=Path('fixed-header-and-vlr.lasmeta').read_bytes()
assert len(head)==1377 and head[104]&0x3f==6 and struct.unpack_from('<H',head,105)[0]==30
assert sha(head[:375])==m['metadataRanges'][0]['sha256'] and sha(head[375:])==m['metadataRanges'][1]['sha256']
assert struct.unpack_from('<H',head,6)[0]==16
xs,ys=struct.unpack_from('<2d',head,131)
xo,yo=struct.unpack_from('<2d',head,155)
assert xs==ys==.001
pos=375;laszip=None
for _ in range(struct.unpack_from('<I',head,100)[0]):
 h=head[pos:pos+54];label=h[2:18].rstrip(b'\0')
 type,n=struct.unpack_from('<HH',h,18);p0=pos+54;pos=p0+n
 assert pos<=len(head)
 if label==b'laszip encoded' and type==22204:laszip=head[p0:pos]
assert laszip and len(laszip)==40
selection=laspy.DecompressionSelection.base()|laspy.DecompressionSelection.CLASSIFICATION|laspy.DecompressionSelection.FLAGS|laspy.DecompressionSelection.SCAN_ANGLE|laspy.DecompressionSelection.POINT_SOURCE_ID|laspy.DecompressionSelection.GPS_TIME
assert not selection & laspy.DecompressionSelection.Z
schema=np.dtype({'names':['X','Y','return_bits','flag_bits','classification','scan_angle','source','t'],
 'formats':['<i4','<i4','u1','u1','u1','<i2','<u2','<f8'],'offsets':[0,4,14,15,16,18,20,22],'itemsize':30})
T=Path('NO-Z-PASS-SCREEN-LOCK.json')
lock={'scope':'Only XY and screening flags of the exact 197 roof-core half-metre cells. No actual Z layer selection, access, fitting, readout or export. No placements.',
 'metadataSHA256':sha(mfile.read_bytes()),'orderedPrimarySourceRanges':expected,'selectedSourceRows':228243,
 'cellSHA256':cellsha,'sourceGroups':'Nonzero native PointSourceID plus coherent disjoint plausible local GPS week-time; labels alone are not verified flights.',
 'additivePointTransportBytes':1909855,'passesGeoAuthorityStillRequired':True,'axes':{ 'origin':[2359704.830168697,309974.1102274133],
 'V':[.9949568696725756,-.10030367636008926],'U':[.10030367636008926,.9949568696725756]},
 'ridgeOptions':[-4.78,-4.38,-3.98,-3.58,-3.18,-2.78,-2.38,-1.98],
 'countThresholds':{'cellsPerFlank':14,'blocksPerFlank':6,'cellsPerBlock':2},
 'timeWindowSecondLimit':30,'timeGapSecondMin':10}
lockbytes=(json.dumps(lock,indent=2)+'\n').encode()
assert hashlib.sha256(lockbytes).hexdigest()=='c01121712bd1cdf3b15e50f8e18cb3fb36b1c4358603f11f4a977c03fbf45ad4'
assert T.is_file() and T.read_bytes()==lockbytes,'published prelock drift'
archived=json.loads(Path('no-z-screen.json').read_bytes())
assert archived['prelockSHA256']==sha(lockbytes)
assert [(r['range'][0],r['range'][1],r['decompressedRecords']) for r in archived['ranges']]==list(expected)
assert archived['pointBytes']==lock['additivePointTransportBytes']
if not args.network:
 print('Pass: exact metadata, VLR, hierarchy, five ranges and 197 cells. No network requested.')
 raise SystemExit(0)
class RefuseRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*p,**q):return None
get=urllib.request.build_opener(RefuseRedirect())
def read(a,b):
 cap=b-a+1
 rq=urllib.request.Request(m['tileURL'],headers={'Accept-Encoding':'identity','If-Match':tag,'Range':f'bytes={a}-{b}'})
 with get.open(rq,timeout=16) as resp:
  assert resp.status==206 and resp.headers['ETag']==tag
  assert resp.headers['Content-Range']==f'bytes {a}-{b}/{total}' and int(resp.headers['Content-Length'])==cap
  assert resp.headers.get('Content-Encoding','identity')=='identity'
  raw=resp.read(cap+1)
 assert len(raw)==cap
 return raw
from functools import cache
posroot=np.array(lock['axes']['origin'])
axes=np.stack([lock['axes']['V'],lock['axes']['U']],axis=1)
@cache
def cellpose(i,j):
 E,N=i/2,j/2
 return (np.array([[E,N],[E+.5,N],[E,N+.5],[E+.5,N+.5]])-posroot)@axes
def project_xy(samples):
 if not args.projection_python:
  from pyproj import Transformer
  x=Transformer.from_crs(2961,3979,always_xy=True)
  return [x.transform(*p) for p in samples]
 converter=("from pyproj import Transformer\nimport json,sys\n"
   "x=Transformer.from_crs(2961,3979,always_xy=True)\n"
   "print(json.dumps([x.transform(*p) for p in json.load(sys.stdin)]))")
 return json.loads(subprocess.check_output([args.projection_python,'-I','-c',converter],
   input=json.dumps(samples).encode()))
pts=[];ranges=[];received=0
for (a,b,count),old in zip(expected,archived['ranges'],strict=True):
 raw=read(a,b);received+=len(raw)
 digest=sha(raw)
 if digest!=old['encodedSHA256']:raise ValueError('Changed encoded range digest')
 ranges.append({'range':[a,b],'encodedSHA256':digest,'decompressedRecords':count})
 if raw[:1]==b'\x00' and len(raw)<20:raise ValueError('No payload')
 out=np.zeros(30*count,dtype=np.uint8)
 lazrs.decompress_points_with_chunk_table(np.frombuffer(raw,np.uint8),laszip,out,[(count,len(raw))],selection.to_lazrs())
 d=out.view(schema)
 X,Y=d['X']*xs+xo,d['Y']*ys+yo
 ij=np.flatnonzero((X>=loX)&(Y>=loY)&(X<=hiX)&(Y<=hiY))
 if len(ij):
  xy=project_xy(np.c_[X[ij],Y[ij]].tolist())
  for k,p in zip(ij,xy,strict=True):
   index=(math.floor(2*p[0]),math.floor(2*p[1]))
   if index not in roster:continue
   # Only now interpret flag/class/acquisition metadata inside the frozen scope.
   bits=int(d['return_bits'][k]);flags=int(d['flag_bits'][k]);cls=int(d['classification'][k])
   ang=int(d['scan_angle'][k]);sid=int(d['source'][k]);gps=float(d['t'][k])
   pts.append((index,int(d['X'][k]),int(d['Y'][k]),bits,flags,cls,ang,sid,gps))
 out.fill(0)
assert received==1909855
counts=Counter();good=defaultdict(list);duplicates={};conflicts=0
for cell,x,y,bits,flags,cls,ang,sid,gps in pts:
 counts[(sid,cls)]+=1
 if bits&15!=1 or not (1<=bits>>4<=15) or flags&(1|4|128) or abs(ang)*.006>25:continue
 if not math.isfinite(gps) or not 0<gps<604800 or not sid:continue
 pulse=(sid,(flags>>4)&3,struct.pack('<d',gps))
 if pulse in duplicates:
  if duplicates[pulse]!=(x,y):conflicts+=1
  continue
 duplicates[pulse]=(x,y)
 good[sid].append((cell,x,y,cls,ang,gps,int(bool(flags&8))))
stats={};viable=[]
for sid,group in sorted(good.items()):
 valid=defaultdict(list)
 for cell,x,y,t,angle,gps,overlap in group:
  if t==6:valid[cell].append((x,y,angle,gps,overlap))
 cells={k for k,v in valid.items() if len(v)>=2 and len({(x,y) for x,y,*u in v})>=2}
 t0=min(p[-2] for p in group);t1=max(p[-2] for p in group)
 options=[]
 for c in lock['ridgeOptions']:
  side=[]
  for sign in (-1,1):
   exact=[k for k in cells if (cellpose(*k)[:,0].max()<=c-.452 if sign<0 else cellpose(*k)[:,0].min()>=c+.452)]
   cc=Counter((i//6,j//6) for i,j in exact)
   blocks={key for key,n in cc.items() if n>=2}
   half=lambda i,j: (np.array([3*i+1.5,3*j+1.5])-posroot)@axes[:,1]<-3.57
   a,b=sum(half(*p) for p in blocks),sum(not half(*p) for p in blocks)
   if exact:
    v,u=np.vstack([cellpose(*t) for t in exact]).T
    cspan,vspan=float(np.ptp(u)),float(np.ptp(v))
   else:cspan=vspan=0
   yes= len(exact)>=14 and len(blocks)>=6 and min(a,b)>=2 and cspan>=8 and vspan>=1.2
   side.append({'cells':len(exact),'blocks':len(blocks),'longitudinalHalfBlocks':[a,b],'horizontalUSpan':cspan,'crossSpan':vspan,'support':yes})
  if all(r['support'] for r in side):options.append(c)
 stats[str(sid)]={'validFirstPulseRows':len(group),'buildingClassRows':sum(len(v) for v in valid.values()),
  'cellsWithTwoDistinctXY':len(cells),'localGPSSpanSeconds':t1-t0,'eligibleRidgeOptionsSupportOnly':options}
 if options and t1-t0<=30:viable.append((t0,t1,sid,options))
viable.sort()
pairs=[(a[2],b[2]) for n,a in enumerate(viable) for b in viable[n+1:] if b[0]-a[1]>=10 and set(a[3])&set(b[3])]
d={'scope':lock['scope'],'prelockSHA256':sha(lockbytes),'ranges':ranges,'pointBytes':received,
   'retainedInsideExactMask':len(pts),'summaryClassBySource':[[a,b,n] for (a,b),n in sorted(counts.items())],
   'duplicateDifferentXY':conflicts,'perCandidateSource':stats,'potentialIndependentFamilies':pairs,
   'verticalDataOpened':False,'decision':'HOLD: no independently qualified pair of acquisition groups' if not pairs or conflicts else 'HOLD: validate provider physical strip semantics before any height'}
with output.open('x') as receipt:receipt.write(json.dumps(d,indent=2)+'\n')
print(json.dumps({k:d[k] for k in ('retainedInsideExactMask','summaryClassBySource','perCandidateSource','potentialIndependentFamilies','decision')},indent=2))
