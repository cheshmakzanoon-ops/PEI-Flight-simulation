#!/usr/bin/env python3
"""Run the surveyed-profile Basin Head footbridge exterior in matched actual Three.js scene cameras."""
import argparse, importlib.util, json, tempfile
from pathlib import Path

path=Path(__file__).with_name('fixed-scenery.py')
modspec=importlib.util.spec_from_file_location('fixed_scenery',path)
fixed=importlib.util.module_from_spec(modspec);modspec.loader.exec_module(fixed)

fixed.VIEWS.update({
    'singing-west':dict(lon=-62.1081375,lat=46.3776135,h=2.2,east=.18,south=.984,nearDist=12,nearAgl=5.0),
    'singing-east':dict(lon=-62.1081375,lat=46.3776135,h=2.2,east=.50,south=-.866,nearDist=34,nearAgl=14),
    'singing-high':dict(lon=-62.095125,lat=46.38404166666667,h=2.2,east=.83,south=.47,nearDist=1800,nearAgl=1410),
})
orig=fixed.capture
prior_settle=fixed.settle
def wait_assets(page,errors):
    from urllib.parse import unquote
    v=json.loads(unquote(page.url.split('qa=',1)[-1]))['site']
    target=7 if v=='east' else 10
    page.wait_for_function('n=>window.islandAirDiagnostics?.detail?.ready>=n && window.islandAirDiagnostics?.detail?.loading===0 && window.islandAirDiagnostics?.detail?.retrying===0',arg=target,timeout=110000)
    return prior_settle(page,errors)
fixed.settle=wait_assets
def verify(args):
    for mode in ('old','new'):
        p=args.out/mode/'results.json'
        for shot in json.loads(p.read_text()):
            expected=mode=='new'
            assert shot['diag']['basinFootbridge']==expected, (shot['name'],shot['diag'].get('basinFootbridge'))
            assert shot['diag']['basinShoreline']=='basin-head-channel-v1'
            assert shot['diag'].get('basinFootbridgeVisible',False)==(expected and shot['name']!='east-close')

def capture(args,browser,url):
    class Query:
        def __init__(self,b,flag,shared):
            self.wrapped=b;self.flag=flag;self.shared=shared
        def new_context(self,**kwargs):
            context=self.wrapped.new_context(**kwargs)
            func=context.new_page
            def create():
                page=func()
                goto=page.goto
                flags=('basinChannel&' if self.flag else 'basinChannel&noBasinFootbridge&')+self.shared
                page.goto=lambda url,**opt:goto(url.replace('/?diagnostics&qa=', '/?diagnostics&'+flags+'qa='),**opt)
                return page
            context.new_page=create
            return context
    out=args.out
    for state in (('new',) if args.reuse_base else ('old','new')):
        args.out=out/state;args.out.mkdir(parents=True,exist_ok=True)
        args.pose_baseline=None if state=='old' else out/'old/results.json'
        orig(args,Query(browser,state=='new',args.extra),url)
    args.out=out
fixed.capture=capture

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--checkout',type=Path,required=True);p.add_argument('--chromium',required=True)
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--views',default='singing-west-close,singing-east-close,east-close')
    p.add_argument('--size',default='900x580')
    p.add_argument('--reuse-base',action='store_true')
    p.add_argument('--extra',default='',help='More preview flags for both compared app states, ampersand terminated.')
    a=p.parse_args();a.void_probe=False;a.deps=None;a.pose_baseline=None
    fixed.run(a)
    verify(a)
