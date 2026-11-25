#!/usr/bin/env python3
"""Same Three.js waterfront frames, pinned optional art, all live local tiles resident."""
import argparse,base64,hashlib,importlib.util,json,math
from pathlib import Path
from urllib.parse import quote
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--checkout',type=Path,required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--chromium',required=True)
p.add_argument('--controls',type=Path,required=True)
p.add_argument('--deps',type=Path)
p.add_argument('--pose-baseline',type=Path)
p.add_argument('--select',nargs='+')
p.add_argument('--query',default='beaconsfieldReview')
p.add_argument('--ground-probes',type=Path)
p.add_argument('--shadow-layer-witness',action='store_true')
p.add_argument('--project-support',action='store_true')
p.add_argument('--expected-grade',help='Wait for the named coupled grade and actual shadow receiver.')
p.add_argument('--forbid-grade',help='Verify the named coupled grade remains absent.')
p.add_argument('--expect-art',action=argparse.BooleanOptionalAction,default=True)
a=p.parse_args()
assert not set(a.query)&set('?#')
if a.shadow_layer_witness and not a.ground_probes:p.error('Shadow witness requires actual resident scene probes.')
if a.project_support and (not a.ground_probes or not a.expected_grade):p.error('Support projection requires grade and ground probes.')
a.void_probe=False
a.size='840x540'
s=importlib.util.spec_from_file_location('fixed',a.checkout/'tools/qa/fixed-scenery.py')
b=importlib.util.module_from_spec(s)
s.loader.exec_module(b)
views=json.loads(a.controls.read_text())['views']
if a.select:
    views={k:views[k] for k in a.select}
a.views=','.join(views)
a.views_input=views
if a.ground_probes:
    original=b.stage
    def stage(repo,tmp,deps,void):
        original(repo,tmp,deps,void)
        f=tmp/'src/main.ts'
        anchor='\n  renderer.render(scene,camera);'
        old=f.read_text()
        old=b.once(old,anchor,anchor+'''
        (window as any).qaActualBeaconsfieldGround=(sites:readonly [number,number][])=>
         sites.map(([x,z])=>{
           const [u,v]=terrain.uv(x,z);
           const key=Math.floor(u*WORLD_COLS)+'-'+Math.floor(v*WORLD_ROWS);
           const tile=(world as any).byId.get(key);
           const mesh=tile?.lod>8&&tile.fine?tile.fine:tile?.coarse;
           if(!mesh)throw Error('Expected a mounted ground mesh at each site');
           const ray=new THREE.Raycaster(new THREE.Vector3(x,900,z),new THREE.Vector3(0,-1,0),0,2000);
           const hits=ray.intersectObject(mesh,false);
           if(!hits.length)throw Error('Ground ray missed the actual geometry');
           const patch=(world as any).installedGrade(key,tile);
           return {x,z,gradeWeight:patch?.weight(x,z)??0.,visualRendererY:hits[0].point.y,visualCPUY:world.visualGroundHeight(x,z),
            colliderY:world.groundHeight(x,z),land:world.surface(x,z).land,key,lod:tile.lod,
            grade:mesh.userData.localGrade??null};
         });
        (window as any).qaActualBeaconsfieldStems=()=>{
         const v=vegetation as any, a=v.stems, b=v.shapes, h=v.hedgeGround;
         const X=5104.223880003646,Z=29804.999693652593, result=[];
         for(let i=0;i<v.geom.instanceCount;i++){
          const x=a.getX(i), z=a.getZ(i);if(Math.hypot(x-X,z-Z)>65.)continue;
          const y=a.getY(i), height=b.getX(i),width=b.getY(i);
          const xc=x+.43*height,zc=z+.21*height;
          result.push({index:i,root:[x,y,z],shape:[height,width,b.getZ(i),b.getW(i)],isHedge:i>=v.hedgeStart,
            stockHedgeSupport:[h.getX(i),h.getY(i),h.getZ(i),h.getW(i)],
            ordinaryShadowPlaneY:y+.46,ordinaryShadowBoundsXZ:[xc-.71*width,zc-.595*width,xc+.71*width,zc+.595*width]});
         }
         return {radiusM:65,instanceCount:v.geom.instanceCount,hedgeStart:v.hedgeStart,shadeVisible:v.shade.visible,stems:result};
        };
        ''')
        if a.project_support:
            h=Path(__file__).with_name('projection-hook.txt').read_text()
            old=b.once(old,anchor,anchor+'\n'+h)
        if a.shadow_layer_witness:
            h=Path(__file__).with_name('shadow-screen-hook.txt').read_text()
            old=b.once(old,anchor,anchor+'\n'+h)
        f.write_text(old)
    b.stage=stage
