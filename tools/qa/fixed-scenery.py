#!/usr/bin/env python3
"""Capture dated, reproducible visual inspection poses using the actual Three.js scene.
The original checkout is never changed. Only the temporary QA copy hides aircraft/UI,
substitutes a camera, pauses physics in dispatch and freezes the water shader phase.
The optional magenta sky is a diagnostic mask, not a scene shown to players.
"""
import argparse
import json
import math
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
from urllib.parse import quote
from urllib.request import urlopen

from playwright.sync_api import sync_playwright

# Camera x is east, camera z is south; all distances are metres. The four lighthouse
# camera poses have 53° vertical FOV and point halfway up the documented structure.
VIEWS = {
    'east': dict(lon=-61.9718333333, lat=46.452527778, h=19.5, east=.91, south=-.415),
    'west': dict(lon=-64.38675, lat=46.620305556, h=20.62, east=-.88, south=.475),
    'town': dict(lon=-63.124747, lat=46.239085, h=10.77, east=.7, south=.7, nearDist=75, nearAgl=62),
    'rural': dict(lon=-63.4085265, lat=46.4838615, h=6.69, east=.7, south=.7, nearDist=75, nearAgl=62),
}
FLAGS = ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--disable-dev-shm-usage', '--ignore-gpu-blocklist']


def once(source, before, after):
    if source.count(before) != 1:
        raise ValueError(f'QA integration anchor changed: {before}. Review before updating.')
    return source.replace(before, after)


def stage(repo, root, deps, void_probe):
    for name in ('index.html', 'package.json', 'package-lock.json', 'tsconfig.json'):
        shutil.copy2(repo / name, root / name)
    shutil.copytree(repo / 'src', root / 'src')
    (root / 'public').symlink_to(repo / 'public', target_is_directory=True)
    (root / 'node_modules').symlink_to(deps, target_is_directory=True)
    main = root / 'src/main.ts'
    text = main.read_text()
    text = once(text, 'const diagnostic=', '''const qa=JSON.parse(new URLSearchParams(location.search).get('qa')!);
      const center=project(qa.lon,qa.lat),baseH=terrain.elevation(center.x,center.z);let qaFrame=0; const diagnostic=''')
    text = once(text, 'clamp, RAD, geographic', 'clamp, RAD, geographic, project')
    text = once(text, 'groundY.copy(aircraft.root.position);', '''
      const norm=Math.hypot(qa.east,qa.south),ex=center.x+qa.dist*qa.east/norm,ez=center.z+qa.dist*qa.south/norm;
      f.x=ex;f.z=ez;f.y=terrain.elevation(ex,ez)+qa.agl;
      camera.position.set(ex,f.y,ez);camera.up.set(0,1,0);camera.lookAt(center.x,baseH+qa.h*.5,center.z);
      camera.updateMatrixWorld();aircraft.root.visible=false;
      const screenY=(h:number)=>{const v=new THREE.Vector3(center.x,baseH+h,center.z).project(camera);return (1-v.y)*innerHeight*.5;};
      (window as any).reviewCamera={frame:++qaFrame,baseH,eyeY:f.y,bottomY:screenY(0),topY:screenY(qa.h),
        x:ex,z:ez,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries};
      groundY.copy(aircraft.root.position);''')
    main.write_text(text)
    world = root / 'src/render/world.ts'
    text = once(world.read_text(), 'this.t.value=clock;', 'this.t.value=12;')
    if void_probe:
        anchor = 'this.sky.renderOrder=-10;'
        text = once(text, anchor, 'this.sky.material=new THREE.MeshBasicMaterial({color:0xff00ff,side:THREE.BackSide,toneMapped:false});' + anchor)
    world.write_text(text)
    (root / 'vite.config.ts').write_text("import {defineConfig} from 'vite'; export default defineConfig({base:'./',cacheDir:" + json.dumps(str(root / 'cache')) + '});')


