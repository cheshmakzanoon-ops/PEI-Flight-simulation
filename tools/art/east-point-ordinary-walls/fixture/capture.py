#!/usr/bin/env python3
"""Actual origin-locked native East Point building shell comparison."""
import argparse,base64,hashlib,json,re
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser()
p.add_argument('--browser',required=True);p.add_argument('--out',required=True,type=Path)
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=False)
origin='http://127.0.0.1:4710'
outside=[];errors=[];events=[];rows=[]
sha=lambda b:hashlib.sha256(b).hexdigest()
def put(name,data):
 p=a.out/name
 if not p.exists():p.write_bytes(data)
 return sha(data)
def report(name,data):return put(name+'.json',(json.dumps(data,indent=2)+'\n').encode())
with sync_playwright() as w:
 browser=w.chromium.launch(executable_path=a.browser,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1200,'height':760},device_scale_factor=1,service_workers='block')
 page.set_default_timeout(420000)
 page.add_init_script("Object.defineProperty(window,'peiEastNativeWallKey',{value:'q434-east-village-native-c'});")
 def refuse(r):outside.append(r.request.url);r.abort()
 page.route(re.compile(r'^(?!'+re.escape(origin)+r'/)https?://'),refuse)
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('response',lambda r:events.append({'range':r.request.headers.get('range'),'contentRange':r.headers.get('content-range'),'code':r.status})
  if r.url==origin+'/world/buildings/tiles.pack' else None)
 def status():return page.evaluate('()=>window.peiEastVillageNative?.state()')
 try:
  page.goto(origin+'/?departure=east-light&diagnostics',wait_until='domcontentloaded')
  page.wait_for_function("""()=>{const a=window.peiEastVillageNative?.state(),d=window.islandAirDiagnostics;return d?.mode==='dispatch'&&d.site==='east-light'&&d.mainland&&d.roads&&d.buildings&&a?.auth==='verified'}""",polling=130)
  before=status();print('REAL EAST POINT OWNER READY',before,flush=True)
  page.get_by_role('button',name='Begin flight').click()
  for step in ('negative','approach','close','inland'):
   page.wait_for_function("()=>{const a=window.peiEastVillageNative?.state();return a?.queued>0||a?.status==='held'}",polling=140)
   q=page.evaluate("()=>window.peiEastVillageNative.take()")
   assert q and q['id']==step,(step,status())
   for k,v in q['passes'].items():
    png=v.pop('png');assert png.startswith('data:image/png;base64,')
    png=base64.b64decode(png.split(',',1)[1],validate=True);assert png.startswith(b'\x89PNG\r\n\x1a\n')
    v['png']=put(f'{step}-{k}.png',png)
    hashes=[]
    for source in v.pop('shaders'):
     b=source.encode();hashes.append(put(sha(b)+'.glsl',b))
    v['shaders']=hashes
   if step=='close':
    assert isinstance(q.get('packedData'),dict) and set(q['packedData'])=={'position','wallFit','topFlag'}
    q['packedData']={k:put(k+('.i16' if k=='wallFit' else '.f32'),base64.b64decode(v,validate=True))
                    for k,v in q['packedData'].items()}
   else:assert q.get('packedData') is None
   rows.append((step,report(step,q)))
   print('REAL EAST POINT WALLS',step,q['scores'],status(),flush=True)
   assert status()['status']!='held',status()
  assert status()['status']=='complete' and not errors and not outside,(status(),errors,outside)
  summary='READY FOR INDEPENDENT SCORE'
 except BaseException as e:
  summary='HOLD '+repr(e)
  raise
 finally:
  report('route',dict(summary=summary,rows=rows,before=locals().get('before'),last=status(),errors=errors,outside=outside,responses=events))
  browser.close()
