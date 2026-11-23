#!/usr/bin/env python3
"""Test matched game frames and a low-altitude positive-control void probe."""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image


def read_png(path):
    with Image.open(path) as img:
        return np.asarray(img.convert('RGB'),dtype=np.int16)


def cloud_test(path):
    pixel=read_png(path)
    marked=(pixel[:,:,0]>=248)&(pixel[:,:,1]<=12)&(pixel[:,:,2]>=248)
    # Whole shoreline band, well below the lowest horizon in the fixed cliff-face shot.
    horizon=marked[:75];band=marked[323:445,32:992]
    return {'positiveControlPixels':int(horizon.sum()),'positiveControlSize':horizon.size,
            'innerShoreSkyPixels':int(band.sum()),'innerShoreSize':band.size,
            'innerShoreROI':[32,323,992,445]}


def compare(before,after,void_before,void_after):
    data=lambda d:{r['view']:r for r in json.loads((d/'report.json').read_text())}
    a,b=data(before),data(after)
    expected={'cliff-face','cliff-reveal','cliff-south','east-station'}
    if set(a)!=expected or set(b)!=expected:raise ValueError('Expected the four named matches.')
    report={'schema':1,'imageMetric':'Submitted Three triangles and matched RGB pixels on SwiftShader; not GPU FPS or a realism score.',
            'views':[],'failedGates':[]}
    failures=report['failedGates']
    for name in sorted(expected):
        old,new=a[name],b[name];o,n=old['diagnostics'],new['diagnostics']
        if old['pose']!=new['pose'] or o['projected']!=n['projected'] or o['tex']!=n['tex'] or o['tex']['expected']!=o['tex']['ready']:
            raise ValueError(f'{name}: cameras or loaded ortho textures do not match')
        for d in (o,n):
            if d['warnings'] or d['assets']['missing'] or d['assets']['loading'] or any(d['buildings'][k] for k in ('pending','loading','failed')):
                raise ValueError(f'{name}: a layer had not settled')
        ref=lambda d:[p for p in d['drawn'] if p['site']=='east-point' and p['lod']==112]
        legacy,refined=ref(o),ref(n)
        if len(legacy)!=1 or legacy[0]['refinement'] is not None or len(refined)!=1 or refined[0]['refinement']!='east-cliff-v1':
            failures.append(f'{name}: expected the existing mesh to be replaced by tagged refined terrain')
        if not 0<n['total']-o['total']<=19000 or n['calls']>o['calls']+1:
            failures.append(f'{name}: unexpected render budget')
        raw_a,raw_b=[read_png(d/(name+'.png'))for d in (before,after)]
        if raw_a.shape!=raw_b.shape or raw_a.shape!=(640,1024,3):
            raise ValueError('Unexpected comparison image sizes')
        diff=np.max(np.abs(raw_a-raw_b),axis=2)
        above8=int((diff>8).sum())
        roi=diff[180:470,245:779]
        if name=='cliff-face' and int((roi>8).sum())<25:
            failures.append('Refined relief could not be detected in the predeclared low cliff image area')
        report['views'].append({
            'view':name,'camera':new['pose'],'fullyLoadedOrthoTiles':n['tex']['ready'],
            'triangleCountBefore':o['total'],'triangleCountAfter':n['total'],
            'drawCallsBefore':o['calls'],'drawCallsAfter':n['calls'],
            'pixels':diff.size,'pixelsOver8RgbLevels':above8,'cliffCenterPixelsOver8RgbLevels':int((roi>8).sum())})
    if void_before and void_after:
        before_void=cloud_test(void_before/'cliff-face.png');after_void=cloud_test(void_after/'cliff-face.png')
        if any(i['positiveControlPixels']/i['positiveControlSize'] < .95 for i in (before_void,after_void)):
            failures.append('Magenta sky did not activate in the positive-control band')
        if after_void['innerShoreSkyPixels']>max(10,before_void['innerShoreSkyPixels']+10):
            failures.append('New voids found in the known-ground shoreline band')
        report['skyVoidProbe']={'before':before_void,'after':after_void}
    return report


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--before',type=Path,required=True);p.add_argument('--after',type=Path,required=True)
    p.add_argument('--cliff-void-before',type=Path);p.add_argument('--cliff-void-after',type=Path)
    p.add_argument('--out',type=Path,required=True)
    args=p.parse_args()
    if bool(args.cliff_void_before)!=bool(args.cliff_void_after):p.error('Both void capture directories are required together')
    report=compare(args.before,args.after,args.cliff_void_before,args.cliff_void_after)
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(report,indent=2)+'\n')
    for r in report['views']:
        print(r['view'],r['triangleCountAfter']-r['triangleCountBefore'],'additional triangles;',r['pixelsOver8RgbLevels'],'RGB changes >8')
    if report['failedGates']:raise SystemExit('\n'.join(report['failedGates']))
