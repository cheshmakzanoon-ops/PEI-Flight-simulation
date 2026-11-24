"""Matched actual terrain renderer with the existing House and Dunelands active."""
import argparse,importlib.util,json,math
from pathlib import Path
R=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('fixed',R/'fixed-scenery.py')
fixed=importlib.util.module_from_spec(s);s.loader.exec_module(fixed)
def pose(eye,look,y):
 x=(eye[0]-look[0])*76766.24;z=(eye[1]-look[1])*-111161.2
 return {'lon':look[0],'lat':look[1],'east':x,'south':z,'nearDist':math.hypot(x,z),'nearAgl':eye[2],'h':0,'fixedEyeY':eye[2],'fixedBaseH':y}
fixed.VIEWS.update({
 'gables-grade-low':pose((-63.38327,46.48663,27.2),(-63.38259,46.48724),15.18),
 'gables-grade-wide':pose((-63.38372,46.48572,85.),(-63.3824,46.48746),15.05),
})
orig=fixed.stage
def stage(repo,root,nodeps,probe):
 orig(repo,root,nodeps,probe)
 f=root/'src/main.ts';text=f.read_text()
 text=fixed.once(text,'const diagnostic=', '''(window as any).gradeQA=(coords:[number,number][])=>coords.map(([lo,la])=>{
   const {x,z}=project(lo,la);
   return {viz:world.visualGroundHeight(x,z), physical:world.surface(x,z), flight:sceneSurface(x,z)};
 });
 (window as any).gradeOrthos=()=>((world as any).tiles as any[]).filter(t=>t.status==='ready').map(t=>t.id).sort();
 const diagnostic=''')
 f.write_text(text)
fixed.stage=stage
settle_before=fixed.settle
def settle(page,errors):
 result=settle_before(page,errors)
 expected=a.mode=='live'
 assert bool(result['localGroundGrade'])==expected,result
 assert result['greenGablesReview'] and result['cavendishWaterCore'],result
 result['orthos']=page.evaluate('window.gradeOrthos()')
 result['gradeRequests']=page.evaluate("performance.getEntriesByType('resource').filter(r=>r.name.endsWith('native-grade.g11.gz')).length")
 assert result['gradeRequests']==int(a.mode!='stock'),result
 result['controlWitnesses']=page.evaluate("p=>window.gradeQA(p)",witness)
 assert all(v['flight']==v['physical'] for v in result['controlWitnesses'])
 return result
fixed.settle=settle
class Browser:
 def __init__(self,x):self.x=x
 def new_context(self,**opts):
  c=self.x.new_context(**opts);old=c.new_page
  def new_page():
   page=old();go=page.goto
   if a.mode=='bad':page.route('**/native-grade.g11.gz',lambda r:r.fulfill(status=200,body=b'Malformed native grade test.'))
   page.goto=lambda u,**opts:go(u.replace('/?diagnostics&qa=','/?diagnostics&greenGablesReview&cavendishWaterReview&'+
                              ('gablesGradeReview&'if a.mode!='stock' else '')+'qa='),**opts)
   return page
  c.new_page=new_page
  return c
capture=fixed.capture
fixed.capture=lambda args,b,url:capture(args,Browser(b),url)
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--checkout',type=Path,default=R.parents[1]);p.add_argument('--deps',type=Path)
p.add_argument('--chromium',required=True);p.add_argument('--out',type=Path,required=True)
p.add_argument('--size',default='844x528');p.add_argument('--views',default='gables-grade-low-close,gables-grade-wide-close')
p.add_argument('--mode',choices=('stock','live','bad'),required=True)
p.add_argument('--lock',type=Path);p.add_argument('--witness',type=Path,required=True)
a=p.parse_args();a.pose_baseline=a.lock;a.void_probe=False
witness=json.loads(a.witness.read_text())
fixed.run(a)
