"""Match the actual close-rendered material without changing terrain or flight."""
import argparse,importlib.util,math
from pathlib import Path
R=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('fixed',R/'fixed-scenery.py')
fixed=importlib.util.module_from_spec(s);s.loader.exec_module(fixed)
def view(eye,aim,height):
 x=(eye[0]-aim[0])*76766.24;z=(eye[1]-aim[1])*-111161.2
 return {'lon':aim[0],'lat':aim[1],'east':x,'south':z,'nearDist':math.hypot(x,z),'nearAgl':eye[2],'h':0,'fixedEyeY':eye[2],'fixedBaseH':height}
fixed.VIEWS.update({
 'gables-track-near':view((-63.381721,46.48828,24.6),(-63.38189,46.488411),13.3),
 'gables-track-long':view((-63.38310,46.48647,78),(-63.38189,46.488411),13.3),
})
prior=fixed.stage
def stage(repo,stage,deps,sky):
 prior(repo,stage,deps,sky)
 main=stage/'src/main.ts';t=main.read_text()
 t=fixed.once(t,'const diagnostic=','''(window as any).trackOrtho=()=>((world as any).tiles as any[]).filter(t=>t.status==='ready').map(t=>t.id).sort();
 (window as any).trackPhysical=()=>[[-63.3819114,46.4882988],[-63.3818888,46.4884252],[-63.3818595,46.4884939],[-63.381841,46.488413]].map(([lo,la])=>{
   const {x,z}=project(lo,la);return {contact:sceneSurface(x,z),visual:world.visualGroundHeight(x,z)};
 });
 const diagnostic=''')
 main.write_text(t)
fixed.stage=stage
prior_settle=fixed.settle
def settle(page,errors):
 d=prior_settle(page,errors)
 assert d['greenGablesReview'] and d['greenGablesBarnReview'] and d['gablesGravelReview']==a.live,d
 d['orthoIds']=page.evaluate('window.trackOrtho()')
 d['positions']=page.evaluate('window.trackPhysical()')
 return d
fixed.settle=settle
class Browser:
 def __init__(self,q):self.q=q
 def new_context(self,**opts):
  c=self.q.new_context(**opts);make=c.new_page
  def page():
   t=make();go=t.goto;flags='greenGablesReview&greenGablesBarnReview&gablesGradeReview&'
   if a.live:flags+='gablesGravelReview&'
   t.goto=lambda url,**kw:go(url.replace('/?diagnostics&qa=','/?diagnostics&'+flags+'qa='),**kw)
   return t
  c.new_page=page
  return c
take=fixed.capture
fixed.capture=lambda args,b,url:take(args,Browser(b),url)
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--checkout',type=Path,default=R.parents[1]);p.add_argument('--deps',type=Path)
p.add_argument('--chromium',required=True);p.add_argument('--out',type=Path,required=True)
p.add_argument('--size',default='840x540');p.add_argument('--views',default='gables-track-near-close,gables-track-long-close')
p.add_argument('--live',action='store_true');p.add_argument('--lock',type=Path)
a=p.parse_args();a.pose_baseline=a.lock;a.void_probe=False
fixed.run(a)
