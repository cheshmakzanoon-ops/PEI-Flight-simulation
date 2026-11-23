#!/usr/bin/env python3
"""Run the Basin Head outer wharf deck using surveyed plan and elevations in matched actual Three.js scene cameras."""
import argparse, importlib.util, json, tempfile
from pathlib import Path

path=Path(__file__).with_name('fixed-scenery.py')
modspec=importlib.util.spec_from_file_location('fixed_scenery',path)
fixed=importlib.util.module_from_spec(modspec);modspec.loader.exec_module(fixed)

fixed.VIEWS.update({
    'wharf-sea':dict(lon=-62.108007,lat=46.377302,h=1.97,east=-.515,south=.857,nearDist=34,nearAgl=8,fixedBaseH=1.97,fixedEyeY=8.5),
    'wharf-cove':dict(lon=-62.108062,lat=46.377384,h=1.97,east=.92,south=.3919,nearDist=48,nearAgl=16,fixedBaseH=1.97,fixedEyeY=17.4),
    'wharf-waterline':dict(lon=-62.108047,lat=46.377343,h=1.4,east=.944,south=.330,nearDist=20,nearAgl=5.4,fixedBaseH=.15,fixedEyeY=5.4),
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
            assert shot['diag']['basinShoreline']=='basin-head-channel-v1'
            assert shot['diag'].get('basinWharfVisible',False)==(expected and shot['name']!='east-close')

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
                flags=('basinChannel&basinWharf&' if self.flag else 'basinChannel&basinWharf&noBasinWharf&')+self.shared
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
    p.add_argument('--views',default='wharf-sea-close,wharf-cove-close,east-close')
    p.add_argument('--size',default='900x580')
    p.add_argument('--reuse-base',action='store_true')
    p.add_argument('--extra',default='',help='More preview flags for both compared app states, ampersand terminated.')
    p.add_argument('--void-probe',action='store_true');a=p.parse_args();a.deps=None;a.pose_baseline=None
    fixed.run(a)
    verify(a)
