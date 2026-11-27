#!/usr/bin/env python3
"""Real Standard CYSU stock model census, with a private fixed-clock replay.

Runs only on a temporary Vite copy. The diagnosed location and roof are not
reconstructed. Uses ordinary Input / flight / Chase; synthetic axis input is
sampled at each fixed step, and outside the three frames GPU draws are spaced
a second apart. The renderer, aeroplane and scenery are unchanged at targets.
No external map or camera service is requested.
"""
import argparse
import base64
import hashlib
import importlib.util
import json
import shutil
from pathlib import Path

spec=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixed)
TARGETS=(5040,5220,5760)
STOCK_POSE=(
 (-48045.7171565,108.30311485,5931.60718300),
 (-47981.4475480,116.08591553,5848.50654027),
 (-47788.2057970,139.70316680,5598.60465062),
)
ORIGINAL_POS_SHA='d06f10ed97449b2f2df18ac9fb61d9bbc30ba521bb6aa91198b2c25766eff950'
POLL=r"""  const hg=(window as any).hangarProbe;
  if(hg&&hg.go){hg.c={speed:f.speed,status:f.status,n:Math.round(f.time*90)};}
"""
FIXED_STEP=r"""   acc+=delta;let n=0;while(acc>=FIXED_STEP&&n++<12){
    if(hg?.go)hg.c={speed:f.speed,status:f.status,n:Math.round(f.time*90)};
    step(f,hg?.go?input.poll(pause):u,sceneSurface);acc-=FIXED_STEP;}
"""
FRAME=r"""  const hangarTick=Math.round(f.time*90);
  const admitHangarFrame=!hg?.go||ui.mode!=='flight'||hangarTick%90===0||[5040,5220,5760].includes(hangarTick);
"""
DEBUG=r"""  if(hg?.go&&ui.mode==='flight'&&SITES[activeSite].id==='cysu'){
   hg.tick=hangarTick;
   if([5040,5220,5760].includes(hangarTick)&&!hg.frames[hangarTick]){
    const owner=(buildings as any)?.meshes.get('q0322') as THREE.Mesh|undefined;
    const ctx=renderer.getContext();
    if(!owner||!owner.visible||owner.geometry.index||owner.geometry.getAttribute('position').count!==23394)
     throw Error('Unknown q0322 building draw at locked CYSU view');
    const mat=owner.material as THREE.ShaderMaterial;
    if(!mat.isShaderMaterial)throw Error('Unknown original buildings shader');
    const pos=owner.geometry.getAttribute('position');
    const marker=new THREE.ShaderMaterial().copy(Object.create(mat,{uniforms:{value:{}}}));
    const tint={value:0},mask={value:0};
    marker.uniforms={...mat.uniforms,hangarTint:tint,hangarMask:mask};
    const hook='#include <colorspace_fragment>';
    if(mat.vertexShader.split('void main(){').length!==2||mat.fragmentShader.split(hook).length!==2)
     throw Error('Unexpected building shader API');
    marker.vertexShader='flat out int hangarVert;\n'+mat.vertexShader.replace('void main(){','void main(){\n hangarVert=gl_VertexID;');
    marker.fragmentShader='flat in int hangarVert;uniform float hangarTint;uniform int hangarMask;\n'+mat.fragmentShader.replace(hook,hook+
     `\n if((hangarMask==0&&hangarVert>=4833&&hangarVert<4989)||
     (hangarMask==1&&hangarVert>=4941&&hangarVert<4989)||
     (hangarMask==2&&hangarVert>=4935&&hangarVert<4941)||
     (hangarMask==3&&hangarVert>=4917&&hangarVert<4923))gl_FragColor.r=hangarTint;`);
    const w=ctx.drawingBufferWidth,h=ctx.drawingBufferHeight;
    const grab=()=>{const data=new Uint8Array(w*h*4);
     ctx.readPixels(0,0,w,h,ctx.RGBA,ctx.UNSIGNED_BYTE,data);return data;};
    const old=grab(),baseCounts=[renderer.info.render.calls,renderer.info.render.triangles],
     png=renderer.domElement.toDataURL('image/png'), basePNG=ctx.getError();
    let rollback=0,other=0,off=0;
    const roles=[];
    try{
     owner.material=marker;
     for(const j of [0,1,2,3]){
      mask.value=j;tint.value=.04;renderer.render(scene,camera);const l=grab();
      tint.value=.94;renderer.render(scene,camera);const h=grab();
      let n=0,x0=w,y0=ctx.drawingBufferHeight,x1=0,y1=0;
      for(let i=0;i<l.length;i+=4){
       const x=(i/4)%w,y=ctx.drawingBufferHeight-1-Math.floor(i/(4*w));
       if(l[i]!==h[i]){n++;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
       else if(l[i]!==old[i]||h[i]!==old[i])off++;
       for(let k=1;k<4;k++)if(l[i+k]!==old[i+k]||h[i+k]!==old[i+k])other++;
      }
      roles.push({n,box:n?[x0,y0,x1,y1]:null});
     }
     owner.material=mat;renderer.render(scene,camera);const exact=grab();
     for(let i=0;i<exact.length;i++)if(exact[i]!==old[i])rollback++;
    }finally{owner.material=mat;marker.dispose();}
    hg.frames[hangarTick]={site:SITES[activeSite].id,frame:hangarTick,
     flight:{time:f.time,x:f.x,y:f.y,z:f.z,speed:f.speed,status:f.status,bank:f.bank},
     pose:{eye:camera.position.toArray(),view:camera.matrixWorldInverse.toArray(),projection:camera.projectionMatrix.toArray(),mode:names[view]},
     vertexCount:pos.count,indices:owner.geometry.getIndex()?.count??null,ownerPosition:owner.position.toArray(),ownerUUID:owner.uuid,
     roles,stockCounts:baseCounts,restoredCounts:[renderer.info.render.calls,renderer.info.render.triangles],
     rgbaRollbackChannels:rollback,unmarkedRed:off,unrelatedChannels:other,size:[w,h],samples:ctx.getParameter(ctx.SAMPLES),
     error:[basePNG,ctx.getError()], png};
    const raw=new Uint8Array(pos.array.buffer,pos.array.byteOffset,pos.array.byteLength);
    const result=hg.frames[hangarTick];
    void crypto.subtle.digest('SHA-256',Uint8Array.from(raw)).then(a=>{
     result.ownerSHA=Array.from(new Uint8Array(a),b=>b.toString(16).padStart(2,'0')).join('');result.ready=true;
    });
   }
  }

"""

