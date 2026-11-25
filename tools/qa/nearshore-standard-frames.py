#!/usr/bin/env python3
"""Matched Standard frames for the source-bounded nearshore material."""
import argparse,base64,importlib.util,json,math
from pathlib import Path
from urllib.parse import quote
from PIL import Image,ImageFilter
import numpy as np

fn=Path(__file__).with_name('fixed-scenery.py')
sp=importlib.util.spec_from_file_location('fixed',fn)
fixed=importlib.util.module_from_spec(sp);sp.loader.exec_module(fixed)
old=fixed.stage

def stage(repo,root,deps,void):
 old(repo,root,deps,void)
 p=root/'src/render/nearshore-foam.ts';s=p.read_text()
 s=fixed.once(s,'float gain=nearshoreLocalGain*detailWeight*frame.y','float gain=abs(nearshoreLocalGain)*detailWeight*frame.y')
 s=fixed.once(s,'experiment&&nearshoreLocalGain>0.','experiment&&abs(nearshoreLocalGain)>0.')
 s=fixed.once(s,'    if(gain>0.){','    if(gain>0.){\n     if(nearshoreLocalGain<0.)return 7.;')
 p.write_text(s)
 p=root/'src/main.ts';s=p.read_text();a='  renderer.render(scene,camera);'
 s=fixed.once(s,a,a+'''
  (window as any).nearshoreStandardQA=(clock:number)=>{
   const v=world.nearshoreLocalGain,t=(world as any).t;
   const prev=v.value,last=t.value;t.value=clock;
   const shot=()=>{
    renderer.render(scene,camera);
    return {image:renderer.domElement.toDataURL(),draws:renderer.info.render.calls,tris:renderer.info.render.triangles};
   };
   v.value=0;const base=shot();
   v.value=1;const detail=shot();
   v.value=-1;const marker=shot();
   v.value=0;const exact=base.image===shot().image;
   t.value=last;v.value=prev;
   return {base,detail,marker,exact,armed:world.nearshoreFoamArmed,mode:world.nearshoreFoamMode.value,pixelGate:world.nearshoreMediumPixelGate.value};
  };''')
 p.write_text(s)
fixed.stage=stage

metricX=76762.59317717304;metricZ=111161.08375388647
def pose(q):
 a,b,c=q['aim'];d,e,f=q['eye'];return dict(lon=-63.2+a/metricX,lat=46.5-c/metricZ,
   dist=math.hypot(d-a,f-c),east=d-a,south=f-c,fixedEyeY=e,fixedBaseH=b,agl=40,h=0)

def capture(a,browser,url):
 source=json.loads((a.checkout/'docs/qa/nearshore-foam-study-fixture.json').read_text())
 pos={r['id']:r for r in source['poses']};out={}
 for name in a.views.split(','):
  pg=browser.new_page(viewport={'width':a.width,'height':round(a.width*.7)})
  pg.set_default_timeout(125000);errors=[]
  pg.on('pageerror',lambda e:errors.append(str(e)))
  pg.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
  pg.goto(url+'/?diagnostics&qa='+quote(json.dumps(pose(pos[name]))),wait_until='domcontentloaded')
  # Resolve all relevant inputs. The paired scope test itself checks mesh
  # counts on the same frame; unrelated per-tile streaming further away
  # need not reach a global three-poll draw-count plateau.
  requirements="window.reviewCamera?.frame>21 && window.islandAirDiagnostics?.roads && window.islandAirDiagnostics?.buildings && window.islandAirDiagnostics?.mainland && window.islandAirDiagnostics?.detail?.ready>0 && window.islandAirDiagnostics.detail.loading===0"
  pg.wait_for_function(requirements,timeout=150000)
  assert not errors and not pg.evaluate('window.islandAirDiagnostics.layerWarnings'),errors
  rows=[]
  for idx,t in enumerate([6.,6.47,7.08]):
   q=pg.evaluate('t=>window.nearshoreStandardQA(t)',t)
   im=[]
   for suffix in ['base','detail','marker']:
    f=a.out/f'{name}-{idx}-{suffix}.png'
    f.write_bytes(base64.b64decode(q[suffix].pop('image').split(',',1)[1]))
    im.append(np.array(Image.open(f).convert('RGB'),dtype=np.int16))
   assert (q['armed'],q['mode'],q['pixelGate'])==(True,2,1), (name,q['armed'],q['mode'],q['pixelGate'])
   assert q['exact'] and q['base']==q['detail'] and not errors,(name,q,errors)
   base,detail,tag=im
   support=(tag!=base).any(2)
   guard=np.asarray(Image.fromarray(support.astype('u1')*255).filter(ImageFilter.MaxFilter(3)))>0
   diff=np.abs(detail-base).max(2)
   assert not (diff[~guard]>0).any(),(name,idx,int((diff[~guard]>0).sum()))
   rows.append(dict(clock=t,marked=int(support.sum()),protected=int((~guard).sum()),
                    changedAbove2=int((diff>2).sum()),maxRGB=int(diff.max()),stats=q['base']))
  pg.close()
  if pos[name]['case']=='open':assert all(q['changedAbove2']>0 for q in rows),(name,rows)
  else:assert all(q['maxRGB']==0 for q in rows),(name,rows)
  out[name]=rows
  (a.out/'standard-nearshore.json').write_text(json.dumps(out,indent=2)+'\n')
  print(name,rows,flush=True)
fixed.capture=capture
pa=argparse.ArgumentParser(description=__doc__)
pa.add_argument('--checkout',type=Path,required=True);pa.add_argument('--deps',type=Path)
pa.add_argument('--out',type=Path,required=True);pa.add_argument('--chromium',required=True)
pa.add_argument('--width',type=int,default=1120)
pa.add_argument('--views',default='prince-close,kings-close,author-basin,author-queens')
pa.set_defaults(void_probe=False)
fixed.run(pa.parse_args())