def settle(page, errors):
    page.wait_for_function('window.reviewCamera?.frame>5 && window.islandAirDiagnostics?.roads && window.islandAirDiagnostics?.mainland && window.islandAirDiagnostics?.buildings')
    page.add_style_tag(content='body *{visibility:hidden!important} #world{visibility:visible!important}')
    previous, steady = None, 0
    start = time.monotonic()
    while time.monotonic() - start < 90:
        if errors:
            raise RuntimeError(str(errors))
        diag = page.evaluate('()=>({...window.islandAirDiagnostics,...window.reviewCamera})')
        d = diag['detail']
        signature = (diag['triangles'], diag['geometries'], d['ready'], d['loading'], diag['drawCalls'])
        if signature == previous and d['loading'] == 0 and d['ready'] > 0 and diag['frame'] > 22:
            steady += 1
        else:
            steady = 0
        if steady >= 3:
            if diag['layerWarnings'] or d['missing']:
                raise RuntimeError(str(diag))
            return diag
        previous = signature
        page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
    raise TimeoutError(f'Scene did not settle: {diag}')


def capture(args, browser, url):
    width, height = map(int, args.size.split('x'))
    results = []
    for name in args.views.split(','):
        site, distance = name.rsplit('-', 1)
        pose = dict(site=site, **VIEWS[site])
        if distance not in ('close', 'approach'):
            raise ValueError(f'Unknown view {name}')
        pose.update(dist=pose.get('nearDist', 125) if distance == 'close' else 650,
                    agl=pose.get('nearAgl', 45) if distance == 'close' else 120)
        ctx = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1)
        page = ctx.new_page()
        page.set_default_timeout(90000)
        errors = []
        page.on('pageerror', lambda err: errors.append(str(err)))
        page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
        page.on('response', lambda res: errors.append(f'{res.status} {res.url}') if res.status >= 400 and res.url.startswith(url) else None)
        page.goto(url + '/?diagnostics&qa=' + quote(json.dumps(pose)), wait_until='domcontentloaded')
        diag = settle(page, errors)
        page.screenshot(path=str(args.out / (name + '.png')), timeout=100000)
        if errors:
            raise RuntimeError(str(errors))
        # Projected DOCUMENTED height; this is not an independent measurement of mesh geometry.
        diag['referenceHeightPixels'] = diag['bottomY'] - diag['topY']
        record = dict(name=name, pose=pose, width=width, height=height, diag=diag,
                      renderer='Chromium / SwiftShader; not a device performance result', errors=errors)
        results.append(record)
        (args.out / 'results.json').write_text(json.dumps(results, indent=2))
        print(name, diag['drawCalls'], 'draws;', diag['triangles'], 'triangles;', diag['detail'], flush=True)
        ctx.close()


def run(args):
    repo = args.checkout.resolve()
    args.out = args.out.resolve()
    deps = (args.deps or repo / 'node_modules').resolve()
    if repo == args.out or repo in args.out.parents:
        raise ValueError('Use an output directory outside the checkout')
    args.out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='pei-inspect-') as temp:
        root = Path(temp)
        stage(repo, root, deps, args.void_probe)
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        url = f'http://127.0.0.1:{port}'
        with (args.out / 'server.log').open('w') as log:
            proc = subprocess.Popen(['node', str(deps / 'vite/bin/vite.js'), '--host', '127.0.0.1', '--port', str(port), '--strictPort'], cwd=root, stdout=log, stderr=log)
            try:
                for _ in range(100):
                    try:
                        with urlopen(url, timeout=1) as response:
                            response.read(1)
                        break
                    except OSError:
                        if proc.poll() is not None:
                            raise RuntimeError('Vite failed: inspect server.log')
                        time.sleep(.2)
                else:
                    raise TimeoutError('Vite did not listen')
                with sync_playwright() as pw:
                    browser = pw.chromium.launch(executable_path=args.chromium, args=FLAGS)
                    capture(args, browser, url)
                    browser.close()
            finally:
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    proc.wait()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkout', required=True, type=Path)
    parser.add_argument('--out', required=True, type=Path)
    parser.add_argument('--deps', type=Path)
    parser.add_argument('--chromium', default=os.getenv('CHROMIUM', 'chromium'))
    parser.add_argument('--void-probe', action='store_true')
    parser.add_argument('--views', default='east-close,west-close,east-approach,west-approach')
    parser.add_argument('--size', default='1024x640')
    run(parser.parse_args())
