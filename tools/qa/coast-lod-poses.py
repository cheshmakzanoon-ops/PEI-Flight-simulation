"""Independent fixed approaches with actual Three renderer counts and single-frame color comparison inputs."""
import argparse,importlib.util,json,os,time
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import quote
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--checkout',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
p.add_argument('--views',default='east-8500,east-22000,west-8500,west-22000');p.add_argument('--chromium',default=os.environ.get('CHROMIUM','chromium'));p.add_argument('--harness',type=Path,default=Path(__file__).with_name('fixed-scenery.py'));args=p.parse_args()
spec=importlib.util.spec_from_file_location('fixed',args.harness);fixed=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixed)
baseStage=fixed.stage
def staged(repo,root,deps,void_probe):
    baseStage(repo,root,deps,void_probe)
    path=root/'src/main.ts';source=path.read_text()
    source=fixed.once(source,'renderer.render(scene,camera);',"""const qaDraws:any[]=[];
  (window as any).qaDraws=qaDraws;
  const demand=(world as any).tiles.filter((q:any)=>Math.hypot(camera.position.x-q.x0-q.w/2,camera.position.z-q.z0-q.d/2)<14500);
  (window as any).qaTextureSet={expected:demand.map((q:any)=>q.id).sort(),ready:demand.filter((q:any)=>q.status==='ready').map((q:any)=>q.id).sort()};
  scene.traverseVisible(o=>{const m=o as THREE.Mesh;if(!m.isMesh||!m.userData.coastalSurvey||m.userData.qaHook)return;
    m.userData.qaHook=true;const original=m.onBeforeRender;
    m.onBeforeRender=function(...a){original.apply(this,a);const geo=this.geometry;
      (window as any).qaDraws.push({site:this.userData.coastalSurvey,lod:this.userData.subdiv,triangles:Math.min(geo.index?.count??geo.getAttribute('position').count,geo.drawRange.count)/3});};
  });
  renderer.render(scene,camera);""")
    path.write_text(source)
fixed.stage=staged
def capture(a,browser,url):
    output=[]
    for site in ['east','west']:
      for dist,alt in [(8500,850),(22000,2200)]:
        if f'{site}-{dist}' not in args.views.split(','): continue
        pose=dict(fixed.VIEWS[site],site=site,dist=dist,agl=alt,east=1,south=0,fixedEyeY=alt,fixedBaseH=10.07 if site=='east' else 1.79)
        context=browser.new_context(viewport={'width':960,'height':540},device_scale_factor=1)
        try:
            page=context.new_page();errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
            page.goto(url+'/?diagnostics&qa='+quote(json.dumps(pose)),wait_until='domcontentloaded')
            page.wait_for_function('window.reviewCamera?.frame>5 && window.islandAirDiagnostics?.roads && window.islandAirDiagnostics?.buildings && window.islandAirDiagnostics?.mainland',timeout=120000)
            page.add_style_tag(content='body *{visibility:hidden!important} #world{visibility:visible!important}')
            last=None;steady=0;start=time.monotonic()
            while time.monotonic()-start<110:
                d=page.evaluate('()=>({total:window.islandAirDiagnostics.triangles,calls:window.islandAirDiagnostics.drawCalls,frame:window.reviewCamera.frame,assets:window.islandAirDiagnostics.detail,warnings:window.islandAirDiagnostics.layerWarnings,tex:window.qaTextureSet,buildings:window.islandAirDiagnostics.buildingTiles,drawn:window.qaDraws})')
                sig=(d['total'],d['calls'],d['assets']['ready'],d['assets']['loading'],json.dumps(d['drawn'],sort_keys=True))
                if (d['frame']>=12 and d['tex']['expected']==d['tex']['ready'] and
                    not d['assets']['loading'] and not d['buildings']['pending'] and not d['buildings']['loading'] and sig==last):steady+=1
                else:steady=0
                if steady>=2:break
                last=sig;page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
            else:raise RuntimeError(f'Unsettled scene: {d}')
            if d['warnings'] or d['assets']['missing'] or errors:raise RuntimeError(str(errors or d))
            name=f'{site}-{dist}';page.screenshot(path=str(a.out/(name+'.png')),timeout=120000)
            output.append({'view':name,'pose':pose,'diagnostics':d,'width':960,'height':540})
            print(name,d['total'],d['calls'],d['drawn'],flush=True)
            (a.out/'report.json').write_text(json.dumps(output,indent=2)+'\n')
        finally:context.close()
fixed.capture=capture
fixed.run(SimpleNamespace(checkout=args.checkout,out=args.out,chromium=args.chromium,views=None,deps=None,void_probe=False))
