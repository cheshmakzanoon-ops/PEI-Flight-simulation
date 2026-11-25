#!/usr/bin/env python3
"""Matched Three.js visual controls for the Standard open-water ripple profile."""
import argparse
import base64
import importlib.util
import io
import json
import os
from pathlib import Path
from urllib.parse import quote

import numpy as np
from PIL import Image

spec = importlib.util.spec_from_file_location('fixed', Path(__file__).with_name('fixed-scenery.py'))
fixed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixed)
prepare = fixed.stage


def stage(repo, root, deps, _):
    prepare(repo, root, deps, False)
    p = root/'src/render/world.ts'
    s = p.read_text()
    s = fixed.once(s, 'uniform sampler2D imageMap,coverMap,rippleMap;', 'uniform float qaRippleMask,qaRippleGain; uniform sampler2D imageMap,coverMap,rippleMap;')
    s = fixed.once(s, '1.5*undulation)*inOpen;', '1.5*undulation)*inOpen*qaRippleGain;')
    s = fixed.once(s, 'if(shore>=0.)discard;', '''if(shore>=0.)discard;
     ${openRipples?`if(qaRippleMask>.5&&inOpen>0.){
       gl_FragColor=qaRippleMask>1.5?vec4(1.,0.,1.,1.):vec4(0.,1.,0.,1.);return;}`:''}''')
    tag = 'ocean.rotation.x=-Math.PI/2;ocean.position.y=OCEAN_Y;'
    s = fixed.once(s, tag, tag+'ocean.name="QA open-water optics";oceanMaterial.uniforms.qaRippleGain={value:1};oceanMaterial.uniforms.qaRippleMask={value:0};')
    s = fixed.once(s, 'this.t.value=12;', 'this.t.value=(window as any).qaRipplePhase??12;')
    p.write_text(s)
    p = root/'src/main.ts'
    s = p.read_text()
    tag = '  renderer.render(scene,camera);'
    s = fixed.once(s, tag, tag+'''
    (window as any).qaRipples=(gain:number,mask:number,phase:number)=>{
      (window as any).qaRipplePhase=phase;
      const o=scene.getObjectByName('QA open-water optics') as THREE.Mesh;
      const m=o.material as THREE.ShaderMaterial;
      m.uniforms.qaRippleGain.value=gain;m.uniforms.qaRippleMask.value=mask;
      return (window as any).reviewCamera?.frame??0;
    };
    (window as any).qaOpenWaterFrame=()=>{
      renderer.render(scene,camera);
      return renderer.domElement.toDataURL('image/png');
    };
    ''')
    p.write_text(s)


POSES = {
    'strait-grazing': dict(lon=-63.7496421, lat=46.1984107, dist=880, east=40,south=878,fixedBaseH=0,fixedEyeY=88,agl=0,h=0),
    'panmure-broadside': dict(lon=-62.4649780,lat=46.1433953,dist=370,east=330,south=167,fixedBaseH=2,fixedEyeY=52,agl=0,h=0),
    'egmont-diagonal': dict(lon=-64.1341777,lat=46.4013900,dist=440,east=-386,south=220,fixedBaseH=.5,fixedEyeY=64,agl=0,h=0),
    'wind-spectrum-nadir': dict(lon=-63.7496421,lat=46.1984107,dist=12,east=0,south=1,fixedBaseH=0,fixedEyeY=183,agl=0,h=0),
    'south-lake-control': dict(lon=-62.02144468,lat=46.42678075,dist=9,east=-1,south=0,fixedBaseH=0,fixedEyeY=102,agl=0,h=0),
    'tryon-offshore': dict(lon=-63.50608,lat=46.5451,dist=390,east=80,south=-380,fixedBaseH=0,fixedEyeY=67,agl=0,h=0),
}


def settled(page, errors):
    page.wait_for_function('window.reviewCamera?.frame>45 && window.islandAirDiagnostics?.mainland && window.islandAirDiagnostics?.openRipples && window.islandAirDiagnostics?.detail?.loading===0')
    d = page.evaluate('()=>({...window.islandAirDiagnostics,...window.reviewCamera})')
    if errors or d['layerWarnings'] or d['detail']['missing']:
        raise RuntimeError((d, errors))
    return d


