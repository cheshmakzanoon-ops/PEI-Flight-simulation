#!/usr/bin/env python3
"""Replay two ordinary Chase flights through the Borden shoreline view.

Seeds and readback probes are inserted in a disposable test copy only. The
flight state then advances through the published controls and simulation.
"""
import argparse
import base64
import functools
import http.server
import json
import shutil
import subprocess
import tempfile
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROUTES = [
 {
  "id": "qa-borden-arc-southwest",
  "name": "Borden local flight regression",
  "region": "QA",
  "lat": 46.248909629612086,
  "lon": -63.70753543579606,
  "heading": 50,
  "height": 51,
  "note": "Temporary replay seed. Not a navigation route."
 },
 {
  "id": "qa-borden-arc-harbour",
  "name": "Borden local flight regression",
  "region": "QA",
  "lat": 46.24841398837631,
  "lon": -63.705187795575,
  "heading": 344,
  "height": 51,
  "note": "Temporary replay seed. Not a navigation route."
 }
]

HOOK=r"""
  (window as any).bordenMotionNative=()=>{
   if(ui.mode!=='flight'||names[view]!=='Chase')return null;
   const sky=(world as any).sky.material.uniforms.skyDiagnostic;
   if(sky.value!==0)return null;
   const gl=renderer.getContext(),W=gl.drawingBufferWidth,H=gl.drawingBufferHeight;
   const take=(repair:boolean,marker:boolean,image=false)=>{
    const release=repair?world.beginBordenShoreArc(camera):undefined;
    sky.value=Number(marker);
    try{
     renderer.render(scene,camera);
     const out=new Uint8Array(W*H*4);gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,out);
     return {out,armed:!!release,draws:renderer.info.render.calls,triangles:renderer.info.render.triangles,points:renderer.info.render.points,
      photo:image?renderer.domElement.toDataURL():null};
    }finally{sky.value=0;release?.();}
   };
   const stock=take(false,false,true),after=take(true,false,true),mask=take(false,true),newMask=take(true,true),repeat=take(false,false);
   let changed=0,outside=0,restore=0,alpha=0,newSky=0,cleared=0,first:number|undefined;
   const rgb=(a:Uint8Array,b:Uint8Array,i:number)=>a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2];
   for(let i=0;i<stock.out.length;i+=4){
    const diff=rgb(stock.out,after.out,i),oldSky=rgb(stock.out,mask.out,i),sky=rgb(after.out,newMask.out,i);
    if(diff){changed++;if(!oldSky)outside++;first??=i/4;}
    if(sky&&!oldSky)newSky++;
    if(oldSky&&!sky)cleared++;
    if(stock.out[i+3]!==after.out[i+3])alpha++;
    if(rgb(stock.out,repeat.out,i)||stock.out[i+3]!==repeat.out[i+3])restore++;
   }
   let foreign:undefined|boolean;
   if(first!==undefined){
    const ndc=new THREE.Vector3(2*((first%W)+.5)/W-1,2*(Math.floor(first/W)+.5)/H-1,0);
    ndc.unproject(camera).sub(camera.position).normalize();
    const geom=new THREE.PlaneGeometry(2.4,2.4),mat=new THREE.MeshBasicMaterial({
     color:0xcf95d0,opacity:.38,transparent:true,depthWrite:false,side:THREE.DoubleSide,
    });
    const pane=new THREE.Mesh(geom,mat);pane.name='QA genuine replay transparent overlap';
    pane.position.copy(camera.position).addScaledVector(ndc,8);
    pane.quaternion.copy(camera.quaternion);scene.add(pane);
    try{
     const before=take(false,false),withPane=take(true,false);
     foreign=before.out.some((v,i)=>v!==stock.out[i])&&before.out.every((v,i)=>v===withPane.out[i])&&
      before.draws===withPane.draws&&before.triangles===withPane.triangles&&before.points===withPane.points;
    }finally{pane.removeFromParent();geom.dispose();mat.dispose();}
   }
   return {actualFlight:true,pose:[f.x,f.y,f.z,f.heading],eye:camera.position.toArray(),
    before:[stock.draws,stock.triangles,stock.points],after:[after.draws,after.triangles,after.points],
    changed,outside,restore,alpha,newSky,cleared,foreign,armed:after.armed,samples:gl.getParameter(gl.SAMPLES),
    gl:gl.getError(),images:[stock.photo,after.photo]};
  };
"""

