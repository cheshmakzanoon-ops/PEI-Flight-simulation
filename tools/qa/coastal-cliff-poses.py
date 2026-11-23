"""Render paired, fixed East Point camera poses with complete scenery. Uses an unmodified game scene."""
import argparse,importlib.util,json,os,time
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import quote
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--checkout',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
p.add_argument('--views',default='cliff-face,cliff-reveal,cliff-south,east-station');p.add_argument('--void-probe',action='store_true');p.add_argument('--chromium',default=os.environ.get('CHROMIUM','chromium'));p.add_argument('--harness',type=Path,default=Path(__file__).with_name('fixed-scenery.py'));args=p.parse_args()
spec=importlib.util.spec_from_file_location('fixed',args.harness);fixed=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixed)
baseStage=fixed.stage
def staged(repo,root,deps,void_probe):
    baseStage(repo,root,deps,void_probe)
    path=root/'src/main.ts';source=path.read_text()
    source=fixed.once(source,'renderer.render(scene,camera);',"""const qaDraws:any[]=[];
  (window as any).qaDraws=qaDraws;
  const target=new THREE.Vector3(center.x,baseH+qa.h*.5,center.z).project(camera);
  (window as any).qaPoseProjection={target:[(target.x+1)*innerWidth*.5,(1-target.y)*innerHeight*.5],fov:camera.fov};
  const demand=(world as any).tiles.filter((q:any)=>Math.hypot(camera.position.x-q.x0-q.w/2,camera.position.z-q.z0-q.d/2)<14500);
  (window as any).qaTextureSet={expected:demand.map((q:any)=>q.id).sort(),ready:demand.filter((q:any)=>q.status==='ready').map((q:any)=>q.id).sort()};
  scene.traverseVisible(o=>{const m=o as THREE.Mesh;if(!m.isMesh||!m.userData.coastalSurvey||m.userData.qaHook)return;
    m.userData.qaHook=true;const original=m.onBeforeRender;
    m.onBeforeRender=function(...a){original.apply(this,a);const geo=this.geometry;
      (window as any).qaDraws.push({site:this.userData.coastalSurvey,lod:this.userData.subdiv,refinement:this.userData.coastalRefinement??null,triangles:Math.min(geo.index?.count??geo.getAttribute('position').count,geo.drawRange.count)/3});};
  });
  renderer.render(scene,camera);""")
    path.write_text(source)
fixed.stage=staged
def capture(a,browser,url):
    output=[]
    corner=dict(lon=-61.97195911804511,lat=46.451417608605276,h=0,fixedBaseH=7.5)
    poses={
        'cliff-face':dict(corner,dist=52,agl=7.2,fixedEyeY=7.2,east=.96,south=.28),
        'cliff-reveal':dict(corner,dist=72,agl=42,fixedEyeY=42,east=.72,south=.69),
        'cliff-south':dict(corner,dist=62,agl=17,fixedEyeY=17,east=.39,south=.92),
        'east-station':dict(fixed.VIEWS['east'],dist=125,agl=45,fixedEyeY=45,fixedBaseH=10.07),
    }
    for name in args.views.split(','):
        pose=poses[name];pose['site']='east'
        context=browser.new_context(viewport={'width':1024,'height':640},device_scale_factor=1)
        try:
            page=context.new_page();errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
            page.goto(url+'/?diagnostics&qa='+quote(json.dumps(pose)),wait_until='domcontentloaded')
            page.wait_for_function('window.reviewCamera?.frame>5 && window.islandAirDiagnostics?.roads && window.islandAirDiagnostics?.buildings && window.islandAirDiagnostics?.mainland',timeout=120000)
            page.add_style_tag(content='body *{visibility:hidden!important} #world{visibility:visible!important}')
            last=None;steady=0;start=time.monotonic()
            while time.monotonic()-start<110:
                d=page.evaluate('()=>({total:window.islandAirDiagnostics.triangles,calls:window.islandAirDiagnostics.drawCalls,frame:window.reviewCamera.frame,assets:window.islandAirDiagnostics.detail,warnings:window.islandAirDiagnostics.layerWarnings,tex:window.qaTextureSet,buildings:window.islandAirDiagnostics.buildingTiles,projected:window.qaPoseProjection,drawn:window.qaDraws})')
                sig=(d['total'],d['calls'],d['assets']['ready'],d['assets']['loading'],json.dumps(d['drawn'],sort_keys=True))
                if (d['frame']>=12 and d['tex']['expected']==d['tex']['ready'] and
                    not d['assets']['loading'] and not d['buildings']['pending'] and not d['buildings']['loading'] and sig==last):steady+=1
                else:steady=0
                if steady>=2:break
                last=sig;page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
            else:raise RuntimeError(f'Unsettled scene: {d}')
            if d['warnings'] or d['assets']['missing'] or errors:raise RuntimeError(str(errors or d))
            page.screenshot(path=str(a.out/(name+'.png')),timeout=120000)
            output.append({'view':name,'pose':pose,'diagnostics':d,'width':1024,'height':640})
            print(name,d['total'],d['calls'],d['drawn'],flush=True)
            (a.out/'report.json').write_text(json.dumps(output,indent=2)+'\n')
        finally:context.close()
fixed.capture=capture
fixed.run(SimpleNamespace(checkout=args.checkout,out=args.out,chromium=args.chromium,views=None,deps=None,void_probe=args.void_probe))
