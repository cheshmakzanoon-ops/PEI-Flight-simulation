"""Fixed-pose exact WebGL sky contribution and stock rollback for regular rims."""
import argparse,base64,importlib.util,io,json
from pathlib import Path
from urllib.parse import quote
import numpy as np
from PIL import Image
spec=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixed)
prior=fixed.stage
POSE={
 'gap17':dict(lon=-62.83363477,lat=46.20363636,first='20-16',second='20-17',edge=17,east=.42,south=-.91,dist=75,agl=44,h=0),
 'gap19':dict(lon=-62.85521484,lat=46.09818182,first='20-18',second='20-19',edge=19,east=.42,south=-.91,dist=75,agl=44,h=0),
 'clean16':dict(lon=-62.98221484,lat=46.25636364,first='18-15',second='18-16',edge=16,east=.42,south=-.91,dist=75,agl=44,h=0),
 'mixed17':dict(lon=-62.83363477,lat=46.20363636,first='20-16',second='20-17',edge=17,east=.33,south=-.94,dist=5600,agl=420,h=0),
 'coarse19':dict(lon=-62.85521484,lat=46.09818182,first='20-18',second='20-19',edge=19,east=.99,south=.1,dist=10500,agl=760,h=0),
}
# A detached probe only. The exact application begin/restore path below is
# intentionally called for each opted draw and never for stock controls.
HOOK=r'''
  (window as any).nativeGroundRim=async()=>{
   const local=(world as any).tiles.filter((t:any)=>t.id===qa.first||t.id===qa.second);
   const sky=(world as any).sky as THREE.Mesh;
   const state=(sky.material as THREE.ShaderMaterial).uniforms.skyDiagnostic;
   const ctx=renderer.getContext(),W=ctx.drawingBufferWidth,H=ctx.drawingBufferHeight;
   const snap=(use:boolean,skyID:number)=>{
    state.value=skyID;
    const stop=use?__ACTUAL_RIM_HOOK__:undefined;
    try{
     const z=local.map((p:any)=>p.local.uniforms?.peiRegularNorthRimZ?.value??0);
     renderer.render(scene,camera);
     return {z,drawn:use?((world as any).regularNorthRimState?.drawnFine??[]):[],image:renderer.domElement.toDataURL('image/png'),
      calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,error:ctx.getError()};
    }finally{stop?.();state.value=0;}
   };
   const old=local.map((q:any)=>q.lod>8?q.fine:q.coarse);
   const get=(q:any)=>[q.geometry,q.geometry.index,...['position','uv','normal'].map(a=>q.geometry.getAttribute(a)),q.material];
   const priorRefs=old.map(get);
   const priorBits=priorRefs.map((a:any[])=>a.slice(1,5).map(p=>Uint8Array.from(new Uint8Array(p.array.buffer,p.array.byteOffset,p.array.byteLength))));
   const {x,z}=project(qa.lon,qa.lat);
   const contact=()=>[-37,-8,0,8,37].flatMap(dx=>[-3,-.1,0,.1,3].flatMap(dz=>[world.groundHeight(x+dx,z+dz),world.visualGroundHeight(x+dx,z+dz)]));
   const groundBefore=contact();
   const stock=snap(false,0),beforeA=snap(false,1),beforeB=snap(false,2);
   const trial=snap(true,0),afterA=snap(true,1),afterB=snap(true,2),rollback=snap(false,0);
   const groundAfter=contact(),contactExact=groundBefore.every((g,i)=>Number.isFinite(g)&&Object.is(g,groundAfter[i]));
   let mismatches=0;
   for(const [i,q] of old.entries()){
    const now=get(q);
    for(const [k,obj] of now.entries())if(obj!==priorRefs[i][k])mismatches++;
    for(const [k,p] of now.slice(1,5).entries()){
     const bits=new Uint8Array(p.array.buffer,p.array.byteOffset,p.array.byteLength),before=priorBits[i][k];
     if(bits.length!==before.length){mismatches++;continue;}
     for(let n=0;n<bits.length;n++)if(bits[n]!==before[n])mismatches++;
    }
   }
   const view={eye:camera.position.toArray(),view:camera.matrixWorldInverse.toArray(),projection:camera.projectionMatrix.toArray(),W,H};
   return {stock,beforeA,beforeB,trial,afterA,afterB,rollback,view,buffersTouched:mismatches,contactExact,contactSamples:groundBefore.length,
    owners:local.map((p:any)=>({id:p.id,lod:p.lod,seams:p.seams,gainAfter:p.local.uniforms?.peiRegularNorthRimZ?.value??0})),
    samples:ctx.getParameter(ctx.SAMPLES),attributes:ctx.getContextAttributes()};
  };
'''
def stage(repo,root,deps,void):
    prior(repo,root,deps,False)
    world=root/'src/render/world.ts';s=world.read_text()
    s=fixed.once(s,'if(skyDiagnostic>.5){gl_FragColor=vec4(1.,0.,1.,1.);return;}',
      'if(skyDiagnostic>.5){gl_FragColor=skyDiagnostic<1.5?vec4(1.,0.,1.,1.):vec4(0.,1.,0.,1.);return;}')
    world.write_text(s)
    main=root/'src/main.ts';s=main.read_text()
    a="  if(world.tryonRockState==='pending'"
    if args.no_msaa:s=fixed.once(s,'antialias:true','antialias:false')
    expr='undefined' if args.stock_only else '(world as any).'+args.method+'(camera)'
    main.write_text(fixed.once(s,a,HOOK.replace('__ACTUAL_RIM_HOOK__',expr)+a))