def prepare(repo,stage,deps,void):
    for name in ('index.html','package.json','package-lock.json','tsconfig.json'):
        shutil.copy2(repo/name,stage/name)
    shutil.copytree(repo/'src',stage/'src')
    (stage/'public').symlink_to(repo/'public',target_is_directory=True)
    (stage/'node_modules').symlink_to(deps,target_is_directory=True)
    (stage/'vite.config.ts').write_text(
        "import {defineConfig} from 'vite';export default defineConfig({base:'./',cacheDir:"
        +json.dumps(str(stage/'cache'))+"});")
    main=stage/'src/main.ts'
    src=main.read_text()
    instead=[
     ('  const u=input.poll(pause);',POLL+'  const u=input.poll(pause);'),
     ('   acc+=delta;let n=0;while(acc>=FIXED_STEP&&n++<12){step(f,u,sceneSurface);acc-=FIXED_STEP;}\n',FIXED_STEP),
     ('  try{if(datedStandReview){',FRAME+
      "  try{if(!admitHangarFrame){/* Private replay transit. */}else if(datedStandReview){"),
    ]
    anchor='}else renderer.render(scene,camera);}finally{endPrince?.();endRidge?.();}'
    instead.append((anchor,anchor+'\n'+DEBUG))
    for old,new in instead:src=fixed.once(src,old,new)
    main.write_text(src)

