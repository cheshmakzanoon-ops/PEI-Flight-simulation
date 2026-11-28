"""Screen low, locally variable paired heights as source cue only, not grass heights."""
from pathlib import Path
from hashlib import sha256
import argparse,gzip,json
import numpy as np
from scipy.ndimage import distance_transform_edt, label
from pyproj import Transformer
HERE=Path(__file__).resolve().parent
PIN='07fbf08153bde9423686874777b43665ef1fbe828b094b70b31cbfdbe71eee4a'
LX=76762.59317717304; LZ=111161.08375388647
COVER_SHA='e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9'
def sha(b):return sha256(b).hexdigest()
def quant(a):
 if not a.size:return None
 return dict(zip(('p0','p10','p50','p90','p100'),map(float,np.quantile(a,[0,.1,.5,.9,1]))))
def native_to_world(tx,ty):
 lon,lat=INVERSE.transform(tx,ty)
 return (lon+63.2)*LX,(46.5-lat)*LZ
INVERSE=Transformer.from_crs(3979,4326,always_xy=True)
def whole_min(tile,lo,hi,top,bottom,taps):
 left=np.floor(lo).astype(int);right=np.floor(hi).astype(int)+taps
 start=np.floor(top).astype(int);end=np.floor(bottom).astype(int)+taps
 valid=(left>=0)&(start>=0)&(right<tile.shape[1])&(end<tile.shape[0])
 result=np.full(left.shape,255,dtype='u1')
 for z in range(int((end-start).max())+1):
  for x in range(int((right-left).max())+1):
   tested=(left+x<=right)&(start+z<=end)
   r=np.clip(start+z,0,tile.shape[0]-1);c=np.clip(left+x,0,tile.shape[1]-1)
   result=np.minimum(result,np.where(tested,tile[r,c],255))
 return np.where(valid,result,0)

def actor_distance(x,z,a):
 if a['kind']=='line':
  (l,b),(r,t)=a['p'];dx,dz=r-l,t-b
  den=dx*dx+dz*dz
  s=0 if not den else np.clip(((x-l)*dx+(z-b)*dz)/den,0,1)
  return np.hypot(x-l-s*dx,z-b-s*dz)
 l,b,r,t=a['box']
 return np.hypot(np.maximum(np.maximum(l-x,x-r),0),np.maximum(np.maximum(b-z,z-t),0))
