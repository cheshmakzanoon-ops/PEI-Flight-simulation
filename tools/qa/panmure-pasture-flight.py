#!/usr/bin/env python3
"""Compiled, unmodified ordinary dispatch entry, source faults and nonlocal controls.
Static-server mutations in named negative cases only; never override the game clock or camera."""
import argparse,functools,gzip,hashlib,http.server,json,math,re,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*_):pass
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True)
p.add_argument('--cases',default='ordinary,stock,detail,named,prince,wrong-cover,wrong-terrain,wrong-building,swapped-detail,unsigned-detail,bad-art')
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True);dist=a.dist.resolve();w=dist/'world'
chunks=[i for i in (dist/'assets').glob('*.js') if 'Panmure · original short grass reflectance' in i.read_text()]
assert len(chunks)==1,chunks
chunk=chunks[0];path='/assets/'+chunk.name
def tamper(path,skip):
    raw=bytearray(gzip.decompress(path.read_bytes()));raw[skip]^=1
    return gzip.compress(raw,compresslevel=2,mtime=0),hashlib.sha256(raw).hexdigest()
def mutate_pack(route):
    b=bytearray((w/'buildings/tiles.pack').read_bytes());b[1962687+4]^=1 # mtime only: same data decode into the ordinary mesh
    h=route.request.headers.get('range','');m=re.fullmatch(r'bytes=(\d+)-(\d+)',h)
    if not m:route.fulfill(status=200,body=bytes(b),content_type='application/octet-stream');return
    i,j=map(int,m.groups());route.fulfill(status=206,body=bytes(b[i:j+1]),headers={'Content-Range':f'bytes {i}-{j}/{len(b)}','Accept-Ranges':'bytes','Content-Type':'application/octet-stream'})
hdr=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist']
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(dist))) as srv,sync_playwright() as pw:
 threading.Thread(target=srv.serve_forever,daemon=True).start(); report={}
 with pw.chromium.launch(executable_path=a.chromium,args=hdr) as browser:
  for case in a.cases.split(','):
   page=browser.new_page(viewport={'width':400,'height':270});page.set_default_timeout(320000)
   errors=[];req=[]
   try:
    page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
    page.on('request',lambda r:req.append(r.url) if r.url.endswith(path) else None)
    if case in ('swapped-detail','unsigned-detail'):
     catalog=json.loads((w/'detail/index.json').read_text())
     assert catalog['tiles']['25-18']['sha256'].startswith('444dcbdb')
     if case=='swapped-detail':catalog['tiles']['25-18']=catalog['tiles']['24-18']
     else:catalog['tiles']['25-18'].pop('sha256')
     page.route('**/world/detail/index.json',lambda r:r.fulfill(status=200,json=catalog))
    if case=='wrong-cover':
     bad,_=tamper(w/'cover.bin.gz',0)
     page.route('**/world/cover.bin.gz',lambda r:r.fulfill(status=200,body=bad,content_type='application/gzip'))
    if case=='wrong-terrain':
     bad,sha=tamper(w/'height.bin.gz',0);meta=json.loads((w/'terrain.json').read_text());meta['sha256']=sha
     page.route('**/world/height.bin.gz',lambda r:r.fulfill(status=200,body=bad,content_type='application/gzip'))
     page.route('**/world/terrain.json',lambda r:r.fulfill(status=200,json=meta))
    if case=='wrong-building':page.route('**/world/buildings/tiles.pack',mutate_pack)
    if case=='bad-art':
     source=chunk.read_text();marker='H4sIAAAAAAACA+2daVR';assert source.count(marker)==1
     page.route('**'+path,lambda r:r.fulfill(status=200,body=source.replace(marker,'%'+marker[1:]),content_type='application/javascript'))
    suffix={'stock':'&stockPanmurePasture','named':'&northRusticoLighthouseStudy','detail':'&scenery=detail'}.get(case,'')
    site='prince-open-shore-pass' if case=='prince' else 'panmure-head-coast'
    page.goto(f'http://127.0.0.1:{srv.server_port}/?diagnostics&departure={site}'+suffix,wait_until='domcontentloaded')
    page.wait_for_function('window.islandAirDiagnostics?.mode==="dispatch"')
    d0=page.evaluate('window.islandAirDiagnostics');boot=d0['panmurePasture'];assert not req and (boot is None or (boot['gain']==0 and not boot['mounted'])),(case,req,boot)
    page.get_by_role('button',name='Begin flight').click();page.wait_for_function('window.islandAirDiagnostics?.mode==="flight"')
    page.wait_for_function('(a)=>Math.hypot(window.islandAirDiagnostics.x-a.x,window.islandAirDiagnostics.z-a.z)>a.d',arg={'x':d0['x'],'z':d0['z'],'d':440 if case in ('ordinary','swapped-detail','unsigned-detail') else 245 if case in ('wrong-cover','wrong-building','bad-art') else 110})
    if case=='ordinary':page.wait_for_function('window.islandAirDiagnostics?.panmurePasture?.gain===1')
    if case in ('wrong-cover','wrong-building','bad-art'):page.wait_for_function('window.islandAirDiagnostics?.panmurePasture?.proof==="stock"')
    page.keyboard.press('Escape');page.wait_for_function('window.islandAirDiagnostics?.mode==="paused"')
    d=page.evaluate('window.islandAirDiagnostics');state=d['panmurePasture']
    if case=='ordinary':assert state=={'proof':'ready','mounted':True,'gain':1} and len(req)==1,(case,state,req)
    elif case in ('prince','swapped-detail','unsigned-detail'):assert state=={'proof':'cold','mounted':False,'gain':0} and not req,(case,state,req)
    elif case in ('wrong-cover','wrong-building','bad-art'):assert state=={'proof':'stock','mounted':False,'gain':0} and len(req)==int(case=='bad-art'),(case,state,req)
    else:assert state is None and not req,(case,state,req)
    assert not errors and not d['layerWarnings'] and d['site']==site and d['roads'] and d['buildings'],(case,errors,d['layerWarnings'])
    if case=='ordinary':page.locator('#world').screenshot(path=str(a.out/'ordinary-paused.png'))
    report[case]=dict(site=site,dispatch=boot,final=state,flownM=round(math.hypot(d['x']-d0['x'],d['z']-d0['z']),2),heightM=round(d['altitude'],2),
                     artRequests=len(req),errors=errors,layerWarnings=d['layerWarnings'],visibleBuildingTileFailures=d['buildingTiles']['failed'])
    print(case,report[case],flush=True);(a.out/'flight.json').write_text(json.dumps(report,indent=2)+'\n')
   except Exception:
    try:print('failure',case,page.evaluate('window.islandAirDiagnostics'),errors,req,flush=True)
    except Exception:pass
    raise
   finally:page.close()
