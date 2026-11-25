#!/usr/bin/env python3
"""Drive the built player normally against authentic, corrupt and missing farmland assets.

Requires Python 3, Playwright and a local Chromium executable with WebGL2. Build
with npm run build first. Supply the old *unmodified* gzip index as --stale-index;
its bytes are checked against the published #218 digest. Example:
  git show 6cc58ec:public/world/fields-province/index.fcr.gz > /tmp/pei-farmland-218.fcr.gz
  python tools/qa/verify-expanded-farmland-compiled-faults.py --dist dist \
    --packdir fields-province/v2 --stale-index /tmp/pei-farmland-218.fcr.gz \
    --chromium /path/to/chrome --out /tmp/pei-compiled-farmland
Serves only the supplied local dist over loopback. No world assets or game source
are edited. Each case boots a fresh page, departs, flies, changes view and pauses.
"""
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
import argparse, functools, gzip, hashlib,http.server,json,math,re,threading
p=argparse.ArgumentParser();p.add_argument('--dist',type=Path,required=True);p.add_argument('--packdir',required=True);p.add_argument('--stale-index',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True);p.add_argument('--cases',default='stale,rawcorrupt,wirecorrupt,missing,grass,pilot,stock,normal');a=p.parse_args();a.out.mkdir(exist_ok=True,parents=True)
base='/PEI-Flight-simulation/'
old=a.stale_index.read_bytes();assert hashlib.sha256(old).hexdigest()=='2c724896d98aea2e83dcdefe849e4159e4f3455ebd762434fee23da0791ee4d8'
new=(a.dist/'world'/a.packdir/'index.fcr.gz').read_bytes();assert new!=old;raw=gzip.decompress(new)
field='/world/'+a.packdir+'/'
class Local(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
 def translate_path(self,path):
  s=urlsplit(path).path
  return super().translate_path(s.removeprefix(base) if s.startswith(base)else '__missing__')
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Local,directory=str(a.dist.resolve()))) as h,sync_playwright()as pw:
 threading.Thread(target=h.serve_forever,daemon=True).start();browser=pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
 try:
  results={}
  for case in a.cases.split(','):
   pg=browser.new_page(viewport={'width':520,'height':360});pg.set_default_timeout(140000);errors=[];req=[];faults=[];rs=[]
   pg.on('pageerror',lambda e:errors.append(str(e)))
   def observe(r):
    t=urlsplit(r.url).path
    if field in t or '/grass-study/'in t or t.endswith(('/fields-pilot.rgba.gz','/furrow-relief.webp')):req.append(t.split('/world/',1)[-1])
   def response(r):
    path=urlsplit(r.url).path
    if field in path or '/grass-study/'in path:rs.append([path.split('/world/',1)[-1],r.status])
   pg.on('request',observe);pg.on('response',response)
   def fault(route):
    path=urlsplit(route.request.url).path
    if case=='stale' or case=='grass':b=old
    elif case=='rawcorrupt':b=bytearray(raw);b[-1]^=0x80;b=bytes(b)
    elif case=='wirecorrupt':b=bytearray(new);b[4]^=1;b=bytes(b)
    else:raise ValueError(case)
    faults.append({'kind':case,'path':path,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()});route.fulfill(status=200,content_type='application/octet-stream',body=b)
   def missing(route):
    path=urlsplit(route.request.url).path;faults.append({'kind':'pack404','path':path});route.fulfill(status=404,body='Test: optional corrected farmland shard absent')
   if case in ('stale','rawcorrupt','wirecorrupt','grass'):pg.route('**'+field+'index.fcr.gz',fault)
   if case=='missing':pg.route(re.compile(re.escape(field)+r'crop-\d+\.pack$'),missing)
   target='kings-grassland' if case=='grass' else 'prince-fields'
   flag='cropRowsReview' if case=='pilot' else '' if case=='stock' else 'provinceFieldsReview'
   if case=='grass':flag+='&sourceGrassStudy'
   try:
    pg.goto(f'http://127.0.0.1:{h.server_port}'+base+'?diagnostics&departure='+target+'&'+flag,wait_until='domcontentloaded')
    pg.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'&&window.islandAirDiagnostics?.roads")
    if case=='normal':pg.wait_for_function('window.islandAirDiagnostics?.provinceFields?.ready>0')
    if case=='grass':pg.wait_for_function('window.islandAirDiagnostics?.provinceGrass?.ready>0')
    if case=='pilot':assert pg.evaluate('window.islandAirDiagnostics.cropRowsReview') is True
    i=pg.evaluate('window.islandAirDiagnostics')
    pg.get_by_role('button',name='Begin flight').click();pg.wait_for_function("p=>{const s=window.islandAirDiagnostics;return s?.mode==='flight'&&s.site===p.site&&Math.hypot(s.x-p.x,s.z-p.z)>95&&s.roads&&s.detail?.ready>0&&!s.detail.missing}",arg=i,polling=180)
    pg.keyboard.press('v');pg.wait_for_function('prior=>window.islandAirDiagnostics?.camera!==prior',arg=i['camera']);pg.keyboard.press('Escape');pg.wait_for_function("window.islandAirDiagnostics?.mode==='pause'||window.islandAirDiagnostics?.mode==='paused'");q=pg.evaluate('window.islandAirDiagnostics')
    assert not errors and q['site']==target,errors; travel=math.hypot(q['x']-i['x'],q['z']-i['z'])
    shards=[x for x in req if x.startswith(a.packdir+'/crop-')];grassShards=[x for x in req if x.startswith('grass-study/crop-')]
    if case in ('stale','rawcorrupt','wirecorrupt','grass'):assert len(faults)==1 and q.get('provinceFields') is None and not shards,(faults,q.get('provinceFields'),shards)
    if case=='grass':assert grassShards and q['provinceGrass']['ready']>0
    if case=='stock':assert q.get('provinceFields') is None and not q.get('cropRowsReview') and not req,req
    if case=='pilot':assert q['cropRowsReview'] and all(not x.startswith(a.packdir+'/') for x in req) and 'fields-pilot.rgba.gz'in req and 'furrow-relief.webp'in req
    if case=='missing':assert faults and q['provinceFields']['ready']==0 and q['provinceFields']['slots']==4 and len(shards)<=12,(q['provinceFields'],shards,faults)
    if case=='normal':assert q['provinceFields']['ready']>0 and shards
    results[case]={'distanceMetres':travel,'validPause':q['mode'],'camera':q['camera'],'optionalFields':q.get('provinceFields'),'optionalGrass':q.get('provinceGrass'),'originalPilot':q.get('cropRowsReview'),'entry':target,'requests':req,'responses':rs,'faults':faults,'pageErrors':errors}
    (a.out/'compiled-player-faults.json').write_text(json.dumps(results,indent=2)+'\n')
    print(case,round(travel,1),q['mode'],q['camera'],q.get('provinceFields'),q.get('provinceGrass'),len(req),flush=True)
   finally:pg.close()
 finally:browser.close()
