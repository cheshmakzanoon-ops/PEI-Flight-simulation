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
        const canopy=(vegetation as any).geom,all=canopy.instanceCount,added=vegetation.hedgeCount;
        canopy.instanceCount=all-added;renderer.render(scene,camera);
        const old=renderer.domElement.toDataURL('image/png'),oldCounts=[renderer.info.render.calls,renderer.info.render.triangles];
        canopy.instanceCount=all;renderer.render(scene,camera);
        const art=renderer.domElement.toDataURL('image/png'),artCounts=[renderer.info.render.calls,renderer.info.render.triangles];
        return {old,art,oldCounts,artCounts,added};
      };
    '''))
fixed.stage = stage

POSES={
 'prince-freetown-edge':dict(lon=-63.62289608517722,lat=46.36104558836548,dist=228,east=.51,south=.86,h=6,agl=33),
 'queens-new-glasgow-edge':dict(lon=-63.38577439297236,lat=46.404241973420795,dist=245,east=.91,south=.41,h=7,agl=42),
 'kings-st-peters-edge':dict(lon=-62.638480859392814,lat=46.41015818954952,dist=230,east=.72,south=.7,h=6,agl=39),
 'prince-freetown-wide':dict(lon=-63.62289608517722,lat=46.36104558836548,dist=625,east=.51,south=.86,h=5,agl=156),
 'prince-freetown-low':dict(lon=-63.62289608517722,lat=46.36104558836548,dist=62,east=.51,south=.86,h=3,agl=11),
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
                !d.detail.loading&&b?.ready===b?.wanted&&!b.failed&&d.woodlandStream.inflight===0&&d.hedgerows?.visible>0&&!d.hedgerows.loading;
            }""",timeout=210000,polling=400)
            diag=page.evaluate('window.islandAirDiagnostics')
            if errors or diag['layerWarnings'] or diag['detail']['missing']:
                raise RuntimeError((errors,diag))
            data=page.evaluate('window.captureForest()')
            assert data['added']>0 and data['oldCounts'][0]==data['artCounts'][0],data
            assert data['artCounts'][1]-data['oldCounts'][1]==data['added']*4,data
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
