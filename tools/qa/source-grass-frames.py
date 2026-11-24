"""Lock camera and atlas state to compare the same open grass terrain under stock and candidate shading."""
import argparse,importlib.util,base64
from pathlib import Path
spec=importlib.util.spec_from_file_location('fixed',Path(__file__).resolve().with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixed)
for name,lon,lat in [('prince',-64.1889149882,46.8410907946),('queens',-63.2103096260,46.1648021620),('kings',-62.6213298265,46.2127363332)]:
 fixed.VIEWS[f'grass-{name}']=dict(lon=lon,lat=lat,h=0.,east=.42,south=.91,nearDist=33.,nearAgl=12.)
fixed.VIEWS['grass-queens-pass']=dict(lon=-63.2103096260,lat=46.1648021620,h=0.,east=.42,south=.91,nearDist=126.,nearAgl=76.)
org=fixed.capture
class Browser:
 def __init__(self,b):self.b=b
 def new_context(self,**conf):
  c=self.b.new_context(**conf);new=c.new_page
  def make():
   page=new();goto=page.goto
   page.goto=lambda u,**opts:goto(u.replace('/?diagnostics&qa=', '/?diagnostics&'+('sourceGrassStudy&' if args.live else '')+'qa='),**opts)
   page.screenshot=lambda *a,**kw:canvas_screenshot(page,**kw)
   return page
  c.new_page=make
  return c
# In the temporary QA build, capture pixels immediately after rendering.
# This avoids an independent compositor screenshot while preserving the actual renderer.
stage0=fixed.stage
def stage(repo,root,deps,void):
 stage0(repo,root,deps,void)
 f=root/'src/main.ts';t=f.read_text()
 t=fixed.once(t,'renderer.render(scene,camera);', """renderer.render(scene,camera);
   if((window as any).qaRendererCapture===true){
    (window as any).qaRendererCapture=renderer.domElement.toDataURL("image/png");
   }""")
 f.write_text(t)
fixed.stage=stage
def canvas_screenshot(page,path,**unused):
 page.evaluate('window.qaRendererCapture=true')
 page.wait_for_function("typeof window.qaRendererCapture==='string'",timeout=180000,polling=500)
 raw=page.evaluate('window.qaRendererCapture')
 assert raw.startswith('data:image/png;base64,')
 Path(path).write_bytes(base64.b64decode(raw.split(',',1)[1]))
fixed.capture=lambda w,b,u:org(w,Browser(b),u)
default=fixed.settle
def settle(page,errors):
 if args.live:
  page.wait_for_function('window.islandAirDiagnostics?.provinceGrass?.active && window.islandAirDiagnostics.provinceGrass.ready>0')
  page.wait_for_timeout(1100)
 d=default(page,errors)
 assert d['detail']['retrying']==0
 if not args.live:assert not d['provinceGrass']
 return d
fixed.settle=settle
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--checkout',type=Path,required=True);p.add_argument('--deps',type=Path)
p.add_argument('--chromium',required=True);p.add_argument('--out',type=Path,required=True)
p.add_argument('--size',default='940x610')
p.add_argument('--views',default='grass-prince-close,grass-queens-close,grass-kings-close,grass-queens-pass-close')
p.add_argument('--live',action='store_true')
args=p.parse_args();args.pose_baseline=None;args.void_probe=False
fixed.run(args)
