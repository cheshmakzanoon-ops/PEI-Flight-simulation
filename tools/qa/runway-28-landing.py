#!/usr/bin/env python3
"""Inject only test initial state and player inputs into a temporary browser copy."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import shutil

spec=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixed)

def stage(repo,root,deps,void_probe):
    for name in ('index.html','package.json','package-lock.json','tsconfig.json'):
        shutil.copy2(repo/name,root/name)
    shutil.copytree(repo/'src',root/'src')
    (root/'public').symlink_to(repo/'public',target_is_directory=True)
    (root/'node_modules').symlink_to(deps,target_is_directory=True)
    main=root/'src/main.ts'
    src=main.read_text()
    src=fixed.once(src,'reposition(i);ui.departure(i);',"""reposition(i);
      const x=7386.078397184241,z=22532.377147476323;
      Object.assign(f,{x,z,y:sceneSurface(x,z).height+5.2,speed:37,throttle:.13,status:'flying',
        heading:4.519509994001824,gamma:-.045,pitch:.105,notice:''});
      ui.departure(i);""")
    src=fixed.once(src,'step(f,u,sceneSurface);',"""step(f,{...u,pitch:f.status==='flying'?.25:0,
       power:f.status==='landed'?-1:0,brake:f.status==='landed'},sceneSurface);""")
    src=fixed.once(src,'mode:ui.mode,camera:names[view]',"""mode:ui.mode,camera:names[view],
       qaStatus:f.status,qaNotice:f.notice,qaRunway:sceneSurface(f.x,f.z).runway""")
    main.write_text(src)
    (root/'vite.config.ts').write_text("import {defineConfig} from 'vite'; export default defineConfig({base:'./',cacheDir:"+json.dumps(str(root/'cache'))+"});")

def capture(args,browser,url):
    page=browser.new_page(viewport={'width':1000,'height':640},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(url+'/?diagnostics',wait_until='domcontentloaded')
    page.locator('#start').click()
    page.wait_for_function("['landed','stopped'].includes(window.islandAirDiagnostics?.qaStatus)",timeout=85000)
    d=page.evaluate('window.islandAirDiagnostics')
    assert d['qaStatus']==args.expect and not errors, (d,errors)
    assert d['qaRunway']==(args.expect=='landed'),d
    page.screenshot(path=str(args.out/'first-contact.png'))
    if args.expect=='landed':
        page.wait_for_function('window.islandAirDiagnostics?.speed<.2',timeout=85000)
    end=page.evaluate('window.islandAirDiagnostics')
    assert end['qaStatus']==args.expect and not errors, (end,errors)
    (args.out/'contact.json').write_text(json.dumps({'contact':d,'end':end},indent=2)+'\n')
    print(d['qaNotice'],d['speed'],end['speed'],flush=True)
    page.close()

fixed.stage,fixed.capture=stage,capture
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--checkout',type=Path,required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--deps',type=Path)
p.add_argument('--chromium',default=os.getenv('CHROMIUM','chromium'))
p.add_argument('--expect',choices=('landed','stopped'),required=True)
p.set_defaults(void_probe=False)
fixed.run(p.parse_args())
