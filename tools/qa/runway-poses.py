#!/usr/bin/env python3
"""Capture paired real game frames above the CYYG crosswind runway."""
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
      (window as any).captureRunway = () => {
        renderer.render(scene,camera);
        return renderer.domElement.toDataURL('image/png');
      };
    '''))
fixed.stage = stage

POSES = {
    'cyyg-overhead': dict(lon=-63.1153282, lat=46.2957423, dist=390, east=.12, south=.99277,
                          fixedBaseH=43, fixedEyeY=1950, h=0, agl=0),
}
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
            diag = fixed.settle(page, errors)
            raw = page.evaluate('window.captureRunway()')
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
parser.add_argument('--views', default=','.join(POSES))
parser.set_defaults(void_probe=False)
fixed.run(parser.parse_args())
