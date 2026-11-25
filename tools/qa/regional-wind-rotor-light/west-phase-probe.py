from pathlib import Path
from urllib.parse import quote
import argparse,importlib.util,json,base64,hashlib
p=argparse.ArgumentParser();p.add_argument('--checkout',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True);p.add_argument('--deps',type=Path);a=p.parse_args();a.void_probe=False;a.size='840x540';a.pose_baseline=None;D=Path(__file__).parent;s=importlib.util.spec_from_file_location('h',a.checkout/'tools/qa/fixed-scenery.py');b=importlib.util.module_from_spec(s);s.loader.exec_module(b);s0=b.stage
def stage(repo,tmp,deps,void):
 s0(repo,tmp,deps,void);f=tmp/'src/main.ts';src=f.read_text();src=b.once(src,'regionalWind?.update(camera.position,time);',"""const rawWindGL=renderer.getContext();const win=window as any;const token=()=>[renderer.getRenderTarget()===null,renderer.getActiveCubeFace(),renderer.getActiveMipmapLevel(),...rawWindGL.getParameter(rawWindGL.VIEWPORT),...rawWindGL.getParameter(rawWindGL.SCISSOR_BOX),rawWindGL.isEnabled(rawWindGL.SCISSOR_TEST),renderer.autoClear,renderer.xr.enabled]; const oldToken=token();regionalWind?.update(camera.position,.42);const newToken=token();if(JSON.stringify(oldToken)!==JSON.stringify(newToken)){(win.qaBadStates??=[]).push([oldToken,newToken]);}const err=rawWindGL.getError();if(err!==rawWindGL.NO_ERROR){(win.qaGLErrors??=[]).push([qaFrame,err]);}""")
 anc='\n  renderer.render(scene,camera);';f.write_text(b.once(src,anc,anc+'''
  (window as any).qaRotorPair=()=>{
   const gw=(regionalWind as any).live.get('west-cape'),staticLight=gw.staticLight,move=staticLight.moving,draw=move.draw,k=move.u.rotorCount.value;
   const w=renderer.domElement, gl=renderer.getContext(),snap=()=>{
    renderer.render(scene,camera);return {png:w.toDataURL('image/png'),calls:renderer.info.render.calls,tris:renderer.info.render.triangles,gl:gl.getError()};};
   if(!k||staticLight.streams.regionalStaticCount.value<=0)throw Error('Need both active in same real view');
   const before=move.state,normal=snap();move.u.rotorCount.value=0;let stock;try{stock=snap();}finally{move.u.rotorCount.value=k;}
   const restored=snap(),at=draw.layout,caster=draw.batch;return {normal,stock,restored,before,ordinaryGlErrors:(window as any).qaGLErrors??[],stateErrors:(window as any).qaBadStates??[],staticCasters:staticLight.streams.regionalStaticCount.value,ids:move.slotIds,clock:gw.lightClock(),activeFarm:gw.groundLightState(),lease:[...move.own.keys()].map((m:any)=>({tex:m.uniforms.regionalRotorDepth.value.name,worldStatic:m.uniforms.regionalStaticCount.value,rect:m.uniforms.rotorLocalRect.value.toArray()})),atlas:{width:at.ax,height:at.ay,cols:at.cols,rows:at.rows,w:at.w,h:at.h,d16:draw.rt.depthTexture.type===THREE.UnsignedShortType,depthTarget:draw.rt.depthTexture.name,submittedOffscreenTriangles:caster.count*(caster.geometry.index.count/3)},worldSun:world.sun.toArray(),time:.42};};
'''))
b.stage=stage
def capture(args,browser,url):
 pose={'lon':-64.3847689404,'lat':46.6861583914,'h':.10,'east':-.4590200519,'south':.8884259069,'dist':146,'agl':84};errors=[]
 with browser.new_context(viewport={'width':840,'height':540},device_scale_factor=1) as ctx:
  pg=ctx.new_page();pg.set_default_timeout(90000);pg.on('pageerror',lambda e:(errors.append(str(e)),print('PAGE',e,flush=True)));pg.on('console',lambda e:(errors.append(e.text),print('CONSOLE',e.text,flush=True))if e.type=='error'else None)
  pg.goto(url+'/?diagnostics&qa='+quote(json.dumps(pose)),wait_until='domcontentloaded')
  pg.wait_for_function('''()=>{const d=window.islandAirDiagnostics,t=d?.buildingTiles,f=d?.regionalWind?.farms?.[0],s=f?.groundLight?.moving;return (s?.phase==='unavailable')||(s?.nearRotors>0&&t?.wanted>0&&t.ready===t.wanted&&!t.loading&&!t.failed&&!t.pending)}''')
  print('mounted',pg.evaluate('()=>window.islandAirDiagnostics.regionalWind'),flush=True)
  diag=b.settle(pg,errors);assert not errors,errors
  r=pg.evaluate('()=>window.qaRotorPair()');r['sha']={};ims=[]
  from PIL import Image
  import numpy as np
  for mode in ['normal','stock','restored']:
   v=r[mode].pop('png');path=args.out/(mode+'.png');path.write_bytes(base64.b64decode(v.split(',',1)[1]));r['sha'][mode]=hashlib.sha256(path.read_bytes()).hexdigest();ims.append(np.array(Image.open(path).convert('RGB'),dtype=np.int16))
  d=ims[0]-ims[1];mx=np.abs(d).max(2);r['delta']={'any':int((mx>0).sum()),'gt2':int((mx>2).sum()),'gt8':int((mx>8).sum()),'peak':int(mx.max()),'brightened':int((d.max(2)>0).sum()),'restoredBitsEqual':bool(np.array_equal(ims[0],ims[2]))};r['pose']=pose;r['errors']=errors
  (args.out/'same-tick.json').write_text(json.dumps(r,indent=2)+'\n');print(r['delta'],r['ordinaryGlErrors'],r['stateErrors'],flush=True)
  assert r['delta']['gt2']>=65 and r['delta']['brightened']==0 and r['delta']['restoredBitsEqual'] and not r['ordinaryGlErrors']and not r['stateErrors']and all(r[m]['gl']==0 for m in ['normal','stock','restored'])
b.capture=capture;b.run(a)
