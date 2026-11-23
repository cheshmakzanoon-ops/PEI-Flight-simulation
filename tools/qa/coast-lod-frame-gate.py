#!/usr/bin/env python3
"""Compare matched full-scene captures: exact camera, completed texture set, topology and pixels."""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image


def captures(directory):
    data=json.loads((directory/'report.json').read_text())
    return {r['view']:r for r in data}


def compare(before,after):
    views=['east-8500','east-22000','west-8500','west-22000']
    a,b=captures(before),captures(after)
    if set(a)!=set(views) or set(b)!=set(views):
        raise ValueError('Expected all four approach poses in both sets.')
    rows=[];failures=[]
    for name in views:
        old,new=a[name],b[name];o,n=old['diagnostics'],new['diagnostics']
        if old['pose']!=new['pose'] or (old['width'],old['height'])!=(new['width'],new['height']):
            raise ValueError(f'{name}: unmatched camera/viewport')
        if o['tex']!=n['tex'] or o['tex']['expected']!=o['tex']['ready']:
            raise ValueError(f'{name}: distant appearance cannot be compared until the same expected texture IDs are loaded')
        for d in [o,n]:
            if d['warnings'] or d['assets']['missing'] or d['assets']['loading'] or any(d['buildings'][k] for k in ['pending','loading','failed']):
                raise ValueError(f'{name}: a scene layer did not settle')
        images=[]
        for root in [before,after]:
            with Image.open(root/(name+'.png')) as image:
                images.append(np.asarray(image.convert('RGB'),dtype=np.int16))
        if images[0].shape!=images[1].shape:raise ValueError(f'{name}: mismatched screenshots')
        delta=np.max(np.abs(images[0]-images[1]),axis=2)
        height,width=delta.shape;n8=int((delta>8).sum());n32=int((delta>32).sum())
        if n8/delta.size>.001 or n32/delta.size>.0001:failures.append(f'{name}: excessive whole-frame RGB change')
        if o['total']-n['total']<20000 or n['calls']>o['calls']:
            failures.append(f'{name}: distance LOD did not meet the triangle/draw budget')
        if not(set(x['site'] for x in o['drawn'])==set(x['site'] for x in n['drawn']) and n['drawn']):
            failures.append(f'{name}: disappeared survey geometry')
        rows.append({'view':name,'width':width,'height':height,'camera':new['pose'],
                     'fullyLoadedOrthoTiles':n['tex']['ready'],'baselineTriangles':o['total'],'candidateTriangles':n['total'],
                     'reductionPercent':round(100*(1-n['total']/o['total']),3),
                     'baselineDrawCalls':o['calls'],'candidateDrawCalls':n['calls'],'surveyDrawsBaseline':o['drawn'],'surveyDrawsCandidate':n['drawn'],
                     'changedOfPixels':int((delta>0).sum()),'pixels':int(delta.size),'over8Of255':n8,'over32Of255':n32,
                     'maxChannelChange':int(delta.max())})
    return {'schema':1,'render':'Chromium with SwiftShader; submitted triangles and matched-frame differences, not hardware FPS.',
            'poses':rows,'failures':failures}


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--before',type=Path,required=True);parser.add_argument('--after',type=Path,required=True);parser.add_argument('--out',type=Path,required=True)
    args=parser.parse_args();report=compare(args.before,args.after);args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(report,indent=2)+'\n')
    for row in report['poses']:
        print(row['view'],row['baselineTriangles'],'→',row['candidateTriangles'],'triangles;',row['over8Of255'],'pixels differ by >8')
    if report['failures']:raise SystemExit('\n'.join(report['failures']))
