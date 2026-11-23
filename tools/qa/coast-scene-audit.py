#!/usr/bin/env python3
"""Measure a candidate with actual in-browser Three.js ground triangles and World.surface.

Needs repo npm dependencies, Playwright for this interpreter, Chromium, and a
Python with GDAL for the pinned LiDAR transform (--gdal-python). The checkout
is read only. Default report mode also runs on the legacy baseline; pass the
result for that baseline via --gate-against to enforce the candidate thresholds.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
from urllib.request import urlopen

from playwright.sync_api import sync_playwright

HERE=Path(__file__).resolve().parent
FLAGS=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist']


def prepare_points(repo, gdal_py, stride):
    manifest=repo/'data/coastal-elevation/index.json'
    spec=json.loads(manifest.read_text())
    # The project exporter verifies decoded SHA256, NoData, CRS and PixelIsArea before the GDAL transform.
    source=json.loads(subprocess.check_output([gdal_py,str(repo/'tools/qa/coast-window-points.py'),
                      '--manifest',str(manifest),'--stride',str(stride)]))
    windows={w['id']:w for w in spec['windows']}
    rows=[]
    for entry in source:
        w=windows[entry['id']]
        if w['noDataCells'] != 0:
            raise ValueError('Review held-out cell indexing for sources with missing cells.')
        cells=[(col,row) for row in range(stride//2,w['rows'],stride) for col in range(stride//2,w['cols'],stride)]
        points=[[*p,*cell] for p,cell in zip(entry['points'],cells,strict=True)]
        rows.append(dict(id=w['id'],reference=w['referenceLonLat'],cols=w['cols'],rows=w['rows'],points=points))
    return dict(stride=stride,sites=rows)


def source_fingerprint(repo):
    """Only repo-relative paths and immutable digests enter the published report."""
    files=[repo/p for p in (
        'src/main.ts', 'src/render/world.ts', 'src/sim/terrain.ts', 'src/sim/geo.ts',
        'src/sim/cover.ts', 'public/world/terrain.json', 'public/world/height.bin.gz',
        'public/world/cover.json','public/world/cover.bin.gz', 'data/coastal-elevation/index.json',
        'src/render/coastal-patch.ts','src/render/coastal-normals.ts','src/render/coastal-lod.ts',
        'src/render/coastal-lod.generated.ts','src/sim/coastal-terrain.ts','src/sim/coastal-surveys.generated.ts')]
    files += sorted((repo/'src/render').glob('coastal*.ts'))
    files += sorted((repo/'src/sim').glob('coastal*.ts'))
    files += sorted((repo/'src/sim').glob('*cliff*.ts'))
    files += sorted((repo/'src/render').glob('*cliff*.ts'))
    files += sorted((repo/'data/coastal-elevation').glob('*.gz'))
    files += sorted(p for p in (repo/'public/world/coastal').glob('**/*') if p.is_file())
    return {p.relative_to(repo).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in files if p.is_file()}


def run(args):
    repo=args.checkout.resolve();deps=(args.deps or repo/'node_modules').resolve()
    digests=source_fingerprint(repo)
    points=prepare_points(repo,args.gdal_python,args.stride)
    with tempfile.TemporaryDirectory(prefix='pei-ground-probe-') as work:
        root=Path(work);shutil.copytree(repo/'src',root/'src')
        (root/'public').symlink_to(repo/'public',target_is_directory=True)
        (root/'node_modules').symlink_to(deps,target_is_directory=True)
        # Vite may import data files from src; these are read only and never staged for publication.
        (root/'data').symlink_to(repo/'data',target_is_directory=True)
        for name in ('coast-edge-audit.mjs','coast-scene-audit.mjs'):
            shutil.copy2(HERE/name,root/name)
        (root/'index.html').write_text('<!doctype html><title>Coastal mesh QA</title><script type=module src="./coast-scene-audit.mjs"></script>')
        (root/'package.json').write_text((repo/'package.json').read_text())
        (root/'vite.config.mjs').write_text('export default {cacheDir:'+json.dumps(str(root/'vite-cache'))+'};')
        (root/'audit-observations.json').write_text(json.dumps(points,separators=(',',':')))
        with socket.socket() as sock:
            sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
        base=f'http://127.0.0.1:{port}'
        with (root/'serve.log').open('w') as log:
            proc=subprocess.Popen(['node',str(deps/'vite/bin/vite.js'),'--host','127.0.0.1','--port',str(port),'--strictPort'],cwd=root,stdout=log,stderr=log)
            try:
                for _ in range(100):
                    try:
                        with urlopen(base,timeout=1):
                            break
                    except OSError:
                        if proc.poll() is not None: raise RuntimeError((root/'serve.log').read_text())
                        time.sleep(.15)
                else: raise RuntimeError('Vite server did not start.')
                with sync_playwright() as pw:
                    browser=pw.chromium.launch(executable_path=args.chromium,args=FLAGS)
                    try:
                        page=browser.new_page()
                        errors=[];substitution=[]
                        if args.refinement_fallback:
                            def corrupt_refinement(route):
                                substitution.append(route.request.url.rsplit('/',1)[-1])
                                route.fulfill(status=200,body='intentionally invalid cliff response')
                            page.route('**/world/coastal/v2/east-point-cliff.i16.gz',corrupt_refinement)
                        page.on('pageerror',lambda e:errors.append(str(e)))
                        page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
                        page.goto(base,wait_until='domcontentloaded')
                        page.wait_for_function('window.auditResult || window.auditError',timeout=200000)
                        failure=page.evaluate('window.auditError')
                        if failure or errors: raise RuntimeError(str(failure or errors))
                        report=page.evaluate('window.auditResult')
                        if source_fingerprint(repo)!=digests:
                            raise RuntimeError('Candidate changed during the run: repeat against a stable checkout.')
                        report['sourceSHA256']=digests
                        if args.refinement_fallback:
                            if substitution!=['east-point-cliff.i16.gz']:
                                raise RuntimeError(f'Expected exactly one substitute optional asset: {substitution}')
                            report['browserSubstitutions']=substitution
                        report['chromium']=browser.version
                        return report
                    finally: browser.close()
            finally:
                proc.terminate()
                try: proc.wait(timeout=5)
                except subprocess.TimeoutExpired: proc.kill();proc.wait()


def refinement_gates(candidate, baseline):
    failures=[]
    old={s['id']:s for s in baseline['sites']};new={s['id']:s for s in candidate['sites']}
    def require(ok,msg):
        if not ok: failures.append(msg)
    require(candidate['settings']['stride']==baseline['settings']['stride']==1,'refinement requires the full native census')
    require(set(old)==set(new)=={'east-point','west-point'},'both survey AOIs are required')
    if failures:return failures
    east,prev=new['east-point'],old['east-point']
    c,b=east['coastalError'],prev['coastalError']
    require(east['counts']['source']==65536 and east['counts']['coverLand']==43700,'East source or masked scope changed')
    require(c['maximumPoint']['errorM']<=1.05 and not c['aboveOnePoint25M'],'East absolute error >1.05 m')
    require(c['aboveOneM']<=5 and c['aboveOneM']<=.03*b['aboveOneM'],'unresolved >1 m East outliers')
    require(c['aboveThreeQuarterM']<=20 and c['aboveThreeQuarterM']<=.05*b['aboveThreeQuarterM'],'unresolved >.75 m East outliers')
    f=lambda a,k,q:a['groups'][k]['mesh'][q]
    p=lambda a,k:f(a,k,'p90')
    require(p(east,'allCoverLand')<=.84*p(prev,'allCoverLand'),'East whole window p90 improvement <16%')
    require(f(east,'allCoverLand','p95')<=.65*f(prev,'allCoverLand','p95'),'East whole window p95 improvement <35%')
    require(p(east,'offVertexOuter24m')<=p(prev,'offVertexOuter24m')+.035,'outer survey ring error regressed by >.035 m')
    require(east['allCoverLandContactDiff']['max']<=.001,'refined mesh/simulation mismatch >1 mm')
    for site in new:
        s,prior=new[site],old[site]
        require(s['oldMaskDigest']==prior['oldMaskDigest'],f'{site}: unexpected shore mask changes')
        for a,d in zip(s['lod'],prior['lod'],strict=True):
            if not a['offsetM']:
                continue
            if site=='west-point':
                require(a['displayedDigestMillimetres']==d['displayedDigestMillimetres'],f"{site}: changed distant mesh at {a['offsetM']} m")
                require(a['meshes']==d['meshes'],f"{site}: distant triangle budget changed at {a['offsetM']} m")
            else:
                limit=28000 if a['offsetM']==22000 else 34000
                triangle_count=sum(m['totalTriangles'] for m in a['meshes'])
                require(triangle_count<=limit,f"East distance patch exceeded {limit:,} triangles at {a['offsetM']} m")
                require(a['screenDiffPxAt1080']['max']<=.025,f"East cross-LOD geometry moved by >0.025 px at {a['offsetM']} m")
                require(a['maxChangeInDisplayedLandM']<=.12,f"East cross-LOD geometry differs by >0.12 m at {a['offsetM']} m")
    west,west_before=new['west-point'],old['west-point']
    require(west['meshAndContactDigestMillimetres']==west_before['meshAndContactDigestMillimetres'],'West control mesh/contact changed')
    triangles=lambda s:sum(m['totalTriangles'] for m in s['meshes'])
    require(0<triangles(east)-triangles(prev)<=19000,'East near extra triangle budget must be >0 and <=19,000')
    require(east['nearEdges']['maxEdgeJumpM']<=.001,'fine edge discontinuity >1 mm')
    return failures


def gates(candidate, baseline):
    failed=[]
    expected={'east-point','west-point'}
    if {s['id'] for s in candidate['sites']}!=expected or {s['id'] for s in baseline['sites']}!=expected:
        return ['Both pinned survey windows must be present in both reports.']
    old={s['id']:s for s in baseline['sites']}
    for s in candidate['sites']:
        site=s['id'];g=s['groups'];c=s['counts'];before=old[site]['groups'];edges=[s['nearEdges']]+[r['edges'] for r in s['lod'] if 'edges' in r]
        def check(ok,text):
            if not ok: failed.append(f'{site}: {text}')
        check(c['wrongLand']==c['holes']==c['doubleCoverage']==c['nonFinite']==0,'mask, coverage, finiteness or overlapping faces')
        check(g['offVertexCore24m']['mesh']['n']>=400,'insufficient non-vertex core sample')
        check(g['offVertexCore24m']['mesh']['p90']<=.75,'core p90 source error >0.75 m')
        check(g['offVertexLand']['mesh']['p90']<=.75,'whole-window p90 source error >0.75 m')
        check(g['offVertexCore24m']['mesh']['p90']<=.70*before['offVertexCore24m']['mesh']['p90'],'core accuracy improvement <30%')
        check(g['offVertexOuter24m']['mesh']['p90']<=before['offVertexOuter24m']['mesh']['p90']+.15,'outer 24 m worsened >0.15 m')
        check(g['allCoverLand']['meshVsContact']['n']>=200 and g['allCoverLand']['meshVsContact']['max']<=.10,'actual ground and contact differ >0.10 m')
        handoff=s['contactHandoff']
        check(handoff and all((h[k].get('max',0)<=.05) for h in handoff.values() for k in ('water','land')),'contact handoff across same-surface ownership boundary >0.05 m')
        wall=s['shoreWall']
        check(wall['spans']>0 and not wall['unclassified'] and wall['envelope'].get('max',1)<=.05,'shore wall leaves a >0.05 m water or ground gap')
        check(s['waterContactOffsetFromPlane']['max']<=.10,'water contact offset >0.10 m')
        check(all(r['profiles'] and not(r['gaps'] or r['overlaps'] or r['backfaces']) and r['maxEdgeJumpM']<=.05 for r in edges),'near/medium/far terrain crack, hole, overlap or reversed face')
        visited={m['segments'] for state in s['lod'] for m in state['meshes']}
        check({8,56,112}.issubset(visited),'probe must visit all three province LODs')
        check(s['threeRayVsIndex']['n']>=8 and s['threeRayVsIndex']['max']<=1e-5,'Three.Raycaster disagrees with index')
        check(all(r['contactDigest']==s['initialContactDigest'] for r in s['lod']),'contact depends on camera/LOD history')
        check(s['lod'][-1]['maxChangeInDisplayedLandM']<=.001,'near mesh did not round trip')
        check(all(v['screenDiffPxAt1080']['max']<=.5 for v in s['lod'] if v['offsetM']),
              'distant ground moved by >0.5 px at 1080p on the specified approach')
    if candidate['cavendishControl']['digestMillimetres']!=baseline['cavendishControl']['digestMillimetres']:
        failed.append('Cavendish: off-window ground/contact changed at millimetre precision')
    return failed


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--checkout',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--chromium',default=os.getenv('CHROMIUM','chromium'))
    p.add_argument('--gdal-python',default=os.getenv('GDAL_PYTHON','/usr/bin/python3'))
    p.add_argument('--stride',type=int,default=4,choices=[1,2,4,8])
    p.add_argument('--deps',type=Path)
    p.add_argument('--gate-against',type=Path,help='verify against a report generated with identical sampling')
    check_mode=p.add_mutually_exclusive_group()
    check_mode.add_argument('--refinement-against',type=Path,help='require targeted East improvement versus an R9 coastal geometry report')
    check_mode.add_argument('--refinement-fallback',type=Path,help='serve a corrupt optional response and verify identical R9 geometry')
    args=p.parse_args();report=run(args);path=args.out.resolve()
    path.parent.mkdir(parents=True,exist_ok=True)
    if args.gate_against:
        baseline=json.loads(args.gate_against.read_text())
        if baseline['settings'] != report['settings']: raise SystemExit('Sampling settings differ from baseline')
        report['failedGates']=gates(report,baseline)
    if args.refinement_against:
        report.setdefault('failedGates',[]).extend(refinement_gates(report,json.loads(args.refinement_against.read_text())))
    if args.refinement_fallback:
        replay=json.loads(args.refinement_fallback.read_text())
        for field in ('settings','cavendishControl','sites'):
            if replay.get(field)!=report.get(field):
                report.setdefault('failedGates',[]).append(f'Fallback did not reproduce baseline {field}.')
    path.write_text(json.dumps(report,indent=2,allow_nan=False)+'\n')
    for site in report['sites']:
        g=site['groups'];edge=site['nearEdges']
        print(site['id'],'source p90 [all nonvertex, core, outer]:',*[g[k]['mesh']['p90'] for k in ('offVertexLand','offVertexCore24m','offVertexOuter24m')],
              'contact mismatch max:',g['allCoverLand']['meshVsContact']['max'],'edge jump max:',edge['maxEdgeJumpM'],'m')
    if report.get('failedGates'): raise SystemExit('\n'.join(report['failedGates']))
