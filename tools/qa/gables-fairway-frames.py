"""Match valid, missing and distant fairway appearance against stock terrain."""
import argparse,importlib.util,math
from pathlib import Path
R=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('fixed',R/'fixed-scenery.py')
fixed=importlib.util.module_from_spec(s);s.loader.exec_module(fixed)
def view(eye,aim,height):
 x=(eye[0]-aim[0])*76766.24;z=(eye[1]-aim[1])*-111161.2
 return {'lon':aim[0],'lat':aim[1],'east':x,'south':z,'nearDist':math.hypot(x,z),'nearAgl':eye[2],'h':0,'fixedEyeY':eye[2],'fixedBaseH':height}
fixed.VIEWS.update({
 'gables-fairway-near':view((-63.38327,46.48663,27.2),(-63.38255,46.48724),15.18),
 'gables-fairway-long':view((-63.38610,46.48347,493),(-63.38257,46.4872),15.1),
})
prior=fixed.stage
def stage(repo,stage,deps,sky):
 prior(repo,stage,deps,sky)
 main=stage/'src/main.ts';t=main.read_text()
 t=fixed.once(t,'const diagnostic=','''(window as any).trackOrtho=()=>((world as any).tiles as any[]).filter(t=>t.status==='ready').map(t=>t.id).sort();
 (window as any).trackPhysical=()=>[[-63.38261,46.48715],[-63.38258,46.48726],[-63.38244,46.48736],[-63.38205,46.48780]].map(([lo,la])=>{
   const {x,z}=project(lo,la);return {contact:sceneSurface(x,z),visual:world.visualGroundHeight(x,z)};
 });
 const diagnostic=''')
 main.write_text(t)
fixed.stage=stage
prior_settle=fixed.settle
def settle(page,errors):
 d=prior_settle(page,errors)
 assert d['greenGablesReview'] and d['greenGablesBarnReview'] and d['gablesFairwayReview']==(a.mode=='live'),d
 d['fairwayRequests']=page.evaluate("performance.getEntriesByType('resource').filter(u=>u.name.endsWith('fairway-ground.r8.gz')).length")
 assert d['fairwayRequests']==int(a.mode!='stock'),d
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
   if a.mode!='stock':flags+='gablesFairwayReview&'
   if a.mode=='bad':t.route('**/fairway-ground.r8.gz',lambda r:r.fulfill(status=200,body=b'Invalid fairway review archive.'))
   t.goto=lambda url,**kw:go(url.replace('/?diagnostics&qa=','/?diagnostics&'+flags+'qa='),**kw)
   return t
  c.new_page=page
  return c
take=fixed.capture
fixed.capture=lambda args,b,url:take(args,Browser(b),url)
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--checkout',type=Path,default=R.parents[1]);p.add_argument('--deps',type=Path)
p.add_argument('--chromium',required=True);p.add_argument('--out',type=Path,required=True)
p.add_argument('--size',default='840x540');p.add_argument('--views',default='gables-fairway-near-close,gables-fairway-long-close')
p.add_argument('--mode',required=True,choices=('stock','live','bad'));p.add_argument('--lock',type=Path)
a=p.parse_args();a.pose_baseline=a.lock;a.void_probe=False
fixed.run(a)
