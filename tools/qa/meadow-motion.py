import argparse,base64,importlib.util,json
from pathlib import Path
from urllib.parse import quote
from PIL import Image,ImageFilter
import numpy as np
spec=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixed)
orig=fixed.stage
def stage(repo,tmp,deps,_):
 orig(repo,tmp,deps,False)
 p=tmp/'src/render/meadow-optics.ts'
 s=p.read_text().replace('if(meadowStrength<.001||','if(meadowStrength>=0.&&meadowStrength<.001||').replace('float weight=meadowStrength*','float weight=abs(meadowStrength)*').replace('if(weight<.002)return;','if(weight<.002)return;\n  if(meadowStrength<0.){ground=vec3(7.,0.,7.);return;}')
 p.write_text(s)
 p=tmp/'src/main.ts';s=p.read_text()
 a='  renderer.render(scene,camera);'
 p.write_text(fixed.once(s,a,a+'''
  (window as any).meadowQA=()=>{
   const v=world.meadowStrength;
   const draw=()=>{renderer.render(scene,camera);return {b64:renderer.domElement.toDataURL(),draws:renderer.info.render.calls,tris:renderer.info.render.triangles};};
   v.value=0;const before=draw();v.value=1;const after=draw();v.value=-1;const mask=draw();
   v.value=0;const exact=before.b64===draw().b64;v.value=1;
   return {before,after,mask,exact,camera:camera.position.toArray()};
  };
 '''))
fixed.stage=stage
P={
 'prince':dict(lon=-64.1055,lat=46.44,dist=41,east=.66,south=.76,h=0,agl=13),
 'queens':dict(lon=-63.36145,lat=46.25,dist=56,east=-.66,south=.76,h=0,agl=16),
 'kings':dict(lon=-62.2494,lat=46.4188,dist=38,east=.66,south=-.76,h=0,agl=11),
 'queens-high':dict(lon=-63.36145,lat=46.25,dist=62,east=-.66,south=.76,h=0,agl=355)
}
for i,d in enumerate((40.65,41.,41.35,41.70)):
 P[f"prince-step-{i}"]=dict(P["prince"],dist=d)

def capture(args,browser,url):
 out={}
 for k in args.views.split(','):
  pg=browser.new_page(viewport={'width':870,'height':530});errors=[]
  pg.on('pageerror',lambda e:errors.append(str(e)));pg.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
  pg.set_default_timeout(120000)
  pg.goto(url+'/?diagnostics&meadowTexture&qa='+quote(json.dumps(P[k])),wait_until='domcontentloaded')
  pg.wait_for_function('()=>window.reviewCamera?.frame>12 && window.islandAirDiagnostics?.detail?.ready>0 && window.islandAirDiagnostics.detail.loading===0')
  x=pg.evaluate('window.meadowQA()');a=[]
  for label in ('before','after','mask'):
   path=args.out/(k+'-'+label+'.png');path.write_bytes(base64.b64decode(x[label].pop('b64').split(',')[1]))
   a.append(np.asarray(Image.open(path).convert('RGB')).astype(int))
  b,c,m=a
  match=np.any(m!=b,axis=2);mask=np.asarray(Image.fromarray(np.uint8(match)*255).filter(ImageFilter.MaxFilter(3)))>0
  d=np.max(np.abs(b-c),axis=2)
  x['pixels']={'over2':int((d>2).sum()),'offmask':int((d[~mask]>0).sum()),'max':int(d.max())}
  x['errors']=errors
  assert x['exact'] and x['before']==x['after'] and not errors and x['pixels']['offmask']==0,x
  if 'high' in k:assert not d.max(),x
  out[k]=x;print(k,x,flush=True);pg.close()
  (args.out/'report.json').write_text(json.dumps(out,indent=2)+'\n')
fixed.capture=capture
p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True);p.add_argument('--views',default=','.join(P));p.add_argument('--checkout',type=Path,default=Path.cwd());p.add_argument('--deps',type=Path);args=p.parse_args()
args.pose_baseline=None;args.void_probe=False
fixed.run(args)
