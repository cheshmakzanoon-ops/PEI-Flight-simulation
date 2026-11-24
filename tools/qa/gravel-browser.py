"""Use actual full dialog/world WebGL at settled control cameras; no production edits."""
from pathlib import Path
import argparse,base64,gzip,json,math,time
from urllib.parse import quote
import shutil, socket, subprocess, tempfile
from types import SimpleNamespace
from urllib.request import urlopen

SOFTWARE_FLAGS=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']

def once(source, before, after):
    if source.count(before) != 1:
        raise ValueError(f'QA integration anchor changed: {before}. Review before updating.')
    return source.replace(before, after)


def base_stage(repo, root, deps, void_probe):
    for name in ('index.html', 'package.json', 'package-lock.json', 'tsconfig.json'):
        shutil.copy2(repo / name, root / name)
    shutil.copytree(repo / 'src', root / 'src')
    (root / 'public').symlink_to(repo / 'public', target_is_directory=True)
    (root / 'node_modules').symlink_to(deps, target_is_directory=True)
    main = root / 'src/main.ts'
    text = main.read_text()
    text = once(text, 'const diagnostic=', '''const qa=JSON.parse(new URLSearchParams(location.search).get('qa')!);
      const center=project(qa.lon,qa.lat),baseH=qa.fixedBaseH??terrain.elevation(center.x,center.z);let qaFrame=0; const diagnostic=''')
    text = once(text, 'clamp, RAD, geographic', 'clamp, RAD, geographic, project')
    text = once(text, 'groundY.copy(aircraft.root.position);', '''
      const norm=Math.hypot(qa.east,qa.south),ex=center.x+qa.dist*qa.east/norm,ez=center.z+qa.dist*qa.south/norm;
      f.x=ex;f.z=ez;f.y=qa.fixedEyeY??terrain.elevation(ex,ez)+qa.agl;
      camera.position.set(ex,f.y,ez);camera.up.set(0,1,0);camera.lookAt(center.x,baseH+qa.h*.5,center.z);
      camera.updateMatrixWorld();aircraft.root.visible=false;
      const screenY=(h:number)=>{const v=new THREE.Vector3(center.x,baseH+h,center.z).project(camera);return (1-v.y)*innerHeight*.5;};
      (window as any).reviewCamera={frame:++qaFrame,baseH,eyeY:f.y,bottomY:screenY(0),topY:screenY(qa.h),
        x:ex,z:ez,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries};
      groundY.copy(aircraft.root.position);''')
    main.write_text(text)
    world = root / 'src/render/world.ts'
    text = once(world.read_text(), 'this.t.value=clock;', 'this.t.value=12;')
    if void_probe:
        anchor = 'this.sky.renderOrder=-10;'
        text = once(text, anchor, '(this.sky.material as THREE.ShaderMaterial).uniforms.skyDiagnostic.value=1.;' + anchor)
    world.write_text(text)
    (root / 'vite.config.ts').write_text("import {defineConfig} from 'vite'; export default defineConfig({base:'./',cacheDir:" + json.dumps(str(root / 'cache')) + '});')


def settle(page, errors):
    page.wait_for_function('window.reviewCamera?.frame>5 && window.islandAirDiagnostics?.roads && window.islandAirDiagnostics?.mainland && window.islandAirDiagnostics?.buildings')
    page.add_style_tag(content='body *{visibility:hidden!important} #world{visibility:visible!important}')
    previous, steady = None, 0
    start = time.monotonic()
    while time.monotonic() - start < 90:
        if errors:
            raise RuntimeError(str(errors))
        diag = page.evaluate('()=>({...window.islandAirDiagnostics,...window.reviewCamera})')
        d = diag['detail']
        signature = (diag['triangles'], diag['geometries'], d['ready'], d['loading'], diag['drawCalls'])
        if signature == previous and d['loading'] == 0 and d['ready'] > 0 and diag['frame'] > 22:
            steady += 1
        else:
            steady = 0
        if steady >= 3:
            if diag['layerWarnings'] or d['missing']:
                raise RuntimeError(str(diag))
            return diag
        previous = signature
        page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
    raise TimeoutError(f'Scene did not settle: {diag}')


