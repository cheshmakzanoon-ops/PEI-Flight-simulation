#!/usr/bin/env python3
"""Compare the shipping view-ray background on a fixed view with a prior defect."""
import argparse,base64,importlib.util,json,os
from pathlib import Path
from urllib.parse import quote
s=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
f=importlib.util.module_from_spec(s);s.loader.exec_module(f);stage0=f.stage
P={
 'walls-road':dict(lon=-63.62936,lat=46.33953,dist=136,east=.23863,south=.97111,h=0,agl=29),
 'warburton-road':dict(lon=-63.42687,lat=46.372505,dist=136,east=-.25305,south=-.96745,h=0,agl=24),
 'new-harmony-road':dict(lon=-62.21987,lat=46.390265,dist=160,east=-.26363,south=-.96463,h=0,agl=34),
}
def stage(repo,root,deps,v):
    stage0(repo,root,deps,v)
    p=root/'src/main.ts';t=p.read_text()
    t=f.once(t,'const startPoint=projectSite(SITES[0].lon,SITES[0].lat),warmForest=', '''const qp=JSON.parse(new URLSearchParams(location.search).get('qa')!);
         const c=projectSite(qp.lon,qp.lat),l=Math.hypot(qp.east,qp.south);
         const startPoint={x:c.x+qp.dist*qp.east/l,z:c.z+qp.dist*qp.south/l},warmForest=''')
    t=f.once(t,'renderer.render(scene,camera);','''renderer.render(scene,camera);
      (window as any).stillInland=()=>{
        renderer.render(scene,camera);
        return renderer.domElement.toDataURL('image/png');
      };''')
    p.write_text(t)
f.stage=stage
def collect(a,b,url,name,pose,variant):
    ctx=b.new_context(viewport={'width':900,'height':540},device_scale_factor=1)
    try:
        x=ctx.new_page();errors=[]
        x.on('pageerror',lambda e:errors.append(str(e)))
        x.on('console',lambda m:errors.append(m.text)if m.type=='error' else None)
        qs=''
        x.goto(url+'/?diagnostics'+qs+'&qa='+quote(json.dumps(pose)),wait_until='domcontentloaded')
        x.wait_for_function("""()=>{const d=window.islandAirDiagnostics,w=window.reviewCamera;
          return w?.frame>24&&d?.roads&&d?.buildings&&d?.mainland&&d?.hedgerows?.visible>0&&d?.hedgerows.loading===0&&
           d?.buildingTiles?.ready===d?.buildingTiles?.wanted&&d?.detail?.ready>0&&!d?.detail?.loading;}""",timeout=160000,polling=350)
        d=x.evaluate('()=>({view:window.reviewCamera,scenery:window.islandAirDiagnostics})')
        if errors or d['scenery']['layerWarnings']:raise RuntimeError((errors,d))
        img=x.evaluate('window.stillInland()')
        (a.out/(name+'-'+variant+'.png')).write_bytes(base64.b64decode(img.split(',',1)[1]))
        return d
    finally:ctx.close()
def capture(a,b,url):
    out={}
    locks={'walls-road': {'locked': {'lon': -63.62936, 'lat': 46.33953, 'dist': 136, 'east': 0.23863, 'south': 0.97111, 'h': 0, 'agl': 29, 'fixedEyeY': 55.846479805161835, 'fixedBaseH': 25.558445832215057}}}
    for name in a.views.split(','):
        lock=locks[name]['locked']
        now=collect(a,b,url,name,lock,a.label)
        out[name]={'lock':lock,'view':now}
        print(name,now['scenery']['drawCalls'],now['scenery']['triangles'],flush=True)
        (a.out/'report.json').write_text(json.dumps(out,indent=2)+'\n')

f.capture=capture
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--label',default='sky');p.add_argument('--checkout',required=True,type=Path);p.add_argument('--out',required=True,type=Path);p.add_argument('--chromium',required=True);p.add_argument('--deps',type=Path)
p.add_argument('--views',default='walls-road');p.set_defaults(void_probe=False)
f.run(p.parse_args())
