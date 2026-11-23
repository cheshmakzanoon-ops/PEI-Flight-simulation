#!/usr/bin/env python3
"""Measure optional building depth on actual receiving materials plus a flat no-occluder roof."""
import argparse
import base64
import importlib.util
import json
import os
from pathlib import Path
from urllib.parse import quote
import numpy as np
from PIL import Image

spec = importlib.util.spec_from_file_location('fixed', Path(__file__).with_name('fixed-scenery.py'))
fixed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixed)
base_stage = fixed.stage
def stage(repo, root, deps, void_probe):
    base_stage(repo, root, deps, void_probe)
    main = root / 'src/main.ts'
    main.write_text("import {BuildingShadows as AuditShadows, buildingShadowGLSL as auditGLSL} from './render/local-building-shadows.ts';\n"+main.read_text())
    if 'warmForest=forestStream.warm' in main.read_text():
        ss=main.read_text()
        ss=fixed.once(ss,'const startPoint=projectSite(SITES[0].lon,SITES[0].lat),warmForest=', '''const qp=JSON.parse(new URLSearchParams(location.search).get('qa')!);
          const wc=projectSite(qp.lon,qp.lat),wn=Math.hypot(qp.east,qp.south);
          const startPoint={x:wc.x+qp.dist*qp.east/wn,z:wc.z+qp.dist*qp.south/wn},warmForest=''')
        main.write_text(ss)
    main.write_text(fixed.once(main.read_text(), 'renderer.render(scene,camera);', '''
      renderer.render(scene,camera);
      const wantedForest=(world as any).tiles.filter((tile:any)=>Math.hypot(camera.position.x-tile.x0-tile.w/2,
        camera.position.z-tile.z0-tile.d/2)<14500);
      (window as any).woodlandTileQA={needed:wantedForest.map((t:any)=>t.id).sort(),
        ready:wantedForest.filter((t:any)=>t.status==='ready').map((t:any)=>t.id).sort(),
        settled:wantedForest.filter((t:any)=>t.status==='ready'||t.status==='uncovered')
          .map((t:any)=>t.id).sort()};

      (window as any).captureForest = () => {
        renderer.render(scene,camera);
        const light=world.buildingShadows,active=light.live.value;
        const oldCounts=[renderer.info.render.calls,renderer.info.render.triangles];
        const canvas=renderer.domElement;
        const draw=()=>{renderer.render(scene,camera);return canvas.toDataURL('image/png');};
        light.live.value=0;const old=draw();
        light.live.value=active;const art=draw();
        const artCounts=[renderer.info.render.calls,renderer.info.render.triangles];
        const shadow=light.state;
        const roadRoot=scene.getObjectByName("PEI National Road Network");
        const roadMeshes:THREE.Mesh[]=[];roadRoot?.traverse(o=>{if((o as THREE.Mesh).isMesh)roadMeshes.push(o as THREE.Mesh);});
        const buildMeshes=[...(buildings as any).meshes.values()] as THREE.Mesh[];
        const switcher={value:0};
        const markedRoad=new THREE.ShaderMaterial({side:THREE.DoubleSide,polygonOffset:true,
         polygonOffsetFactor:-2,polygonOffsetUnits:-2,toneMapped:false,uniforms:{marker:switcher},vertexShader:`
         attribute vec2 roadSurface; varying float roadKind;
         #include <common>
         #include <logdepthbuf_pars_vertex>
         void main(){
          roadKind=roadSurface.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
          #include <logdepthbuf_vertex>
         }`, fragmentShader:`
         uniform float marker;varying float roadKind;
         #include <common>
         #include <logdepthbuf_pars_fragment>
         void main(){
          #include <logdepthbuf_fragment>
          gl_FragColor=vec4(marker*vec3(roadKind>.22&&roadKind<.76?1.:.4,0.,0.),1.);
         }`});
        const markedBuilding=new THREE.ShaderMaterial({side:THREE.DoubleSide,toneMapped:false,
         uniforms:{marker:switcher},vertexShader:`
         attribute float facadeStyle,topFlag;varying float fk,tk;
         #include <common>
         #include <logdepthbuf_pars_vertex>
         void main(){
          fk=facadeStyle;tk=topFlag;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
          #include <logdepthbuf_vertex>
         }`, fragmentShader:`
         uniform float marker;varying float fk,tk;
         #include <common>
         #include <logdepthbuf_pars_fragment>
         void main(){
          #include <logdepthbuf_fragment>
          gl_FragColor=vec4(marker*(fk>5.5&&fk<6.5?vec3(1.):tk>.5?vec3(0.,1.,0.):vec3(0.,0.,1.)),1.);
         }`});
        const originals=new Map<THREE.Mesh,THREE.Material|THREE.Material[]>();
        for(const mesh of roadMeshes){originals.set(mesh,mesh.material);mesh.material=markedRoad;}
        for(const mesh of buildMeshes){originals.set(mesh,mesh.material);mesh.material=markedBuilding;}
        const maskOff=draw();switcher.value=1.;const maskOn=draw();
        for(const [mesh,mat] of originals)mesh.material=mat;
        markedRoad.dispose();markedBuilding.dispose();
        const afterDraw=draw();
        const locks=[];
        const cast=(x:number,z:number,r:number,o:THREE.Mesh[])=>buildings?.drawableCasters(x,z,r,o);
        const bareWorldY=world.groundHeight(camera.position.x,camera.position.z);
        const up=camera.position.clone();up.y=bareWorldY+500;
        light.render(up,bareWorldY,cast);const outside=draw();locks.push(light.state);
        const force=(n:number)=>{(light as any).last=performance.now()+n;};
        force(-500);
        const rise=camera.position.clone();rise.y=bareWorldY+340;
        light.render(rise,bareWorldY,cast);const half=draw();locks.push(light.state);
        light.render(camera.position,bareWorldY,cast);const full=draw();locks.push(light.state);
        let snapP=null;const next=camera.position.clone();next.x+=92;
        force(-500);
        light.render(next,bareWorldY,cast);snapP=draw();locks.push(light.state);
        force(-500);light.render(camera.position,bareWorldY,cast);
        const snapReturn=draw();locks.push(light.state);
        // Immediate replacement of a real in-range group inside the 155ms minimum interval.
        let removedOne=false;
        const subset=(x:number,z:number,r:number,o:THREE.Mesh[])=>{
         cast(x,z,r,o);
         if(o.length>1){removedOne=true;o.pop();}
        };
        force(100);light.render(camera.position,bareWorldY,subset);
        const duringChange=draw();locks.push(light.state);
        force(-500);light.render(camera.position,bareWorldY,cast);const restore=draw();locks.push(light.state);
        // Only a local software GL proxy. Sample same settled scene/program, not a real GPU FPS claim.
        const runtimeCost:{active:number,submitMs:number,flushMs:number}[]=[];
        if(new URLSearchParams(location.search).has('flatRoofAudit')){
         const gl=renderer.getContext();gl.finish();
         for(const run of [0,active,active,0,0,active,active,0,0,active]){
          light.live.value=run;const t=performance.now();
          renderer.render(scene,camera);const submitted=performance.now();
          gl.finish();runtimeCost.push({active:run,submitMs:submitted-t,flushMs:performance.now()-t});
         }
         light.live.value=active;
        }
        // Remove all original tiles via the actual public Buildings.update; lock camera, change only manager position.
        (buildings as any).update(-700000,-700000);
        const residentAfter=(buildings as any).meshes.size;
        light.render(camera.position,bareWorldY,cast);const evicted=draw();locks.push(light.state);
        light.live.value=0;const evictedLegacy=draw();
        const evictedExact=evicted===evictedLegacy;
        const synthetic:{roof?:string,roofOff?:string,depth?:unknown,occluder?:string,occluderSnap?:string,sun?:number[],timing?:unknown}= {};
        if(new URLSearchParams(location.search).has('flatRoofAudit')){
         // One flat public-physics plane, no occluder. The SAME depth caster and GLSL as the game.
         const truth=new AuditShadows(renderer,world.sun);
         const only=new THREE.Scene(),geo=new THREE.PlaneGeometry(60,60,1,1);geo.rotateX(-Math.PI/2);
         geo.setAttribute('facadeStyle',new THREE.Float32BufferAttribute([7,7,7,7],1));
         const paint=new THREE.ShaderMaterial({side:THREE.DoubleSide,uniforms:truth.uniforms,
          vertexShader:`varying vec3 land;
           #include <common>
           #include <logdepthbuf_pars_vertex>
           void main(){land=(modelMatrix*vec4(position,1.)).xyz;
            gl_Position=projectionMatrix*viewMatrix*vec4(land,1.);
            #include <logdepthbuf_vertex>
           }`,fragmentShader:`varying vec3 land;
           #include <common>
           #include <logdepthbuf_pars_fragment>
           `+auditGLSL+`
           void main(){
            #include <logdepthbuf_fragment>
            float falseShadow=buildingShade(land,vec3(0.,1.,0.),80.);
            gl_FragColor=vec4(vec3(1.-falseShadow),1.);
           }`});
         const plane=new THREE.Mesh(geo,paint);plane.position.set(0,8,0);only.add(plane);
         const top=new THREE.OrthographicCamera(-30,30,18.75,-18.75,.15,200);
         top.position.set(0,50,0);top.up.set(0,0,-1);top.lookAt(0,8,0);top.updateMatrixWorld();
         truth.render(top.position,0,(_x,_z,_r,o)=>o.push(plane));
         synthetic.depth=truth.state;renderer.render(only,top);synthetic.roof=canvas.toDataURL('image/png');
         truth.live.value=0;renderer.render(only,top);synthetic.roofOff=canvas.toDataURL('image/png');

         // A second building physically protrudes from the roof height. Keep the blocker out
         // of the eye pass, so every pixel tests the receiver independently, never a facade.
         const box=new THREE.BoxGeometry(10,6,8);
         box.setAttribute('facadeStyle',new THREE.Float32BufferAttribute(new Float32Array(box.getAttribute('position').count).fill(7),1));
         const blocker=new THREE.Mesh(box,paint);blocker.position.set(-3,11,1);
         blocker.updateMatrixWorld();
         const source=(_x:number,_z:number,_r:number,o:THREE.Mesh[])=>o.push(plane,blocker);
         (truth as any).last=performance.now()-500;
         truth.render(top.position,0,source);
         renderer.render(only,top);synthetic.occluder=canvas.toDataURL('image/png');
         const shifted=top.position.clone();shifted.x+=92;
         (truth as any).last=performance.now()-500;
         truth.render(shifted,0,source);
         renderer.render(only,top);synthetic.occluderSnap=canvas.toDataURL('image/png');
         synthetic.sun=[world.sun.x,world.sun.y,world.sun.z];
         const gl=renderer.getContext(),timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');
         synthetic.timing={glTiming:!!timer,framebuffer:canvas.width+'×'+canvas.height};
         paint.dispose();geo.dispose();box.dispose();

        }
        return {old,art,maskOn,maskOff,half,snapP,oldCounts,artCounts,shadow,
                during:locks,removedOne,residentAfter,evictedExact,
                materialSwitchExact:art===afterDraw,highExact:old===outside,fullExact:art===full,snapReturnExact:art===snapReturn,
                transitionExact:old===duringChange,restoreExact:art===restore,runtimeCost,synthetic};
      };
    '''))
