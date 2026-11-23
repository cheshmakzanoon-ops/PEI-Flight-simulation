#!/usr/bin/env python3
"""Verify the original vertical tail and hinged rudder in a fixed view."""
import argparse
import json
import math
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--url',required=True,help='Vite dev server')
p.add_argument('--out',type=Path,required=True)
p.add_argument('--chromium',required=True)
args=p.parse_args()
args.out.mkdir(parents=True,exist_ok=True)
out={}
with sync_playwright() as w:
    b=w.chromium.launch(executable_path=args.chromium,
        args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
    for yaw in [-1,0,1]:
        page=b.new_page(viewport={'width':1160,'height':740},device_scale_factor=1)
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(f'{args.url}/tools/qa/aircraft-preview.html?pose=rudder&yaw={yaw}')
        page.wait_for_function('window.aircraftPreview')
        raw=page.evaluate('window.aircraftPreview')
        a=raw['rudderAngle']
        assert abs(math.degrees(a)-22*yaw)<.01,(yaw,a)
        assert not errors,errors
        page.locator('canvas').screenshot(path=str(args.out/f'{yaw}.png'))
        out[yaw]=a
        page.close()
    b.close()
(args.out/'angles.json').write_text(json.dumps(out,indent=2))
