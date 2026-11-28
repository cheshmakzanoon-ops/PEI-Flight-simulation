#!/usr/bin/env python3
"""Compile the actual player in isolation and compare both rendered variants in real moving Chase."""
from pathlib import Path
from threading import Thread
from io import BytesIO
import argparse,base64,functools,hashlib,http.server,json,subprocess,sys,tempfile
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--checkout',type=Path,default=Path.cwd())
p.add_argument('--corridors',type=Path,required=True,help='Two preregistered same-camera positive distances and one exact late distance')
p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
def stage(checkout,corridors,root):
 def once(s,a,b):
  if s.count(a)!=1:raise ValueError('Review changed QA anchor: '+a)
  return s.replace(a,b,1)
 subprocess.run([sys.executable,str(checkout/'tools/qa/inland-aerial-joins-fixture.py'),
    '--checkout',str(checkout),'--corridors',str(corridors),'--out',str(root)],check=True)
 f=root/'src/render/orthophoto-seams.ts';s=f.read_text()
 s=once(s,'uniform float orthoRowsGain;', 'uniform float orthoRowsGain,qaOrthoID;')
 s=once(s,'col=mix(col,canonical,w*orthoRowsGain);',
    'col=qaOrthoID>0.&&w>.000001?(qaOrthoID<1.5?vec3(.98,.01,.72):vec3(.02,.87,.07)):mix(col,canonical,w*orthoRowsGain);')
 s=once(s,"custom['orthoRowsGain'+suffix]=pair.gain;", "custom['orthoRowsGain'+suffix]=pair.gain;custom['qaOrthoID'+suffix]={value:0};")
 s=once(s,'orthoRowsGain:pair.gain};','orthoRowsGain:pair.gain,qaOrthoID:{value:0}};')
 s=once(s,".replaceAll('orthoRowsGain','orthoRowsGain'+suffix):text;",
    ".replaceAll('orthoRowsGain','orthoRowsGain'+suffix).replaceAll('qaOrthoID','qaOrthoID'+suffix):text;")
 f.write_text(s)
 f=root/'src/main.ts';s=f.read_text()
 anchor="  if(world.tryonRockState==='pending'"
 ts="""
  (window as any).shotLiveOrtho=(first:string,second:string)=>{
   if(ui.mode!=='flight')throw Error('not ordinary flight');
   const q=(ortho as any)?.pairs?.find((p:any)=>p.plan.first===first&&p.plan.second===second);
   if(!q||q.gain.value!==1)throw Error('source strip is not resident');
   const u=(world as any).tiles.filter((t:any)=>t.id===first||t.id===second)
    .flatMap((t:any)=>Object.entries(t.local.uniforms)
     .filter(([k,v])=>k.startsWith('orthoRowsGain')&&v===q.gain)
     .map(([k])=>t.local.uniforms['qaOrthoID'+k.slice('orthoRowsGain'.length)]));
   if(u.length!==2||u.some((x:any)=>!x||x.value!==0))throw Error('take both idle lanes exactly');
   const g=renderer.getContext();
   const snap=()=>{
    const end=world.beginRegularNorthRimDraw?.(camera);
    try{
     renderer.render(scene,camera);
     return {image:renderer.domElement.toDataURL('image/png'),draws:renderer.info.render.calls,tris:renderer.info.render.triangles};
    }finally{end?.();}
   };
   try{
    const art=snap();q.gain.value=0;const old=snap();q.gain.value=1;
    u.forEach((x:any)=>x.value=1);const a=snap();
    u.forEach((x:any)=>x.value=2);const b=snap();
    u.forEach((x:any)=>x.value=0);const restore=snap();
    return {art,old,a,b,restore:restore.image===art.image,samples:g.getParameter(g.SAMPLES),
       err:g.getError(),p:[f.x,f.y,f.z],eye:camera.position.toArray()};
   }finally{q.gain.value=1;u.forEach((x:any)=>x.value=0);}
  };

"""
 f.write_text(once(s,anchor,'\n'+ts+anchor))
 with (root.parent/'build.log').open('w') as log:
  subprocess.run(['npm','run','build'],cwd=root,stdout=log,stderr=subprocess.STDOUT,check=True)
 return root/'dist'

