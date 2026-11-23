#!/usr/bin/env python3
"""Check original moving control surfaces in a locked Three.js dev fixture."""
import argparse
import json
import math
from pathlib import Path
from playwright.sync_api import sync_playwright

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--url',required=True,help='Vite dev workspace serving the fixture')
p.add_argument('--out',type=Path,required=True)
p.add_argument('--chromium',required=True)
args=p.parse_args()
args.out.mkdir(parents=True,exist_ok=True)
results={}
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=args.chromium,
        args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
    for name,roll,pitch in [('neutral',0,0),('right-pull',1,1),('left-push',-1,-1)]:
        page=browser.new_page(viewport={'width':1160,'height':740})
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
        page.goto(f'{args.url}/tools/qa/aircraft-preview.html?pose=surfaces&roll={roll}&pitch={pitch}')
        page.wait_for_function('window.aircraftPreview')
        state=page.evaluate('window.aircraftPreview')
        page.locator('canvas').screenshot(path=str(args.out/(name+'.png')))
        assert not errors, errors
        targets=([0,0],[0,0]) if name=='neutral' else (([16,-19],[-21,-19]) if roll==1 else ([-21,19],[16,19]))
        for pair,wants in zip(state['controlAngles'],targets):
            assert all(abs(math.degrees(got)-wish)<.01 for got,wish in zip(pair,wants)), state
        results[name]=state
        page.close()
    browser.close()
(args.out/'states.json').write_text(json.dumps(results,indent=2))
