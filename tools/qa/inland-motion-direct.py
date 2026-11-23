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
      };
      (window as any).inspectInlandMotion=(id:string)=>{
        const ground=terrain.inlandGrids.find(g=>g.spec.id===id);
        if(!ground)throw Error('No inland terrain for '+id);
        const inspect=()=>{
         const root=scene.getObjectByName('PEI National Road Network')!;
         const road=root.children.filter(n=>(n as THREE.Mesh).geometry)
           .filter(n=>Math.abs(n.position.x-(ground.x0+ground.x1)*.5)<4200 &&
                      Math.abs(n.position.z-(ground.z0+ground.z1)*.5)<4200)
           .map(n=>({id:n.uuid,g:(n as THREE.Mesh).geometry.uuid,
                  tris:(n as THREE.Mesh).geometry.getAttribute('position').count/3,
                  mode:n.userData.inlandMode})).sort((a,b)=>a.id.localeCompare(b.id));
         const tile=(world as any).byId.get(ground.spec.tileX+'-'+ground.spec.tileZ);
         return {lod:tile.lod,road,shore:cover.distance(terrain,ground.x0,ground.z0)};
        };
        const base=camera.position.clone(),near=inspect();
        // Keep the road stream resident while crossing the World camera
        // distance bands. Each world update is a real LOD calculation.
        const viewed=new THREE.Vector3((ground.x0+ground.x1)*.5,base.y,(ground.z0+ground.z1)*.5);
        viewed.x+=8600;world.update(viewed,time+2);roads!.update(f.x,f.z);const medium=inspect();
        viewed.x+=8500;world.update(viewed,time+4);roads!.update(f.x,f.z);const far=inspect();
        world.update(base,time+6);roads!.update(f.x,f.z);const again=inspect();
        return {near,medium,far,again};
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
        x.wait_for_function("""()=>window.reviewCamera?.frame>20&&window.islandAirDiagnostics?.roads&&
          window.islandAirDiagnostics?.inlandSurveys?.length===3&&window.inspectInlandMotion""",
          timeout=80000,polling=250)
        d=x.evaluate('()=>({view:window.reviewCamera,scenery:window.islandAirDiagnostics})')
        if errors or d['scenery']['layerWarnings']:raise RuntimeError((errors,d))
        if variant=='inland':
            assert name in d['scenery']['inlandSurveys'],d
            q=x.evaluate("name=>window.inspectInlandMotion(name)",name)
            lanes=q['near']['road']
            assert [q[key]['lod']for key in ('near','medium','far','again')]==[112,56,8,112],q
            assert any(name in r['mode']for r in lanes) and all(not r['mode'] for r in q['far']['road']),q
            assert q['medium']['road']==q['far']['road'] and q['near']['road']==q['again']['road'],q
            assert [r['id']for r in lanes]==[r['id']for r in q['far']['road']],q
            d['LOD']=q
        else:assert d['scenery']['inlandSurveys']==[]
        img=x.evaluate('window.stillInland()')
        (a.out/(name+'-'+variant+'.png')).write_bytes(base64.b64decode(img.split(',',1)[1]))
        return d
    finally:ctx.close()
def capture(a,b,url):
    out={}
    locks={'walls-road': {'lon': -63.62936, 'lat': 46.33953, 'dist': 136, 'east': 0.23863, 'south': 0.97111, 'h': 0, 'agl': 29, 'fixedEyeY': 55.846479805161835, 'fixedBaseH': 25.558445832215057}, 'warburton-road': {'lon': -63.42687, 'lat': 46.372505, 'dist': 136, 'east': -0.25305, 'south': -0.96745, 'h': 0, 'agl': 24, 'fixedEyeY': 118.61349647931715, 'fixedBaseH': 84.92764155308245}, 'new-harmony-road': {'lon': -62.21987, 'lat': 46.390265, 'dist': 160, 'east': -0.26363, 'south': -0.96463, 'h': 0, 'agl': 34, 'fixedEyeY': 104.16998203353569, 'fixedBaseH': 71.05609448818768}}
    for name in a.views.split(','):
        out[name]=collect(a,b,url,name,locks[name],'inland')
        print(name,[(key,value['lod']) for key,value in out[name]['LOD'].items()],flush=True)
        (a.out/'report.json').write_text(json.dumps(out,indent=2)+'\n')

f.capture=capture
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--checkout',required=True,type=Path);p.add_argument('--out',required=True,type=Path);p.add_argument('--chromium',required=True);p.add_argument('--deps',type=Path)
p.add_argument('--views',default=','.join(P));p.set_defaults(void_probe=False)
f.run(p.parse_args())