def run(args):
    repo = args.checkout.resolve()
    args.out = args.out.resolve()
    deps = (args.deps or repo / 'node_modules').resolve()
    if repo == args.out or repo in args.out.parents:
        raise ValueError('Use an output directory outside the checkout')
    args.out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='pei-inspect-') as temp:
        root = Path(temp)
        stage(repo, root, deps, args.void_probe)
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        url = f'http://127.0.0.1:{port}'
        with (args.out / 'server.log').open('w') as log:
            proc = subprocess.Popen(['node', str(deps / 'vite/bin/vite.js'), '--host', '127.0.0.1', '--port', str(port), '--strictPort'], cwd=root, stdout=log, stderr=log)
            try:
                for _ in range(100):
                    try:
                        with urlopen(url, timeout=1) as response:
                            response.read(1)
                        break
                    except OSError:
                        if proc.poll() is not None:
                            raise RuntimeError('Vite failed: inspect server.log')
                        time.sleep(.2)
                else:
                    raise TimeoutError('Vite did not listen')
                from playwright.sync_api import sync_playwright
                with sync_playwright() as pw:
                    flags=SOFTWARE_FLAGS if args.software_webgl else []
                    if args.unsandboxed_in_isolated_ci:
                        flags=[*flags,'--no-sandbox','--disable-dev-shm-usage']
                    browser = pw.chromium.launch(executable_path=args.chromium, args=flags)
                    capture(args, browser, url)
                    browser.close()
            finally:
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    proc.wait()


