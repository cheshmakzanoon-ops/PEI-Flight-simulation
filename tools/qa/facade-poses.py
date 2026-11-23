#!/usr/bin/env python3
"""Capture matched downtown façade and West Point control frames."""
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
      (window as any).captureFacade = () => {
        renderer.render(scene,camera);
        return renderer.domElement.toDataURL('image/png');
      };
    '''))
fixed.stage = stage

POSES = {'harbour-overview': {'lon': -63.125071349676446, 'lat': 46.23095329016037, 'dist': 515, 'east': -44.88520751504396, 'south': 513.0402695172489, 'fixedEyeY': 175.673, 'fixedBaseH': 18, 'h': 0, 'agl': 0}, 'peakes-wharf': {'lon': -63.12084853605774, 'lat': 46.234190449228606, 'dist': 275, 'east': 33.514069436415554, 'south': 272.95019170136356, 'fixedEyeY': 88.053, 'fixedBaseH': 12, 'h': 0, 'agl': 0}}

POSES['west-outside-control'] = dict(lon=-64.38675,lat=46.620305556,dist=125,east=-.88,south=.475,fixedBaseH=1.79,fixedEyeY=45,h=20.62,agl=0)

def capture(args, browser, url):
    results = []
    for name in args.views.split(','):
        pose = POSES[name]
        context = browser.new_context(viewport={'width': 1000, 'height': 600}, device_scale_factor=1)
        try:
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
            page.goto(url+'/?diagnostics&qa='+quote(json.dumps(pose)), wait_until='domcontentloaded')
            page.wait_for_function("""()=>{const d=window.islandAirDiagnostics,b=d?.buildingTiles;
              return d?.mainland&&d?.roads&&d?.detail.ready>0&&!d.detail.loading&&b?.ready===b?.wanted&&b.ready>0&&!b.failed;
            }""",timeout=210000,polling=400)
            diag=page.evaluate('window.islandAirDiagnostics')
            if errors or diag['layerWarnings'] or diag['detail']['missing']:
                raise RuntimeError((errors,diag))
            raw = page.evaluate('window.captureFacade()')
            (args.out/(name+'.png')).write_bytes(base64.b64decode(raw.split(',', 1)[1]))
            results.append(dict(view=name, pose=pose, triangles=diag['triangles'], calls=diag['drawCalls'],detail=diag['detail']))
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
