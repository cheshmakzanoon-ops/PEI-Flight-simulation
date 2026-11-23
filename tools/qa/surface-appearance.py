#!/usr/bin/env python3
"""Capture real Three.js frames and object masks after an identical geographic workload settles.

Only instrumentation in a temporary checkout changes: fixed camera, water clock,
and an optional flat emissive color used to identify visible pixels of one material.
"""
import argparse
import base64
import importlib.util
import json
import os
from pathlib import Path
import time
from types import SimpleNamespace
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
    text = fixed.once(main.read_text(), 'renderer.render(scene,camera);', """
      const active=(world as any).tiles.filter((v:any)=>Math.hypot(camera.position.x-v.x0-v.w/2,camera.position.z-v.z0-v.d/2)<14500);
      const activeId=(ts:any[])=>ts.map(t=>t.id).sort();
      (window as any).qaTiles={expected:activeId(active),ready:activeId(active.filter((v:any)=>v.status==='ready'))};
      renderer.render(scene,camera);
      if((window as any).qaCapture){
        (window as any).qaPixels=renderer.domElement.toDataURL('image/png').split(',')[1];
        (window as any).qaCapture=false;
      }""")
    main.write_text(text)
    world = root / 'src/render/world.ts'
    text = fixed.once(world.read_text(), 'this.t.value=12;', 'this.t.value=(window as any).qaClock??12;')
    if ARGS.mask == 'water':
        text = fixed.once(text, 'gl_FragColor=vec4(mist(c,dist,p.y),1.);',
                          'gl_FragColor=vec4(1.,0.,1.,1.);return;')
    if ARGS.mask == 'breaker':
        # Measure the advancing bright crest (not the swash/remnant), plus the
        # signed distance actually used by that exact fragment. Blue is a
        # sentinel; return before tone mapping or fog changes the encoded values.
        text = fixed.once(text,'gl_FragColor=vec4(mist(c,dist,p.y),1.);',
                          'gl_FragColor=vec4(shoreFoam(q,shore,t,dist,n,foamFootprint),clamp(-shore/40.,0.,1.),1.,1.);return;')
        shader = root / 'src/render/shore-foam.ts'
        shader.write_text(fixed.once(shader.read_text(),
                                     'return lod*(head*.39+wash*.16+remnant*.08);',
                                     'return lod*head;'))
    world.write_text(text)
    if ARGS.mask == 'road':
        road = root / 'src/render/roads.ts'
        text = fixed.once(road.read_text(), 'return new Roads(scene,tiles,terrain);', '''
          const roads=new Roads(scene,tiles,terrain);
          Object.assign(roads,{material:new THREE.MeshBasicMaterial({color:0xff00ff,
            side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,toneMapped:false})});
          return roads;''')
        road.write_text(text)
fixed.stage = stage

def capture(args, browser, url):
    output = []
    for name in ARGS.views.split(','):
        site, distance = name.split('-')
        pose = dict(site=site, **fixed.VIEWS[site])
        near, far = (125, 45), (650, 120)
        dist, alt = near if distance == 'close' else far
        pose.update(dist=dist, agl=alt)
        # Pin absolute camera and aim between checkouts, independent of differences in relief.
        # The ground baseline is the current regional atlas at the documented station coordinate.
        if site in ('east','west'):
            pose.update(fixedBaseH=10.07 if site=='east' else 1.79,
                        fixedEyeY=alt if distance != 'close' else (49 if site=='east' else 46))
        ctx = browser.new_context(viewport={'width': 1024, 'height': 640}, device_scale_factor=1)
        errors = []
        try:
            page = ctx.new_page()
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('console', lambda m: errors.append(m.text) if m.type=='error' else None)
            page.goto(url+'/?diagnostics&qa='+quote(json.dumps(pose)),wait_until='domcontentloaded')
            page.wait_for_function('window.islandAirDiagnostics?.roads && window.reviewCamera?.frame>5 && window.islandAirDiagnostics?.buildings && window.islandAirDiagnostics?.mainland',timeout=120000)
            page.add_style_tag(content='body *{visibility:hidden!important} #world{visibility:visible!important}')
            end = time.monotonic()+120
            last = None
            while time.monotonic()<end:
                if errors:
                    raise RuntimeError(str(errors))
                d = page.evaluate('()=>({frame:reviewCamera.frame,x:reviewCamera.x,z:reviewCamera.z,eye:reviewCamera.eyeY,base:reviewCamera.baseH,draws:islandAirDiagnostics.drawCalls,triangles:islandAirDiagnostics.triangles,layers:islandAirDiagnostics.layerWarnings,tiles:qaTiles,buildings:islandAirDiagnostics.buildingTiles})')
                sig=(d['draws'],d['triangles'],*d['tiles']['ready'])
                settled=(not d['layers'] and not any(d['buildings'][k] for k in ('pending','loading','failed')) and d['tiles']['expected']==d['tiles']['ready'])
                if d['frame']>=12 and sig==last and settled:break
                last=sig
                page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
            else:raise RuntimeError(f'Unsettled {name}: {d}')
            for phase in ARGS.phases:
                page.evaluate('(phase)=>{window.qaClock=phase;window.qaPixels=null;window.qaCapture=true;}',phase)
                page.wait_for_function('typeof window.qaPixels==="string"',timeout=120000)
                pixels=page.evaluate('window.qaPixels')
                target=f'{name}-{phase:g}'
                (ARGS.out/(target+'.png')).write_bytes(base64.b64decode(pixels,validate=True))
            if errors:raise RuntimeError(str(errors))
            output.append(dict(view=name,pose=pose,phases=ARGS.phases,diagnostics=d))
            (ARGS.out/'report.json').write_text(json.dumps(output,indent=2)+'\n')
            print(name,d['draws'],d['triangles'],len(d['tiles']['ready']),flush=True)
        finally:ctx.close()
