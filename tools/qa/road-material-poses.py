#!/usr/bin/env python3
"""Capture the same 2025 agricultural field locations at low altitude in all three counties."""
import argparse
import base64
import importlib.util
import json
import os
from pathlib import Path
from urllib.parse import quote

spec = importlib.util.spec_from_file_location('fixed', Path(__file__).with_name('fixed-scenery.py'))
fixed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixed)
base_stage = fixed.stage
def stage(repo, root, deps, void_probe):
    base_stage(repo, root, deps, void_probe)
    main = root / 'src/main.ts'
    if 'warmForest=forestStream.warm' in main.read_text():
        ss=main.read_text()
        ss=fixed.once(ss,'const startPoint=projectSite(SITES[0].lon,SITES[0].lat),warmForest=', '''const qp=JSON.parse(new URLSearchParams(location.search).get('qa')!);
          const wc=projectSite(qp.lon,qp.lat),wn=Math.hypot(qp.east,qp.south);
          const startPoint={x:wc.x+qp.dist*qp.east/wn,z:wc.z+qp.dist*qp.south/wn},warmForest=''')
        main.write_text(ss)
    main.write_text(fixed.once(main.read_text(), 'renderer.render(scene,camera);', '''
      renderer.render(scene,camera);
      const wantedForest=(world as any).tiles.filter((tile:any)=>Math.hypot(camera.position.x-tile.x0-tile.w/2,
        camera.position.z-tile.z0-tile.d/2)<14500);
      (window as any).woodlandTileQA={needed:wantedForest.map((t:any)=>t.id).sort(),
        ready:wantedForest.filter((t:any)=>t.status==='ready').map((t:any)=>t.id).sort(),
        settled:wantedForest.filter((t:any)=>t.status==='ready'||t.status==='uncovered')
          .map((t:any)=>t.id).sort()};
      (window as any).captureForest = () => {
        renderer.render(scene,camera);
        const root=scene.getObjectByName('PEI National Road Network');
        if(!root)throw Error('No rendered road ribbons');
        const marks:{k:THREE.BufferAttribute,c:THREE.BufferAttribute,old:Float32Array,i:number[]}[]=[];
        const gravel=new THREE.Color(0x9f7658);
        root.traverse(o=>{
         const g=(o as THREE.Mesh).geometry;
         if(!g)return;
         const k=g.getAttribute('roadSurface') as THREE.BufferAttribute,c=g.getAttribute('color') as THREE.BufferAttribute;
         if(!k||!c)return;
         const old=c.array as Float32Array,i:number[]=[];
         for(let j=0;j<k.count;j++)if((k.array as Int8Array)[j*2+1]===-64)i.push(j);
         if(i.length)marks.push({k,c,old:old.slice(),i});
        });
        const draw=()=>{
          renderer.render(scene,camera);
          return [renderer.domElement.toDataURL('image/png'),[renderer.info.render.calls,renderer.info.render.triangles]];
        };
        const [art,artCounts]=draw();
        for(const {k,c,i} of marks){
         for(const j of i){(k.array as Int8Array)[j*2+1]=0;c.setXYZ(j,gravel.r,gravel.g,gravel.b);}
         k.clearUpdateRanges();c.clearUpdateRanges();k.needsUpdate=c.needsUpdate=true;
        }
        const [old,oldCounts]=draw();
        for(const {k,c,i,old:a} of marks){
         for(const j of i)(k.array as Int8Array)[j*2+1]=-64;
         (c.array as Float32Array).set(a);k.needsUpdate=c.needsUpdate=true;
        }
        return {old,art,oldCounts,artCounts,vertices:marks.reduce((n,x)=>n+x.i.length,0)};
      };
    '''))
fixed.stage = stage

POSES={
 'walls-dirt':dict(lon=-63.62936,lat=46.33953,dist=100,east=.23863,south=.97111,h=0,agl=12),
 'warburton-dirt':dict(lon=-63.42687,lat=46.372505,dist=100,east=-.25305,south=-.96745,h=0,agl=12),
 'new-harmony-dirt':dict(lon=-62.21987,lat=46.390265,dist=100,east=-.26363,south=-.96463,h=0,agl=12),
 'new-harmony-gravel':dict(lon=-62.19496,lat=46.36827,dist=100,east=-.98561,south=-.16903,h=0,agl=12),
 'new-harmony-paved':dict(lon=-62.209985,lat=46.368885,dist=66.785,east=-.25764,south=-.96624,h=0,agl=12)
}
def capture(args, browser, url):
    results = []
    for name in args.views.split(','):
        pose = POSES[name]
        context = browser.new_context(viewport={'width': 720, 'height': 450}, device_scale_factor=1)
        try:
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
            page.goto(url+'/?diagnostics&qa='+quote(json.dumps(pose)), wait_until='domcontentloaded')
            page.wait_for_function("""()=>{const d=window.islandAirDiagnostics,b=d?.buildingTiles;
              const w=window.woodlandTileQA;
              return d?.mainland&&d?.roads&&w?.ready.length>0&&w.needed.length===w.settled.length&&
                !d.detail.loading&&b?.ready===b?.wanted&&!b.failed&&d.woodlandStream.inflight===0;
            }""",timeout=210000,polling=400)
            diag=page.evaluate('window.islandAirDiagnostics')
            if errors or diag['layerWarnings'] or diag['detail']['missing']:
                raise RuntimeError((errors,diag))
            data=page.evaluate('window.captureForest()')
            assert data['vertices']>0 and data['oldCounts'][0]==data['artCounts'][0],data
            assert data['artCounts'][1]-data['oldCounts'][1]==0,data
            for key in ('old','art'):
                raw=data.pop(key)
                (args.out/(name+'-'+key+'.png')).write_bytes(base64.b64decode(raw.split(',',1)[1]))
            results.append(dict(view=name, pose=pose, triangles=diag['triangles'], calls=diag['drawCalls'],detail=diag['detail'],tiles=page.evaluate('window.woodlandTileQA'),native=diag.get('woodlandStream'),hedgerows=diag.get('hedgerows'),comparison=data))
            print(name, diag['triangles'], diag['drawCalls'], flush=True)
        finally:
            context.close()
    (args.out/'report.json').write_text(json.dumps(results, indent=2)+'\n')

fixed.capture = capture
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--checkout', type=Path, required=True)
parser.add_argument('--out', type=Path, required=True)
parser.add_argument('--chromium', default=os.getenv('CHROMIUM', 'chromium'))
parser.add_argument('--deps', type=Path)
parser.add_argument('--views', default=','.join(POSES))
parser.set_defaults(void_probe=False)
fixed.run(parser.parse_args())
