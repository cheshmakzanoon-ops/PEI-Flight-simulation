#!/usr/bin/env python3
"""Actual matched simulator views and regular flight for the Summerside station preview."""
import argparse,base64,importlib.util,json,math
from pathlib import Path
from urllib.parse import quote
from PIL import Image
import numpy as np
m=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(m);m.loader.exec_module(fixed)
position=(-45170.597,12127.596)
r=math.pi/180; lat=46.5*r;a=6378137.;e2=6.69437999014e-3; t=1-e2*math.sin(lat)**2
lon=-63.2+position[0]/(a*r*math.cos(lat)/math.sqrt(t))
latitude=46.5-position[1]/(a*(1-e2)*r/t**1.5)
views={'street-quarter':dict(lon=lon,lat=latitude,dist=56,east=-.57,south=.829,h=10.,agl=12),
       'harbour-air':dict(lon=lon,lat=latitude,dist=112,east=.51,south=.86,h=13.,agl=68),
       'lod-far':dict(lon=lon,lat=latitude,dist=6600,east=.51,south=.86,h=12.,agl=1060)}
def capture(a,browser,url):
 results=[]
 for id in a.views.split(','):
  out={};pose=views[id]
  for on in [False,True]:
   k='candidate' if on else 'stock'
   ctx=browser.new_context(viewport={'width':520,'height':385},device_scale_factor=1)
   try:
    p=ctx.new_page();p.set_default_timeout(120000);errors=[]
    p.on('pageerror',lambda e:errors.append(str(e)));p.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
    p.goto(url+'/?buildingShadows&diagnostics'+('&summersideStationReview' if on else '')+'&qa='+quote(json.dumps(pose)),wait_until='domcontentloaded')
    if on and id!='lod-far':
     p.wait_for_function('window.islandAirDiagnostics?.summersideStation===true')
    d=fixed.settle(p,errors)
    assert bool(d['summersideStation'])==(on and id!='lod-far'),d
    assert not errors and not d['layerWarnings'],errors
    p.screenshot(path=str(a.out/f'{id}-{k}.png'),timeout=100000)
    out[k]={'station':d['summersideStation'],'draws':d['drawCalls'],'triangles':d['triangles'],'shadow':d['buildingShadows'],'stage':d['detail'],'layerWarnings':d['layerWarnings']}
   finally:ctx.close()
  u,v=[np.asarray(Image.open(a.out/f'{id}-{k}.png'))[:,:,:3].astype('i2') for k in ('stock','candidate')]
  dif=np.abs(u-v).max(axis=-1)
  out.update(view=id,pose=pose,pixels=dict(total=dif.size,changed=int((dif>1).sum()),significant=int((dif>8).sum())))
  results.append(out);(a.out/'report.json').write_text(json.dumps(results,indent=2)+'\n');print(id,out['pixels'],flush=True)
fixed.capture=capture
p=argparse.ArgumentParser();p.add_argument('--checkout',type=Path,required=True);p.add_argument('--deps',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True);p.add_argument('--views',default=','.join(views));p.set_defaults(void_probe=False)
fixed.run(p.parse_args())