fixed=SimpleNamespace(stage=base_stage,settle=settle,once=once,run=run)
_BROOKVALE="[{\"name\":\"brookvale-near-east\",\"lon\":-63.42161141136672,\"lat\":46.27244574613537,\"h\":0,\"east\":0.95,\"south\":0.31,\"dist\":104,\"agl\":26,\"fixedBaseH\":75.92076110839844,\"fixedEyeY\":101.92076110839844},{\"name\":\"brookvale-near-northwest\",\"lon\":-63.42161141136672,\"lat\":46.27244574613537,\"h\":0,\"east\":-0.81,\"south\":-0.59,\"dist\":112,\"agl\":27,\"fixedBaseH\":75.92076110839844,\"fixedEyeY\":102.92076110839844},{\"name\":\"brookvale-near-south\",\"lon\":-63.42161141136672,\"lat\":46.27244574613537,\"h\":0,\"east\":0.12,\"south\":0.99,\"dist\":95,\"agl\":23,\"fixedBaseH\":75.92076110839844,\"fixedEyeY\":98.92076110839844},{\"name\":\"brookvale-bowl-oblique\",\"lon\":-63.42161141136672,\"lat\":46.27244574613537,\"h\":0,\"east\":0.82,\"south\":0.57,\"dist\":145,\"agl\":44,\"fixedBaseH\":75.92076110839844,\"fixedEyeY\":119.92076110839844}]"
_COUNTIES="[{\"camera\":{\"position\":[-56875.10221809653,23.285885085619757,-10900.369577870568],\"target\":[-0.925501510784411,-0.0798255433747939,0.37023618969610683]},\"key\":\"prince-inspection\",\"aimY\":12.240208291892209,\"xz\":{\"x\":-56965.52039677989,\"z\":-10859.326271917176},\"eyeAGL\":12,\"aimWGS\":{\"lon\":-63.942590420819045,\"lat\":46.597598355705536}},{\"camera\":{\"position\":[-56886.6180676226,69.75728058955399,-10931.440226555344],\"target\":[-0.7314453626750952,-0.4008076754542828,0.5516709968070035]},\"key\":\"prince-flight\",\"aimY\":12.239999999999998,\"xz\":{\"x\":-56965.52039677989,\"z\":-10859.326271917176},\"eyeAGL\":58,\"aimWGS\":{\"lon\":-63.94243952210549,\"lat\":46.597626553949986}},{\"camera\":{\"position\":[-19170.529994689794,80.60544851337286,24827.601691509364],\"target\":[0.3608131661278393,-0.08589907742722919,0.9286738973643844]},\"key\":\"queens-inspection\",\"aimY\":68.71333553522295,\"xz\":{\"x\":-19130.38965864887,\"z\":24918.424339689882},\"eyeAGL\":12,\"aimWGS\":{\"lon\":-63.449087181669306,\"lat\":46.275495442212396}},{\"camera\":{\"position\":[-19201.713845598722,122.85950339008299,24838.80737946191],\"target\":[0.5502714791382457,-0.37723140214497436,0.7449146048257774]},\"key\":\"queens-flight\",\"aimY\":69.30750047459965,\"xz\":{\"x\":-19130.38965864887,\"z\":24918.424339689882},\"eyeAGL\":58,\"aimWGS\":{\"lon\":-63.44912651038644,\"lat\":46.27559992153166}},{\"camera\":{\"position\":[-19133.54061848247,72.14410349636934,24913.45730313606],\"target\":[0.48164376873928744,-0.24948248691702374,0.840105808072003]},\"key\":\"queens-macro\",\"aimY\":70.38165072068178,\"xz\":{\"x\":-19130.38965864887,\"z\":24918.424339689882},\"eyeAGL\":1.7999999999999972,\"aimWGS\":{\"lon\":-63.449211722606904,\"lat\":46.27582629339006}},{\"camera\":{\"position\":[-19178.488587795688,309.3568885438201,24884.43179617032],\"target\":[0.20993510889749778,-0.9559623628995193,0.205093175829338]},\"key\":\"queens-high\",\"aimY\":69.71233860608956,\"xz\":{\"x\":-19130.38965864887,\"z\":24918.424339689882},\"eyeAGL\":241,\"aimWGS\":{\"lon\":-63.44915600692429,\"lat\":46.27567828102111}},{\"camera\":{\"position\":[77050.18232351917,39.996135858327875,14642.451210240093],\"target\":[0.9956189800365779,-0.07673230879744392,0.05343219420478729]},\"key\":\"kings-inspection\",\"aimY\":29.38106476604483,\"xz\":{\"x\":77149.47664678606,\"z\":14643.249562899578},\"eyeAGL\":12.000000000000004,\"aimWGS\":{\"lon\":-62.19445925331925,\"lat\":46.368210686042374}},{\"camera\":{\"position\":[77047.56010596613,85.24427011873252,14675.48337600476],\"target\":[0.8996781522344411,-0.3912379550846423,-0.19368036785696496]},\"key\":\"kings-flight\",\"aimY\":29.352073272707806,\"xz\":{\"x\":77149.47664678606,\"z\":14643.249562899578},\"eyeAGL\":58.00000000000001,\"aimWGS\":{\"lon\":-62.19461332922102,\"lat\":46.36822893649087}},{\"camera\":{\"position\":[-16912.597381459538,101.92076110839844,25327.440064123584],\"target\":[-0.922281198093934,-0.24253562503633105,-0.3009549172727604]},\"key\":\"brookvale-near-east\",\"aimY\":75.92076110839844,\"xz\":{\"x\":-16999.843885016504,\"z\":25005.685790436735},\"eyeAGL\":19.94266696555708,\"aimWGS\":{\"lon\":-63.42161141136672,\"lat\":46.27244574613537}},{\"camera\":{\"position\":[-17101.99670018246,102.92076110839844,25229.23580480462],\"target\":[0.7857934163711321,-0.23435769449408386,0.5723680440234259]},\"key\":\"brookvale-near-northwest\",\"aimY\":75.92076110839844,\"xz\":{\"x\":-16999.843885016504,\"z\":25005.685790436735},\"eyeAGL\":24.292793532046076,\"aimWGS\":{\"lon\":-63.42161141136672,\"lat\":46.27244574613537}},{\"camera\":{\"position\":[-17000.035134248035,98.92076110839844,25389.487181692708],\"target\":[-0.1169525886843372,-0.23530720080854547,-0.9648588566457166]},\"key\":\"brookvale-near-south\",\"aimY\":75.92076110839844,\"xz\":{\"x\":-16999.843885016504,\"z\":25005.685790436735},\"eyeAGL\":9.373690415066818,\"aimWGS\":{\"lon\":-63.42161141136672,\"lat\":46.27244574613537}},{\"camera\":{\"position\":[-16892.40577338641,119.92076110839844,25377.93927635352],\"target\":[-0.7857303808864533,-0.2903736991414423,-0.5461784354942482]},\"key\":\"brookvale-bowl-oblique\",\"aimY\":75.92076110839844,\"xz\":{\"x\":-16999.843885016504,\"z\":25005.685790436735},\"eyeAGL\":35.80511492992602,\"aimWGS\":{\"lon\":-63.42161141136672,\"lat\":46.27244574613537}}]"
target='compact-aggregate-v1.rgba.gz'
original=fixed.stage
def stage(repo,root,deps,void_probe):
 original(repo,root,deps,void_probe)
 if void_probe:
  # Flight edition runs the original application. Only append one temporary
  # virtual start for the test. There is no shimming of control or flight state.
  for p in ('src/main.ts','src/render/world.ts'):
   (root/p).write_bytes((repo/p).read_bytes())
  r=root/'src/sim/places.ts';text=r.read_text()
  row={'id':'gravel-qa-fixture','name':'Brookvale gravel · virtual QA only','region':'Queens County',
       'lon':-63.42479417,'lat':46.27108108,'heading':48,'height':52,'note':''}
  end='];\nfunction cyyg10SimulatorEnds()'
  r.write_text(fixed.once(text,end,',\n '+json.dumps(row)+'\n'+end));return
 p=root/'src/main.ts';s=p.read_text()
 a='\n  renderer.render(scene,camera);'
 b='''
  renderer.render(scene,camera);
  (window as any).gravelQALastAGL=eyeAGL;
  (window as any).gravelQAHeight=(h:number)=>{
   qa.fixedEyeY=world.groundHeight(camera.position.x,camera.position.z)+h;
  };
  (window as any).gravelPair=()=>{
   const q=(roads as any),live=__MATERIAL_BINDING__,worldTiles=(world as any).byId;
   const shot=()=>{
    renderer.render(scene,camera);
    return {frame:renderer.domElement.toDataURL('image/png'),draws:renderer.info.render.calls,
     triangles:renderer.info.render.triangles,ord:JSON.parse(JSON.stringify((window as any).islandAirDiagnostics?.gravelSurface??null))};
   };
   const before=shot(),gain=live?.aggregateGain.value??0;
   if(live)live.aggregateGain.value=0;
   const stock=shot();
   if(live)live.aggregateGain.value=gain;
   const after=shot(),out:number[][][]=[],tags:Record<string,number>={};
   const view=new THREE.Vector3(),c=new THREE.Vector3();
   const W=innerWidth,H=innerHeight;
   const project=(v:any,m:THREE.Matrix4,i:number)=>{
    view.fromBufferAttribute(v,i).applyMatrix4(m);
    const d=c.copy(view).applyMatrix4(camera.matrixWorldInverse).z;
    c.copy(view).project(camera);return [W*(1+c.x)*.5,H*(1-c.y)*.5,d];
   };
   for(const mesh of q?.visible.values()??[]){
    const g=mesh.geometry,rs=g.getAttribute('roadSurface'),pos=g.getAttribute('position');
    if(!rs||!mesh.visible||!pos)continue;
    const kind=(i:number)=>rs.array instanceof Int8Array?rs.array[i*2+1]:Math.round(rs.getY(i)*127);
    const indices=g.index,length=indices?.count??rs.count;
    for(let j=0;j<length;j+=3){
     const ids=[0,1,2].map(k=>indices?.getX(j+k)??j+k),p0=kind(ids[0]);
     tags[p0]=(tags[p0]??0)+1;
     if(p0!==16||ids.some(k=>kind(k)!==16))continue;
     const v=ids.map(k=>project(pos,mesh.matrixWorld,k));
     if(v.every(x=>x[2]>-.08))continue;
     if(v.every(x=>x[2]<-.08)&&
       (v.every(x=>x[0]<-3)||v.every(x=>x[0]>W+3)||v.every(x=>x[1]<-3)||v.every(x=>x[1]>H+3)))continue;
     out.push(v);
    }
   }
   return {before,stock,againExact:before.frame===after.frame,gain,tags,scope:out,
    closestAGL:eyeAGL,keys:[...worldTiles.values()].filter((x:any)=>x.status==='ready').map((x:any)=>x.id).sort()};
  };'''
 assert s.count(a)==1;p.write_text(s.replace(a,b.replace('__MATERIAL_BINDING__','gravelSurface?.look'),1))
