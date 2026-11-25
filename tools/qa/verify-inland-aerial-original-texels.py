#!/usr/bin/env python3
"""Verify a live 4 x 640 inland aerial strip against its two real source owners.

Uses a throwaway overlay via tools/qa/fixed-scenery.py, current Three.js texture
objects and WebGL2 readback, not a screenshot or an emulator of the sampler.
No assets are downloaded, generated or written into the supplied checkout.
Install project dependencies, Pillow, NumPy and Playwright; supply an actual
WebGL2 Chromium via --chromium. The .gpu.ts probe must be alongside this script.
Example: python tools/qa/verify-inland-aerial-original-texels.py --checkout . \
  --out /tmp/pei-texels --chromium /path/to/chrome
"""
from pathlib import Path
from urllib.parse import quote
import argparse, hashlib, importlib.util, io, json
import numpy as np
from PIL import Image

SITES = {
    'west': (['7-12','8-12'], 227, -63.835, 46.44852982954546, ['47d33340a2b0318e61fde6f8a820e645c28484a53d5fc7ab643543b6158ede6d', '2154c285d58ce96f80e5f4f7e6f7761abd6578769aa7fb62a8b26428ce4b2cd4']),
    'central': (['10-11','11-11'], 467, -63.596875, 46.481484375, ['d3d7b18884016a2afeb4842f1b27bd543702234d7d6c1660f52caeeafc4f2fcb', 'f962988f7aa5ed4f9679803ef0e1e9e1f69c54dd70c3748769a323bb8ce653f7'])}

def sha(data):
    return hashlib.sha256(data).hexdigest()

def native_data(root, ids, pins):
    detail = root/'public/world/detail'
    manifest = json.loads((detail/'index.json').read_text())
    samples = []
    for i,(name,pin) in enumerate(zip(ids,pins)):
        tile = manifest['tiles'][name]
        pack = manifest['packs'][tile['pack']]
        wire = (detail/pack['file']).read_bytes()
        assert len(wire)==pack['bytes'] and sha(wire)==pack['sha256']
        encoded = wire[tile['offset']:tile['offset']+tile['bytes']]
        assert sha(encoded)==tile['sha256']==pin
        src = np.asarray(Image.open(io.BytesIO(encoded)).convert('RGBA'))
        assert src.shape==(640,640,4)
        samples.append(src[:,-2:,:] if i==0 else src[:,:2,:])
    return np.concatenate(samples, axis=1)

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--checkout', type=Path, required=True)
parser.add_argument('--out', type=Path, required=True)
parser.add_argument('--chromium', required=True)
parser.add_argument('--views', default='west,central')
args=parser.parse_args(); args.deps=None; args.void_probe=False
module=importlib.util.spec_from_file_location('fixed',args.checkout/'tools/qa/fixed-scenery.py')
fixed=importlib.util.module_from_spec(module); module.loader.exec_module(fixed)
base_stage=fixed.stage

def stage(repo, staged, deps, void):
    base_stage(repo, staged, deps, void)
    path=staged/'src/main.ts'
    source=path.read_text(); anchor='\n  renderer.render(scene,camera);'
    probe=Path(__file__).with_name('inland-aerial-original-texels.gpu.ts').read_text()
    path.write_text(fixed.once(source,anchor,anchor+'\n'+probe))

def capture(args,browser,url):
    result={}
    for name in args.views.split(','):
        ids,row,lon,lat,pins=SITES[name]
        world=native_data(args.checkout,ids,pins)
        pose={'owners':ids,'row':row,'lon':lon,'lat':lat,'h':0,'dist':54,'agl':34,'east':.84,'south':-.54}
        ctx=browser.new_context(viewport={'width':768,'height':480})
        try:
            page=ctx.new_page(); errors=[]
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('console', lambda msg:errors.append(msg.text) if msg.type=='error' else None)
            page.goto(url+'/?diagnostics&qa='+quote(json.dumps(pose)),wait_until='domcontentloaded')
            fixed.settle(page,errors)
            page.wait_for_function('e=>window.islandAirDiagnostics?.orthophotoSeams?.some(s=>s.edge===e&&s.gain===1)',arg=' / '.join(ids),timeout=120000)
            r=page.evaluate('window.stockAndStripSamples()')
            r['sourceCPUUnmodifiedWebPCentreHash']=sha(world.tobytes())
            r['exactGPUOriginalVersusIndependentDecodedSourceRGBA']=r['originalCentresRawHash']==r['sourceCPUUnmodifiedWebPCentreHash']
            r['maxSourceCPUGPUHeldRowCentreChannelDifference']=int(max(np.max(abs(world[p['row'],idx,:3].astype(int)-np.array(p[tag]))) for p in r['chosenRows'] for tag,idx in [('left',1),('right',2)]))
            assert not errors and r['selectedOwnerMaterialUsesSameStrip'] and r['actualStripDimensions']==[4,640]
            assert r['fullOriginalTexelCenters']==2560 and r['maximumCentreAbsoluteChannelError']==r['centresDifferent']==0
            assert r['intermediatePositions']==5760 and r['maximumQuarterTexelRGBAError']<=1 and r['quarterTexelErrorsOverOne']==0
            assert not r['lost'] and r['glError']==0 and r['exactGPUOriginalVersusIndependentDecodedSourceRGBA']
            result[name]=r
            (args.out/'gpu-original-texels.json').write_text(json.dumps(result,indent=2)+'\n')
            print(name, r['fullOriginalTexelCenters'], r['centresDifferent'], r['maximumQuarterTexelRGBAError'], r['sourceCPUUnmodifiedWebPCentreHash'],flush=True)
        finally: ctx.close()
fixed.stage=stage; fixed.capture=capture; fixed.run(args)