def capture(args, browser, url):
    output = {}
    for name in args.views.split(','):
        pose=POSES[name]
        page=browser.new_page(viewport={'width':1000,'height':600},device_scale_factor=1)
        errs=[]
        page.set_default_timeout(100000)
        page.on('pageerror',lambda e:errs.append(str(e)))
        page.on('console',lambda e:errs.append(e.text) if e.type=='error' else None)
        page.on('response',lambda res:errs.append(f'{res.status} {res.url}') if res.status>=400 and res.url.startswith(url) else None)
        page.goto(url+'/?diagnostics&qa='+quote(json.dumps(pose)),wait_until='domcontentloaded')
        d=settled(page,errs)
        def px(phase,gain,mask,label):
            f=page.evaluate('a=>window.qaRipples(...a)',[gain,mask,phase])
            page.wait_for_function('f=>window.reviewCamera.frame>=f+2',arg=f)
            p=base64.b64decode(page.evaluate('window.qaOpenWaterFrame()').split(',',1)[1])
            (args.out/f'{name}-{phase:g}-{label}.png').write_bytes(p)
            return np.asarray(Image.open(io.BytesIO(p)).convert('RGB'),dtype=np.int16)
        phases=[]
        for phase in args.phase:
            for _ in range(3):
                stock=px(phase,0,0,'stock')
                live=px(phase,1,0,'live')
                green=px(phase,1,1,'green')
                magenta=px(phase,1,2,'magenta')
                repeat=px(phase,1,0,'repeat')
                stock_repeat=px(phase,0,0,'stock-repeat')
                # Reject transient horizon or imagery changes during variant
                # warm-up rather than widening the protected-pixel tolerance.
                if np.array_equal(stock,stock_repeat) and np.array_equal(live,repeat):
                    break
            assert np.array_equal(stock,stock_repeat) and np.array_equal(live,repeat),name
            admitted=np.any(green!=magenta,axis=2)
            derivative_margin=admitted.copy()
            for _ in range(2):
                m=np.pad(derivative_margin,1)
                derivative_margin=np.logical_or.reduce([m[dy:dy+600,dx:dx+1000] for dx in range(3) for dy in range(3)])
            delta=np.max(abs(live-stock),axis=2)
            row=dict(phase=phase,pixelsChangedAbove4=int((delta>4).sum()),visibleOpen=int(admitted.sum()),
                     protectedOutsideTwoPixelDerivativeMargin=int((~derivative_margin).sum()),
                     maxProtectedDelta=int(delta[~derivative_margin].max(initial=0)),repeatExact=bool(np.array_equal(live,repeat)),stockRepeatExact=bool(np.array_equal(stock,stock_repeat)))
            assert row['maxProtectedDelta']==0 and row['repeatExact'] and not errs,(row,errs)
            if name=='south-lake-control':
                assert row['visibleOpen']==0 and np.array_equal(live,stock),row
            else:
                assert row['visibleOpen']>500 and row['pixelsChangedAbove4']>500,row
            phases.append(row)
        motion={}
        if args.motion and name!='south-lake-control':
            # Measure same-mask successive 1/30 s steps, not render-time FPS.
            for gain,key in [(0,'stock'),(1,'live')]:
                seq=[px(round(12+j/30,4),gain,0,'motion-'+key) for j in range(8)]
                a=np.concatenate([np.max(abs(bb-aa),axis=2)[admitted]
                                  for aa,bb in zip(seq[:-1],seq[1:])])
                motion[key]={'samples':len(a),'p95':float(np.quantile(a,.95)),
                             'p99':float(np.quantile(a,.99)),'max':int(a.max()),
                             'above8':int((a>8).sum())}
            assert motion['live']['p99']<=motion['stock']['p99']+2,motion
            assert motion['live']['above8']/motion['live']['samples']<1e-5,motion
        output[name]=dict(pose=pose,draws=d['drawCalls'],triangles=d['triangles'],phases=phases,
                          phaseStepMotion=motion or None)
        (args.out/'report.json').write_text(json.dumps(output,indent=2)+'\n')
        print(name,phases,flush=True)
        page.close()


fixed.stage=stage
fixed.capture=capture
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--checkout',type=Path,default=Path.cwd())
parser.add_argument('--out',type=Path,required=True)
parser.add_argument('--deps',type=Path)
parser.add_argument('--chromium',default=os.getenv('CHROMIUM','chromium'))
parser.add_argument('--views',default=','.join(POSES))
parser.add_argument('--motion',action='store_true')
parser.add_argument('--phase',type=float,nargs='+',default=[12,26])
parser.set_defaults(void_probe=False)
fixed.run(parser.parse_args())
