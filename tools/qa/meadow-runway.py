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
 p=tmp/'src/render/world.ts';s=p.read_text()
 a='if(along>=0.&&along<=1.&&across>=0.&&across<=1.){vec2 u='
 r="if(along>=0.&&along<=1.&&across>=0.&&across<=1.){${meadow?'if(meadowStrength<-1.5){gl_FragColor=vec4(1.,0.,1.,1.);return;}':''}vec2 u="
 s=fixed.once(s,a,r).replace('if(abs(meadowStrength)>.001&&d<180.','if(meadowStrength>-1.5&&abs(meadowStrength)>.001&&d<180.')
 p.write_text(s)
 p=tmp/'src/main.ts';s=p.read_text()
 a='  renderer.render(scene,camera);'
 p.write_text(fixed.once(s,a,a+'''
  (window as any).meadowQA=()=>{
   const v=world.meadowStrength;
   const draw=()=>{renderer.render(scene,camera);return {b64:renderer.domElement.toDataURL(),draws:renderer.info.render.calls,tris:renderer.info.render.triangles};};
   v.value=0;const before=draw();v.value=1;const after=draw();v.value=-2;const mask=draw();
   v.value=0;const exact=before.b64===draw().b64;v.value=1;
   return {before,after,mask,exact,camera:camera.position.toArray()};
  };
 '''))
fixed.stage=stage
P={
 'cyyg-03':dict(lon=-63.12248266,lat=46.29490743,dist=35,east=.71,south=.70,h=0,agl=9),
 'cyyg-10':dict(lon=-63.1280,lat=46.2862,dist=44,east=-.72,south=.69,h=0,agl=12),
 'cysu-05':dict(lon=-63.8354,lat=46.4359,dist=42,east=.52,south=.84,h=0,agl=11),
}
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
  mask=(m[:,:,0]>230)&(m[:,:,1]<30)&(m[:,:,2]>230)
  d=np.max(np.abs(b-c),axis=2)
  x['pixels']={'runwayMarked':int(mask.sum()),'runwayChanged':int((d[mask]>0).sum()),'elsewhereOver2':int((d[~mask]>2).sum())}
  x['errors']=errors
  assert x['exact'] and x['before']==x['after'] and not errors and x['pixels']['runwayChanged']==0 and x['pixels']['runwayMarked']>100,x
  if 'high' in k:assert not d.max(),x
  out[k]=x;print(k,x,flush=True);pg.close()
  (args.out/'report.json').write_text(json.dumps(out,indent=2)+'\n')
fixed.capture=capture
p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True);p.add_argument('--views',default=','.join(P));p.add_argument('--checkout',type=Path,default=Path.cwd());p.add_argument('--deps',type=Path);args=p.parse_args()
args.pose_baseline=None;args.void_probe=False
fixed.run(args)