fixed.stage=stage
def views():
 rows=json.loads(_BROOKVALE)
 for q in json.loads(_COUNTIES):
  camera=q['camera'];eye=camera['position'];t=camera['target'];look=q.get('aimY')
  dist=math.dist([eye[0],eye[2]],[q['xz']['x'],q['xz']['z']])
  rows.append(dict(name=q['key'],lon=q['aimWGS']['lon'],lat=q['aimWGS']['lat'],h=0,
    east=-t[0],south=-t[2],dist=dist,agl=q['eyeAGL'],fixedBaseH=look,fixedEyeY=eye[1]))
 for name,lon,lat,ex,ez,dist,height in [
  ('prince-gravel-paved',-63.932,46.59954,-.32,.946,91,24),
  ('brookvale-gravel-paved',-63.42343,46.27798,.63,.777,96,27),
  ('kings-gravel-dirt',-62.19057,46.36775,-.39,.921,80,23),
  ('kings-gravel-bridge',-62.67722,46.13866,-.49,.872,90,22),
  ('maplewood-owner-join',-63.449215,46.275835,.67,.742,91,22),
  ('montague-gravel-bridge-dirt',-62.74606599,46.15543465,.946,.324,114,27),
 ]:
  rows.append(dict(name=name,lon=lon,lat=lat,h=0,east=ex,south=ez,dist=dist,agl=height))
 return {q['name']:q for q in rows}