def fields(args,plan,record,peer,masks,pre,on_base=None):
 cdir=args.repo/'public/world'
 cm=(cdir/'cover.json').read_bytes(); tm=(cdir/'terrain.json').read_bytes()
 assert sha(cm)=='4834b7598fe4c34fc9a1ac1f3a13229d4fe483a19361b2e90250adbf874c68ab'
 assert sha(tm)=='77c9417c6bd4f4286ea4ca86a4625be30f779f33272dd7a8a4af13e001de7e98'
 meta=json.loads(cm);terrain=json.loads(tm)
 assert meta['bounds']==terrain['bounds'] and meta['width']==terrain['width']==4096 and meta['height']==terrain['height']==2720
 n,m=(meta['height'],meta['width']);w,s,e,north=meta['bounds']
 loX=(w+63.2)*LX;hiX=(e+63.2)*LX;loZ=(46.5-north)*LZ;hiZ=(46.5-s)*LZ
 raw=gzip.decompress((cdir/meta['file']).read_bytes());assert sha(raw)==COVER_SHA
 C=np.frombuffer(raw,'u1').reshape(n,m,2)
 for k,w in zip(plan['windows'],peer['boxes']):assert k['worldXZBounds']==w
 keep=[]
 for case in plan['windows']:
  ident=case['id'];r=record['windows'][ident];p=masks['rows'][ident]
  assert p['shard']==case['grassShard'] and r['xywh']==case['xywh']
  buf=(args.mask/p['name']).read_bytes();assert sha(buf)==p['sha256'] and len(buf)==135200
  a=np.frombuffer(buf,'u1').reshape(260,260,2)
  nx,ny=r['xywh'][2:];y0,x0=np.indices((ny,nx))
  lxhat,lzhat=r['firstCentreEPSG3979'];east=lxhat+x0;north=lzhat-y0
  worlds=[native_to_world(east+dx,north+dz) for dx,dz in [(-.5,-.5),(.5,-.5),(-.5,.5),(.5,.5),(0,0)]]
  X,Z=worlds[-1]
  moat=pre['nativeCellWholeCornerPadWorldMetres']
  xlo=np.min([x for x,z in worlds],axis=0)-moat;xhi=np.max([x for x,z in worlds],axis=0)+moat
  zlo=np.min([z for x,z in worlds],axis=0)-moat;zhi=np.max([z for x,z in worlds],axis=0)+moat
  Q,T=p['boxStart']
  inside=(xlo>=Q)&(xhi<Q+1024)&(zlo>=T)&(zhi<T+1024)
  grass=inside&(whole_min(a[:,:,1],(xlo-Q)/4+1.5,(xhi-Q)/4+1.5,(zlo-T)/4+1.5,(zhi-T)/4+1.5,1)
               >=pre['requireAllSignedGrassTapsG'])
  a0,a1=m*(xlo-loX)/(hiX-loX),m*(xhi-loX)/(hiX-loX)
  b0,b1=n*(zlo-loZ)/(hiZ-loZ),n*(zhi-loZ)/(hiZ-loZ)
  # Every touched texel must match the original class; a minimum alone
  # could otherwise accept a mix of 30 and a higher incompatible code.
  C30=np.where(C[:,:,0]==pre['originalCoverClass'],255,0).astype('u1')
  cls=whole_min(C30,a0,a1,b0,b1,0)==255
  d=whole_min(C[:,:,1],a0-.5,a1-.5,b0-.5,b1-.5,1)
  dry=cls&((d.astype(int)-128)*2>=pre['minOriginalWetDistanceMetres'])
  reco={}
  for kind,f in r['files'].items():
   b=(args.source/f['name']).read_bytes()
   assert sha(b)==f['sha256'] and len(b)==nx*ny*4
   reco[kind]=np.frombuffer(b,'<f4').astype(float).reshape(ny,nx)
  G,S=reco['dtm'],reco['dsm'];D=S-G
  finite=np.isfinite(G)&np.isfinite(S)&(G>-100)&(S>-100)
  removed={};peerok=np.ones_like(grass)
  for item in peer['localActors']:
   k=item['category'];rsv=pre['hardscapeExtraReserveMetres'][k]+moat+item.get('width',0)
   low=actor_distance(X,Z,item)<=rsv
   if np.any(low):removed[k]=removed.get(k,np.zeros_like(low))|low
  for v in removed.values():peerok &=~v
  tall=finite&(D>=pre['tallDSMNeighbourRejectMetres'])
  buffer=(distance_transform_edt(~tall)>pre['tallDSMNeighbourReserveNativeCells']) if np.any(tall) else np.ones_like(tall)
  edge=pre['cropEdgeNoDataUnobservableReserveM']
  base=grass&dry&finite&peerok&buffer
  # Cells near an observation boundary cannot prove an unobserved tall return absent.
  valid_surround=distance_transform_edt(np.pad(finite,1))[1:-1,1:-1]>edge
  base &= valid_surround
  if on_base: on_base(case, r, X, Z, east, north, G, base)
  allow=base&(D>=pre['minPlausibleNativeSeparationMetres'])&(D<=pre['maxPlausibleNativeSeparationMetres'])
  row={'id':ident,'allCells':nx*ny,'exactFourTapGrassCorners':int(grass.sum()),'strictDryClassWhole':int((grass&dry).sum()),
       'finiteSignedPairAfterGuards':int(base.sum()),'physicsNote':'Interpretation refers only to separations of aligned source surfaces.',
       'hardscapeVetoBeforeHeightRange':{k:int((v&grass&dry&finite).sum()) for k,v in removed.items()},
       'nativeTallVetoBeforeHeightRange':int((~buffer&grass&dry&finite&peerok).sum()),
       'unclampedSeparationDistributionM':quant(D[base]),
       'strongNegativeSeparationCells':int((base&(D<pre['negativeNoRaiseDiagnosticMetres'])).sum()),
       'lowSeparationsBeforeMeso':int(allow.sum()),'meso':{}}
  for B in pre['mesoCells']:
   cells=[];origins=[];counts=[];span=[]
   # Axis remains the native global grid (not translated to favor a fit).
   p0=(-r['xywh'][0])%B;p1=(-r['xywh'][1])%B
   for j in range(p1,ny-B+1,B):
    for i in range(p0,nx-B+1,B):
     z0=D[j:j+B,i:i+B];ok=base[j:j+B,i:i+B]
     if not ok.all():continue
     if np.any(z0<-.045) or np.any(z0>.95):continue
     cells.append(float(np.median(z0)));counts.append(int(allow[j:j+B,i:i+B].sum()))
     origins.append((i,j))
   selected=np.asarray(counts)>=pre['requiredWholeCellAuthorBlockFraction']*B*B
   measure=quant(np.asarray(cells))
   active_measure=quant(np.asarray(cells)[selected])
   support=np.zeros((ny//B+2,nx//B+2),dtype=bool)
   for (i,j),ok in zip(origins,selected):
    if ok:support[(j-p1)//B,(i-p0)//B]=True
   labs,_=label(support);regions=np.bincount(labs.ravel())[1:]
   row['meso'][str(B)]={'completeBlocks':len(cells),'nativeBlockMediansM':measure,
                       'p90MinusP10M':None if not measure else measure['p90']-measure['p10'],
                       'blocksWithMinimumLowSeparationCoverage':int(selected.sum()),
                       'connectedActiveBlocksDescending':sorted(map(int,regions),reverse=True),
                       'predeclaredActiveBlockMediansM':active_measure,
                       'activeP90MinusP10M':None if not active_measure else active_measure['p90']-active_measure['p10']}
  eight=row['meso']['8']
  row['qualifiedNumericalProspectOnly']=eight['blocksWithMinimumLowSeparationCoverage']>=pre['minSupportedAuthorableBlocksPerSiteAt8Metres'] and eight['activeP90MinusP10M']>=pre['minMesoP90MinusP10Metres']
  keep.append(row)
 return keep

def main():
 p=argparse.ArgumentParser(description=__doc__)
 for k in ('source','plan','peer','mask','repo','out'):p.add_argument('--'+k,type=Path,required=True)
 a=p.parse_args()
 b=(HERE/'PRELOCK.json').read_bytes();assert sha(b)==PIN
 pl=a.plan.read_bytes();plan=json.loads(pl);r=json.loads((a.source/'source.json').read_bytes())
 assert sha(pl)==r["windowsPlanSHA256"] and plan["prelockBeforeNativeReads"]==PIN
 evidence=fields(a,plan,r,json.loads(a.peer.read_bytes()),json.loads((a.mask/'mask-receipt.json').read_bytes()),json.loads(b))
 out={'scope':'Conservative geographic mid-scale author feasibility only; no art, shader, geology or shape mounted.',
      'prelock':PIN,'plansSHA256':sha(pl),'sourceReceipt':sha((a.source/'source.json').read_bytes()),'nearFieldEvidence':evidence}
 with a.out.open('x') as f:f.write(json.dumps(out,indent=2)+'\n')
 for s in evidence:print(s['id'],s['exactFourTapGrassCorners'],s['finiteSignedPairAfterGuards'],s['meso']['8'],s['qualifiedNumericalProspectOnly'])
if __name__=='__main__':main()
