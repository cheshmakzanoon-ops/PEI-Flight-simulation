#!/usr/bin/env python3
"""Compare exact actual Three.js coastal cameras with the old and adaptive curtain."""
import argparse
import importlib.util
import json
from pathlib import Path
from urllib.parse import quote

import numpy as np
from PIL import Image

here = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('fixed', here / 'fixed-scenery.py')
fixed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixed)

stage_fixed = fixed.stage


def stage(repo, root, deps, _):
    stage_fixed(repo, root, deps, False)
    path = root / 'src/main.ts'
    path.write_text(fixed.once(path.read_text(), 'const diagnostic=', '''
    (window as any).qaDetailTiles=()=>(world as any).tiles.filter((t:any)=>t.status==='ready').map((t:any)=>t.id).sort();
    (window as any).qaSkyOnly=(enabled:boolean)=>{
      (world as any).sky.material.uniforms.skyDiagnostic.value=enabled?1:0;
      return (window as any).reviewCamera?.frame??0;
    };
    const diagnostic='''))


fixed.stage = stage


def capture(args, browser, url):
    records = []
    for row in args.poses:
        name, pose = row['region'], row['pose']
        expected = {'queens-harbour':16,'prince-summerside':17,'kings-east-point':9}[name]
        old_ids = None
        old_sky = None
        for mode in ('stock', 'arcs'):
            flags = 'legacyShoreArcs&' if mode == 'arcs' else ''
            context = browser.new_context(viewport={'width': 900, 'height': 564}, device_scale_factor=1)
            page = context.new_page()
            page.set_default_timeout(95000)
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
            page.goto(url + '/?diagnostics&' + flags + 'qa=' + quote(json.dumps(pose)), wait_until='domcontentloaded')
            page.wait_for_function('n=>window.qaDetailTiles?.().length===n && window.islandAirDiagnostics?.detail?.loading===0',arg=expected)
            seen = fixed.settle(page, errors)
            ids = page.evaluate('window.qaDetailTiles()')
            if old_ids is None:
                old_ids = ids
            assert ids == old_ids, (name, mode, ids, old_ids)
            assert bool(seen.get('legacyShore')) == (mode == 'arcs'), (name, mode, seen)
            page.screenshot(path=str(args.out / f'{name}-{mode}.png'))
            frame = page.evaluate('window.qaSkyOnly(true)')
            page.wait_for_function('n=>window.reviewCamera.frame>=n+2', arg=frame)
            photo = args.out / f'{name}-{mode}-sky.png'
            page.screenshot(path=str(photo))
            raw = np.asarray(Image.open(photo).convert('RGB'))
            sky = (raw[:,:,0] > 244) & (raw[:,:,1] < 10) & (raw[:,:,2] > 244)
            center = int(sky[237:328,390:511].sum())
            if old_sky is None:
                old_sky = sky
            else:
                assert not np.any((sky & ~old_sky)[100:]), (name, 'new below-skyline exposure')
            assert not errors
            assert (center > 1000) if mode == 'stock' else (center == 0), (name, mode, center)
            records.append({'region':name,'mode':mode,'diagnosticMagentaInCentral121x91':center,
                            'exactEye':[seen[k] for k in ('x','eyeY','z')], 'draws':seen['drawCalls'],
                            'triangles':seen['triangles'],'detail':seen['detail'],
                            'legacyArcs':seen.get('legacyShore'), 'sameDetailTileIds':ids,
                            'addedPureSkyBelowY100':int((sky & ~old_sky)[100:].sum())})
            (args.out / 'results.json').write_text(json.dumps(records, indent=2) + '\n')
            print(name, mode, center, seen['drawCalls'], seen['triangles'], ids, flush=True)
            context.close()


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--checkout', type=Path, required=True)
    p.add_argument('--chromium', required=True)
    p.add_argument('--out', type=Path, required=True)
    a = p.parse_args()
    a.poses = json.loads((a.checkout / 'docs/qa/legacy-shore-arc-poses.json').read_text())
    a.views = a.pose_baseline = a.deps = None
    a.void_probe = False
    fixed.capture = capture
    fixed.run(a)
