"""Verify every actual contributing TCI source footprint on native elevated ground."""
from pathlib import Path
import argparse,hashlib,json,math,runpy,threading
from concurrent.futures import ThreadPoolExecutor
from collections import Counter,defaultdict
import numpy as np
P=argparse.ArgumentParser(description=__doc__)
P.add_argument('--root',type=Path,required=True);P.add_argument('--scratch',type=Path,required=True);P.add_argument('--trace',type=Path,required=True)
P.add_argument('--dry-fence',type=Path,required=True);arg=P.parse_args();a=arg.scratch
protected={x['id']:x for x in json.loads(arg.dry_fence.read_text())['cases']}
base=json.loads((a/'verified-large-roof-tone-receipt.json').read_text())
trace=json.loads(arg.trace.read_text())
assert trace['sourceTCIandSCLfilesVerifiedAgainstSHA256']
local=threading.local()
H=runpy.run_path(str(arg.root/'tools/qa/roof-fit-pilot.py'))
by=defaultdict(list);a0=Counter()
for x in trace['samples']:
 if not x['firstValidClear'] or x['scl']!=5:a0['SCL other than 5']+=1;continue
 if x['beyondPlanAreaM2']>1e-5:a0['source support extends off plane']+=1;continue
 by[x['site']].append(x)
def witness(points,ring):
 p,q=points.T;inside=np.zeros(len(points),dtype=bool);dist=np.full(len(points),np.inf)
 for a,b in zip(ring,np.roll(ring,-1,axis=0)):
  d=b-a;delta=points-a
  if d[1]!=0:inside^=((a[1]>q)!=(b[1]>q))&(p<a[0]+(q-a[1])*d[0]/d[1])
  t=np.clip(delta@d/(d@d),0.,1.)
  dist=np.minimum(dist,np.linalg.norm(delta-t[:,None]*d,axis=1))
 return inside|(dist<=.717)
def replay(row):
 name=row['owner']+'/'+str(row['row'])
 q=by[name]
 if len(q)<4:return 'too few clear fully-contained source supports',None,Counter()
 if not hasattr(local,'source'):local.source=H['open_models']()
 dsm,dtm,g,_=local.source;origin=np.array([g[0],g[3]])
 quads=np.array([x['input_dsm3979_edge_quad']for x in q]);ij=(quads-origin)*[1,-1]
 x0,y0=np.floor(ij.min(axis=(0,1))-2).astype(int);x1,y1=np.ceil(ij.max(axis=(0,1))+2).astype(int)
 if min(x0,y0)<0 or x1>=dsm.RasterXSize or y1>=dsm.RasterYSize:return 'outside native',None,Counter()
 s=dsm.ReadAsArray(int(x0),int(y0),int(x1-x0),int(y1-y0))
 t=dtm.ReadAsArray(int(x0),int(y0),int(x1-x0),int(y1-y0))
 Y,X=np.mgrid[y0:y1,x0:x1]+.5
 cells=np.stack([X.ravel(),Y.ravel()],axis=1)
 sr,tr=s.ravel(),t.ravel();valid=np.isfinite(sr)&np.isfinite(tr)&(sr>-200)&(tr>-200)
 checks=[];notes=Counter()
 for rowSample,ring in zip(q,ij):
  localMask=(cells[:,0]>=ring.min(0)[0]-.72)&(cells[:,0]<=ring.max(0)[0]+.72)&(cells[:,1]>=ring.min(0)[1]-.72)&(cells[:,1]<=ring.max(0)[1]+.72)
  i=np.flatnonzero(localMask);has=i[witness(cells[i],ring)]
  if not len(has)or not np.all(valid[has]):notes['native nodata']+=1;continue
  v=sr[has];h=v-tr[has];fraction=float((h>2.65).mean());spread=float(np.quantile(v,.9)-np.quantile(v,.1))
  if fraction<.975:notes['raw source footprint not elevated']+=1;continue
  if spread>4.1:notes['raw source footprint too vertically mixed']+=1;continue
  checks.append(dict(col=rowSample['col'],row=rowSample['row'],scene=rowSample['scene'],
    scl=5,rgb=rowSample['packedAtlasRGB'],inputUTMEPSG=rowSample['input_utm_epsg'],
    inputUTMEdgeQuad=rowSample['input_utm_2x2_cell_edge_quad'],nativeGroundSamples=int(len(has)),
    nativeRaisedFraction=round(fraction,6),nativeVerticalSpreadM=round(spread,5)))
 if len(checks)<4:return 'too few native supported source footprints',None,notes
 x=np.array([r['rgb']for r in checks]);median=np.median(x,axis=0)
 spread=float(np.quantile(abs(x-median).max(1),.85))
 if spread>23 or median[1]>max(median[0],median[2])*1.10:return 'noncoherent color',None,notes
 nat=hashlib.sha256(s.astype('<f4').tobytes()+t.astype('<f4').tobytes()).hexdigest()
 result={k:row[k]for k in ['owner','row','areaM2','centerLonLat']}
 result.update(sampledPixels=len(checks),rgb=median.tolist(),maxColorErr85=spread,
  nativeSha=nat,nativeWindow=[int(x0),int(y0),int(x1-x0),int(y1-y0)],samples=checks)
 return 'pass',result,notes
with ThreadPoolExecutor(max_workers=3) as ex:out=list(ex.map(replay,base['proofCases']))
result=[];exclusions=[];scan=Counter()
for state,q,_ in out:
 if state!='pass':continue
 name=q['owner']+'/'+str(q['row'])
 support=protected[name]
 if support['legacySourceSignedMinM']<=0 or support['nearestPaddedRunwayM']<=0:
  exclusions.append(dict(owner=q['owner'],row=q['row'],reason='Negative original signed Cover across actual full footprint.' if support['legacySourceSignedMinM']<=0 else 'Intersects runway protection.'))
 else:result.append(q)
for row in out:scan.update(row[2])
receipt=dict(sources=base['sources'],accepted=len(result),candidates=len(out),outcomes=Counter(x[0]for x in out),
 sourceOutletRejects=a0,nativeSupportRejects=scan,proofCases=result,
 dryExclusions=exclusions,limits='Scene SCL5 at the selected sample, actual 2x2 raw source-pixel ground support fully in original AEB roof plan, native DSM/DTM sites within each support + 0.717m native cell-centre guard.')
(a/'strict-release-roof-tone.json').write_text(json.dumps(receipt,separators=(',',':'))+'\n')
print(len(result),receipt['outcomes'],a0,scan,flush=True)
