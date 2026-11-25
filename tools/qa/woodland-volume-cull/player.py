"""Private compiled simulator QA, no code changes or native user browser."""
import argparse,functools,http.server,json,math,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
p=argparse.ArgumentParser()
p.add_argument('--dist',type=Path,required=True);p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--counties',nargs='+',default=['prince'],choices=['prince','queens','kings'])
p.add_argument('--modes',nargs='+',default=['culled','stock','standard','no-msaa'],choices=['culled','stock','standard','no-msaa'])
p.add_argument('--field',default='woodlandCull');p.add_argument('--admitted-key',default='admitted')
p.add_argument('--submitted-key',default='submitted')
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(a.dist)))
threading.Thread(target=server.serve_forever,daemon=True).start()
out=[]
try:
 with sync_playwright() as w:
  browser=w.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage'])
  for county in a.counties:
   for mode in a.modes:
    with browser.new_context(viewport={'width':540,'height':380}) as c:
     site=county+'-woodland-view';errs=[]
     pg=c.new_page();pg.set_default_timeout(125000)
     pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda e:errs.append(e.text) if e.type=='error' else None)
     pg.on('response',lambda e:errs.append(str(e.status)+' '+e.url) if e.status>=400 else None)
     if mode=='no-msaa':
      pg.add_init_script('''(() => {
       const get=HTMLCanvasElement.prototype.getContext;
       HTMLCanvasElement.prototype.getContext=function(kind, config,...rest){
        if(kind==='webgl'||kind==='webgl2')return get.call(this,kind,{...config,antialias:false},...rest);
        return get.call(this,kind,config,...rest);
       };
      })()''')
     q={'culled':'woodlandView','stock':'woodlandView&stockWoodlandVolumeCull','standard':'stockWoodlandVolumeCull','no-msaa':'woodlandView'}[mode]
     pg.goto(f'http://127.0.0.1:{server.server_port}/?departure={site}&diagnostics&'+q,wait_until='domcontentloaded')
     pg.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
     pg.evaluate("""keys=>{
      const samples=[];
      window.privateWoodlandPilotSamples=samples;
      function probe(){
       const d=window.islandAirDiagnostics,q=d?.[keys.diagnostic];
       if(d&&samples.length<2500) samples.push({view:d.camera,mode:d.mode,total:d.woodlandVolume??0,
        admitted:q?.[keys.admitted]??null,submitted:q?.[keys.submitted]??null,enabled:q?.enabled??null,active:q?.active??null,submittedTriangles:q?.submittedTriangles??null});
       requestAnimationFrame(probe);
      }
      requestAnimationFrame(probe);
     }""", {'diagnostic':a.field,'admitted':a.admitted_key,'submitted':a.submitted_key})
     pg.get_by_role('button',name='Begin flight').click()
     pg.wait_for_function("id=>window.islandAirDiagnostics?.mode==='flight'&&window.islandAirDiagnostics.site===id",arg=site)
     start=pg.evaluate("()=>window.islandAirDiagnostics")
     camera_sequence=['Cockpit','Wide chase']+(['Scenery'] if mode in ('culled','stock') else [])
     for view in camera_sequence:
      pg.keyboard.press('v');pg.wait_for_function('v=>window.islandAirDiagnostics?.camera===v',arg=view)
     pg.wait_for_function('p=>Math.hypot(window.islandAirDiagnostics.x-p.x,window.islandAirDiagnostics.z-p.z)>=120',arg={'x':start['x'],'z':start['z']})
     pg.keyboard.press('Escape');pg.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
     f=pg.evaluate("()=>window.islandAirDiagnostics")
     data=pg.evaluate("()=>window.privateWoodlandPilotSamples")
     samples=pg.evaluate("""()=>{const gl=document.querySelector('#world').getContext('webgl2');return gl?.getParameter(gl.SAMPLES)??null}""")
     assert not errs and not f['layerWarnings'] and samples is not None,(site,mode,errs,f.get('layerWarnings'))
     if mode in ['culled','stock']:
      observed=[x for x in data if x['total']>0 and isinstance(x['admitted'],int)and isinstance(x['submitted'],int)]
      assert observed and samples>=2, (site,mode, len(observed),samples)
      assert all(0<=x['submitted']<=x['admitted'] and x['admitted']==x['total'] and isinstance(x['submittedTriangles'],int) and (x['submittedTriangles']==0)==(x['submitted']==0) for x in observed)
      if mode=='stock':assert all(x['submitted']==x['admitted'] and x['enabled'] is False for x in observed)
      else:assert any(0<x['submitted']<x['admitted'] and x['enabled'] is True and x['active'] is True for x in observed)
     else:
      observed=[]
      assert all(x['total']==0 and x['submitted'] in (None,0) for x in data)
      if mode=='no-msaa':assert samples<2
     row=dict(site=site,mode=mode,view=f['camera'],controls=camera_sequence+['Pause'],msaaSamples=samples,
      travelledM=math.hypot(f['x']-start['x'],f['z']-start['z']),observedFrames=len(observed),
      maximumAdmitted=max((x['admitted'] for x in observed),default=0),
      maximumActualSubmitted=max((x['submitted'] for x in observed),default=0),
      maximumVolumeTrianglesReported=max((x['submittedTriangles'] for x in observed),default=0),
      actualCasesWithFewerSubmissions=sum(x['submitted']<x['admitted'] for x in observed),errors=errs)
     out.append(row);(a.out/'compiled-woodland-usage.json').write_text(json.dumps(out,indent=2)+'\n')
     print(row,flush=True)
  browser.close()
finally:server.shutdown()
