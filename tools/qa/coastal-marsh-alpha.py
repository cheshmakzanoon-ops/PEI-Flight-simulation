"""Replay stock vs guarded opaque blend in one rendered frame at each signed marsh site."""
from pathlib import Path
from urllib.parse import quote
import argparse,base64,importlib.util,json
ROOT=Path(__file__).resolve().parents[2]
sp=importlib.util.spec_from_file_location('fixed',ROOT/'tools/qa/fixed-scenery.py')
f=importlib.util.module_from_spec(sp);sp.loader.exec_module(f)
base=f.stage
P={
 'tracadie':dict(lon=-62.97173126551944,lat=46.414650886087024,east=.72,south=-.68,h=.3,dist=7,agl=5),
 'tracadie-approach':dict(lon=-62.97173126551944,lat=46.414650886087024,east=.72,south=-.68,h=.25,dist=24,agl=18),
 'cascumpec':dict(lon=-64.1212494924029,lat=46.76014050082513,east=.76,south=.65,h=.30,dist=8,agl=6),
 'morell':dict(lon=-62.68155086543071,lat=46.42274724471909,east=.8,south=.6,h=.30,dist=8,agl=5.5),
 'high':dict(lon=-62.97173126551944,lat=46.414650886087024,east=.72,south=-.68,h=0,dist=210,agl=450),
}
def stage(repo,root,deps,void):
 base(repo,root,deps,False)
 material=root/'src/render/marsh-foliage/marsh-material.ts'; q=material.read_text()
 q=f.once(q,'const uniforms={marshTime:', 'const uniforms={qaMarshMarker:{value:0},marshTime:')
 q=f.once(q,'uniform float marshAGL;', 'uniform float marshAGL,qaMarshMarker;')
 q=f.once(q,'gl_FragColor=vec4(mix(color,vec3(.28,.34,.30),air),fade);',
 'gl_FragColor=vec4(qaMarshMarker>.5?(qaMarshMarker<1.5?vec3(.97,.02,.62):vec3(.02,.93,.04)):mix(color,vec3(.28,.34,.30),air),fade);')
 material.write_text(q)
 main=root/'src/main.ts';s=main.read_text()
 anchor='}else renderer.render(scene,camera);}finally{endPrince?.();endRidge?.();}'
 marker='''
 (window as any).marshAlphaQA=()=>{
   const group=scene.getObjectByName('Marsh vegetation / original geometry');
   const materials=[...new Set((group?.children??[]).map(x=>(x as THREE.Mesh).material as THREE.ShaderMaterial))];
   const old=materials.map(m=>[m,Object.fromEntries(Object.keys(opaqueCoverageBlend).map(k=>[k,m[k as keyof typeof m]]))] as const);
   const compat=materials.map(m=>[m.name,m.alphaToCoverage,m.blending]);
   const gl=renderer.getContext(),W=gl.drawingBufferWidth,H=gl.drawingBufferHeight;
   function draw(){
     renderer.render(scene,camera);
     const raw=new Uint8Array(W*H*4);
     gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,raw);
     return {raw,img:renderer.domElement.toDataURL('image/png'),draws:renderer.info.render.calls,tris:renderer.info.render.triangles,glError:gl.getError()};
   }
   const restore=()=>old.forEach(([m,v])=>m.setValues(v));
   const stats=(a:Uint8Array,b:Uint8Array)=>{let rgb=0,alpha=0,nonopaqueBefore=0,nonopaqueAfter=0,loss=0,minBefore=255,minAfter=255;
     for(let i=0;i<a.length;i+=4){if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])rgb++;
       if(a[i+3]!==b[i+3])alpha++;if(a[i+3]!==255)nonopaqueBefore++;if(b[i+3]!==255)nonopaqueAfter++;
       if(b[i+3]<a[i+3])loss++;minBefore=Math.min(minBefore,a[i+3]);minAfter=Math.min(minAfter,b[i+3]);}
     return {rgb,alpha,nonopaqueBefore,nonopaqueAfter,loss,minBefore,minAfter};};
   const view=({raw,...q}:ReturnType<typeof draw>)=>q;
   try{
     const matched=draw();
     materials.forEach(m=>m.setValues({blending:THREE.NormalBlending}));
     const a=draw();restore();const b=draw();
     materials.forEach(m=>m.setValues({blending:THREE.NormalBlending}));
     const undo=draw();restore();
     materials.forEach(m=>m.uniforms.qaMarshMarker.value=1);
     const idA=draw();
     materials.forEach(m=>m.uniforms.qaMarshMarker.value=2);
     const idB=draw();
     materials.forEach(m=>m.uniforms.qaMarshMarker.value=0);
     const undoNew=draw();
     let offRole=0,role=0,markerAlphaDelta=0;
     for(let i=0;i<a.raw.length;i+=4){
       const marked=idA.raw[i]!==idB.raw[i]||idA.raw[i+1]!==idB.raw[i+1]||idA.raw[i+2]!==idB.raw[i+2];
       if(marked)role++;
       if(a.raw[i+3]!==b.raw[i+3]&&!marked)offRole++;
       if(idA.raw[i+3]!==idB.raw[i+3])markerAlphaDelta++;
     }
     return {before:view(a),after:view(b),delta:stats(a.raw,b.raw),restore:stats(a.raw,undo.raw),
      pngUndo:a.img===undo.img,newPngExact:b.img===matched.img&&b.img===undoNew.img,candidateRepeat:stats(matched.raw,undoNew.raw),
      offRole,role,markerAlphaDelta,stage:foliage?.diagnostics(),attributes:gl.getContextAttributes(),samples:gl.getParameter(gl.SAMPLES),compat};
   }finally{restore();materials.forEach(m=>m.uniforms.qaMarshMarker.value=0);}

 };
 '''
 s=f.once(s,anchor,anchor+'\n'+marker)
 main.write_text("import {opaqueCoverageBlend} from './render/opaque-coverage-alpha.ts';\n"+s)