fixed.stage=stage

def draw(png):
    b=base64.b64decode(png.split(',',1)[1])
    return b,np.asarray(Image.open(io.BytesIO(b)).convert('RGBA'),dtype=np.int16)
def capture(a,browser,url):
    results={}
    for name in a.views.split(','):
        q=POSE[name]
        page=browser.new_page(viewport={'width':840,'height':540});page.set_default_timeout(120000);errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
        try:
            page.goto(url+'/?diagnostics&qa='+quote(json.dumps(q)),wait_until='domcontentloaded')
            fixed.settle(page,errors)
            if not a.stock_only and not a.no_msaa and name in {'gap17','gap19'}:
                try:
                    page.wait_for_function("id=>window.islandAirDiagnostics?.regularNorthRim?.source==='verified'&&window.islandAirDiagnostics.regularNorthRim.drawnFine.includes(id)",arg=q['second'],timeout=120000,polling=350)
                except Exception:
                    print(name,'candidate did not admit; last renderer state:',page.evaluate("()=>({state:window.islandAirDiagnostics?.regularNorthRim,gl:document.querySelector('#world')?.getContext('webgl2')?.getContextAttributes()})"), flush=True)
                    raise
            v=page.evaluate('window.nativeGroundRim()')
            assert not errors and v['samples']==(0 if a.no_msaa else 4) and v['buffersTouched']==0 and v['contactExact'] and v['contactSamples']==50 and v['stock']==v['rollback'],(name,v['owners'],errors)
            assert len(v['owners'])==2 and not any(q['gainAfter'] for q in v['owners'])
            assert v['view']['W']==840 and v['view']['H']==540
            arr={}
            for label in ('stock','beforeA','beforeB','trial','afterA','afterB','rollback'):
                p=v[label]
                assert p['calls']==v['stock']['calls'] and p['triangles']==v['stock']['triangles'] and p['error']==0
                raw,arr[label]=draw(p.pop('image'))
                if label!='rollback':(a.out/f'{name}-{label}.png').write_bytes(raw)
            A,B=arr['stock'],arr['trial']
            old=(arr['beforeA'][:,:,:3]!=arr['beforeB'][:,:,:3]).any(2)
            new=(arr['afterA'][:,:,:3]!=arr['afterB'][:,:,:3]).any(2)
            C=abs(A-B);strong=C[:,:,:3].max(2)>2
            metric={'skyBefore':int(old.sum()),'skyAfter':int(new.sum()),
              'skyIntroduced':int((new&~old).sum()),'strongRGB':int(strong.sum()),
              'strongOutsideStockSky':int((strong&~old).sum()),'alphaChanged':int((C[:,:,3]>0).sum()),
              'positiveStrengthOutsideSky':int(C[:,:,:3][~old].max(initial=0)),
              'strongInsideBytes':int(((C[:,:,:3].max(2)>0)&old).sum())}
            assert metric['skyIntroduced']==metric['alphaChanged']==0,metric
            if name in {'gap17','gap19'}:
                assert {p['lod'] for p in v['owners']}=={112} and (a.no_msaa or metric['skyBefore']>0)
                if not a.stock_only and not a.no_msaa:
                    assert metric['skyAfter']==metric['strongOutsideStockSky']==0 and v['trial']['drawn']==[q['second']],(name,metric,v['trial'])
            if a.no_msaa or name in {'clean16','mixed17','coarse19'}:
                assert np.array_equal(A,B) and not any(v['trial']['z']) and not set(v['trial']['drawn'])&{q['first'],q['second']},(name,v['owners'],metric)
                if name in {'mixed17','coarse19'}:assert any(p['lod']!=112 for p in v['owners']),(name,v['owners'])
            results[name]={'pose':q,'renderer':'Chromium WebGL 2','pixelGate':metric,**v}
            (a.out/'receipt.json').write_text(json.dumps(results,indent=2)+'\n')
            print(name,metric,v['owners'],flush=True)
        finally:page.close()
fixed.capture=capture
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--checkout',required=True,type=Path);parser.add_argument('--out',required=True,type=Path)
parser.add_argument('--chromium',required=True);parser.add_argument('--deps',type=Path)
parser.add_argument('--views',default=','.join(POSE));parser.add_argument('--stock-only',action='store_true')
parser.add_argument('--method',default='beginRegularNorthRimDraw')
parser.add_argument('--no-msaa',action='store_true')
parser.set_defaults(void_probe=False)
args=parser.parse_args()
assert args.method.isidentifier()
fixed.run(args)
