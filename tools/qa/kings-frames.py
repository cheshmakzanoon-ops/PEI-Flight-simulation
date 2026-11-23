"""Actual textured 4×MSAA roofs with fixed camera and the same streamed rows."""
import argparse,base64,importlib.util,json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('fixed',ROOT/'tools/qa/fixed-scenery.py')
f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
f.VIEWS={
 'morell':dict(lon=-62.70933265,lat=46.415669,h=6.1,east=.69,south=.72,nearDist=125,nearAgl=89,owner='q12312'),
 'souris':dict(lon=-62.25219097,lat=46.35408038,h=7.1,east=.54,south=.84,nearDist=132,nearAgl=92,owner='q130331'),
 'montague':dict(lon=-62.64890325,lat=46.16668150,h=6.9,east=.69,south=.72,nearDist=54,nearAgl=43,owner='q103301')
}
old=f.stage
def stage(repo,root,deps,void):
 old(repo,root,deps,False)
 w=root/'src/render/world.ts';s=w.read_text()
 s=f.once(s,'const vertex=`','const roofReviewTiles=new Set<string>(JSON.parse(new URLSearchParams(location.search).get(\'qa\')!).tiles);\nconst vertex=`')
 w.write_text(f.once(s,'Math.hypot(pos.x-q.x0-q.w/2,pos.z-q.z0-q.d/2)<14500','roofReviewTiles.has(q.id)'))
 m=root/'src/main.ts';s=m.read_text()
 s=f.once(s,'const diagnostic=', '''(window as any).roofView=()=>({
     tiles:(world as any).tiles.filter((t:any)=>t.status==='ready').map((t:any)=>t.id).sort(),
     owners:[...((buildings as any)?.meshes.keys()??[])].sort(),
     samples:renderer.getContext().getParameter(renderer.getContext().SAMPLES)});
   let captureRoof:((s:string)=>void)|undefined;
   (window as any).roofPNG=()=>new Promise<string>(r=>{captureRoof=r;});
   const diagnostic=''')
 m.write_text(f.once(s,'  renderer.render(scene,camera);','  renderer.render(scene,camera);\n  if(captureRoof){const q=captureRoof;captureRoof=undefined;q(renderer.domElement.toDataURL());}'))
f.stage=stage
prev=f.settle
def settle(page,errors):
 page.wait_for_function("""()=>{const q=JSON.parse(new URLSearchParams(location.search).get('qa'));const a=window.islandAirDiagnostics;const s=window.roofView?.();return s?.owners.includes(q.owner)&&s?.tiles.join('|')===q.tiles.join('|')&&a?.buildingTiles?.pending===0&&a.buildingTiles.loading===0&&a.buildingTiles.failed===0}""")
 v=prev(page,errors);v.update(page.evaluate('window.roofView()'))
 return v
f.settle=settle
oldCapture=f.capture
class CanvasSnapshot:
 def __init__(self,b):self.b=b
 def new_context(self,**kw):
  c=self.b.new_context(**kw);original=c.new_page
  def new_page():
   p=original()
   def shot(path,timeout):
    b=base64.b64decode(p.evaluate('()=>window.roofPNG()').split(',',1)[1]);Path(path).write_bytes(b);return b
   p.screenshot=shot;return p
  c.new_page=new_page;return c
def capture(a,b,u): return oldCapture(a,CanvasSnapshot(b),u)
f.capture=capture
p=argparse.ArgumentParser();p.add_argument('--checkout',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
p.add_argument('--chromium',required=True);p.add_argument('--pose-baseline',type=Path)
p.add_argument('--poses',type=Path,help='Use this published geographic pose set instead.')
p.add_argument('--views',help='Comma-separated entries with -close or -approach; defaults to all named close views.')
a=p.parse_args();a.size='740x470';a.deps=None;a.void_probe=False
if a.poses:f.VIEWS=json.loads(a.poses.read_text())
if not a.views:a.views=','.join(name+'-close' for name in f.VIEWS)
index=json.loads((ROOT/'public/world/detail/index.json').read_text())
west,south,east,north=index['bounds']; cols,rows=index['columns'],index['rows']
for v in f.VIEWS.values():
 i,j=math.floor((v['lon']-west)/(east-west)*cols),math.floor((north-v['lat'])/(north-south)*rows)
 v['tiles']=sorted((t for t in index['tiles'] if all(abs(int(k)-m)<2 for k,m in zip(t.split('-'),(i,j)))))
f.run(a)
