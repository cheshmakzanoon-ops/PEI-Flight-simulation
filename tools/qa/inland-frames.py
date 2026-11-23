#!/usr/bin/env python3
"""Use the same world-coordinate camera for an optional inland terrain A/B."""
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
        qs='&inlandRelief' if variant=='inland' else ''
        x.goto(url+'/?diagnostics'+qs+'&qa='+quote(json.dumps(pose)),wait_until='domcontentloaded')
        x.wait_for_function("""()=>{const d=window.islandAirDiagnostics,w=window.reviewCamera;
          return w?.frame>45&&d?.roads&&d?.buildings&&d?.mainland&&d?.detail?.ready>1;}""",timeout=95000,polling=350)
        d=x.evaluate('()=>({view:window.reviewCamera,scenery:window.islandAirDiagnostics})')
        if errors or d['scenery']['layerWarnings']:raise RuntimeError((errors,d))
        if variant=='inland':assert name in d['scenery']['inlandSurveys'],d
        else:assert d['scenery']['inlandSurveys']==[]
        img=x.evaluate('window.stillInland()')
        (a.out/(name+'-'+variant+'.png')).write_bytes(base64.b64decode(img.split(',',1)[1]))
        return d
    finally:ctx.close()
def capture(a,b,url):
    out={}
    for name in a.views.split(','):
        old=collect(a,b,url,name,P[name],'base')
        lock=dict(P[name],fixedEyeY=old['view']['eyeY'],fixedBaseH=old['view']['baseH'])
        art=collect(a,b,url,name,lock,'inland')
        assert all(old['view'][k]==art['view'][k]for k in ('baseH','eyeY','x','z','bottomY','topY'))
        out[name]={'locked':lock,'base':old,'inland':art}
        print(name,[(x['scenery']['drawCalls'],x['scenery']['triangles'])for x in (old,art)],flush=True)
        (a.out/'report.json').write_text(json.dumps(out,indent=2)+'\n')
f.capture=capture
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--checkout',required=True,type=Path);p.add_argument('--out',required=True,type=Path);p.add_argument('--chromium',required=True);p.add_argument('--deps',type=Path)
p.add_argument('--views',default=','.join(P));p.set_defaults(void_probe=False)
f.run(p.parse_args())
