"""Fixed-pose exact WebGL sky contribution and stock rollback for regular rims."""
import argparse,base64,importlib.util,io,json
from pathlib import Path
from urllib.parse import quote
import numpy as np
from PIL import Image
spec=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixed)
prior=fixed.stage
POSE={'south21': {'lon': -62.53736049, 'lat': 45.99272727272727, 'first': '24-20', 'second': '24-21', 'edge': 21, 'east': 0.42, 'south': -0.91, 'dist': 64, 'agl': 48, 'h': 0}, 'south21-reciprocal': {'lon': -62.53736049, 'lat': 45.99272727272727, 'first': '24-20', 'second': '24-21', 'edge': 21, 'east': -0.42, 'south': 0.91, 'dist': 64, 'agl': 48, 'h': 0}, 'south21-outside': {'lon': -62.543738839285716, 'lat': 45.99272727272727, 'first': '24-20', 'second': '24-21', 'edge': 21, 'east': 0.707, 'south': -0.707, 'dist': 45, 'agl': 45, 'h': 0}, 'south21-mixed': {'lon': -62.53736049, 'lat': 45.99272727272727, 'first': '24-20', 'second': '24-21', 'edge': 21, 'east': 0.33, 'south': -0.94, 'dist': 5600, 'agl': 420, 'h': 0}}
POSITIVE={'south21','south21-reciprocal'}
NEGATIVE={'south21-mixed'}
HOOK=r'''
  (window as any).qaRimState=()=>(world as any).__QA_RIM_STATE__;
  (window as any).qaRimPrepare=()=>{
   const end=(world as any).__QA_RIM_METHOD__(camera);end?.();
   return (world as any).__QA_RIM_STATE__?.source;
  };
  (window as any).qaRimMove=(p)=>{Object.assign(qa,p);return (window as any).reviewCamera?.frame;};
  (window as any).qaRimPaintOnce=()=>{
   const end=(world as any).__QA_RIM_METHOD__(camera);
   if(!end)return null;
   const gl=renderer.getContext();
   try{
    renderer.render(scene,camera);
    return {state:(world as any).__QA_RIM_STATE__,error:gl.getError(),draws:renderer.info.render.calls,triangles:renderer.info.render.triangles};
   }finally{end();}
  };

  (window as any).nativeGroundRim=async()=>{
   const local=(world as any).tiles.filter((t:any)=>t.id===qa.first||t.id===qa.second);
   const sky=(world as any).sky as THREE.Mesh;
   const state=(sky.material as THREE.ShaderMaterial).uniforms.skyDiagnostic;
   const ctx=renderer.getContext(),W=ctx.drawingBufferWidth,H=ctx.drawingBufferHeight;
   const snap=(use:boolean,skyID:number)=>{
    state.value=skyID;
    const stop=use?__ACTUAL_RIM_HOOK__:undefined;
    try{
     const z=local.map((p:any)=>p.local.uniforms?.__QA_RIM_UNIFORM__?.value??0);
     renderer.render(scene,camera);
     return {z,drawn:use?((world as any).__QA_RIM_STATE__?.drawnFine??[]):[],image:renderer.domElement.toDataURL('image/png'),
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
   const rimVertices=local.map((t:any)=>{
     if(t.lod!==112)return null;
     const m=t.fine,a=m.geometry.getAttribute('position'),off=t.id===qa.first?112*113:0;
     return Array.from({length:113},(_,j)=>[
       Math.fround(Math.fround(m.matrixWorld.elements[12])+a.getX(off+j)),
       Math.fround(Math.fround(m.matrixWorld.elements[13])+a.getY(off+j)),
       Math.fround(Math.fround(m.matrixWorld.elements[14])+a.getZ(off+j))
     ]);
   });
   return {stock,beforeA,beforeB,trial,afterA,afterB,rollback,view,rimVertices,buffersTouched:mismatches,contactExact,contactSamples:groundBefore.length,
    owners:local.map((p:any)=>({id:p.id,lod:p.lod,seams:p.seams,gainAfter:p.local.uniforms?.__QA_RIM_UNIFORM__?.value??0})),
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
    main.write_text(fixed.once(s,a,HOOK.replace('__ACTUAL_RIM_HOOK__',expr).replace('__QA_RIM_METHOD__',args.method).replace('__QA_RIM_STATE__',args.state).replace('__QA_RIM_UNIFORM__',args.uniform)+a))
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
            prime=name=='south21-mixed' and not (a.stock_only or a.expect_msaa0_veto)
            page.goto(url+'/?diagnostics&qa='+quote(json.dumps(POSE['south21'] if prime else q)),wait_until='domcontentloaded')
            fixed.settle(page,errors)
            if not a.stock_only and not a.expect_msaa0_veto and (name in POSITIVE or prime or name=='south21-outside'):
                try:
                    page.wait_for_function("window.qaRimState?.()?.source==='verified'||window.qaRimPrepare?.()==='verified'",timeout=120000,polling=350)
                except Exception:
                    print(name,'candidate did not admit; last renderer state:',page.evaluate("()=>({state:window.qaRimState?.(),gl:document.querySelector('#world')?.getContext('webgl2')?.getContextAttributes()})"), flush=True)
                    raise
            priorActualDraw=None
            if prime:
                priorActualDraw=page.evaluate("window.qaRimPaintOnce()")
                assert priorActualDraw and priorActualDraw['error']==0 and priorActualDraw['state']['source']=='verified' and priorActualDraw['state']['drawnFine']==[q['second']],priorActualDraw
                frame=page.evaluate("q=>window.qaRimMove(q)",q)
                page.wait_for_function("n=>window.reviewCamera?.frame>=n",arg=frame+8,timeout=120000,polling=350)
                fixed.settle(page,errors)
            v=page.evaluate('window.nativeGroundRim()')
            if priorActualDraw:v['priorActualDraw']=priorActualDraw
            assert not errors and v['samples']==(0 if a.no_msaa else 4) and v['buffersTouched']==0 and v['contactExact'] and v['contactSamples']==50 and v['stock']==v['rollback'],(name,v['owners'],errors)
            assert v['attributes']['alpha'] is True and v['attributes']['depth'] is True and v['attributes']['antialias'] is (not a.no_msaa),v['attributes']
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
            if name in POSITIVE:
                assert {p['lod'] for p in v['owners']}=={112} and metric['skyBefore']>0
                rows=np.asarray(v['rimVertices'],dtype=np.float64)
                assert rows.shape==(2,113,3) and np.array_equal(rows[0,:,:2],rows[1,:,:2])
                assert np.all(rows[1,:,2]-rows[0,:,2]==.00390625)
                if not a.stock_only and not a.expect_msaa0_veto:
                    y,x=np.nonzero(old|new);pix=np.c_[x+.5,y+.5]
                    mat=np.asarray(v['view']['projection']).reshape((4,4),order='F') @ np.asarray(v['view']['view']).reshape((4,4),order='F')
                    def support(lo,hi):
                        d=np.full(len(pix),np.inf)
                        for row in rows:
                            pos=row[lo:hi];clip=(mat@np.c_[pos,np.ones(len(pos))].T).T
                            assert np.all(clip[:,3]>0),clip
                            v2=clip[:,:2]/clip[:,3:4]
                            v2=np.c_[(v2[:,0]+1)*420,(1-v2[:,1])*270]
                            for u,w in zip(v2[:-1],v2[1:]):
                                span=w-u; t=np.clip((pix-u)@span/(span@span),0,1)
                                d=np.minimum(d,np.linalg.norm(pix-u-t[:,None]*span,axis=1))
                        return d<=.75
                    core=support(37,41)
                    guard=support(36,42)  # edges touching an adjusted endpoint
                    metric['oldInTarget']=int(np.count_nonzero(old[y,x]&core))
                    metric['newInTarget']=int(np.count_nonzero(new[y,x]&core))
                    metric['outsideGuardSkyChanged']=int(np.count_nonzero((old[y,x]!=new[y,x])&~guard))
                    metric['transitionSkyChanged']=int(np.count_nonzero((old[y,x]!=new[y,x])&guard&~core))
                    assert metric['oldInTarget']>0 and metric['newInTarget']==metric['outsideGuardSkyChanged']==metric['strongOutsideStockSky']==0,(name,metric)
                    assert metric['positiveStrengthOutsideSky']<=1,(name,metric)
                    assert v['trial']['drawn']==[q['second']],(name,v['trial'])
            if name=='south21-outside':
                assert {p['lod'] for p in v['owners']}=={112} and metric['skyBefore']>0
                assert np.array_equal(A,B) and np.array_equal(old,new), (name,metric)
                metric['outsideWindowSameOwners']=True
            if a.stock_only or a.expect_msaa0_veto or name in NEGATIVE:
                assert np.array_equal(A,B) and not any(v['trial']['z']) and not set(v['trial']['drawn'])&{q['first'],q['second']},(name,v['owners'],metric)
                if name=='south21-mixed':assert any(p['lod']!=112 for p in v['owners']),(name,v['owners'])
            results[name]={'pose':q,'renderer':'Chromium WebGL 2','pixelGate':metric,**v}
            (a.out/'receipt.json').write_text(json.dumps(results,indent=2)+'\n')
            print(name,metric,v['owners'],flush=True)
        finally:page.close()
fixed.capture=capture
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--checkout',required=True,type=Path);parser.add_argument('--out',required=True,type=Path)
parser.add_argument('--chromium',required=True);parser.add_argument('--deps',type=Path)
parser.add_argument('--views',default=','.join(POSE));parser.add_argument('--stock-only',action='store_true')
parser.add_argument('--method',default='beginSouth21RimDraw')
parser.add_argument('--state',default='south21RimState')
parser.add_argument('--uniform',default='peiSouth21RimActive')
parser.add_argument('--expect-msaa0-veto',action='store_true')
parser.add_argument('--no-msaa',action='store_true')
parser.set_defaults(void_probe=False)
args=parser.parse_args()
assert all(x.isidentifier() for x in (args.method,args.state,args.uniform))
assert not args.expect_msaa0_veto or args.no_msaa
fixed.run(args)
