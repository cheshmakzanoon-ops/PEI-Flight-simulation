"""Actual stock-versus-grass surface renderer plus no-resource high control."""
import argparse,base64,importlib.util,json
from pathlib import Path
from urllib.parse import quote
import numpy as np
from PIL import Image,ImageFilter
P=Path(__file__).with_name('fixed-scenery.py')
sp=importlib.util.spec_from_file_location('fixed',P);f=importlib.util.module_from_spec(sp);sp.loader.exec_module(f)
stage=f.stage
def add(repo,tmp,deps,v):
 stage(repo,tmp,deps,False)
 p=tmp/'src/render/dune-grass-surface.ts';s=p.read_text()
 p.write_text(f.once(s,'  if(w<.001)return;','  if(w<.001)return;\n  if(duneTuftGroundGain>1.5){ col=vec3(13.,0.,13.);return; }'))
 p=tmp/'src/main.ts';s=p.read_text()
 a='  renderer.render(scene,camera);'
 p.write_text(f.once(s,a,a+'''
 (window as any).grassProof=()=>{
  if(!grassCoast)return;
  const rows=Array.from((grassCoast as any).live as Set<any>);
  const valid=rows.filter(r=>r.vars.duneTuftGroundGain.value>.99);
  const draw=()=>{renderer.render(scene,camera);return {img:renderer.domElement.toDataURL('image/png'),draws:renderer.info.render.calls,tris:renderer.info.render.triangles};};
  const keep=rows.map(r=>r.vars.duneTuftGroundGain.value);
  for(const r of rows)r.vars.duneTuftGroundGain.value=0;
  const before=draw();
  rows.forEach((r,i)=>{r.vars.duneTuftGroundGain.value=keep[i];});
  const after=draw();
  rows.forEach((r,i)=>{r.vars.duneTuftGroundGain.value=keep[i]>.001?2:0;});
  const mask=draw();
  rows.forEach(r=>{r.vars.duneTuftGroundGain.value=0;});
  const stable=before.img===draw().img;
  rows.forEach((r,i)=>{r.vars.duneTuftGroundGain.value=keep[i];});
  const targetX=91395.46250157194,targetZ=4195.924931199628;
  const samples=[-16,-12,-8,-4,-1,-.10,0,.2,1,4].map(dx=>{
    const x=targetX+dx,z=targetZ,y=world.visualGroundHeight(x,z)+.018;
    const q=new THREE.Vector3(x,y,z).project(camera);
    return {dx,pixel:[Math.round((q.x*.5+.5)*(innerWidth-1)),Math.round((.5-q.y*.5)*(innerHeight-1))]};
  });
  const row=valid.find(r=>r.s.tile[0]===30&&r.s.tile[1]===12);
  return {before,after,mask,stable,tiles:valid.map(r=>r.s.tile),samples,protectedEast:row?.vars.duneTuftNeighbours?.value.y??null};
 };
 (window as any).grassReady=()=>Array.from(((grassCoast as any)?.live??new Set()) as Set<any>).some(r=>r.vars.duneTuftGroundGain.value>.999);
 '''))
f.stage=add
V={
 'east-edge':dict(lon=-62.009375,lat=46.46225365218,dist=21,east=-.22,south=.976,agl=16.,h=0),
}
def capture(args,browser,url):
 out={}
 for name in args.views.split(','):
  w,h=460,338;pg=browser.new_page(viewport={'width':w,'height':h});err=[];reads=[];pg.set_default_timeout(90000)
  pg.on('pageerror',lambda e:err.append(str(e)));pg.on('console',lambda e:err.append(e.text)if e.type=='error'else None)
  pg.on('request',lambda r:reads.append(r.url.split('/')[-1])if '/dune-grass/v1/' in r.url else None)
  pg.goto(url+'/?diagnostics&duneGrassSurface&qa='+quote(json.dumps(V[name])),wait_until='domcontentloaded')
  f.settle(pg,err)
  pg.wait_for_function('window.islandAirDiagnostics?.grassCoast?.authorized')
  if name!='high':pg.wait_for_function('window.grassReady?.()')
  q=pg.evaluate('window.grassProof()');assert not err
  p={}
  for key in ('before','after','mask'):
   file=args.out/(name+'-'+key+'.png');file.write_bytes(base64.b64decode(q[key].pop('img').split(',')[1]))
   p[key]=np.asarray(Image.open(file).convert('RGB')).astype(np.int16)
  d=np.abs(p['after']-p['before']).max(2);mask=np.abs(p['mask']-p['before']).max(2)>0
  extent=np.asarray(Image.fromarray(np.uint8(mask)*255).filter(ImageFilter.MaxFilter(5)))>0
  q['diff']={'over2':int((d>2).sum()),'outside':int((d[~extent]>0).sum()),'protected':int((~extent).sum())}
  q['requests']=reads;q['errors']=err;q['pose']=V[name];out[name]=q
  (args.out/'report.json').write_text(json.dumps(out,indent=2)+'\n');print(name,q,flush=True)
  for r in q['samples']:
   x,y=r['pixel'];assert 1<=x<w-1 and 1<=y<h-1,r
   r['pixelDelta']=int(d[y,x]);r['nearbyMax']=int(d[y-1:y+2,x-1:x+2].max())
  assert q['protectedEast']==0 and not q['diff']['outside'] and q['stable'] and q['before']==q['after']
  assert all(r['nearbyMax']==0 for r in q['samples'] if r['dx']>=1.)
  assert max(r['nearbyMax'] for r in q['samples'] if r['dx']<=-8)>2, q
  (args.out/'report.json').write_text(json.dumps(out,indent=2)+'\n')

  if name=='high':assert not reads and not q['tiles'] and not d.max()
  else:assert q['tiles'] and q['diff']['over2']>100 and sorted(reads)==['authority.pack','sparse-grass-photometric.png']
  pg.close()
f.capture=capture
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--out',type=Path,required=True);p.add_argument('--checkout',type=Path,required=True);p.add_argument('--deps',type=Path)
p.add_argument('--chromium',required=True);p.add_argument('--views',default=','.join(V))
a=p.parse_args();a.void_probe=False;a.pose_baseline=None;a.size='460x338';f.run(a)
