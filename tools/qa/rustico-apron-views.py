"""Actual WebGL North Rustico comparisons. Fixed cameras are QA-only."""
import argparse,importlib.util,base64,math
from pathlib import Path
p=Path(__file__).resolve().with_name('fixed-scenery.py')
q=importlib.util.spec_from_file_location('fixed',p)
fixed=importlib.util.module_from_spec(q);q.loader.exec_module(fixed)
def shot(x,z,y,look):
 return dict(lon=-63.291964738182266,lat=46.45530404141915,east=x,south=z,
  nearDist=math.hypot(x,z),nearAgl=y,h=0,fixedEyeY=y,fixedBaseH=look)
fixed.VIEWS.update({
 'rustico-apron-low':shot(-15,7,5.25,7.5),
 'rustico-apron-pass':shot(105,28,75.9,8.8),
})
orig=fixed.capture
class Browser:
 def __init__(self,b):self.b=b
 def new_context(self,**conf):
  c=self.b.new_context(**conf);fn=c.new_page
  def newpage():
   p=fn();goto=p.goto
   p.goto=lambda u,**opts:goto(u.replace('/?diagnostics&qa=', '/?diagnostics&'+('northRusticoLighthouseStudy&'+(''if args.preview else 'legacyRusticoSoil&'))+'qa='),**opts)
   p.screenshot=lambda *a,**kw:canvas_screenshot(p,**kw)
   return p
  c.new_page=newpage
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
fixed.capture=lambda opts,b,url:orig(opts,Browser(b),url)
settle=fixed.settle
def settled(page,errors):
 d=settle(page,errors);v=d.get('northRusticoLighthouse');assert v and v['seat']=='verified'
 assert bool(d['rusticoDrySoil'])==args.preview,d
 return d
fixed.settle=settled
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--checkout',type=Path,required=True);p.add_argument('--deps',type=Path)
p.add_argument('--chromium',required=True);p.add_argument('--out',type=Path,required=True)
p.add_argument('--size',default='1100x740');p.add_argument('--views',default='rustico-apron-low-close,rustico-apron-pass-close')
p.add_argument('--preview',action='store_true')
args=p.parse_args();args.pose_baseline=None;args.void_probe=False
fixed.run(args)
