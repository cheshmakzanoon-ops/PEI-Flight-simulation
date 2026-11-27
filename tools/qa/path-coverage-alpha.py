"""Replay stock vs guarded coverage blend in one frame on the existing Trail and sidewalks."""
from pathlib import Path
from urllib.parse import quote
import argparse,base64,importlib.util,json
ROOT=Path(__file__).resolve().parents[2]
sp=importlib.util.spec_from_file_location('fixed',ROOT/'tools/qa/fixed-scenery.py')
f=importlib.util.module_from_spec(sp);sp.loader.exec_module(f)
base=f.stage
P={
 'prince-trail':dict(lon=-63.6860628524,lat=46.4262323223,east=-.911,south=.412,dist=22.,agl=6.8,h=.04),
 'queens-trail':dict(lon=-63.3480649803,lat=46.3511121287,east=-.60136,south=.86068,dist=31.,agl=7.8,h=.04),
 'kings-trail':dict(lon=-62.6354084039,lat=46.4214545261,east=-.945,south=.327,dist=24.,agl=7.8,h=.04),
 'charlottetown-walk':dict(lon=-63.1233501012,lat=46.2419428722,east=.7339666,south=-.6791855,dist=30,h=0,agl=19),
 'summerside-walk':dict(lon=-63.7921925396,lat=46.391678548,east=-.9831342,south=-.1828858,dist=29,h=0,agl=18),
 'kensington-walk':dict(lon=-63.6368658433,lat=46.436972277,east=-.8459997,south=.5331834,dist=19,h=0,agl=16),
 'charlottetown-fade-walk':dict(lon=-63.1233501012,lat=46.2419428722,east=.7339666,south=-.6791855,dist=470,h=0,agl=365),
 'summerside-fade-walk':dict(lon=-63.7921925396,lat=46.391678548,east=-.9831342,south=-.1828858,dist=500,h=0,agl=381),
 'high':dict(lon=-63.3480649803,lat=46.3511121287,east=-.60136,south=.86068,dist=810.,agl=520.,h=.04),
}
def stage(repo,root,deps,void):
 base(repo,root,deps,False)
 for n,a,b in [('confederation-trail-material.ts','gl_FragColor=vec4(mix(col,vec3(.55,.65,.68),haze),coverage);','coverage'),
               ('sidewalk-material.ts','gl_FragColor=vec4(mix(c,vec3(.56,.68,.72),air),fade);','fade')]:
  material=root/'src/render'/n; q=material.read_text()
  q=f.once(q,'uniforms:{','uniforms:{qaPathMarker:{value:0},')
  q=f.once(q,'fragmentShader:`','fragmentShader:`uniform float qaPathMarker;\n')
  q=f.once(q,a,'vec4 qaPathOriginal='+a.removeprefix('gl_FragColor=')+
           'gl_FragColor=qaPathMarker<.5?qaPathOriginal:vec4(qaPathMarker<1.5?vec3(.97,.02,.62):vec3(.02,.93,.04),'+b+');')
  material.write_text(q)
 main=root/'src/main.ts';s=main.read_text()
 anchor='}else renderer.render(scene,camera);}finally{endPrince?.();endRidge?.();}'
 marker='''
 (window as any).pathAlphaQA=(which:string)=>{
   const group=scene.getObjectByName(which==='walk'?'Mapped PEI sidewalk ribbons':'Main Confederation Trail – mapped stone dust');
   const materials=[...new Set((group?.children??[]).filter(x=>(x as THREE.Mesh).isMesh).map(x=>(x as THREE.Mesh).material as THREE.ShaderMaterial))];
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
     const c=draw();
     materials.forEach(m=>m.setValues({blending:THREE.NormalBlending}));
     const a=draw();restore();const b=draw();
     materials.forEach(m=>m.setValues({blending:THREE.NormalBlending}));
     const undo=draw();restore();
     materials.forEach(m=>m.uniforms.qaPathMarker.value=1);
     const idA=draw();
     materials.forEach(m=>m.uniforms.qaPathMarker.value=2);
     const idB=draw();
     materials.forEach(m=>m.uniforms.qaPathMarker.value=0);
     const undoNew=draw();
     let offRole=0,role=0,markerAlphaDelta=0;
     for(let i=0;i<a.raw.length;i+=4){
       const marked=idA.raw[i]!==idB.raw[i]||idA.raw[i+1]!==idB.raw[i+1]||idA.raw[i+2]!==idB.raw[i+2];
       if(marked)role++;
       if(a.raw[i+3]!==b.raw[i+3]&&!marked)offRole++;
       if(idA.raw[i+3]!==idB.raw[i+3])markerAlphaDelta++;
     }
     return {before:view(a),after:view(b),delta:stats(a.raw,b.raw),restore:stats(a.raw,undo.raw),
      pngUndo:a.img===undo.img,newPngExact:b.img===c.img&&b.img===undoNew.img,candidateRepeat:stats(b.raw,undoNew.raw),
      offRole,role,markerAlphaDelta,stage:which==='walk'?sidewalks?.state:confederationTrail?.state,attributes:gl.getContextAttributes(),samples:gl.getParameter(gl.SAMPLES),compat};
   }finally{restore();materials.forEach(m=>m.uniforms.qaPathMarker.value=0);}

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
  pg.on('request',lambda r:requests.append(r.url.rsplit('/',1)[-1]) if 'confederation-main.bin.gz' in r.url or 'sidewalks' in r.url else None)
  try:
   which='walk' if v.endswith('walk') else 'trail'
   q='&departure=hunter-river-trail' if which=='trail' else '&departure=charlottetown'
   pg.goto(url+'/?diagnostics'+q+'&qa='+quote(json.dumps(P[v])),wait_until='domcontentloaded')
   if which=='trail':
    pg.wait_for_function("window.reviewCamera?.frame>9&&window.islandAirDiagnostics?.mode==='dispatch'")
    pg.get_by_role('button',name='Begin flight').click()
    pg.wait_for_function("window.islandAirDiagnostics?.mode==='flight'")
   f.settle(pg,err)
   if v!='high':
    pg.wait_for_function('''w=>{const q=window.islandAirDiagnostics;const d=w==='trail'?q?.confederationTrail:q?.sidewalks;
                return q?.detail?.loading===0&&d?.visible>0&&d?.pending===0}''',arg=which,timeout=85000)
   r=pg.evaluate('window.pathAlphaQA',which)
   assert not err and r['pngUndo'] and r['newPngExact'] and r['samples']>=2,(err,r['samples'])
   assert r['markerAlphaDelta']==r['candidateRepeat']['rgb']==r['candidateRepeat']['alpha']==0,r
   assert all(c[1] and c[2]==5 for c in r['compat']),r['compat']
   assert r['delta']['rgb']==r['delta']['loss']==r['offRole']==r['restore']['rgb']==r['restore']['alpha']==0,r['delta']
   assert r['before']['draws']==r['after']['draws'] and r['before']['tris']==r['after']['tris']
   for k in ['before','after']:
    assert r[k]['glError']==0
    png=base64.b64decode(r[k].pop('img').split(',',1)[1])
    if v in {'queens-trail','charlottetown-fade-walk'}:(a.out/f'{v}-{k}.png').write_bytes(png)
   if v=='high':assert not r['delta']['alpha']
   elif v.endswith('trail') or 'fade' in v:assert r['delta']['alpha']>0 and r['role']>0,(v,r,requests)
   else:assert r['role']>0,r
   r['requests']=requests;data[v]=r
   (a.out/'native-report.json').write_text(json.dumps(data,indent=2)+'\n')
   print(v,r,flush=True)
  finally:c.close()
f.capture=capture
a=argparse.ArgumentParser()
a.add_argument('--checkout',type=Path,default=ROOT);a.add_argument('--out',type=Path,required=True)
a.add_argument('--views',default='queens-trail,kings-trail,prince-trail,charlottetown-fade-walk,summerside-fade-walk,charlottetown-walk,high');a.add_argument('--deps',type=Path)
a.add_argument('--chromium',required=True)
a.set_defaults(void_probe=False);f.run(a.parse_args())