fixed.stage = stage

POSES={
 'charlottetown':dict(lon=-63.123569,lat=46.232223,dist=192,east=.66,south=.74,h=6,agl=33),
 'summerside':dict(lon=-63.784807,lat=46.39279,dist=150,east=.28,south=.96,h=6,agl=34),
 'montague':dict(lon=-62.64895,lat=46.166375,dist=230,east=.63,south=.78,h=3,agl=45),
 'souris':dict(lon=-62.242203,lat=46.346414,dist=182,east=155,south=95,fixedEyeY=43,fixedBaseH=25,h=0,agl=0)
}
def capture(args, browser, url):
    results = []
    for name in args.views.split(','):
        pose = POSES[name]
        context = browser.new_context(viewport={'width': 720, 'height': 450}, device_scale_factor=1)
        try:
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
            page.goto(url+'/?diagnostics&buildingShadows'+('&flatRoofAudit' if name=='charlottetown' else '')+'&qa='+quote(json.dumps(pose)), wait_until='domcontentloaded')
            page.wait_for_function("""()=>{const d=window.islandAirDiagnostics,b=d?.buildingTiles;
              const w=window.woodlandTileQA;
              return d?.mainland&&d?.roads&&w?.ready.length>0&&w.needed.length===w.settled.length&&
                !d.detail.loading&&b?.ready===b?.wanted&&!b.failed&&d.woodlandStream.inflight===0&&d.buildingShadows?.active;
            }""",timeout=210000,polling=400)
            diag=page.evaluate('window.islandAirDiagnostics')
            if errors or diag['layerWarnings'] or diag['detail']['missing']:
                raise RuntimeError((errors,diag))
            data=page.evaluate('window.captureForest()')
            assert data['shadow']['active'] and data['oldCounts'][0]==data['artCounts'][0],data
            assert data['artCounts'][1]-data['oldCounts'][1]==0,data
            if data["synthetic"]:
                for n in ('roof','roofOff','occluder','occluderSnap'):
                    raw=data["synthetic"].pop(n)
                    (args.out/(name+'-'+n+'.png')).write_bytes(base64.b64decode(raw.split(',',1)[1]))
                roo,ref,block,snap=[np.asarray(Image.open(args.out/(name+'-'+n+'.png')).convert('RGB'),dtype=np.int16) for n in ('roof','roofOff','occluder','occluderSnap')]
                # Ignore tiny antialias footprint of synthetic plane if browser viewport differs (canvas covers it at this aspect).
                where=ref[:,:,0]>250;dark=np.max(ref-roo,axis=2)
                data["synthetic"]["falseShadow"]={"litReference":int(where.sum()), "falsePixels":int(((dark>2)&where).sum()),"maxDarken":int(dark[where].max())}
                # Direct ray/slab intersection of the sun path with the exact physical 10x6x8 box.
                ps,pw=roo.shape[:2];scale=np.array([37.5/ps,60./pw]);sun=np.asarray(data['synthetic']['sun'])
                z,x=np.indices((ps,pw),dtype=float);z=(z+.5)*scale[0]-18.75;x=(x+.5)*scale[1]-30
                lo=np.stack((x,x*0+8,z),axis=-1)
                bounds=np.array([[-8,8,-3],[2,14,5]],dtype=float)
                t=(bounds[:,None,None,:]-lo)/sun
                begin=np.min(t,axis=0).max(axis=-1);end=np.max(t,axis=0).min(axis=-1)
                predicted=(end>=begin)&(end>0)
                from scipy.ndimage import distance_transform_edt
                core=distance_transform_edt(predicted,sampling=scale)>1.6
                lit=where&(distance_transform_edt(~predicted,sampling=scale)>1.6)
                cd=(ref-block).max(axis=2);phase=np.abs(snap-block).max(axis=2)
                data['synthetic']['occluderProof']={
                  'predictedPixels':int(predicted.sum()),'trueShadowCore':int(core.sum()),'coreDarkPixels':int(((cd>=220)&core).sum()),
                  'protectedLit':int(lit.sum()),'litFalsePixels':int(((cd>2)&lit).sum()),'litFalseMax':int(cd[lit].max()),
                  'recenterEffectPixels':int((phase>0).sum()),'recenterEffectAbove3':int((phase>3).sum()),'recenterMax':int(phase.max())}
            for key in ('old','art','half','snapP','maskOn','maskOff'):
                raw=data.pop(key)
                (args.out/(name+'-'+key+'.png')).write_bytes(base64.b64decode(raw.split(',',1)[1]))
            pix=lambda n:np.asarray(Image.open(args.out/(name+'-'+n+'.png')).convert('RGB'),dtype=np.int16)
            absdelta=lambda a,b:np.abs(a-b).max(axis=2)
            old,art,p,off,half,snap=(pix(n) for n in ('old','art','maskOn','maskOff','half','snapP'))
            marker=(p-off).max(axis=2);r,g,b=np.moveaxis(p-off,2,0)
            paved=(r>165)&(g<16)&(b<16);roof=(g>165)&(r<16)&(b<16);wall=(b>165)&(g<16)&(r<16);specific=(r>165)&(g>165)&(b>165)
            ab=absdelta(art,old);snapd=absdelta(snap,art);halfd=absdelta(half,old)
            data['pixelDelta'] = dict(changed=int((ab>0).sum()),over1=int((ab>1).sum()),max=int(ab.max()),top80Changed=int((ab[:80,:]>0).sum()),
                                     halfVsOld=int((halfd>1).sum()),halfMaxDelta=int(halfd.max()),
                                     snapChanged=int((snapd>0).sum()),snapOver4=int((snapd>4).sum()),snapMax=int(snapd.max()))
            data['receivers']={}
            for n,m in [('paved',paved),('roof',roof),('wall',wall),('style6',specific),('notRoadOrBldg',marker==0)]:
                v=ab[m]
                data['receivers'][n]={"pixels":int(m.sum()),"changed":int((v>1).sum()),"maxDelta":int(v.max()) if v.size else 0}
            assert data['oldCounts']==data['artCounts'],data
            assert data['pixelDelta']['top80Changed']==0,data
            for gate in ('evictedExact','fullExact','highExact','materialSwitchExact','restoreExact','transitionExact'):
                assert data[gate],(name,gate)
            if name=='souris':
                assert data['receivers']['style6']['changed']==0,data['receivers']
            if data.get('synthetic'):
                witness=data['synthetic']
                assert witness['falseShadow']['falsePixels']==0,witness
                proof=witness['occluderProof']
                assert proof['trueShadowCore']==proof['coreDarkPixels'] and proof['litFalsePixels']==0,proof
            results.append(dict(view=name, pose=pose, triangles=diag['triangles'], calls=diag['drawCalls'],detail=diag['detail'],tiles=page.evaluate('window.woodlandTileQA'),native=diag.get('woodlandStream'),hedgerows=diag.get('hedgerows'),comparison=data))
            (args.out/'report.json').write_text(json.dumps(results, indent=2)+'\n')
            print(name, diag['triangles'], diag['drawCalls'], data, flush=True)
        finally:
            context.close()
    (args.out/'report.json').write_text(json.dumps(results, indent=2)+'\n')

fixed.capture = capture
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--checkout', type=Path, required=True)
parser.add_argument('--out', type=Path, required=True)
parser.add_argument('--chromium', default=os.getenv('CHROMIUM', 'chromium'))
parser.add_argument('--deps', type=Path)
parser.add_argument('--views', default=','.join(POSES))
parser.set_defaults(void_probe=False)
fixed.run(parser.parse_args())
