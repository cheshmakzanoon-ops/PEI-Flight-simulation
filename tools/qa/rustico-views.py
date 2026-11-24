"""Actual WebGL North Rustico comparisons. Fixed cameras are QA-only."""
import argparse,importlib.util,math
from pathlib import Path
p=Path(__file__).resolve().with_name('fixed-scenery.py')
q=importlib.util.spec_from_file_location('fixed',p)
fixed=importlib.util.module_from_spec(q);q.loader.exec_module(fixed)
def shot(x,z,y,look):
 return dict(lon=-63.291964738182266,lat=46.45530404141915,east=x,south=z,
  nearDist=math.hypot(x,z),nearAgl=y,h=0,fixedEyeY=y,fixedBaseH=look)
fixed.VIEWS.update({
 'rustico-sash':shot(-15,7,5.25,7.5),
 'rustico-gallery':shot(16,-17,8.2,8.1),
 'rustico-seaward':shot(105,28,75.9,8.8),
})
orig=fixed.capture
class Browser:
 def __init__(self,b):self.b=b
 def new_context(self,**conf):
  c=self.b.new_context(**conf);fn=c.new_page
  def newpage():
   p=fn();goto=p.goto
   p.goto=lambda u,**opts:goto(u.replace('/?diagnostics&qa=', '/?diagnostics&'+('northRusticoLighthouseStudy&'if args.preview else '')+'qa='),**opts)
   return p
  c.new_page=newpage
  return c
fixed.capture=lambda opts,b,url:orig(opts,Browser(b),url)
settle=fixed.settle
def settled(page,errors):
 d=settle(page,errors);v=d.get('northRusticoLighthouse')
 if args.preview:assert v and v['seat']=='verified' and v['visible']
 else:assert v is None
 return d
fixed.settle=settled
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--checkout',type=Path,required=True);p.add_argument('--deps',type=Path)
p.add_argument('--chromium',required=True);p.add_argument('--out',type=Path,required=True)
p.add_argument('--size',default='1100x740');p.add_argument('--views',default='rustico-sash-close,rustico-gallery-close,rustico-seaward-close')
p.add_argument('--preview',action='store_true')
args=p.parse_args();args.pose_baseline=None;args.void_probe=False
fixed.run(args)
