"""Model a late adjacent mask in the actual scene, with the real temporal fade."""
import argparse,base64,importlib.util,json
from pathlib import Path
from urllib.parse import quote
import numpy as np
from PIL import Image
P=Path(__file__).with_name('fixed-scenery.py')
spec=importlib.util.spec_from_file_location('fixed',P);f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
stage=f.stage
def add(repo,tmp,deps,v):
 stage(repo,tmp,deps,False)
 p=tmp/'src/render/dune-grass-authority.ts';s=p.read_text()
 a='   const wire=this.packet.slice(s.offset,s.offset+s.wire);'
 p.write_text(f.once(s,a,'''   if(s.tile[0]===17&&s.tile[1]===13){
    await new Promise<void>(resolve=>{(window as any).releaseLateGrass=resolve;});
   }
'''+a))
 p=tmp/'src/main.ts';s=p.read_text();a='  renderer.render(scene,camera);'
 p.write_text(f.once(s,a,a+'''
 const q=grassCoast as any,W=window as any;
 const a0=q?.rows?.get('17-12'),b0=q?.rows?.get('17-13');
 if(a0&&b0){
  W.lateGrassTrace??=[];
  if(W.lateGrassTrace.length<250)W.lateGrassTrace.push({
   a:a0.vars.duneTuftGroundGain.value,b:b0.vars.duneTuftGroundGain.value,
   northToSouth:a0.vars.duneTuftNeighbours.value.w,southToNorth:b0.vars.duneTuftNeighbours.value.z,
   delayed:!!b0.loading,now:performance.now()
  });
  W.lateGrassProof=()=>{
   const draw=()=>{renderer.render(scene,camera);return {png:renderer.domElement.toDataURL('image/png'),calls:renderer.info.render.calls};};
   const keep=Array.from(q.live as Set<any>,r=>[r,r.vars.duneTuftGroundGain.value] as const);
   const after=draw();
   for(const [r] of keep)r.vars.duneTuftGroundGain.value=0;
   const before=draw();
   for(const [r,v] of keep)r.vars.duneTuftGroundGain.value=v;
   const stable=after.png===draw().png;
   const x=11177.280833438388,z=9499.219884423117;
   const samples=[-12,-6,-1,0,1,6,12].map(dz=>{
    const py=world.visualGroundHeight(x,z+dz)+.018;
    const p=new THREE.Vector3(x,py,z+dz).project(camera);
    return [dz,Math.round((p.x*.5+.5)*(innerWidth-1)),Math.round((.5-p.y*.5)*(innerHeight-1))];
   });
   return {after,before,stable,samples};
  };
 }
 '''))
f.stage=add
pose=dict(lon=-63.05439156793934,lat=46.414545454545454,dist=26,east=.70,south=.714,agl=18,h=0)
def capture(args,browser,url):
 pg=browser.new_page(viewport={'width':460,'height':338});err=[]
 pg.on('pageerror',lambda x:err.append(str(x)));pg.on('console',lambda m:err.append(m.text)if m.type=='error'else None)
 pg.set_default_timeout(100000)
 pg.goto(url+'/?diagnostics&duneGrassSurface&qa='+quote(json.dumps(pose)),wait_until='domcontentloaded')
 f.settle(pg,err);pg.wait_for_function("window.releaseLateGrass&&window.lateGrassTrace?.some(q=>q.a>.99&&q.b===0&&q.delayed)")
 def get(label):
  j=pg.evaluate('window.lateGrassProof()')
  im=[]
  for k in ('before','after'):
   file=args.out/(label+'-'+k+'.png');file.write_bytes(base64.b64decode(j[k].pop('png').split(',')[1]))
   im.append(np.asarray(Image.open(file).convert('RGB')).astype(np.int16))
  d=abs(im[1]-im[0]).max(2)
  j['observed']=[]
  for dz,x,y in j.pop('samples'):
   if 1<=x<459 and 1<=y<337:j['observed'].append([dz,int(d[y-1:y+2,x-1:x+2].max())])
  return j
 cold=get('late');pg.evaluate('window.releaseLateGrass()')
 pg.wait_for_function('window.lateGrassTrace?.some(q=>q.a>.99&&q.b>.99)')
 hot=get('both')
 frames=pg.evaluate('window.lateGrassTrace')
 seen=[q for q in frames if q['a']>.5 or q['b']>.5]
 assert seen and all(abs(q['northToSouth']-q['b'])<1e-8 and (q['b']==0 or abs(q['southToNorth']-q['a'])<1e-8) for q in seen),seen
 assert not err and cold['stable'] and hot['stable']
 assert cold['before']['calls']==cold['after']['calls'] and hot['before']['calls']==hot['after']['calls']
 assert max((v for dz,v in cold['observed']if dz>=1),default=-1)==0,cold
 assert max((v for dz,v in hot['observed']if dz>=1),default=-1)>1,hot
 out={'posed':pose,'delayed':cold,'bothResident':hot,'framesObserved':len(frames),
       'zeroBoundaryDuringDelay':True,'blendingFrames':sum(0<q['b']<.99 for q in frames),'errors':err}
 print(out,flush=True);(args.out/'report.json').write_text(json.dumps(out,indent=2)+'\n')
f.capture=capture
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--out',type=Path,required=True);p.add_argument('--checkout',type=Path,required=True)
p.add_argument('--chromium',required=True);p.add_argument('--deps',type=Path)
a=p.parse_args();a.void_probe=False;a.pose_baseline=None;a.size='460x338';f.run(a)
