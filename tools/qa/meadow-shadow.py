import argparse,base64,importlib.util,json
from pathlib import Path
from urllib.parse import quote
from PIL import Image
import numpy as np
ref=Path(__file__).with_name('fixed-scenery.py')
s=importlib.util.spec_from_file_location('fixed',ref);f=importlib.util.module_from_spec(s);s.loader.exec_module(f)
old=f.stage
def stage(repo,tmp,deps,_):
 old(repo,tmp,deps,False)
 p=tmp/'src/render/world.ts';x=p.read_text()
 a=' readonly meadowStrength={value:1};'
 x=f.once(x,a,a+'\n readonly meadowShadowQA={value:0};')
 x=f.once(x,'showMeadow?{meadowStrength:this.meadowStrength,meadowTileGuard:', 'showMeadow?{meadowStrength:this.meadowStrength,meadowShadowQA:this.meadowShadowQA,meadowTileGuard:')
 a="(meadow?meadowGLSL:'')"
 x=f.once(x,a,"(meadow?meadowGLSL+'uniform float meadowShadowQA;\\n':'')")
 a=' col*=mix(vec3(1.),vec3(.69,.74,.81),castShade*(.39+.61*light));'
 x=f.once(x,a,"${meadow?'if(meadowShadowQA>.5){gl_FragColor=vec4(vec3(castShade),1.);return;}':''}\n"+a)
 p.write_text(x)
 p=tmp/'src/main.ts';x=p.read_text();a='  renderer.render(scene,camera);'
 x=f.once(x,a,a+'''
  (window as any).meadowShadowProbe=()=>{
   const value=world.meadowStrength,marker=world.meadowShadowQA;
   const shadows=world.buildingShadows!.uniforms.localCastLive;
   const snap=()=>{renderer.render(scene,camera);return {bytes:renderer.domElement.toDataURL(),draws:renderer.info.render.calls,n:renderer.info.render.triangles};};
   marker.value=1;value.value=0;const before=snap();
   value.value=1;const after=snap();const old=shadows.value;shadows.value=0;
   const noCast=snap();shadows.value=old;marker.value=0;
   return {before,after,noCast,state:world.buildingShadows!.state};
  };
 ''')
 p.write_text(x)
f.stage=stage
def capture(a,browser,url):
 ran={}
 for n,pose in {
  'prince':dict(lon=-64.1055,lat=46.44,dist=41,east=.66,south=.76,h=0,agl=13),
  'kings':dict(lon=-62.2494,lat=46.4188,dist=38,east=.66,south=-.76,h=0,agl=11)
 }.items():
  page=browser.new_page(viewport={'width':790,'height':510});errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
  page.set_default_timeout(110000)
  page.goto(url+'/?buildingShadows&meadowTexture&diagnostics&qa='+quote(json.dumps(pose)))
  page.wait_for_function('()=>window.reviewCamera?.frame>14&&window.islandAirDiagnostics?.buildingShadows?.active')
  x=page.evaluate('window.meadowShadowProbe()')
  ar=[]
  for k in ['before','after','noCast']:
   fn=a.out/(n+'-'+k+'.png');fn.write_bytes(base64.b64decode(x[k].pop('bytes').split(',',1)[1]));ar.append(np.asarray(Image.open(fn).convert('RGB')).astype(int))
  b,c,d=ar
  assert x['before']==x['after'] and not errors and np.array_equal(b,c),[x,errors]
  x['visibleCastProofPixels']=int(np.any(b!=d,axis=2).sum())
  x['allShadowProofPixelsExact']=int(np.all(b==c,axis=2).sum())
  if n=='prince':assert x['visibleCastProofPixels']>10,x
  ran[n]=x;print(n,x,flush=True);page.close()
 (a.out/'report.json').write_text(json.dumps(ran,indent=2)+'\n')
f.capture=capture
p=argparse.ArgumentParser();p.add_argument('--checkout',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True);a=p.parse_args();a.deps=None;a.void_probe=False
f.run(a)
