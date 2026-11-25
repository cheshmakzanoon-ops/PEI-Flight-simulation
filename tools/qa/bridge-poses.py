#!/usr/bin/env python3
"""Capture paired real game frames at the two bridge approaches and the channel."""
import argparse
import base64
import importlib.util
import json
import os
from pathlib import Path
from urllib.parse import quote

spec = importlib.util.spec_from_file_location('fixed', Path(__file__).with_name('fixed-scenery.py'))
fixed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixed)
base_stage = fixed.stage
def stage(repo, root, deps, void_probe):
    base_stage(repo, root, deps, void_probe)
    main = root / 'src/main.ts'
    main.write_text(fixed.once(main.read_text(), 'renderer.render(scene,camera);', '''
      renderer.render(scene,camera);
      (window as any).captureBridge = () => {
        renderer.render(scene,camera);
        return renderer.domElement.toDataURL('image/png');
      };
    '''))
fixed.stage = stage

POSES = {
    # Same main shaft P22, along and across the centreline. No inspection of marine access.
    'main-shaft-broadside': dict(lon=-63.753234528065455, lat=46.20912902644122, dist=80.62257748299056,
                            east=54.004780718263646, south=59.86220560230868, fixedBaseH=26, fixedEyeY=17, h=0, agl=0),
    'main-shaft-axial': dict(lon=-63.753234528065455, lat=46.20912902644122, dist=91.66242414424774,
                        east=67.8094701506916, south=-61.67556856553845, fixedBaseH=25, fixedEyeY=21, h=0, agl=0),
    'navigation-broadside': dict(lon=-63.7521722, lat=46.2099778, dist=1770,
                         east=1110, south=1390, fixedBaseH=38, fixedEyeY=66, h=0, agl=0),
    'main-span-ramp': dict(lon=-63.765, lat=46.2007, dist=520,
                         east=345, south=389, fixedBaseH=38, fixedEyeY=59, h=0, agl=0),
    'nb-approach': dict(lon=-63.802510147, lat=46.173400180, dist=513.1277,
                        east=506.0024, south=85.2148, fixedBaseH=33, fixedEyeY=109, h=0, agl=0),
    'navigation-span': dict(lon=-63.752174064, lat=46.209978386, dist=615.8734,
                            east=609.9109, south=85.4912, fixedBaseH=53, fixedEyeY=135, h=0, agl=0),
    'pei-approach': dict(lon=-63.712294078, lat=46.244933170, dist=460.6788,
                         east=204.6443, south=412.7296, fixedBaseH=33, fixedEyeY=125, h=0, agl=0),
    'nb-concrete': dict(lon=-63.80031115, lat=46.17504983, dist=68.4105,
                        east=68.1751, south=5.6710, fixedBaseH=20, fixedEyeY=28, h=0, agl=0),
    'pei-concrete': dict(lon=-63.71694148, lat=46.24081548, dist=64.4050,
                         east=28.5138, south=57.7491, fixedBaseH=21, fixedEyeY=28, h=0, agl=0),
}

def stable(page, errors):
    import time
    end=time.monotonic()+80
    page.wait_for_function("window.reviewCamera?.frame>12 && window.islandAirDiagnostics?.mainland",
                           timeout=80000)
    last=None; run=0
    while time.monotonic()<end:
        if errors: raise RuntimeError(errors)
        d=page.evaluate("()=>({...window.islandAirDiagnostics,...window.reviewCamera})")
        sub=d["detail"]
        now=(d["triangles"], d["drawCalls"],d["geometries"],sub["ready"],sub["loading"])
        run=run+1 if now==last and sub["loading"]==0 else 0
        if run>=3 and d["frame"]>22:
            if d["layerWarnings"] or sub["missing"]: raise RuntimeError(d)
            return d
        last=now
        page.evaluate("()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))")
    raise TimeoutError(d)

def capture(args, browser, url):
    results = []
    width, height = map(int, args.size.split('x'))
    for name in args.views.split(','):
        pose = POSES[name]
        context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1)
        try:
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
            page.goto(url+'/?diagnostics&qa='+quote(json.dumps(pose)), wait_until='domcontentloaded')
            diag = stable(page, errors)
            raw = page.evaluate('window.captureBridge()')
            (args.out/(name+'.png')).write_bytes(base64.b64decode(raw.split(',', 1)[1]))
            results.append(dict(view=name, pose=pose, triangles=diag['triangles'], calls=diag['drawCalls']))
            print(name, diag['triangles'], diag['drawCalls'], flush=True)
        finally:
            context.close()
    (args.out/'report.json').write_text(json.dumps(results, indent=2)+'\n')

fixed.capture = capture
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--checkout', type=Path, required=True)
parser.add_argument('--out', type=Path, required=True)
parser.add_argument('--chromium', default=os.getenv('CHROMIUM', 'chromium'))
parser.add_argument('--deps', type=Path)
parser.add_argument('--views', default=','.join(name for name in POSES if not name.startswith('main-shaft-')))
parser.add_argument('--size', default='1000x600')
parser.set_defaults(void_probe=False)
fixed.run(parser.parse_args())
