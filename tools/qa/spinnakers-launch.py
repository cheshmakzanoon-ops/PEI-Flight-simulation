"""Test the exact distributed Vite build through the real launch UI, no scene instrumentation."""
import argparse
from pathlib import Path
import json,subprocess,socket,time,gzip,hashlib
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--checkout',type=Path,required=True)
parser.add_argument('--chromium',required=True)
parser.add_argument('--out',type=Path,required=True)
parser.add_argument('--combined',action='store_true')
args=parser.parse_args(); R=args.checkout.resolve(); D=args.out.resolve().parent; D.mkdir(parents=True,exist_ok=True)
asset=R/'dist/world/spinnakers/v0/measured-deck.gz';body=asset.read_bytes();sig=hashlib.sha256(body).hexdigest()
raw=bytearray(gzip.decompress(body));raw[133]^=1
bad=gzip.compress(raw,mtime=0)
cases=['preview'] if args.combined else ['default','preview','corrupt']
results=[]
with socket.socket() as s:
 s.bind(('127.0.0.1',0));port=s.getsockname()[1]
url=f'http://127.0.0.1:{port}'
with (D/'spinnakers-launch-server.log').open('w') as l:
 proc=subprocess.Popen(['node','node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',str(port),'--strictPort'],cwd=R,stdout=l,stderr=l)
 try:
  for j in range(60):
   try:
    with urlopen(url,timeout=1) as r:r.read(1)
    break
   except OSError:
    if proc.poll() is not None:raise RuntimeError('preview server stopped')
    time.sleep(.15)
  else:raise TimeoutError('server did not start')
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path=args.chromium,
     args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
   for state in cases:
    page=browser.new_page(viewport={'width':660,'height':412})
    errors=[];requests=[];download=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda e:errors.append(e.text) if e.type=='error'else None)
    page.on('request',lambda req:requests.append(req.url) if req.url.endswith('/measured-deck.gz')else None)
    # Only optional transfer is fault-injected. Everything else is production.
    if state=='corrupt':
     page.route('**/measured-deck.gz',lambda route:route.fulfill(status=200,body=bad,headers={'content-type':'application/gzip'}))
    target=url+'/?diagnostics'+('&spinnakersPreview'if state!='default'else '')
    if args.combined:target+='&basinChannel&basinWharf&montagueFoundationPreview&legacyShoreArcs'
    page.goto(target,wait_until='domcontentloaded',timeout=125000);page.set_default_timeout(125000)
    pfn='()=>window.islandAirDiagnostics'
    page.wait_for_function('()=>window.islandAirDiagnostics?.mode==="dispatch" && document.querySelector("#site")',timeout=125000)
    page.select_option('#site',label='Summerside')
    page.get_by_role('button',name='Begin flight').click()
    page.wait_for_function('()=>window.islandAirDiagnostics?.mode==="flight" && window.islandAirDiagnostics?.site==="summerside"')
    a=page.evaluate(pfn)
    if state=='preview':
     page.wait_for_function('()=>window.islandAirDiagnostics?.spinnakersDeck===true',timeout=125000)
    else:
     page.wait_for_function('()=>window.islandAirDiagnostics?.buildingTiles?.ready>=2')
    page.keyboard.press('v')
    page.wait_for_function('()=>window.islandAirDiagnostics?.camera==="Cockpit"')
    page.wait_for_function('(a)=>Math.hypot(window.islandAirDiagnostics.x-a.x,window.islandAirDiagnostics.z-a.z)>28',arg={'x':a['x'],'z':a['z']})
    b=page.evaluate(pfn)
    assert a['mode']==b['mode']=='flight' and a['site']==b['site']=='summerside',(a,b)
    assert abs(a['altitude']-360)<30 and abs(a['altitude']-b['altitude'])<110,(a['altitude'],b['altitude'])
    assert bool(b['spinnakersDeck'])==(state=='preview'),b
    if args.combined:assert b['basinShoreline'] and b['basinWharfToe'] and b['montagueBridge'] and b['legacyShore'],b
    assert len(requests)==int(state!='default'),requests
    assert not errors and not b['layerWarnings'],[errors,b['layerWarnings']]
    page.keyboard.press('Escape')
    page.wait_for_function('()=>window.islandAirDiagnostics?.mode==="paused"')
    result={'case':state,'exactBuildAssetSha256':sig,'requests':len(requests),'visualOverride':b['spinnakersDeck'],
     'distanceM':((a['x']-b['x'])**2+(a['z']-b['z'])**2)**.5,'site':b['site'],'startAltitude':a['altitude'],
     'afterAltitude':b['altitude'],'controls':['choose departure','fly','cockpit toggle','pause'],
     'errors':errors,'layerWarnings':b['layerWarnings'],'combined':args.combined}
    results.append(result)
    path=args.out;path.write_text(json.dumps(results,indent=2)+'\n')
    print(json.dumps(result),flush=True);page.close()
   browser.close()
 finally:
  proc.terminate()
  try:proc.wait(5)
  except subprocess.TimeoutExpired:proc.kill();proc.wait()
