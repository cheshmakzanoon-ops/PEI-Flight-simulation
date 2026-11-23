"""Sun, ground contact and cladding A/B held at the actual Souris building."""
import argparse,base64,gzip,importlib.util,json,os
from pathlib import Path
from urllib.parse import quote
s=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(s);s.loader.exec_module(fixed);base_stage=fixed.stage
poses={
 'souris-low':dict(lon=-62.242203,lat=46.346414,dist=182,east=155,south=95,fixedEyeY=43,fixedBaseH=25,h=0,agl=0),
 'souris-near':dict(lon=-62.242192,lat=46.346397,dist=109,east=75,south=79,fixedEyeY=30,fixedBaseH=22,h=0,agl=0),
 'souris-high':dict(lon=-62.242203,lat=46.346414,dist=265,east=-110,south=241,fixedEyeY=115,fixedBaseH=25,h=0,agl=0),
}
def stage(repo,root,deps,void_probe):
 base_stage(repo,root,deps,void_probe)
 main=root/'src/main.ts'
 main.write_text(fixed.once(main.read_text(),'renderer.render(scene,camera);','''
   renderer.render(scene,camera);
   (window as any).sourisPair=()=>{
     const before=sourisLighting?.active.value??0;
     const pair=[];
     for(const mode of before?[0,1]:[0]){
       if(sourisLighting)sourisLighting.active.value=mode;renderer.render(scene,camera);
       const check=[[73518,17066],[73537,17081],[73710,17199],[74500,18290]].map(([x,z])=>world.surface(x,z));
       pair.push({img:renderer.domElement.toDataURL('image/png'),calls:renderer.info.render.calls,tris:renderer.info.render.triangles,surface:check});
     }
     if(sourisLighting)sourisLighting.active.value=before;
     return pair;
   };
 '''))
def capture(args,browser,url):
 reports=[]
 for name in args.views.split(','):
  ctx=browser.new_context(viewport=dict(width=1000,height=600),device_scale_factor=1)
  try:
   page=ctx.new_page();page.set_default_timeout(90000);errors=[];requested=[]
   route='**/world/lighting/v1/souris-daylight-fields.gz'
   def fail(r):
    requested.append(r.request.url)
    if args.fault=='missing':
     r.fulfill(status=404,body='not installed')
    elif args.fault=='corrupt':
     source=args.checkout/'public/world/lighting/v1/souris-daylight-fields.gz'
     content=bytearray(gzip.decompress(source.read_bytes()));content[17]^=16
     r.fulfill(status=200,content_type='application/gzip',body=gzip.compress(content,mtime=0))
    else:r.continue_()
   page.route(route,fail)
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.on('console',lambda m:errors.append(m.text) if m.type=='error' and 'souris-daylight-fields.gz' not in m.location.get('url','') else None)
   page.goto(url+'/?diagnostics&qa='+quote(json.dumps(poses[name])),wait_until='domcontentloaded')
   d=fixed.settle(page,errors)
   if args.fault=='none':
    page.wait_for_function('window.islandAirDiagnostics?.sourisLighting==="souris-daylight-contact-v2"')
   else:
    assert page.evaluate('window.islandAirDiagnostics.sourisLighting') is None
   items=[];versions=('baseline','daylight') if args.fault=='none' else ('fallback',)
   for item,version in zip(page.evaluate('window.sourisPair()'),versions,strict=True):
    img=item.pop('img').split(',',1)[1]
    (args.out/f'{name}-{version}.png').write_bytes(base64.b64decode(img))
    items.append(item)
   if len(items)==2:assert items[0]==items[1],items
   assert len(requested)==1,requested
   reports.append({'pose':name,'coordinates':poses[name],'draw':items[-1],'detail':d['detail'],'fault':args.fault,'packRequests':len(requested)})
   print(json.dumps(reports[-1]),flush=True)
   (args.out/'report.json').write_text(json.dumps(reports,indent=2)+'\n')
  finally:ctx.close()
fixed.stage=stage;fixed.capture=capture
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--checkout',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',default=os.getenv('CHROMIUM','chromium'))
p.add_argument('--deps',type=Path);p.add_argument('--views',default=','.join(poses))
p.add_argument('--fault',choices=('none','missing','corrupt'),default='none');p.set_defaults(void_probe=False)
fixed.run(p.parse_args())
