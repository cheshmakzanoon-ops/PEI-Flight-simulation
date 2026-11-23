#!/usr/bin/env python3
"""Capture matched pilot woodland height views in all three counties."""
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
      const wantedForest=(world as any).tiles.filter((tile:any)=>Math.hypot(camera.position.x-tile.x0-tile.w/2,
        camera.position.z-tile.z0-tile.d/2)<14500);
      (window as any).woodlandTileQA={needed:wantedForest.map((t:any)=>t.id).sort(),
        ready:wantedForest.filter((t:any)=>t.status==='ready').map((t:any)=>t.id).sort(),
        settled:wantedForest.filter((t:any)=>t.status==='ready'||t.status==='uncovered')
          .map((t:any)=>t.id).sort()};
      (window as any).captureForest = () => {
        renderer.render(scene,camera);
        return renderer.domElement.toDataURL('image/png');
      };
    '''))
fixed.stage = stage

POSES = {
 'prince':dict(lon=-64.274,lat=46.6345,dist=145,east=.61,south=.79,fixedBaseH=20,fixedEyeY=44,h=0,agl=0),
 'queens':dict(lon=-63.42,lat=46.4835,dist=145,east=.64,south=.77,fixedBaseH=26,fixedEyeY=53,h=0,agl=0),
 'kings':dict(lon=-62.030,lat=46.4405,dist=145,east=.54,south=.84,fixedBaseH=30,fixedEyeY=54,h=0,agl=0),
}
def capture(args, browser, url):
    results = []
    for name in args.views.split(','):
        pose = POSES[name]
        context = browser.new_context(viewport={'width': 800, 'height': 500}, device_scale_factor=1)
        try:
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
            page.goto(url+'/?diagnostics&qa='+quote(json.dumps(pose)), wait_until='domcontentloaded')
            page.wait_for_function("""()=>{const d=window.islandAirDiagnostics,b=d?.buildingTiles;
              const w=window.woodlandTileQA;
              return d?.mainland&&d?.roads&&w?.ready.length>0&&w.needed.length===w.settled.length&&
                !d.detail.loading&&b?.ready===b?.wanted&&b.ready>0&&!b.failed;
            }""",timeout=210000,polling=400)
            diag=page.evaluate('window.islandAirDiagnostics')
            if errors or diag['layerWarnings'] or diag['detail']['missing']:
                raise RuntimeError((errors,diag))
            raw = page.evaluate('window.captureForest()')
            (args.out/(name+'.png')).write_bytes(base64.b64decode(raw.split(',', 1)[1]))
            results.append(dict(view=name, pose=pose, triangles=diag['triangles'], calls=diag['drawCalls'],detail=diag['detail'],tiles=page.evaluate('window.woodlandTileQA')))
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
parser.add_argument('--views', default=','.join(POSES))
parser.set_defaults(void_probe=False)
fixed.run(parser.parse_args())