def install(page,job,b):
 req=[];log=[]
 def got(r):
  if r.url.split('?')[0].endswith('/'+target):req.append(r.url)
 page.on('request',got)
 def handle(route):
  def send(**kw):
   try:route.fulfill(**kw)
   except Exception:
    if job!='held':raise
  if job=='missing':log.append('404');send(status=404,body='');return
  if job=='held':log.append('intentional timeout with exact valid body');time.sleep(5.5);send(status=200,body=b);return
  if job=='corrupt':
   data=bytearray(gzip.decompress(b));data[len(data)//2]^=0x20;log.append('same-length corrupted decoded body');send(status=200,body=bytes(data));return
  if job=='oversize':
   log.append('bounded overflow');send(status=200,body=b'x'*410123);return
 if job in ('missing','held','corrupt','oversize'):page.route('**/'+target+'*',handle)
 return req,log
def capture(a,browser,url):
 full=views();viewsSelected=a.views.split(',')
 body=(a.checkout/'public/art/aggregate'/target).read_bytes()
 faults=['off','active','missing','corrupt','oversize','held','detail','high','far']
 selected=a.fault_cases.split(',') if a.fault_cases else faults
 if any(x not in faults for x in selected):raise ValueError('Unknown fault control')
 jobs=[(v,'active') for v in viewsSelected] if a.mode=='pairs' else [(viewsSelected[0],kind) for kind in selected]
 if a.mode=='flight':
  for mode in ['off','active']:flight(a,browser,url,mode,body)
  return
 if a.mode=='motion':
  vertical(a,browser,url,full[viewsSelected[0]],body);return
 rows=[]
 for n,mode in jobs:
  q=dict(full[n])
  if mode=='high':q['fixedEyeY']=q['fixedBaseH']+241
  if mode=='far':
   q.update(lon=-63.191,lat=46.94,dist=88,fixedEyeY=30,fixedBaseH=0,east=.85,south=.53)
  ctx=browser.new_context(viewport={'width':a.width,'height':a.height},device_scale_factor=1)
  try:
   p=ctx.new_page();p.set_default_timeout(110000);errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
   get,log=install(p,mode,body);opts=['diagnostics','qa='+quote(json.dumps(q))]
   if mode=='off':opts.append('stockGravelSurface')
   elif not a.standard_coverage:opts.append('gravelSurfaceStudy')
   if mode=='detail':opts.append('scenery=detail')
   p.goto(url+'/?'+'&'.join(opts),wait_until='domcontentloaded')
   p.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch' && window.islandAirDiagnostics?.roads")
   assert not get,get
   p.get_by_role('button',name='Begin flight').click()
   if mode=='far':
    # An ocean control deliberately has no nearby HD land textures.
    p.wait_for_function("window.reviewCamera?.frame > 36 && window.islandAirDiagnostics?.roads && window.islandAirDiagnostics?.mainland")
    p.wait_for_timeout(550)
   else:
    fixed.settle(p,errors)
   active=mode=='active'
   if active:
    p.wait_for_function("window.islandAirDiagnostics?.gravelSurface?.gain > .97",timeout=45000)
   invalid=mode in ('missing','corrupt','oversize','held')
   if invalid:
    p.wait_for_function("window.islandAirDiagnostics?.gravelSurface?.attempts >= 1")
    p.wait_for_function("!['loading','pending','fetching'].includes(window.islandAirDiagnostics?.gravelSurface?.status)")
   s=p.evaluate('window.gravelPair()')
   assert not errors and s['againExact'],(errors,s.get('againExact'))
   assert s['before']['draws']==s['stock']['draws'] and s['before']['triangles']==s['stock']['triangles']
   refs=[s[k].pop('frame') for k in ('before','stock')]
   assert bool(s['gain']>.97)==active,(mode,s['gain'],s['before']['ord'])
   assert len(get)==int(active or invalid),[n,mode,get,s['before']['ord']]
   if not active:assert refs[0]==refs[1],(mode,s['gain'])
   for name,im in zip(('art','neutral'),refs):
    (a.out/f'{n}-{mode}-{name}.png').write_bytes(base64.b64decode(im.split(',',1)[1]))
   outScope=s.pop('scope')
   if active:
    assert s['tags'].get('16',0)>0 and len(outScope)>0
    (a.out/f'{n}-{mode}-scope.json').write_text(json.dumps(outScope,separators=(',',':'))+'\n')
   s.update(view=n,mode=mode,urlRequests=len(get),transport=log,scopeTriangles=len(outScope))
   rows.append(s);print(n,mode,s['gain'],s['scopeTriangles'],s['before']['ord'],flush=True)
   (a.out/'observed.json').write_text(json.dumps(rows,indent=2)+'\n')
  finally:ctx.close()
def vertical(a,browser,url,q,body):
 c=browser.new_context(viewport={'width':a.width,'height':a.height})
 try:
  p=c.new_page();p.set_default_timeout(120000);err=[];p.on('pageerror',lambda e:err.append(str(e)))
  asks,_=install(p,'motion',body);q=dict(q);q['fixedEyeY']=q['fixedBaseH']+250
  p.goto(url+'/?diagnostics'+('' if a.standard_coverage else '&gravelSurfaceStudy')+'&qa='+quote(json.dumps(q)),wait_until='domcontentloaded')
  p.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch' && window.islandAirDiagnostics?.roads")
  assert not asks,asks
  p.get_by_role('button',name='Begin flight').click()
  fixed.settle(p,err);assert not asks,asks
  from PIL import Image,ImageChops
  from io import BytesIO
  out=[]
  for h in (245,183,132,108,58,26,98,159,221,245,58):
   p.evaluate('h=>window.gravelQAHeight(h)',arg=h)
   p.wait_for_function("(h)=>Math.abs(window.gravelQALastAGL-h)<.12",arg=h)
   if h==26:p.wait_for_function("window.islandAirDiagnostics?.gravelSurface?.gain > .96")
   p.wait_for_timeout(400)
   row=p.evaluate('window.gravelPair()')
   ims=[Image.open(BytesIO(base64.b64decode(row[k].pop('frame').split(',',1)[1]))).convert('RGB') for k in ('before','stock')]
   diff=ImageChops.difference(*ims);changed=sum(px>0 for px in diff.convert('L').get_flattened_data()) if hasattr(diff,'get_flattened_data') else sum(px>0 for px in diff.convert('L').getdata())
   if h>=221:assert diff.getbbox() is None
   assert row['againExact'] and not err
   out.append(dict(agl=row['closestAGL'],changed=changed,requested=len(asks),diagnostics=row['before']['ord'],stateGain=row['gain']))
  assert len(asks)==1 and out[5]['changed']>0 and out[-1]['changed']>0,out
  (a.out/'live-height-cycle.json').write_text(json.dumps(out,indent=2)+'\n')
 finally:c.close()
def flight(a,browser,url,mode,body):
 c=browser.new_context(viewport={'width':a.width,'height':a.height})
 try:
  p=c.new_page();p.set_default_timeout(120000);err=[];p.on('pageerror',lambda e:err.append(str(e)))
  asks,_=install(p,mode,body);active=mode=='active'
  p.goto(url+'/?diagnostics&departure=gravel-qa-fixture'+(('' if a.standard_coverage else '&gravelSurfaceStudy') if active else '&stockGravelSurface'),wait_until='domcontentloaded')
  p.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch' && window.islandAirDiagnostics?.roads && window.islandAirDiagnostics?.buildings")
  state=p.evaluate('window.islandAirDiagnostics');p.get_by_role('button',name='Begin flight').click()
  first_live=None
  if active:
   p.wait_for_function("window.islandAirDiagnostics?.gravelSurface?.active === true && window.islandAirDiagnostics.gravelSurface.gain > .50")
   first_live=p.evaluate("window.islandAirDiagnostics.gravelSurface")
  p.wait_for_function('p=>Math.hypot(window.islandAirDiagnostics.x-p.x,window.islandAirDiagnostics.z-p.z)>500',arg={'x':state['x'],'z':state['z']})
  q=p.evaluate('window.islandAirDiagnostics');p.keyboard.press('v');p.wait_for_function("window.islandAirDiagnostics?.camera==='Cockpit'")
  p.keyboard.press('Escape');p.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
  assert not err and len(asks)==int(active),[mode,err,asks]
  (a.out/f'flight-{mode}.json').write_text(json.dumps(dict(dist=math.hypot(q['x']-state['x'],q['z']-state['z']),asset=q['gravelSurface'],firstActiveTexture=first_live,requests=len(asks),noLayerWarnings=not q['layerWarnings'],enteredCockpitAndPaused=True),indent=2)+'\n')
  p.screenshot(path=str(a.out/f'flight-{mode}.png'))
 finally:c.close()
fixed.capture=capture
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--checkout',type=Path,required=True);p.add_argument('--deps',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
p.add_argument('--chromium',required=True);p.add_argument('--views',default='brookvale-near-northwest,prince-flight,queens-flight,kings-flight')
p.add_argument('--width',type=int,default=560);p.add_argument('--height',type=int,default=384)
p.add_argument('--software-webgl',action='store_true',help='Use the SwiftShader software WebGL comparison path.')
p.add_argument('--unsandboxed-in-isolated-ci',action='store_true',help='Only for disposable isolated CI that cannot initialize Chromium’s sandbox.')

p.add_argument('--mode',choices=['pairs','faults','flight','motion'],default='pairs')
p.add_argument('--standard-coverage',action='store_true',help='Use the ordinary Standard path without the explicit study flag.')
p.add_argument('--fault-cases',help='Comma-separated subset of the listed transport controls.')
args=p.parse_args();args.void_probe=args.mode=='flight';fixed.run(args)
