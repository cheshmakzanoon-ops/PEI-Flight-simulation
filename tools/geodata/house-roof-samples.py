#!/usr/bin/env python3
"""Acquire exact small co-registered DSM/DTM windows for independent residential-roof fitting."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from osgeo import gdal,osr
from collections import defaultdict,Counter
import numpy as np
import argparse,json,math,threading,runpy,sys,time
gdal.UseExceptions()
ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--root',type=Path,default=Path('.'));ap.add_argument('--scratch',type=Path,required=True);ap.add_argument('--max-groups',type=int,default=139);ap.add_argument('--jobs',type=int,default=4);ap.add_argument('--all-groups',action='store_true',help='read every spatial group of an already capped candidate sample')
cfg=ap.parse_args();p=cfg.scratch
if not 1<=cfg.jobs<=6:ap.error('Use one to six workers')
O=runpy.run_path(str(cfg.root/'tools/qa/roof-fit-pilot.py'))
dsm,dtm,gt,T=O['open_models']()
print('Native storage',dsm.GetRasterBand(1).GetBlockSize(),dsm.GetRasterBand(1).GetNoDataValue(),gt,flush=True)
V=np.array([1,-1]);h=threading.local()
rows=json.loads((p/'candidate-shells.json').read_text())
D=defaultdict(list);seen=set()
for c in rows:
    r=np.array(T.TransformPoints(c['fp']))[:,:2];xy=r.mean(axis=0)
    u=(xy-np.array([gt[0],gt[3]]))*V
    D[tuple(np.floor(u/512).astype(int))].append(c)
    c.update(survey=r.tolist(),xy=xy.tolist())
print('Distinct block groups',len(D),{k:sum(k[0] in [q['county'][0] for q in v]for v in D.values())for k in ['PRINCE','QUEENS','KINGS']},flush=True)
# Contiguous residential rows first in the three identified districts.
# A dispersed stratum separately reaches all three counties outside the larger towns.
groups=defaultdict(list)
for block,rows in D.items():
    k=Counter(c['city'] for c in rows).most_common(1)[0][0]
    groups[k].append((block,rows))
def score(pair):
    _,r=pair
    return (len(r)+.22*sum(bool(c.get('osmMatch',{}).get('tags',{}).get('roof:shape')) for c in r)+.12*sum(c['h']>6 for c in r))
L=[]
for city in ('Summerside','Montague','Charlottetown'):
    L.extend(sorted(groups[city],key=score,reverse=True)[:min(24,max(2,cfg.max_groups//5))])
outside=defaultdict(list)
for block,rows in groups['other']:
    c=max(rows,key=lambda a:a['area'])
    bucket=(int(c['world'][0]//7600),int(c['world'][1]//9500))
    outside[bucket].append((block,rows))
for r in outside.values():r.sort(key=score,reverse=True)
while any(outside.values()):
    for r in outside.values():
        if r:L.append(r.pop(0))
if cfg.max_groups<=0:sys.exit(0)
L=sorted(D.items()) if cfg.all_groups else L[:cfg.max_groups]
print('Selected',sum(len(g)for _,g in L),len(L),Counter(c['county']for _,g in L for c in g),flush=True)
P=p/'windows';P.mkdir(exist_ok=True)
def window(B):
    block,features=B
    filename=P/('group-%04d-%04d.npz'%block)
    existing={}
    if filename.exists():
        with np.load(filename) as cache:existing={k:cache[k] for k in cache.files}
        expected={f"{c['tile']}_{c['i']}_{s}" for c in features for s in ('surface','ground','origin')}
        if expected.issubset(existing):return (len(features),0.)
    start=time.monotonic()
    if not hasattr(h,'models'):h.models=O['open_models']()
    dsm,dtm,gt,T=h.models
    named=existing
    for c in features:
        x,y=np.array(c['survey']).T
        a,b=math.floor(x.min()-gt[0])-4,math.floor(gt[3]-y.max())-4
        w,q=math.ceil(x.max()-gt[0])+4-a,math.ceil(gt[3]-y.min())+4-b
        prefix=f"{c['tile']}_{c['i']}"
        if prefix+'_origin' in named:continue
        asm=dsm.ReadAsArray(a,b,w,q);atm=dtm.ReadAsArray(a,b,w,q)
        named[prefix+'_surface']=asm;named[prefix+'_ground']=atm
        named[prefix+'_origin']=np.array([gt[0]+a+.5,gt[3]-b-.5])
    np.savez_compressed(filename,**named)
    return len(features),time.monotonic()-start
with ThreadPoolExecutor(max_workers=cfg.jobs) as pool:
    for i,((b,c),(n,t)) in enumerate(zip(L,pool.map(window,L))):
        count=Counter(f['county']for f in c)
        if i<10 or i%10==9:print(i,b,n,round(t,2),dict(count),flush=True)
(p/'sample-plan.json').write_text(json.dumps([c for b,g in L for c in g],separators=(',',':'))+'\n')