def run(dist,corridors,chromium,out_dir):
 srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(dist)))
 Thread(target=srv.serve_forever,daemon=True).start()
 def pixels(d):
  q=base64.b64decode(d.pop('image').split(',',1)[1]);return np.asarray(Image.open(BytesIO(q)).convert('RGBA'),dtype=np.int16),q
 event="""q=>{
   const s=window.islandAirDiagnostics,x0=s.x,z0=s.z,step=q.offsets;
   const n=q.heading*Math.PI/180,dx=Math.sin(n),dz=-Math.cos(n);
   window.motionQA={frames:[],error:null,start:[x0,z0]};
   let i=0;
   function sample(){
    const d=window.islandAirDiagnostics,c=window.motionQA;
    try {
     const dist=d?((d.x-x0)*dx+(d.z-z0)*dz):null;
     c.last={dist,site:d?.site,frame:d?.frame,x:d?.x,y:d?.altitude,z:d?.z,status:d?.status,mode:d?.mode,camera:d?.camera,hidden:document.hidden};
     if(d?.mode==='flight'&&d?.camera==='Chase'){
      if(dist>=step[i]){
       if(!window.shotLiveOrtho)throw Error('QA anchor unavailable');
       const row=window.shotLiveOrtho(...q.owners);
       row.fromLaunch=dist;row.cross=Math.abs((d.x-x0)*dz-(d.z-z0)*dx);
       c.frames.push(row);i++;
      }
     }
     if(i<step.length)requestAnimationFrame(sample);
    }catch(e){c.error=String(e);}
   }
   requestAnimationFrame(sample);
  }"""
 out={}
 try:
  with sync_playwright() as w:
   br=w.chromium.launch(executable_path=chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
   for q in json.loads(corridors.read_text()):
    n=q['name']; pair=' / '.join(q['owners']); ctx=br.new_context(viewport={'width':840,'height':540},device_scale_factor=1)
    pg=ctx.new_page();pg.set_default_timeout(145000);errors=[]
    pg.on('pageerror',lambda e:errors.append(str(e)))
    pg.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
    try:
     go=pg.goto(f'http://127.0.0.1:{srv.server_port}/?diagnostics&departure=qa-{n}',wait_until='domcontentloaded');assert go.status==200
     print(n,"opened",flush=True)
     pg.wait_for_function("id=>window.islandAirDiagnostics?.mode==='dispatch'&&window.islandAirDiagnostics.site===id",arg='qa-'+n)
     pg.wait_for_function("edge=>window.islandAirDiagnostics?.orthophotoSeams?.find(o=>o.edge===edge)?.gain===1",arg=pair,polling=250)
     print(n,"dispatch and signed donors ready",flush=True)
     pg.evaluate(event,q)
     pg.get_by_role('button',name='Begin flight').click()
     pg.wait_for_function("window.islandAirDiagnostics?.mode==='flight'",timeout=30000,polling=100)
     print(n,'launched',pg.evaluate("()=>({last:window.motionQA.last,site:islandAirDiagnostics.site,status:islandAirDiagnostics.status})"),flush=True)
     out[n]=[]
     for i in range(len(q['offsets'])):
      try:
       pg.wait_for_function("n=>window.motionQA.error||window.motionQA.frames.length>=n",arg=i+1,polling=250,timeout=250000)
      except Exception:
       print(n,'timeout',pg.evaluate('()=>({error:motionQA?.error,last:motionQA?.last,frames:motionQA?.frames.length,scene:window.islandAirDiagnostics})'),flush=True)
       raise
      collected=pg.evaluate('i=>({error:motionQA.error,v:motionQA.frames[i],last:motionQA.last})',i)
      assert not collected['error'] and not errors,(n,collected.get('error'),collected.get('last'),errors)
      v=collected['v']
      names=('old','art','a','b');result=[pixels(v[k]) for k in names]
      (old,oldraw),(art,artraw),(ma,_),(mb,_)=result
      d=np.max(abs(old[:,:,:3]-art[:,:,:3]),axis=2);m=np.any(ma[:,:,:3]!=mb[:,:,:3],axis=2)
      row=dict(n=i,flightAlongM=v['fromLaunch'],flightCrossM=v['cross'],pos=v['p'],eye=v['eye'],samples=v['samples'],
        error=v['err'],changed=int(np.count_nonzero(d)),strong=int(np.count_nonzero(d>2)),
        alpha=int(np.count_nonzero(old[:,:,3]!=art[:,:,3])),
        outside=int(np.count_nonzero(d[~m])),marker=int(np.count_nonzero(m)),render=[v[k] for k in names],
        exactRollback=v['restore'],stockSha256=hashlib.sha256(oldraw).hexdigest(),joinedSha256=hashlib.sha256(artraw).hexdigest())
      out[n].append(row);(out_dir/'report.json').write_text(json.dumps(out,indent=2)+'\n')
      print(n,json.dumps(row),flush=True)
      for k,blob in [('stock',oldraw),('joined',artraw)]: (out_dir/f'{n}-{i}-{k}.png').write_bytes(blob)
      assert row['samples']==4 and row['error']==row['alpha']==row['outside']==0 and row['exactRollback'],row
      assert row['render'].count(row['render'][0])==4 and 0<=row['flightCrossM']<15,row
      assert 0<=row['flightAlongM']-q['offsets'][i]<=15,row
      assert row['strong']>=500 if i<2 else row['changed']==0,row
     final=pg.evaluate('window.islandAirDiagnostics')
     pg.keyboard.press('v');pg.wait_for_function("window.islandAirDiagnostics?.camera==='Cockpit'")
     pg.keyboard.press('Escape');pg.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
     assert not final['layerWarnings'] and not errors
     (out_dir/f'{n}-controls.json').write_text(json.dumps(dict(cockpitAndPause=True,site=final['site']),indent=2)+'\n')
    finally:ctx.close()
   br.close()
 finally:srv.shutdown()

if __name__=='__main__':
 a=p.parse_args();repo=a.checkout.resolve();out=a.out.resolve();corridors=a.corridors.resolve()
 if out==repo or repo in out.parents:p.error('Choose an unused output folder outside the real checkout.')
 qs=json.loads(corridors.read_text())
 if not qs or not all(q.get('offsets') and len(q['offsets'])==3 and
                      0<q['offsets'][0]<q['offsets'][1]<q['offsets'][2] for q in qs):
  p.error('Each corridor must contain two ordered positive checkpoints and one late checkpoint.')
 out.mkdir(parents=True,exist_ok=False)
 with tempfile.TemporaryDirectory(prefix='flight-fixture-',dir=out) as d:
  box=Path(d)
  try:
   dist=stage(repo,corridors,box/'app')
   run(dist,corridors,a.chromium,out)
  finally:
   log=box/'build.log'
   if log.exists():(out/'build.log').write_bytes(log.read_bytes())
