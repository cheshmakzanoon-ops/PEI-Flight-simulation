"""Confirm each satellite tone comes from a raised surface, not a courtyard or yard."""
from pathlib import Path
import argparse,hashlib,json,math,runpy,threading
from concurrent.futures import ThreadPoolExecutor
from collections import Counter
import numpy as np
P=argparse.ArgumentParser(description=__doc__);P.add_argument('--root',type=Path,required=True);P.add_argument('--scratch',type=Path,required=True);arg=P.parse_args()
a=arg.scratch;s=json.loads((a/'2025-large-roof-tone-receipt.json').read_text())
i=json.loads((arg.root/'public/world/detail/index.json').read_text());n=i['tilePixels']
w,bt,e,t=i['bounds'];dx=(e-w)/(i['columns']*n);dy=(t-bt)/(i['rows']*n)
H=runpy.run_path(str(arg.root/'tools/qa/roof-fit-pilot.py'))
local=threading.local()
def replay(r):
 if not hasattr(local,'runtime'):local.runtime=H['open_models']()
 dsm,dtm,geo,proj=local.runtime
 coords=np.array(proj.TransformPoints([[w+(x+.5)*dx,t-(y+.5)*dy]for x,y,*_ in r['pixels']]))[:,:2]
 base=np.array([geo[0],geo[3]]);ij=(coords-base)*[1,-1]
 guard=15.1
 x0,y0=np.floor(ij.min(axis=0)-guard).astype(int);x1,y1=np.ceil(ij.max(axis=0)+guard).astype(int)
 if x0<0 or y0<0 or x1>=dsm.RasterXSize or y1>=dsm.RasterYSize:return r['owner'],r['row'],'out of native grid',None
 h=dsm.ReadAsArray(int(x0),int(y0),int(x1-x0),int(y1-y0));g=dtm.ReadAsArray(int(x0),int(y0),int(x1-x0),int(y1-y0))
 yl,xl=np.mgrid[y0:y1,x0:x1]+.5
 samples=[];fail=Counter()
 for (sx,sy),x in zip(ij,r['pixels']):
  q=np.square(xl-sx)+np.square(yl-sy)<=guard*guard
  above=h[q]-g[q];roof=h[q];ok=(np.isfinite(above)&np.isfinite(roof)&(h[q]>-200)&(g[q]>-200))
  if ok.sum()!=q.sum():fail['invalid native cell']+=1;continue
  cover=float((above>2.65).mean());spread=np.quantile(roof,.90)-np.quantile(roof,.10)
  if cover<.975:fail['native substrate not roof']+=1;continue
  if spread>4.1:fail['native height variable']+=1;continue
  samples.append([*x,round(cover,5),round(float(spread),4),int(q.sum())])
 if len(samples)<4:return r['owner'],r['row'],'<4 raised supported color cells',dict(fail)
 # Keep the original no-greying safety: if enough independent covered cells
 # have different tone, the newly held subset does not represent one roof hue.
 pix=np.array([q[3]for q in samples]);rgb=np.median(pix,axis=0)
 err=float(np.quantile(abs(pix-rgb).max(1),.85))
 if err>23 or rgb[1]>max(rgb[0],rgb[2])*1.10:return r['owner'],r['row'],'held hue non-uniform',dict(fail)
 q=hashlib.sha256(h.astype('<f4').tobytes()+g.astype('<f4').tobytes()).hexdigest()
 return r['owner'],r['row'],'pass',dict(owner=r['owner'],row=r['row'],areaM2=r['areaM2'],centerLonLat=r['centerLonLat'],
  sampledPixels=len(samples),bayExcluded=len(r['pixels'])-len(samples),rgb=rgb.tolist(),maxColorErr85=err,
  nativeWindow=[int(x0),int(y0),int(x1-x0),int(y1-y0)],nativeSha=q,nativeMinRaisedFraction=min(c[4]for c in samples),
  samples=samples,discardedConditions=dict(fail))
with ThreadPoolExecutor(max_workers=3) as ex:
    out=list(ex.map(replay,s['records']))
cases=[r for _,_,k,r in out if k=='pass']
report={'accepted':len(cases),'candidates':len(out),'outcomes':Counter(k for _,_,k,_ in out),'proofCases':cases,
 'sources':{'sentinel2025IndexSha':s['imageryIndexSha'],'atlasSha':s['atlasSha'],'nativeItem':H['ROOT']+'/'+H['ITEM']},
 'scope':'These data support approximate broad roof tone under known raised plans, not present-day paint or material classification.'}
(a/'verified-large-roof-tone-receipt.json').write_text(json.dumps(report,separators=(',',':'))+'\n')
print(report['accepted'],report['outcomes'],flush=True)
