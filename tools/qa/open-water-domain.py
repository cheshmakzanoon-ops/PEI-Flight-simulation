#!/usr/bin/env python3
"""Check preflight offshore envelopes against the current Cover grid."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import subprocess

import numpy as np
from scipy.ndimage import binary_propagation


def check(root):
    world = root/'public/world'
    meta = json.loads((world/'cover.json').read_text())
    packed = (world/meta['file']).read_bytes()
    assert hashlib.sha256(packed).hexdigest() == meta['compressedSha256']
    raw = gzip.decompress(packed)
    stride = np.frombuffer(raw,np.uint8).reshape(meta['height'],meta['width'],2)
    signed = stride[:,:,1].astype(np.int16)*2-256
    wet = signed < 0
    edges = np.zeros_like(wet)
    edges[0] |= wet[0]; edges[-1] |= wet[-1]
    edges[:,0] |= wet[:,0]; edges[:,-1] |= wet[:,-1]
    ocean = binary_propagation(edges,mask=wet)
    root_js = '''import {OPEN_WATER_WINDOWS} from './src/render/open-water-ripples.ts';
      import {project} from './src/sim/geo.ts';
      const {x:left,z:top}=project(Number(process.argv[1]),Number(process.argv[4]));
      const {x:right,z:bottom}=project(Number(process.argv[3]),Number(process.argv[2]));
      process.stdout.write(JSON.stringify({left,right,top,bottom,
        windows:OPEN_WATER_WINDOWS.map(([lon,lat,_inner,outer])=>({...project(lon,lat),lon,lat,outer}))}));'''
    a = json.loads(subprocess.check_output(['node','--experimental-strip-types','--input-type=module','-e',root_js,'--',
                        *map(str,meta['bounds'])],cwd=root,text=True))
    x = np.linspace(a['left'],a['right'],meta['width'],endpoint=False)+(a['right']-a['left'])/(2*meta['width'])
    z = np.linspace(a['top'],a['bottom'],meta['height'],endpoint=False)+(a['bottom']-a['top'])/(2*meta['height'])
    rows = []
    for w in a['windows']:
        cx,cz,r = w['x'],w['z'],w['outer']
        # Screen a conservative area larger than the shader's support.
        ix=np.nonzero(abs(x-cx)<r+80)[0]; iz=np.nonzero(abs(z-cz)<r+80)[0]
        B,Z=np.ix_(iz,ix)
        support=(np.hypot(x[Z]-cx,z[B]-cz)<r+78)&(signed[B,Z]<-152)
        disconnected=support & ~ocean[B,Z]
        rows.append(dict(lon=w['lon'],lat=w['lat'],checkedCells=int(support.sum()),
                         disconnected=int(disconnected.sum()),paddingM=78))
        assert not disconnected.any(),rows[-1]
    return dict(coverSha256=meta['compressedSha256'],conservativeScreenM=-152,
                scope="Inherited dry/wet raster connectivity only. No new shoreline or tides.",windows=rows)


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkout',type=Path,default=Path.cwd())
    parser.add_argument('--out',type=Path,required=True)
    a=parser.parse_args()
    a.out.write_text(json.dumps(check(a.checkout.resolve()),indent=2)+'\n')
