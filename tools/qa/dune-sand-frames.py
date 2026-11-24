#!/usr/bin/env python3
"""Same-scene renderer gate for authenticated experimental sand material."""
import argparse,base64,importlib.util,json
from pathlib import Path
from urllib.parse import quote
import numpy as np
from PIL import Image,ImageFilter
S=Path(__file__).with_name('fixed-scenery.py')
spec=importlib.util.spec_from_file_location('fixed',S)
fixed=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixed)
stage0=fixed.stage
def stage(repo,tmp,deps,_):
 stage0(repo,tmp,deps,False)
 p=tmp/'src/render/dune-sand.ts';s=p.read_text()
 a='  vec4 a=textureGrad(duneMacro,local/15.0,dX/15.0,dY/15.0);'
 p.write_text(fixed.once(s,a,'  if(duneResident>1.5){col=vec3(15.,0.,15.);return;}\n'+a))
 p=tmp/'src/main.ts';s=p.read_text()
 a='  renderer.render(scene,camera);'
 p.write_text(fixed.once(s,a,a+'''
  (window as any).duneCapture=()=>{
   const rows=Array.from(duneSand?.rows.values()??[]).filter(r=>r.uniforms.duneResident.value===1);
   const draw=()=>{renderer.render(scene,camera);return {img:renderer.domElement.toDataURL('image/png'),draws:renderer.info.render.calls,tris:renderer.info.render.triangles};};
   const use=(n:number)=>{for(const r of rows)r.uniforms.duneResident.value=n;};
   use(0);const before=draw();use(1);const after=draw();use(2);const mask=draw();
   use(0);const returns=before.img===draw().img;use(1);return {before,after,mask,returns,active:rows.map(r=>r.stamp.tile)};
  };
 '''))
fixed.stage=stage
V={
'prince':dict(lon=-63.94210616105072,lat=46.70280613944216,dist=26,east=.22,south=.975,h=0,agl=10),
'queens':dict(lon=-63.45853729679512,lat=46.50723409870771,dist=26,east=.18,south=.99,h=0,agl=12),
'kings':dict(lon=-62.059027515357116,lat=46.468416557044,dist=25,east=.33,south=.944,h=0,agl=11),
'high':dict(lon=-63.45853729679512,lat=46.50723409870771,dist=135,east=.18,south=.99,h=0,agl=245),
}
def capture(args,browser,url):
 out={}
 for name in args.views.split(','):
  pose=V[name];w,h=460,338
  pg=browser.new_page(viewport={'width':w,'height':h});err=[];reads=[]
  pg.on('pageerror',lambda e:err.append(str(e)));pg.on('console',lambda e:err.append(e.text)if e.type=='error'else None)
  pg.on('request',lambda r:reads.append(r.url.rsplit('/',1)[-1])if '/dune-sand/v1/' in r.url else None)
  pg.set_default_timeout(105000)
  pg.goto(url+'/?diagnostics&qa='+quote(json.dumps(pose)),wait_until='domcontentloaded')
  fixed.settle(pg,err)
  if name!='high':
   pg.wait_for_function('window.islandAirDiagnostics?.duneSand?.approved===true')
   pg.wait_for_function('window.islandAirDiagnostics?.duneSand?.active.length>0')
  q=pg.evaluate('window.duneCapture()')
  px={}
  for label in ('before','after','mask'):
   path=args.out/(name+'-'+label+'.png');path.write_bytes(base64.b64decode(q[label].pop('img').split(',')[1]))
   px[label]=np.asarray(Image.open(path).convert('RGB')).astype(np.int16)
  d=np.abs(px['after']-px['before']).max(2)
  match=np.any(px['before']!=px['mask'],axis=2)
  support=np.asarray(Image.fromarray(np.uint8(match)*255).filter(ImageFilter.MaxFilter(5)))>0
  report={'width':w,'height':h,'exactExterior':int((~support).sum()),'changesExterior':int(np.count_nonzero(d[~support])),
   'activeDeltaGT2':int((d>2).sum()),'maxRGBChange':int(d.max()),'poses':pose,'metrics':q,'requests':reads,'errors':err}
  print(name,report,flush=True);out[name]=report
  (args.out/'report.json').write_text(json.dumps(out,indent=2)+'\n')
  assert q['returns'] and q['before']==q['after'] and not err and report['changesExterior']==0,report
  if name!='high':assert report['activeDeltaGT2']>600,report
  else:assert not d.max() and not q['active'] and not reads and not pg.evaluate('window.islandAirDiagnostics?.duneSand?.approved'),report
  pg.close()
fixed.capture=capture
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True)
p.add_argument('--views',default=','.join(V));p.add_argument('--checkout',type=Path,required=True);p.add_argument('--deps',type=Path)
a=p.parse_args();a.pose_baseline=None;a.void_probe=False;a.size='460x338';fixed.run(a)