def stage(repo, root, deps):
    for name in ('index.html','package.json','package-lock.json','tsconfig.json','vite.config.ts'):
        shutil.copy2(repo/name,root/name)
    shutil.copytree(repo/'src',root/'src')
    (root/'public').symlink_to(repo/'public',target_is_directory=True)
    (root/'node_modules').symlink_to(deps,target_is_directory=True)
    places=root/'src/sim/places.ts'
    text=places.read_text()
    end=text.index('\n];')+1
    rows=''.join(' '+json.dumps(row)+',\n' for row in ROUTES)
    places.write_text(text[:end]+rows+text[end:])
    main=root/'src/main.ts'
    text=main.read_text()
    anchor="  if(world.tryonRockState==='pending'"
    if text.count(anchor)!=1:
        raise RuntimeError('review the actual scene continuation before restaging')
    main.write_text(text.replace(anchor,HOOK+anchor))
    subprocess.run(['npm','run','build'],cwd=root,check=True)


class Local(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*v):pass
def capture(a, dist):
 a.out.mkdir(parents=True,exist_ok=True)
 receipt={}
 with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Local,directory=str(dist))) as srv,sync_playwright() as pw:
  threading.Thread(target=srv.serve_forever,daemon=True).start()
  with pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']) as b:
   for row in ROUTES:
    name=row['id'];page=b.new_page(viewport={'width':840,'height':540});page.set_default_timeout(150000);errs=[]
    page.on('pageerror',lambda e:errs.append(str(e)))
    page.on('console',lambda e:errs.append(e.text) if e.type=='error' else None)
    if a.zero:page.add_init_script("(()=>{const p=HTMLCanvasElement.prototype,g=p.getContext;p.getContext=function(n,a,...args){return g.call(this,n,this.id==='world'&&n==='webgl2'?{...a,antialias:false}:a,...args);};})();")
    query='&stockBordenCoast' if a.stock else ''
    assert page.goto(f'http://127.0.0.1:{srv.server_port}/?diagnostics&departure='+name+query,wait_until='domcontentloaded').ok
    page.wait_for_function("x=>window.islandAirDiagnostics?.site===x&&islandAirDiagnostics.mode==='dispatch'",arg=name)
    origin=page.evaluate("[islandAirDiagnostics.x,islandAirDiagnostics.z]")
    page.evaluate("""pts=>{
     window.bordenMotionFrames={};requestAnimationFrame(function pick(){
       const q=window.islandAirDiagnostics,dist=q?Math.hypot(q.x-pts[0],q.z-pts[1]):0;
       if(q?.mode==='flight'&&q?.camera==='Chase')for(const d of [12,45,110,150]){
        if(dist>=d&&!window.bordenMotionFrames[d]){const v=window.bordenMotionNative();if(v){v.travel=dist;window.bordenMotionFrames[d]=v;}}
       }
       if(!window.bordenMotionFrames[150])requestAnimationFrame(pick);
     });
    }""",origin)
    page.get_by_role('button',name='Begin flight').click()
    frames=[]
    for target in (12,45,110,150):
     page.wait_for_function('n=>window.bordenMotionFrames?.[n]',arg=target)
     v=page.evaluate('n=>window.bordenMotionFrames[n]',target)
     assert v['gl']==v['alpha']==v['outside']==v['restore']==v['newSky']==0 and v['samples']==(0 if a.zero else 4) and v['actualFlight'],v
     if v['changed']:
      assert v['foreign'] and v['cleared'] and v['after'][1]==v['before'][1]+58,v
     for k,b64 in zip(('stock','repair'),v.pop('images')):
      raw=base64.b64decode(b64.split(',',1)[1]);(a.out/f'{name}-{target}-{k}.png').write_bytes(raw)
     frames.append(v)
    page.keyboard.press('v');page.wait_for_function("window.islandAirDiagnostics?.camera==='Cockpit'")
    page.keyboard.press('p');page.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
    receipt[name]={'frames':frames,'cockpitAndPause':True,'errors':errs}
    (a.out/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print(name,[(round(v['travel'],2),v['changed'],v['cleared'],v['after'][1]-v['before'][1],v['foreign']) for v in frames],flush=True)
    assert not errs
    if a.zero or a.stock:
     assert all(not v['changed'] and not v['armed'] and v['before']==v['after'] for v in frames),name
    else:
     assert any(v['changed']>=100 and v['after'][0]==v['before'][0]+2 and
                v['after'][2]>v['before'][2] for v in frames[:2]),name
     assert frames[-1]['changed']==0,name
     assert frames[-1]['before']==frames[-1]['after'],name
    page.close()


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--checkout',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--deps',type=Path)
    p.add_argument('--chromium',required=True)
    flags=p.add_mutually_exclusive_group()
    flags.add_argument('--stock',action='store_true')
    flags.add_argument('--zero',action='store_true')
    args=p.parse_args()
    repo=args.checkout.resolve()
    args.out=args.out.resolve()
    if args.out==repo or repo in args.out.parents:
        p.error('use a receipt directory outside the source checkout')
    deps=(args.deps or repo/'node_modules').resolve()
    with tempfile.TemporaryDirectory(prefix='pei-borden-flight-') as out:
        work=Path(out)
        stage(repo,work,deps)
        capture(args,work/'dist')


if __name__=='__main__':
    main()
