#!/usr/bin/env python3
"""Capture paired real game frames at the two bridge approaches and the channel."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
from urllib.parse import quote

spec = importlib.util.spec_from_file_location('fixed', Path(__file__).with_name('fixed-scenery.py'))
fixed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixed)
POSES = {
    'nb-approach': dict(lon=-63.802510147, lat=46.173400180, dist=513.1277,
                        east=506.0024, south=85.2148, fixedBaseH=33, fixedEyeY=109, h=0, agl=0),
    'navigation-span': dict(lon=-63.752174064, lat=46.209978386, dist=615.8734,
                            east=609.9109, south=85.4912, fixedBaseH=53, fixedEyeY=135, h=0, agl=0),
    'pei-approach': dict(lon=-63.712294078, lat=46.244933170, dist=460.6788,
                         east=204.6443, south=412.7296, fixedBaseH=33, fixedEyeY=125, h=0, agl=0),
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
            page.screenshot(path=str(args.out/(name+'.png')))
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