fixed.capture = capture

def compare(before, after, mask, out, kind, views=None):
    def read(root):
        return {row['view']:row for row in json.loads((root/'report.json').read_text())}
    a,b,c=map(read,(before,after,mask))
    if views:
        chosen=set(views.split(','))
        if not all(chosen<=set(z) for z in (a,b,c)):
            raise ValueError('Missing selected view')
        a={k:v for k,v in a.items() if k in chosen}
    elif not a or set(a)!=set(b) or set(a)!=set(c):
        raise ValueError('Mismatched view sets')
    rows=[]
    for name, old in a.items():
        new,sentinel=b[name],c[name]
        meta=('x','z','eye','base','triangles','draws','tiles')
        key=lambda row:(row['pose'],*[row['diagnostics'][k] for k in meta])
        if key(old)!=key(new) or key(old)!=key(sentinel):
            raise ValueError(f'{name}: unmatched pose, draw counts, or imagery')
        phase=12
        if any(phase not in row['phases'] for row in (old,new,sentinel)):
            raise ValueError('Expected a phase-12 matched capture')
        def rgb(root):
            with Image.open(root/f'{name}-{phase}.png') as image:
                return np.asarray(image.convert('RGB'),dtype=np.int16)
        src,dst,mat=map(rgb,(before,after,mask))
        inside=(mat[:,:,0]>215)&(mat[:,:,1]<20)&(mat[:,:,2]>215)
        delta=np.max(np.abs(src-dst),axis=2)
        # Ignore the immediate rasterized surface boundary where multisampling can
        # produce changed pixels that never meet the mask's full-magenta cutoff.
        surface=inside.copy()
        dilate=np.pad(inside,2)
        for dy in range(5):
            for dx in range(5):
                inside=inside | dilate[dy:dy+inside.shape[0],dx:dx+inside.shape[1]]
        strong=delta>8
        n=int(strong.sum())
        leaked=int((strong&~inside).sum())
        if n<48 or leaked>max(40,n*.012):
            raise ValueError(f'{name}: effect missing or outside {kind} ({n} changed, {leaked} outside)')
        row=dict(view=name,pixels=int(delta.size),over8=n,over8Outside=leaked,
                 draws=old['diagnostics']['draws'],triangles=old['diagnostics']['triangles'],
                 settledOrthoIDs=old['diagnostics']['tiles']['ready'])
        if kind=='water' and name=='east-close':
            # At the same light, camera, and wave time, count very bright
            # water pixels in the lower half where the old stripe dominated.
            floor=surface & (np.arange(surface.shape[0])[:,None]>335)
            count=lambda rgb:int(((rgb @ np.array([.2126,.7152,.0722])>175)&floor).sum())
            old_white,new_white=map(count,(src,dst))
            if old_white<2000 or new_white>.5*old_white:
                raise ValueError(f'{name}: bright foam area not reduced enough ({old_white} → {new_white})')
            row.update(waterPixels=int(floor.sum()),brightBefore=old_white,brightAfter=new_white)
        rows.append(row)
    out.write_text(json.dumps(dict(kind=kind,rows=rows),indent=2)+'\n')
    print(out.read_text())

if __name__=='__main__':
    cli=argparse.ArgumentParser(description=__doc__)
    sub=cli.add_subparsers(dest='action',required=True)
    cap=sub.add_parser('capture')
    cap.add_argument('--checkout',type=Path,required=True)
    cap.add_argument('--out',type=Path,required=True)
    cap.add_argument('--chromium',default=os.environ.get('CHROMIUM','chromium'))
    cap.add_argument('--views',default='east-close,west-close')
    cap.add_argument('--phases',type=float,nargs='+',default=[12])
    cap.add_argument('--mask',choices=['water','road','breaker'])
    diff=sub.add_parser('compare')
    for name in ['before','after','mask','out']:diff.add_argument('--'+name,type=Path,required=True)
    diff.add_argument('--kind',choices=['water','road'],required=True)
    diff.add_argument('--views',help='Limit analysis to this comma-separated set of recorded views')
    ARGS=cli.parse_args()
    if ARGS.action=='capture':
        fixed.run(SimpleNamespace(checkout=ARGS.checkout,out=ARGS.out,chromium=ARGS.chromium,deps=None,void_probe=False))
    else:
        compare(ARGS.before,ARGS.after,ARGS.mask,ARGS.out,ARGS.kind,ARGS.views)
