#!/usr/bin/env python3
"""Watchdog and signed-pack integrity regression on the built browser game.

Run nominal, missing, same-size corrupt and stalled-body scenarios. The HTTP
fixture serves the same production files on separate threads; only the new
optional refinement is fault-injected. The old East and West inputs must
still load, and the lighthouse departure must still fly.
"""
import argparse
import functools
import gzip
import json
import math
import socket
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Event, Lock, Thread
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

EAST_BASE='/world/coastal/v1/east-point.i16.gz'
COARSE={EAST_BASE,'/world/coastal/v1/west-point.i16.gz'}
CLIFF='/world/coastal/v2/east-point-cliff.i16.gz'
ATLAS_INPUTS=COARSE|{CLIFF}
REFINEMENT='east-cliff-v1'
SCENARIOS=('healthy','missing','corrupt-decoded','stalled-body','base-east-missing')
FLAGS=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist']
MS=lambda:time.monotonic_ns()/1e6


def run_case(browser, dist, scenario):
    guard=Lock()
    shut=Event()
    still_held=Event()
    trace=[]
    nominal=(dist/CLIFF.lstrip('/')).read_bytes()
    decoded=bytearray(gzip.decompress(nominal))
    decoded[-min(50,len(decoded))]^=0x23 # re-gzip a same-size but invalid decoded body
    tampered=gzip.compress(decoded,mtime=0)
    known_missing=CLIFF if scenario=='missing' else EAST_BASE if scenario=='base-east-missing' else None

    def log(action,path):
        with guard: trace.append((action,path,MS()))

    class Server(SimpleHTTPRequestHandler):
        def log_message(self,*_):
            pass

        def do_GET(self):
            path=urlsplit(self.path).path
            if path in ATLAS_INPUTS:log('request',path)
            if path==known_missing:
                self.send_error(404)
                return
            if path!=CLIFF or scenario=='healthy':
                return super().do_GET()
            self.connection.settimeout(12)
            try:
                body=tampered if scenario=='corrupt-decoded' else nominal
                self.send_response(200)
                self.send_header('Content-Type','application/gzip')
                self.send_header('Content-Length',str(len(body)))
                self.end_headers()
                if scenario=='stalled-body':
                    # Real network trace: receive headers and some data, then stop.
                    self.wfile.write(body[:32]);self.wfile.flush()
                    log('partial-body',path);still_held.set()
                    shut.wait(45)
                    log('released-partial',path)
                    self.wfile.write(body[32:])
                else:
                    self.wfile.write(body)
            except (BrokenPipeError,ConnectionResetError,socket.timeout):
                log('server-saw-abort',path)

    with ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Server,directory=str(dist))) as server:
        worker=Thread(target=server.serve_forever,daemon=True)
        worker.start()
        ctx=browser.new_context(viewport={'width':640,'height':400},device_scale_factor=1)
        try:
            page=ctx.new_page()
            errors=[]
            session=ctx.new_cdp_session(page)
            session.send('Network.enable')
            started={}
            canceled=[]
            def request(event):
                if urlsplit(event['request']['url']).path==CLIFF:
                    started[event['requestId']]=event['timestamp']
            def failure(event):
                start=started.get(event['requestId'])
                if start is not None:
                    canceled.append((1000*(event['timestamp']-start),event['errorText']))
            session.on('Network.requestWillBeSent',request)
            session.on('Network.loadingFailed',failure)
            page.on('pageerror',lambda e:errors.append(str(e)))
            def console(m):
                if m.type=='error' and urlsplit(m.location.get('url','')).path!=known_missing:
                    errors.append(m.text)
            page.on('console',console)
            page.on('response',lambda res:errors.append(f'{res.status} {urlsplit(res.url).path}')
              if res.status>=400 and not(res.status==404 and urlsplit(res.url).path==known_missing) else None)
            page.goto(f'http://127.0.0.1:{server.server_port}/?diagnostics',wait_until='domcontentloaded',timeout=60000)
            page.wait_for_function('window.islandAirDiagnostics?.mode==="dispatch" && Array.isArray(window.islandAirDiagnostics?.coastalRefinements)',timeout=70000)
            def snapshot():return page.evaluate('window.islandAirDiagnostics')
            def check(diag):
                active=[REFINEMENT] if scenario=='healthy' else []
                expected=['west-point'] if scenario=='base-east-missing' else ['east-point','west-point']
                if sorted(diag['coastalSurveys'])!=expected or sorted(diag['coastalRefinements'])!=active:
                    raise RuntimeError(f'{scenario}: wrong startup data set {diag}')
            d=snapshot();check(d)
            times={}
            if scenario=='stalled-body':
                with guard: already_released=any(a=='released-partial' for a,_,_ in trace)
                if not still_held.is_set() or shut.is_set() or already_released:
                    raise RuntimeError('Interrupted refinement was not still held when the app became flyable.')
                page.wait_for_timeout(250) # drain queued CDP network events
                # Network-event timestamps come from Chromium, not delayed delivery
                # to Playwright while the software renderer is busy.
                aborts=[ms for ms,message in canceled if 'abort' in message.lower()]
                if len(aborts)!=1:
                    raise RuntimeError(f'Stalled body failed to abort exactly once: {canceled}')
                times['optionalRequestAbortedMs']=round(aborts[0],1)
                # The app sets a 1,600 ms main-thread timer. JS timers cannot
                # preempt a loaded browser; the observable release limit includes
                # conservative scheduling headroom in software rendering.
                if not 950<=times['optionalRequestAbortedMs']<=10000:
                    raise RuntimeError(f'Unexpected optional request lifetime: {times}')
                print(f'Watchdog aborted stalled body at {times["optionalRequestAbortedMs"]} ms',flush=True)
                shut.set() # server offers the original valid payload after the client abandoned it
                page.wait_for_timeout(500);check(snapshot())
            # Exercise the actual UI handlers without waiting for Chromium to
            # paint 2 *additional* stable software frames before each click.
            page.evaluate('''()=> {
              document.querySelector('#start').click();
              document.querySelector('#nav-map').click();
              const s=document.querySelector('#map-site');
              const departure=[...s.options].find(o=>o.text==='East Point · lighthouse pass');
              if(!departure)throw Error('East Point departure missing');
              s.value=departure.value;
              s.dispatchEvent(new Event('change',{bubbles:true}));
              document.querySelector('#fly-here').click();
            }''')
            page.wait_for_function("""()=>{const d=window.islandAirDiagnostics;
                  return d?.site==='east-light' && d.mode==='flight' && d.mainland && d.roads && d.detail.ready>0}""",timeout=70000)
            a=snapshot()
            try:
                page.wait_for_function("""a=>{const d=window.islandAirDiagnostics;
                    return d?.mode==='flight' && Math.hypot(d.x-a.x,d.z-a.z)>12}""",arg=a,timeout=100000,polling=100)
            except PlaywrightTimeout as exc:
                raise RuntimeError(f'{scenario}: projected departure not moving: start {a}, last {snapshot()}, errors {errors}') from exc
            b=snapshot();check(b)
            with guard:requested=[path for method,path,_ in trace if method=='request']
            if sorted(requested)!=sorted(ATLAS_INPUTS) or errors:
                raise RuntimeError(f'{scenario}: unexpected requests/browser errors: {requested}; {errors}')
            if not all(math.isfinite(b[k]) for k in ('groundY','x','z','altitude','speed')):
                raise RuntimeError(f'{scenario}: invalid flight coordinates')
            return {'scenario':scenario,'requests':sorted(requested),'installedBaseSurveys':b['coastalSurveys'],
                    'installedRefinement':b['coastalRefinements'],'flightTravelM':round(math.hypot(b['x']-a['x'],b['z']-a['z']),2),
                    **times,'browserErrors':errors}
        finally:
            shut.set()
            ctx.close()
            server.shutdown()
            worker.join()


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--dist',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
    p.add_argument('--chromium',required=True);p.add_argument('--case',choices=SCENARIOS,action='append')
    args=p.parse_args();records=[]
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path=args.chromium,args=FLAGS)
        args.out.parent.mkdir(parents=True,exist_ok=True)
        for case in args.case or SCENARIOS:
            row=run_case(browser,args.dist.resolve(),case)
            records.append(row);print(json.dumps(row),flush=True)
            args.out.write_text(json.dumps({'schema':1,'scenarios':records},indent=2)+'\n')


if __name__=='__main__':
    main()
