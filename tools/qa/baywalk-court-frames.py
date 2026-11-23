#!/usr/bin/env python3
"""Lock the actual scene's Baywalk camera and compare explicit preview/fallback modes."""
import argparse
import base64
import gzip
import importlib.util
import math
from pathlib import Path

self=Path(__file__).resolve()
repo=self.parents[2]
spec=importlib.util.spec_from_file_location('fixed_scenery',self.with_name('fixed-scenery.py'))
f=importlib.util.module_from_spec(spec)
spec.loader.exec_module(f)
a=6378137*math.pi/180
t=1-.00669437999014*math.sin(math.radians(46.5))**2
scale=(a*math.cos(math.radians(46.5))/math.sqrt(t),-a*(1-.00669437999014)/t**1.5)
def pose(eye,aim,height,centre):
    x,z=[(u-v)*k for u,v,k in zip(eye,aim,scale)]
    return dict(lon=aim[0],lat=aim[1],east=x,south=z,h=2*centre,nearDist=math.hypot(x,z),
                nearAgl=height,fixedEyeY=height,fixedBaseH=0.)
f.VIEWS.update({
    'baywalk-ramp':pose((-63.787588,46.389313),(-63.787450,46.3894145),5.25,2.01),
    'baywalk-aerial':pose((-63.78773,46.38876),(-63.78726,46.389605),88.6,1.75),
})
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--checkout',type=Path,default=repo)
p.add_argument('--deps',type=Path)
p.add_argument('--chromium',default='chromium')
p.add_argument('--out',required=True,type=Path)
p.add_argument('--pose-baseline',type=Path)
p.add_argument('--mode',choices=['default','pier','court','corrupt'],default='court')
p.add_argument('--with-foam',action='store_true')
p.add_argument('--with-legacy-arcs',action='store_true')
p.add_argument('--views',default='baywalk-ramp-close,baywalk-aerial-close')
opts=p.parse_args()
flags=[]
if opts.mode!='default':flags.append('spinnakersPreview')
if opts.mode in ('court','corrupt'):flags.append('northBaywalkPreview')
if opts.with_foam:flags.append('shoreFoamDetail')
if opts.with_legacy_arcs:flags.append('legacyShoreArcs')
oldstage=f.stage
def stage(source,tmp,deps,void):
    oldstage(source,tmp,deps,void)
    main=tmp/'src/main.ts'
    s=main.read_text()
    s=f.once(s,'const diagnostic=', '''let captureCourt:((png:string)=>void)|null=null;
      (window as any).captureCourt=()=>new Promise<string>(r=>{captureCourt=r;});
      (window as any).courtImagery=()=>((world as any).tiles as any[]).filter(t=>t.status==='ready').map(t=>t.id).sort();
      const diagnostic=''')
    s=f.once(s,'  renderer.render(scene,camera);', '''  renderer.render(scene,camera);
      if(captureCourt){const copy=captureCourt;captureCourt=null;copy(renderer.domElement.toDataURL('image/png'));}''')
    main.write_text(s)
f.stage=stage
settle=f.settle
def ready(page,errors):
    settle(page,errors)
    page.wait_for_timeout(450)
    diag=settle(page,errors)
    diag['exactReadyOrthoIds']=page.evaluate('window.courtImagery()')
    for key in ('northBaywalkCourt','northBaywalkRamp','northBaywalkRoad'):
        assert bool(diag.get(key))==(opts.mode=='court'),key
    assert bool(diag.get('spinnakersDeck'))==(opts.mode!='default')
    return diag
f.settle=ready
capture=f.capture
class Browser:
    def __init__(self,underlying):
        self.b=underlying
    def new_context(self,**kw):
        context=self.b.new_context(**kw)
        create=context.new_page
        def page():
            pg=create()
            go=pg.goto
            pg.goto=lambda url,**kw:go(url.replace('/?diagnostics&qa=', '/?diagnostics&'+''.join(x+'&'for x in flags)+'qa='),**kw)
            if opts.mode=='corrupt':
                pack=opts.checkout/'public/world/spinnakers/v1/north-court.gz'
                body=bytearray(gzip.decompress(pack.read_bytes()))
                body[113]^=1
                bad=gzip.compress(body,mtime=0)
                pg.route('**/north-court.gz',lambda route:route.fulfill(status=200,body=bad))
            def snapshot(path,timeout):
                png=pg.evaluate('window.captureCourt()')
                result=base64.b64decode(png.split(',',1)[1])
                Path(path).write_bytes(result)
                return result
            pg.screenshot=snapshot
            return pg
        context.new_page=page
        return context
f.capture=lambda args,browser,url:capture(args,Browser(browser),url)
f.run(argparse.Namespace(checkout=opts.checkout,deps=opts.deps,out=opts.out,views=opts.views,
                        chromium=opts.chromium,size='900x564',pose_baseline=opts.pose_baseline,void_probe=False))