def capture(args,browser,url):
    bases={}
    if args.pose_baseline:
        bases={r['name']:r for r in json.loads(args.pose_baseline.read_text())}
    rows=[]
    for name,q in args.views_input.items():
        pose=dict(q)
        if bases:
            r=bases.get(name)
            assert r and all(r['pose'][k]==v for k,v in pose.items()),name
            for field,diagnostic in [('fixedBaseH','baseH'),('fixedEyeY','eyeY')]:
                pose[field]=r['diag'][diagnostic];assert math.isfinite(pose[field])
        with browser.new_context(viewport={'width':840,'height':540},device_scale_factor=1) as ctx:
            page=ctx.new_page();errs=[];served=[]
            page.set_default_timeout(175000)
            page.on('pageerror',lambda err:errs.append(str(err)))
            page.on('console',lambda msg:errs.append(msg.text) if msg.type=='error' else None)
            def note_request(r):
                part=r.url.split('/world/',1)
                if len(part)==2:
                    served.append('world/'+part[1])
                elif r.url.endswith('/beaconsfield-v1.bin.gz'):
                    served.append('beaconsfield-v1.bin.gz')
            page.on('request',note_request)
            end='&'+args.query if args.query else ''
            page.goto(url+'/?diagnostics&qa='+quote(json.dumps(pose))+end,wait_until='domcontentloaded')
            page.wait_for_function('''expected=>{
                const s=window.islandAirDiagnostics,t=s?.buildingTiles;
                return t?.wanted>0 && t.ready===t.wanted && !t.loading && !t.failed && !t.pending
                    && !!s.beaconsfieldReview===expected;
            }''',arg=args.expect_art)
            if args.expected_grade:
                page.wait_for_function('''id=>{
                    const d=window.islandAirDiagnostics;
                    return d?.localGroundGrades?.includes(id)&&d.beaconsfieldGrade===true&&d.beaconsfieldGradeShadows>0;
                }''',arg=args.expected_grade)
            d=b.settle(page,errs)
            if args.forbid_grade:
                assert args.forbid_grade not in d['localGroundGrades'] and not d.get('beaconsfieldGrade'),d
            if args.expected_grade:
                assert args.expected_grade in d['localGroundGrades'] and d.get('beaconsfieldGrade') and d.get('beaconsfieldGradeShadows',0)>0,d
            assert d['beaconsfieldReview']==args.expect_art and len(errs)==0
            out=args.out/(name+'.png')
            page.screenshot(path=str(out))
            rows.append(dict(name=name,pose=pose,diag={k:d[k] for k in ('baseH','eyeY','buildingTiles','drawCalls','triangles','localGroundGrades','beaconsfieldReview')},
               coupledDiagnostics={k:d.get(k) for k in ('beaconsfieldGrade','beaconsfieldGradeShadows')},fileSha256=hashlib.sha256(out.read_bytes()).hexdigest(),assetRequests=sorted(set(served)),errors=errs))
            if args.ground_probes:
                coords=json.loads(args.ground_probes.read_text())['worldXZ']
                rows[-1]['groundRays']=page.evaluate('v=>window.qaActualBeaconsfieldGround(v)',coords)
                rows[-1]['frontageStems']=page.evaluate('window.qaActualBeaconsfieldStems()')
            if args.project_support:
                s=page.evaluate('window.qaBeaconsfieldProjectedSupport()')
                (args.out/(name+'-projected-support.json')).write_text(json.dumps(s,separators=(',',':')))
            if args.shadow_layer_witness:
                s=page.evaluate('window.qaBeaconsfieldShadowLayerFrames()')
                rows[-1]['shadowWitness']={k:v for k,v in s.items() if not isinstance(v,str)}
                for k in ('before','noTrees'):
                    x=base64.b64decode(s[k].split(',',1)[1])
                    (args.out/(name+'-shadow-witness-'+k+'.png')).write_bytes(x)
                    rows[-1]['shadowWitness'][k+'SHA256']=hashlib.sha256(x).hexdigest()
            (args.out/'results.json').write_text(json.dumps(rows,indent=2)+'\n')
            print(name,rows[-1]['diag'],flush=True)
    return rows
b.capture=capture
b.run(a)