f.stage=stage
def capture(a,browser,url):
 data={}
 for v in a.views.split(','):
  c=browser.new_context(viewport={'width':840,'height':540},device_scale_factor=1)
  pg=c.new_page();err=[];requests=[]
  pg.on('pageerror',lambda e:err.append(str(e)))
  pg.on('console',lambda m:err.append(m.text) if m.type=='error' else None)
  pg.on('request',lambda r:requests.append(r.url.rsplit('/',1)[-1]) if 'coastal-marsh' in r.url else None)
  try:
   pg.goto(url+'/?diagnostics&qa='+quote(json.dumps(P[v])),wait_until='domcontentloaded')
   f.settle(pg,err)
   if v!='high':
    pg.wait_for_function('d=>{const a=window.islandAirDiagnostics?.marshFoliage;return a?.id===d&&(a.near+a.mid)>0}',arg=v.split('-')[0],timeout=65000)
   r=pg.evaluate('window.marshAlphaQA()')
   assert not err and r['pngUndo'] and r['newPngExact'] and r['samples']>=2,(err,r['samples'])
   assert r['markerAlphaDelta']==r['candidateRepeat']['rgb']==r['candidateRepeat']['alpha']==0,r
   assert all(c[1] and c[2]==5 for c in r['compat']),r['compat']
   assert r['delta']['rgb']==r['delta']['loss']==r['offRole']==r['restore']['rgb']==r['restore']['alpha']==0,r['delta']
   assert r['before']['draws']==r['after']['draws'] and r['before']['tris']==r['after']['tris']
   for k in ['before','after']:
    assert r[k]['glError']==0
    png=base64.b64decode(r[k].pop('img').split(',',1)[1])
    if v in {'tracadie','morell'}:(a.out/f'{v}-{k}.png').write_bytes(png)
   if v=='high':assert not r['delta']['alpha'] and not requests
   else:assert r['delta']['alpha']>500 and requests==[v.split('-')[0]+'.red.gz'],(v,r,requests)
   r['requests']=requests;data[v]=r
   (a.out/'native-report.json').write_text(json.dumps(data,indent=2)+'\n')
   print(v,r,flush=True)
  finally:c.close()
f.capture=capture
a=argparse.ArgumentParser()
a.add_argument('--checkout',type=Path,default=ROOT);a.add_argument('--out',type=Path,required=True)
a.add_argument('--views',default=','.join(P));a.add_argument('--deps',type=Path)
a.add_argument('--chromium',required=True)
a.set_defaults(void_probe=False);f.run(a.parse_args())