CONTROLLER=r"""
(last=>{
 const q=window.hangarProbe={go:false,frames:{},c:null};
 const raf=window.requestAnimationFrame.bind(window);let clock;
 window.requestAnimationFrame=f=>raf(t=>{
  if(Number.isFinite(clock))t=q.go?clock+1000/30+.000004:Math.max(t,clock);
  clock=t;f(t);
  if(q.frames[last])q.go=false;
 });
 const original=navigator.getGamepads?.bind(navigator),
  buttons=Array.from({length:17},()=>({value:0,pressed:false,touched:false}));
 buttons[7]={value:1,pressed:true,touched:true};
 Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>{
  if(!q.go)return original?.()??[];
  const t=(q.c?.n??0)+1,p=t<=1519?0:t<=1899?.52:.18;
  const v=p>0?.11+.89*Math.pow(p,1/1.45):0;
  return [{mapping:'standard',id:'Simulator QA controller',index:0,
           connected:true,axes:[0,v,0,0],buttons}];
 }});
})(5760)
"""

def capture(args,browser,url):
    with browser.new_context(viewport={'width':1200,'height':760},device_scale_factor=1) as ctx:
        p=ctx.new_page()
        faults=[]
        p.on('pageerror',lambda e:faults.append(str(e)))
        p.on('console',lambda e:faults.append(e.text)
             if e.type=='error' and 'favicon' not in e.text.lower() else None)
        p.route('**/*',lambda route:route.continue_()
                if route.request.url.startswith((url+'/', 'blob:'+url+'/', 'data:')) else route.abort())
        p.add_init_script(CONTROLLER)
        assert p.goto(url+'/?departure=cysu&diagnostics',wait_until='domcontentloaded').ok
        assert not faults,faults
        p.wait_for_function("""()=>{const d=window.islandAirDiagnostics;
           return d?.site==='cysu'&&d.mode==='dispatch'&&d.roads&&d.buildings&&d.mainland&&
                  d.detail?.ready>0&&!d.detail.loading;}""",timeout=150000)
        p.get_by_role('button',name='Begin flight').evaluate("e=>{window.hangarProbe.go=true;e.click()}")
        results={}
        for n,eye in zip(TARGETS,STOCK_POSE):
            p.wait_for_function('n=>window.hangarProbe?.frames[n]?.ready',arg=n,timeout=400000,polling=180)
            q=p.evaluate('n=>window.hangarProbe.frames[n]',n)
            assert q['site']=='cysu' and q['frame']==n and q['pose']['mode']=='Chase'
            assert q['flight']['status']=='flying' and q['samples']==4 and q['size']==[1200,760]
            assert q['ownerSHA']==ORIGINAL_POS_SHA and q['indices'] is None and q['vertexCount']==23394
            assert q['rgbaRollbackChannels']==q['unmarkedRed']==q['unrelatedChannels']==0
            assert q['restoredCounts']==q['stockCounts'] and q['error']==[0,0] and not faults, faults
            q['cpuEyeMaxDelta']=max(abs(x-y) for x,y in zip(q['pose']['eye'],eye))
            assert q['cpuEyeMaxDelta']<.05,q['cpuEyeMaxDelta']
            counts=[x['n'] for x in q['roles']]
            if n==TARGETS[-1]:
                assert counts==[0,0,0,0], counts
            else:
                assert counts[0]>1700 and counts[1]>550 and min(counts[2:])>290, counts
            im=base64.b64decode(q.pop('png').split(',',1)[1])
            q['nativePngSha256']=hashlib.sha256(im).hexdigest()
            if n!=TARGETS[-1]:(args.out/f'cysu-stock-{n}.png').write_bytes(im)
            # Runtime UUID deliberately excluded: it differs for the same pack across sessions.
            q.pop('ownerUUID',None)
            results[n]=q
            (args.out/'receipt.json').write_text(json.dumps(results,indent=2)+'\n')
            print(n,counts, q['cpuEyeMaxDelta'],flush=True)
        p.keyboard.press('p')
        p.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
        assert not faults,faults

fixed.stage=prepare
fixed.capture=capture
if __name__=='__main__':
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--checkout',type=Path,default=Path(__file__).resolve().parents[2])
    cli.add_argument('--out',type=Path,required=True)
    cli.add_argument('--chromium',required=True)
    cli.add_argument('--deps',type=Path)
    cli.set_defaults(void_probe=False)
    fixed.run(cli.parse_args())
