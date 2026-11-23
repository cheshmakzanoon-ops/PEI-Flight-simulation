#!/usr/bin/env python3
"""Run the unmodified Basin Head bank geometry in matched actual Three.js scene cameras."""
import argparse, importlib.util, json, tempfile
from pathlib import Path

path=Path(__file__).with_name('fixed-scenery.py')
modspec=importlib.util.spec_from_file_location('fixed_scenery',path)
fixed=importlib.util.module_from_spec(modspec);modspec.loader.exec_module(fixed)

fixed.VIEWS.update({
    'singing-west':dict(lon=-62.108125,lat=46.37745833333334,h=1.4,east=.60,south=.80,nearDist=36,nearAgl=18),
    'singing-east':dict(lon=-62.095125,lat=46.38404166666667,h=1.4,east=.89,south=.46,nearDist=67,nearAgl=26),
    'singing-high':dict(lon=-62.095125,lat=46.38404166666667,h=2.2,east=.83,south=.47,nearDist=1800,nearAgl=1410),
})
orig=fixed.capture
prior_settle=fixed.settle
def wait_assets(page,errors):
    qa=page.url.split('qa=',1)[-1]
    from urllib.parse import unquote
    q=json.loads(unquote(qa))
    expected=11 if q['site']=='singing-west' else 7
    page.wait_for_function('n=>window.islandAirDiagnostics?.detail?.ready===n && window.islandAirDiagnostics?.detail?.loading===0 && window.islandAirDiagnostics?.detail?.retrying===0',arg=expected,timeout=110000)
    return prior_settle(page,errors)
fixed.settle=wait_assets
def capture(args,browser,url):
    class Query:
        def __init__(self,b,flag):
            self.wrapped=b;self.flag=flag
        def new_context(self,**kwargs):
            context=self.wrapped.new_context(**kwargs)
            if self.flag:
                return context
            func=context.new_page
            def create():
                page=func()
                goto=page.goto
                page.goto=lambda url,**opt:goto(url.replace('/?diagnostics&qa=', '/?diagnostics&noBasinBank&qa='),**opt)
                return page
            context.new_page=create
            return context
    out=args.out
    for state in (('new',) if args.reuse_base else ('old','new')):
        args.out=out/state;args.out.mkdir(parents=True,exist_ok=True)
        args.pose_baseline=None if state=='old' else out/'old/results.json'
        orig(args,Query(browser,state=='new'),url)
    args.out=out
fixed.capture=capture

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--checkout',type=Path,required=True);p.add_argument('--chromium',required=True)
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--views',default='singing-west-close,east-close')
    p.add_argument('--size',default='900x580')
    p.add_argument('--reuse-base',action='store_true')
    a=p.parse_args();a.void_probe=False;a.deps=None;a.pose_baseline=None
    fixed.run(a)
