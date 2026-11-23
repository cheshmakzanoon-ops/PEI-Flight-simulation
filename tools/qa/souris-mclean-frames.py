#!/usr/bin/env python3
"""Capture actual Three frames of 95 Main Street with optional matched streaming."""
import argparse,importlib.util,json,base64
from pathlib import Path
D=Path(__file__).resolve().parent
repo=D.parents[1]
spec=importlib.util.spec_from_file_location('raw',repo/'tools/qa/fixed-scenery.py');q=importlib.util.module_from_spec(spec);spec.loader.exec_module(q)
q.VIEWS.update({'mclean-shopfront': {'lon': -62.253396401092765,
                      'lat': 46.354704281583565,
                      'east': -4.42663892466993,
                      'south': 18.501965141014136,
                      'nearDist': 19.024138515283816,
                      'nearAgl': 17.3,
                      'h': 8.6,
                      'fixedEyeY': 17.3,
                      'fixedBaseH': 15.86},
 'mclean-cornice': {'lon': -62.25339376132065,
                    'lat': 46.3547102355695,
                    'east': 11.075124954685174,
                    'south': 23.48032189995374,
                    'nearDist': 25.961200074097835,
                    'nearAgl': 20.9,
                    'h': 12.0,
                    'fixedEyeY': 20.9,
                    'fixedBaseH': 15.86},
 'mclean-roofs': {'lon': -62.253346588679,
                  'lat': 46.35478025116936,
                  'east': 5.286964072195017,
                  'south': 45.080878882649344,
                  'nearDist': 45.389840602636845,
                  'nearAgl': 38.2,
                  'h': 15.0,
                  'fixedEyeY': 38.2,
                  'fixedBaseH': 15.86},
 'mclean-context': {'lon': -62.253346588679,
                    'lat': 46.35478025116936,
                    'east': 11.326220188742758,
                    'south': 75.90878288163816,
                    'nearDist': 76.74911453779494,
                    'nearAgl': 57.0,
                    'h': 13.4,
                    'fixedEyeY': 57.0,
                    'fixedBaseH': 15.86},
 'mclean-west': {'lon': -62.25339470972538,
                 'lat': 46.35471416007534,
                 'east': -23.096538118560993,
                 'south': 15.44543593553046,
                 'nearDist': 27.785096082265337,
                 'nearAgl': 18.65,
                 'h': 9.4,
                 'fixedEyeY': 18.65,
                 'fixedBaseH': 15.86}})
F=q.stage
def stage(repo,root,deps,void):
 F(repo,root,deps,void)
 # Avoid dispatch-frame timing deciding which legitimate atlas assets
 # reach the renderer during this fixed comparison. Both renders use the
 # same observed ready set, still through the actual tile loader/shader.
 tiles=['26-12','26-13','26-14','26-15','27-12','27-13','27-14','28-12','28-13','28-14','29-12','29-13']
 w=root/'src/render/world.ts';source=w.read_text()
 source=q.once(source,'const vertex=`','const fixedReviewDetail=new Set('+json.dumps(tiles)+');\nconst vertex=`')
 w.write_text(q.once(source,'Math.hypot(pos.x-q.x0-q.w/2,pos.z-q.z0-q.d/2)<14500','fixedReviewDetail.has(q.id)'))

 p=root/'src/main.ts';s=p.read_text()
 k='const diagnostic='
 s=q.once(s,k,'''(window as any).macroView=()=>({
       ready:[...(world as any).tiles].filter(t=>t.status==='ready').map(t=>t.id).sort(),
       rowOwner:!!(buildings as any)?.meshes.has('q130331'),
       radio:renderer.getContext().getParameter(renderer.getContext().SAMPLES)
    });
    let viewPNG:((p:string)=>void)|undefined;
    (window as any).renderPNG=()=>new Promise<string>(r=>{viewPNG=r;});
    '''+k)
 k='  renderer.render(scene,camera);'
 s=q.once(s,k,k+'''\n  if(viewPNG){const r=viewPNG;viewPNG=undefined;r(renderer.domElement.toDataURL('image/png'));}''')
 p.write_text(s)
q.stage=stage
F1=q.settle
def settle(page,err):
 page.wait_for_function('window.macroView?.().rowOwner')
 expected=['26-12','26-13','26-14','26-15','27-12','27-13','27-14','28-12','28-13','28-14','29-12','29-13']
 if a.streaming:
  site=page.evaluate("JSON.parse(new URLSearchParams(location.search).get('qa')).site")
  m=next(r['diag']['ready'] for r in json.loads(a.streaming.read_text()) if r['name']==site+'-close')
  assert m==expected,(site,m,expected)
 page.wait_for_function('(ids)=>JSON.stringify(window.macroView().ready)===JSON.stringify(ids)',arg=expected)
 v=F1(page,err);v.update(page.evaluate('window.macroView()'))
 return v
q.settle=settle
F2=q.capture
class Browser:
 def __init__(self,b):self.b=b
 def new_context(self,**kwargs):
  c=self.b.new_context(**kwargs);base=c.new_page
  def new_page():
   p=base()
   def shot(path,timeout):
    b=base64.b64decode(p.evaluate('()=>window.renderPNG()').split(',',1)[1]);Path(path).write_bytes(b);return b
   p.screenshot=shot
   return p
  c.new_page=new_page;return c
def capture(a,b,u):return F2(a,Browser(b),u)
q.capture=capture
p=argparse.ArgumentParser(description='Inspect the exact Souris heritage site with fixed Three.js production cameras.')
p.add_argument('--checkout',type=Path,default=repo);p.add_argument('--out',type=Path,required=True)
p.add_argument('--streaming',type=Path);p.add_argument('--pose-baseline',type=Path);p.add_argument('--views',default='mclean-shopfront-close,mclean-cornice-close,mclean-roofs-close,mclean-context-close')
p.add_argument('--size',default='1100x684');p.add_argument('--deps',type=Path)
p.add_argument('--chromium',required=True)
a=p.parse_args();a.void_probe=False
if a.pose_baseline and not a.streaming:a.streaming=a.pose_baseline
q.run(a)
