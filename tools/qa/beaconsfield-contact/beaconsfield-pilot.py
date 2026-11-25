#!/usr/bin/env python3
"""Real compiled flight on isolated Beaconsfield grade comparison routes."""
import argparse,functools,json,math,threading
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
p.add_argument('--chromium',required=True);p.add_argument('--query',default='beaconsfieldReview')
p.add_argument('--site',action='append',choices=('harbour','street','ordinary-harbour'))
p.add_argument('--expect-art',action=argparse.BooleanOptionalAction,default=True)
p.add_argument('--expected-grade');p.add_argument('--forbid-grade');p.add_argument('--verify-exit',action='store_true')
p.add_argument('--grade-file',help='Optional pack basename for exact request accounting or injection.')
p.add_argument('--grade-request-count',type=int,choices=(0,1))
p.add_argument('--emulated-fragment-samplers',type=int,choices=range(1,33))
p.add_argument('--grade-fault',choices=('missing','corrupt'))
p.add_argument('--serve-missing-grade',help='Compatibility shortcut for --grade-file NAME --grade-fault missing.')
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
if a.serve_missing_grade:
    if a.grade_file or a.grade_fault:p.error('Do not combine the old missing shortcut and general flags.')
    a.grade_file,a.grade_fault=a.serve_missing_grade,'missing'
if (a.grade_fault or a.grade_request_count is not None) and (not a.grade_file or '/' in a.grade_file):
    p.error('Specify the grade asset basename for fault/count checks.')
assert not set(a.query)&set('?#')
if a.verify_exit and not a.expected_grade:p.error('--verify-exit requires --expected-grade.')
origin=(5104.223880003646,29804.999693652593)
class Site(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
    def translate_path(self,path):
        path=path.split('?',1)[0]
        pref='/PEI-Flight-simulation/'
        return super().translate_path(path.removeprefix(pref) if path.startswith(pref) else '/NOT_QA_LOCAL/')
receipt={}
with ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Site,directory=str(a.dist))) as server,sync_playwright() as w:
    threading.Thread(target=server.serve_forever,daemon=True).start()
    browser=w.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
    try:
        for route in a.site or ['harbour','street']:
            site='harbour-low' if route=='ordinary-harbour' else 'qa-beacons-'+route
            with browser.new_context(viewport={'width':520,'height':350},device_scale_factor=1) as ctx:
                page=ctx.new_page();page.set_default_timeout(155000)
                errors=[];requests=[];missed=[]
                if a.emulated_fragment_samplers:
                    page.add_init_script('''(() => {
                      const p=WebGL2RenderingContext.prototype, get=p.getParameter;
                      p.getParameter=function(key) {
                        if(key===this.MAX_TEXTURE_IMAGE_UNITS)return %d;
                        return get.call(this,key);
                      };
                    })()'''%a.emulated_fragment_samplers)
                page.on('pageerror',lambda e:errors.append(str(e)))
                page.on('console',lambda m:errors.append(m.text) if m.type=='error' and
                  not (a.grade_fault=='missing' and m.location.get('url','').endswith('/'+a.grade_file)) else None)
                page.on('request',lambda q:requests.append('/'+q.url.split('/PEI-Flight-simulation/',1)[1]) if '/PEI-Flight-simulation/' in q.url else None)
                if a.grade_fault:
                    def inject(r):
                        missed.append(r.request.url)
                        if a.grade_fault=='missing':r.fulfill(status=404,body='QA optional grade unavailable')
                        else:r.fulfill(status=200,content_type='application/octet-stream',body=bytes(range(31)))
                    page.route('**/'+a.grade_file,inject)
                page.goto(f'http://127.0.0.1:{server.server_port}/PEI-Flight-simulation/?diagnostics&departure={site}'+('&'+a.query if a.query else ''),wait_until='domcontentloaded')
                page.get_by_role('button',name='Begin flight').click()
                page.wait_for_function("s=>window.islandAirDiagnostics?.mode==='flight'&&window.islandAirDiagnostics?.site===s",arg=site)
                start=page.evaluate('window.islandAirDiagnostics')
                gate=dict(x=start['x'],z=start['z'],aim=origin,art=a.expect_art,grade=a.expected_grade,
                          scope=160 if route!='ordinary-harbour' else None)
                page.wait_for_function('''q=>{
                    const d=window.islandAirDiagnostics,t=d.buildingTiles;
                    return Math.hypot(d.x-q.x,d.z-q.z)>85 && d.beaconsfieldReview===q.art
                      &&(!q.scope || Math.hypot(d.x-q.aim[0],d.z-q.aim[1])<q.scope)
                      &&t?.wanted>0&&t.ready===t.wanted&&!t.loading&&!t.failed&&!t.pending
                      &&(!q.grade||d.localGroundGrades.includes(q.grade));
                }''',arg=gate)
                d=page.evaluate('window.islandAirDiagnostics')
                exit_pose=None
                if a.verify_exit:
                    page.wait_for_function('''q=>{
                        const d=window.islandAirDiagnostics;
                        return d?.mode==='flight'&&Math.hypot(d.x-q.aim[0],d.z-q.aim[1])>790
                          && !d.localGroundGrades.includes(q.grade) && d.beaconsfieldGrade===false && d.beaconsfieldGradeShadows===0;
                    }''',arg=gate,timeout=210000)
                    tail=page.evaluate('window.islandAirDiagnostics')
                    exit_pose={'distanceM':math.hypot(tail['x']-origin[0],tail['z']-origin[1]),'gradeActive':tail['beaconsfieldGrade'],
                        'scopedShadowCount':tail['beaconsfieldGradeShadows'],'stillFlight':tail['mode']=='flight'}
                page.keyboard.press('v')
                page.wait_for_function("window.islandAirDiagnostics?.camera==='Cockpit'")
                page.keyboard.press('Escape')
                page.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
                assert not errors and not d['layerWarnings'],(route,errors,d['layerWarnings'])
                if a.forbid_grade:assert a.forbid_grade not in d['localGroundGrades'],d['localGroundGrades']
                if a.grade_fault:assert len(missed)==1,missed
                grade_requests=sum(q.endswith('/'+a.grade_file) for q in requests) if a.grade_file else None
                if a.grade_request_count is not None:assert grade_requests==a.grade_request_count,requests
                receipt[route]=dict(site=site,art=d['beaconsfieldReview'],distanceM=math.hypot(d['x']-start['x'],d['z']-start['z']),
                  targetDistanceM=math.hypot(d['x']-origin[0],d['z']-origin[1]),groundClearanceM=d['altitude']-d['groundY'],grades=d['localGroundGrades'],
                  artRequests=sum(v.endswith('/beaconsfield-v1.bin.gz') for v in requests),buildingPaths=sorted({v for v in requests if v.startswith('/world/buildings/')}),
                  buildingTiles=d['buildingTiles'],gradeRequests=grade_requests,injectedGradeFault=a.grade_fault,scopedExit=exit_pose,emulatedFragmentSamplerCapacity=a.emulated_fragment_samplers,controls=['Cockpit','Pause'],errors=errors)
                (a.out/'player.json').write_text(json.dumps(receipt,indent=2)+'\n')
                print(route,receipt[route],flush=True)
    finally:
        browser.close();server.shutdown()
