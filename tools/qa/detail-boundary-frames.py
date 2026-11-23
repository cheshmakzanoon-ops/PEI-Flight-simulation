#!/usr/bin/env python3
"""A real compiled terrain seam with fully loaded and missing-neighbour controls."""
import argparse
import importlib.util
import json
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import quote
import socket
import time
from urllib.request import urlopen

import numpy as np
from PIL import Image, ImageFilter
from playwright.sync_api import sync_playwright
b=Path(__file__).with_name('fixed-scenery.py')
spec=importlib.util.spec_from_file_location('fixed',b)
fixed=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixed)
pose=dict(lon=-62.41263720703125,lat=46.46727272727273,east=.74,south=.67,
          h=4.0,dist=326,agl=240,fixedBaseH=29,fixedEyeY=260)
omit='25-12'
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--base',type=Path,required=True);p.add_argument('--checkout',type=Path,required=True)
p.add_argument('--scope-only',action='store_true')
p.add_argument('--reuse-base',action='store_true')
p.add_argument('--chromium',required=True);p.add_argument('--out',type=Path,required=True)
args=p.parse_args();args.out.mkdir(parents=True,exist_ok=True)
index=json.loads((args.checkout/'public/world/detail/index.json').read_text())

def wait_ready(url):
    for _ in range(100):
        try:
            with urlopen(url,timeout=1) as response:response.read(1)
            return
        except OSError: time.sleep(.20)
    raise RuntimeError('QA Vite server did not listen')

def angle(page, url, spec, target, marker=False):
    page.goto(url+'/?diagnostics&'+('qaDetailScope&' if marker else '')+'qa='+quote(json.dumps(spec)),wait_until='domcontentloaded')
    fixed.settle(page,[])
    page.wait_for_timeout(900)
    page.screenshot(path=str(target),timeout=90000)
    return page.evaluate('()=>({...window.islandAirDiagnostics,...window.reviewCamera})')

with tempfile.TemporaryDirectory(prefix='pei-detail-seam-') as temporary, sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=args.chromium,args=fixed.FLAGS)
    receipts={}
    pairs=[('old',args.base.resolve()),('new',args.checkout.resolve())]
    if args.scope_only or args.reuse_base:pairs=pairs[1:]
    for label,repo in pairs:
        root=Path(temporary)/label;root.mkdir()
        deps=(repo/'node_modules').resolve()
        fixed.stage(repo,root,deps,False)
        if label=='new':
            code=root/'src/render/world.ts'
            text=code.read_text().replace('uniform sampler2D imageMap,coverMap,detailMap,paintMap;', 'uniform float qaDetailScope; uniform sampler2D imageMap,coverMap,detailMap,paintMap;')
            text=text.replace('const uniforms={detailClock:', 'const uniforms={qaDetailScope:{value:Number(new URLSearchParams(location.search).has("qaDetailScope"))},detailClock:')
            text=text.replace('float amount=hasDetail>.5?detailAmount(q):0.;','''float amount=hasDetail>.5?detailAmount(q):0.;
 if(qaDetailScope>.5){gl_FragColor=vec4((hasDetail>.5&&amount<1.)?vec3(1.,0.,1.):vec3(0.),1.);return;}''')
            assert text.count('uniform float qaDetailScope')==1 and text.count('qaDetailScope>.5')==1
            code.write_text(text)
        with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
        url=f'http://127.0.0.1:{port}'
        with (args.out/(label+'.log')).open('w') as log:
            process=subprocess.Popen(['node',str(deps/'vite/bin/vite.js'),'--host','127.0.0.1','--port',str(port),'--strictPort'],cwd=root,stdout=log,stderr=log)
            try:
                wait_ready(url)
                for mode in (['scope'] if args.scope_only else (['full','mixed','scope'] if label=='new' else ['full','mixed'])):
                    with browser.new_context(viewport={'width':850,'height':560},device_scale_factor=1) as context:
                        page=context.new_page();page.set_default_timeout(90000);err=[]
                        page.on('pageerror',lambda e:err.append(str(e)))
                        page.on('console',lambda m:err.append(m.text) if m.type=='error' else None)
                        if mode in {'mixed','scope'}:
                            fake={**index,'tiles':{key:value for key,value in index['tiles'].items() if key!=omit}}
                            page.route('**/world/detail/index.json',lambda r:r.fulfill(status=200,json=fake))
                        target=args.out/(label+'-'+mode+'.png')
                        info=angle(page,url,pose,target,marker=mode=='scope')
                        assert not err,err
                        receipts[label+'-'+mode]={'detail':info['detail'],'triangles':info['triangles'],'drawCalls':info['drawCalls']}
                        print(label,mode,receipts[label+'-'+mode],flush=True)
            finally:
                process.terminate();process.wait(timeout=8)
    browser.close()
    if args.scope_only or args.reuse_base:
        old_receipt=json.loads((args.out/'receipt.json').read_text());old_receipt.update(receipts);receipts=old_receipt
    for mode in ['full','mixed']:
        a,b=(np.asarray(Image.open(args.out/(k+'-'+mode+'.png')).convert('RGB'),dtype=np.int16) for k in ['old','new'])
        d=np.abs(a-b).max(axis=2)
        receipts[mode]={'pixels':d.size,'any':int((d>0).sum()),'gt2':int((d>2).sum()),'max':int(d.max())}
    marker=np.asarray(Image.open(args.out/'new-scope.png').convert('RGB'),dtype=np.int16)
    inside=(marker[:,:,0]>150)&(marker[:,:,1]<110)&(marker[:,:,2]>150)
    inside=np.asarray(Image.fromarray(inside.astype('uint8')*255).filter(ImageFilter.MaxFilter(7)))>0
    a,b=(np.asarray(Image.open(args.out/(v+'-mixed.png')).convert('RGB'),dtype=np.int16) for v in ['old','new'])
    delta=np.abs(a-b).max(axis=2)
    receipts['scope']={'supportPlus3px':int(inside.sum()),'outsideExact':int((~inside & (delta==0)).sum()),
                       'outsideAny':int((~inside & (delta>0)).sum()),'outsideGt2':int((~inside & (delta>2)).sum())}
    (args.out/'receipt.json').write_text(json.dumps(receipts,indent=2)+'\n')
    print(json.dumps(receipts,indent=2),flush=True)
    assert receipts['full']['any']==0 and receipts['mixed']['gt2']>5000
    assert receipts['scope']['outsideAny']==0
    for mode in ('full','mixed'):
        for info in ('triangles','drawCalls','detail'):
            assert receipts['old-'+mode][info]==receipts['new-'+mode][info],(mode,info)
