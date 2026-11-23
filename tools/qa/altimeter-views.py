#!/usr/bin/env python3
"""Compare the original analog altimeter in a fixed cockpit camera."""
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
    for alt in [0,999,1000,1450,12450]:
        page=b.new_page(viewport={'width':1160,'height':740},device_scale_factor=1)
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(f'{args.url}/tools/qa/aircraft-preview.html?pose=cockpit&altitude={alt}')
        page.wait_for_function('window.aircraftPreview')
        raw=page.evaluate('window.aircraftPreview')
        x=raw['altitudeAngles']
        assert len(x)==3 and all(abs(g+2*math.pi*((alt%n)/n))<1e-10 for n,g in zip([1000,10000,100000],x))
        assert not errors,errors
        page.locator('canvas').screenshot(path=str(args.out/f'{alt}.png'))
        out[alt]=x
        page.close()
    b.close()
(args.out/'angles.json').write_text(json.dumps(out,indent=2))
