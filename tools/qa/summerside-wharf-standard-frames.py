#!/usr/bin/env python3
"""Matched native WebGL frames of the same Standard world with and without the local pier."""
import argparse
import importlib.util
import json
from pathlib import Path
from urllib.parse import quote

import numpy as np
from PIL import Image

module = importlib.util.spec_from_file_location('fixed', Path(__file__).with_name('fixed-scenery.py'))
fixed = importlib.util.module_from_spec(module)
module.loader.exec_module(fixed)

site = dict(lon=-63.787304981817, lat=46.389145047264, h=7.5)
# County and station poses are exact pre-candidate baseline cameras; the
# wharf close pose was frozen independently from the shipped deck anchor.
poses = {
    'wharf-close': (900, 600, dict(**site, dist=138, east=.51, south=.86, agl=26)),
    'county-approach': (900, 600, dict(lon=-63.790211, lat=46.392695, h=12.68,
                                      dist=650, east=.68, south=.74, agl=120,
                                      fixedBaseH=7.983448275881528, fixedEyeY=120.99634345661718)),
    'station-street': (600, 400, dict(lon=-63.78850717, lat=46.39088167, h=10.,
                                    dist=56, east=-.57, south=.829, agl=12)),
    'distant': (720, 460, dict(**site, dist=3000, east=.26, south=.965, agl=570)),
}

def capture(a, browser, url):
    result = []
    scope = json.loads(a.scope.read_text())['views'] if a.scope else {}
    for name in a.views.split(','):
        width,height,initial = poses[name]
        pose = initial.copy()
        outcomes = []
        for candidate in (False, True):
            with browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1) as ctx:
                page = ctx.new_page()
                page.set_default_timeout(150000)
                errors = []
                transfers = []
                page.on('pageerror', lambda err: errors.append(str(err)))
                page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' or 'WebGL: INVALID_' in msg.text else None)
                page.on('response', lambda r: transfers.append(r.status) if r.url.endswith('/measured-deck.gz') else None)
                page.goto(url + '/?diagnostics' + ('' if candidate else '&stockSpinnakersDeck') +
                          '&qa=' + quote(json.dumps(pose)), wait_until='domcontentloaded')
                if name != 'distant':
                    page.wait_for_function('window.islandAirDiagnostics?.summersideStation===true')
                if candidate and name != 'distant':
                    page.wait_for_function('window.islandAirDiagnostics?.spinnakersDeck===true')
                diag = fixed.settle(page, errors)
                assert diag['spinnakersDeck'] == (candidate and name != 'distant'), diag
                assert not errors and not diag['layerWarnings'], (errors, diag['layerWarnings'])
                assert transfers == ([200] if diag['spinnakersDeck'] else []), transfers
                filename = f'{name}-{"standard" if candidate else "stock"}.png'
                page.screenshot(path=str(a.out / filename))
                pose.update(fixedBaseH=diag['baseH'], fixedEyeY=diag['eyeY'])
                outcomes.append(dict(file=filename, transfers=transfers, active=diag['spinnakersDeck'],
                                     station=diag['summersideStation'], measuredRoofs=diag['summersideMeasuredRoofs'],
                                     calls=diag['drawCalls'], tris=diag['triangles'], coverGround=diag['groundY'],
                                     warnings=diag['layerWarnings'],
                                     neighbours={k:diag[k] for k in ('summersideOpenGround','openRipples',
                                                    'aerialPerspective','shoreFoamDetail','townWallProfile')}))
        stock, candidate = outcomes
        assert (stock['station'], stock['measuredRoofs'], stock['coverGround']) == (
            candidate['station'], candidate['measuredRoofs'], candidate['coverGround']), outcomes
        assert stock['neighbours'] == candidate['neighbours'], outcomes
        sa, ca = [np.asarray(Image.open(a.out / r['file']))[:, :, :3].astype('i2') for r in outcomes]
        diff = np.abs(sa - ca).max(axis=-1)
        ys, xs = np.where(diff > 0)
        changed = int(ys.size)
        bounds = [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1] if changed else None
        if name == 'distant':
            assert changed == 0, (name, changed, bounds)
        if name in ('wharf-close','county-approach'):
            assert (diff > 7).sum() > 140, (name, changed, bounds)
        protected = np.ones(diff.shape, dtype=bool)
        if name in scope:
            assert scope[name]['size'] == [width,height]
            for x0,y0,x1,y1 in scope[name]['boxes']:
                protected[y0:y1,x0:x1] = False
            assert not np.any(diff[protected]), (name,int(np.count_nonzero(diff[protected])),bounds)
        row = dict(pose=pose, view=name, stock=stock, standard=candidate, total=diff.size, changed=changed,
                   significant=int((diff > 7).sum()), changedBounds=bounds,
                   protectedPixels=int(protected.sum()) if name in scope or name=='distant' else None,
                   changedProtectedPixels=int(np.count_nonzero(diff[protected])) if name in scope or name=='distant' else None)
        result.append(row)
        (a.out / 'report.json').write_text(json.dumps(result, indent=2) + '\n')
        print(json.dumps(row), flush=True)

fixed.capture = capture
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--checkout', type=Path, required=True)
p.add_argument('--deps', type=Path)
p.add_argument('--out', type=Path, required=True)
p.add_argument('--chromium', required=True)
p.add_argument('--scope', type=Path, help='Optional preregistered pixel exclusion boxes')
p.add_argument('--views', default=','.join(poses))
p.set_defaults(void_probe=False)
fixed.run(p.parse_args())
