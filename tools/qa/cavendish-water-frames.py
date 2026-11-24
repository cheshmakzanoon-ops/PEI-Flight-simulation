"""Capture matched real Three.js views of the dated Cavendish pond core."""
import argparse
import base64
import importlib.util
import json
import math
from pathlib import Path

S=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('fixed',S/'fixed-scenery.py')
fixed=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixed)

def view(eye,focus):
    x=(eye[0]-focus[0])*76766.24
    z=(eye[1]-focus[1])*-111161.2
    return dict(lon=focus[0],lat=focus[1],east=x,south=z,nearDist=math.hypot(x,z),
                nearAgl=eye[2],h=2.94,fixedEyeY=eye[2],fixedBaseH=0.)

fixed.VIEWS.update({
    'dunelands-air':view((-63.3909,46.49320,99.),(-63.38712,46.49512)),
    'dunelands-edge':view((-63.38762,46.49355,17.),(-63.38669,46.49485)),
    'dunelands-shore':view((-63.38946,46.49730,19.),(-63.38720,46.49534)),
})

stage_before=fixed.stage
def stage(repo,target,dependencies,probe):
    stage_before(repo,target,dependencies,probe)
    p=target/'src/main.ts'
    text=p.read_text()
    text=fixed.once(text,'const diagnostic=', '''(window as any).dunelandsProbe=(points:[number,number][])=>points.map(([lon,lat])=>{
      const {x,z}=project(lon,lat);
      return {surface:world.surface(x,z),flight:sceneSurface(x,z),charted:world.cover.distance(terrain,x,z),
        computedTerrain:world.visualGroundHeight(x,z),fresh:world.freshwaterContains(x,z)};
    });
    (window as any).dunelandsOrtho=()=>((world as any).tiles as any[])
      .filter(t=>t.status==='ready').map(t=>t.id).sort();
    (window as any).dunelandsRaster=()=>{
      const gl=renderer.getContext();return {samples:gl.getParameter(gl.SAMPLES),width:gl.drawingBufferWidth,height:gl.drawingBufferHeight};
    };
    let pendingQA:{done:(images:string[])=>void}|null=null,dxQA=0,dzQA=0;
    (window as any).grabDunelandsPair=(dx:number,dz:number)=>new Promise<string[]>(done=>{
      dxQA=dx;dzQA=dz;pendingQA={done};
    });
    const diagnostic=''')
    text=fixed.once(text,'ex=center.x+qa.dist*qa.east/norm,ez=center.z+qa.dist*qa.south/norm',
                         'ex=center.x+qa.dist*qa.east/norm+dxQA,ez=center.z+qa.dist*qa.south/norm+dzQA')
    anchor='  renderer.render(scene,camera);'
    text=fixed.once(text,anchor,anchor+'''
    if(pendingQA){
      const {done}=pendingQA;pendingQA=null;
      const normal=renderer.domElement.toDataURL('image/png');
      const ink=(world as any).sky.material.uniforms.skyDiagnostic;
      ink.value=1.;renderer.render(scene,camera);ink.value=0.;
      done([normal,renderer.domElement.toDataURL('image/png')]);
    }
    ''')
    p.write_text(text)
fixed.stage=stage

settle_before=fixed.settle
def settle(page,errors):
    page.wait_for_function("window.dunelandsOrtho?.().length>=12")
    facts=settle_before(page,errors)
    facts['orthoTiles']=page.evaluate('window.dunelandsOrtho()')
    if args.lock:
        site=page.evaluate("JSON.parse(new URLSearchParams(location.search).get('qa')).site")
        named=next(r for r in baseline if r['pose']['site']==site)
        assert facts['orthoTiles']==named['diag']['orthoTiles'],facts
    expected=args.mode=='live'
    assert bool(facts['cavendishWaterCore'])==expected,facts
    facts['optionalRequests']=page.evaluate("performance.getEntriesByType('resource').filter(r=>r.name.endsWith('/cavendish-water-2020.r8.gz')).length")
    assert facts['optionalRequests']==int(args.mode!='stock'),facts
    if args.probes:
        facts['controlTypes']=[x['expect'] for x in points]
        facts['contacts']=page.evaluate('p=>window.dunelandsProbe(p)',[x['coord'] for x in points])
        for witness,sample in zip(points,facts['contacts']):
            assert sample['surface']==sample['flight'],sample
            if expected and witness['expect']=='wet':
                assert sample['fresh'] and not sample['surface']['land'],(witness,sample)
            else:assert not sample['fresh'] and sample['surface']['land'],(witness,sample)
    return facts

class Browser:
    def __init__(self,browser):self.browser=browser
    def new_context(self,**options):
        c=self.browser.new_context(**options);new=c.new_page
        def page():
            p=new();goto=p.goto
            if args.mode=='bad':
                p.route('**/cavendish-water-2020.r8.gz',lambda r:r.fulfill(status=200,body=b'Invalid comparison fixture'))
            p.goto=lambda path,**kw:goto(path.replace('/?diagnostics&qa=', '/?diagnostics&bowleySurveyPreview&'+
                         ('cavendishWaterReview&' if args.mode!='stock' else '')+'qa='),**kw)
            if args.aperture_motion:
                def shot(path,timeout):
                    file=Path(path);rows=[]
                    for i,(x,z) in enumerate([(-4,-2),(-2,-1),(0,0),(2,1),(4,2)]):
                        art,sky=[base64.b64decode(q.split(',',1)[1]) for q in p.evaluate('p=>window.grabDunelandsPair(...p)',[x,z])]
                        file.with_name(f'{file.stem}-{i}-art.png').write_bytes(art)
                        file.with_name(f'{file.stem}-{i}-void.png').write_bytes(sky)
                        rows.append(dict(offsetXZ=[x,z],pose=p.evaluate('window.reviewCamera'),
                                         orthoIds=p.evaluate('window.dunelandsOrtho()'),raster=p.evaluate('window.dunelandsRaster()')))
                        if i==2:file.write_bytes(art)
                    file.with_name(file.stem+'-motion.json').write_text(json.dumps(rows,indent=2)+'\n')
                    return file.read_bytes()
                p.screenshot=shot
            return p
        c.new_page=page
        return c

capture_before=fixed.capture
def capture(a,browser,url):return capture_before(a,Browser(browser),url)
fixed.capture=capture
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--checkout',type=Path,default=S.parents[1]);p.add_argument('--deps',type=Path)
p.add_argument('--chromium',required=True);p.add_argument('--out',type=Path,required=True)
p.add_argument('--size',default='864x540');p.add_argument('--views',default='dunelands-air-close,dunelands-edge-close,dunelands-shore-close')
p.add_argument('--mode',choices=('stock','live','bad'),required=True)
p.add_argument('--aperture-motion',action='store_true');p.add_argument('--lock',type=Path);p.add_argument('--probes',type=Path)
args=p.parse_args();args.pose_baseline=args.lock;args.void_probe=False
points=json.loads(args.probes.read_text()) if args.probes else []
baseline=json.loads(args.lock.read_text()) if args.lock else []
fixed.settle=settle
fixed.run(args)
