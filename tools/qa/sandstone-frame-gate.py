#!/usr/bin/env python3
"""Validate a material-only canyon patch in fixed, texture-complete simulator frames.

These difference checks detect bleeding into the sea/sky/grass and art regressions
outside East Point. The local ROI statistics are not photometric calibration to
a photograph: real light, weather, tone mapping, lens, and time of day differ.
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image

REGIONS={
 'cliff-face':{'rock':(315,287,680,397),'sea':(490,495,970,620),'sky':(115,26,920,80)},
 'cliff-reveal':{'rock':(420,264,790,378),'sea':(490,530,935,620),'grassCap':(585,202,690,230)},
 'west-control':{'offsite':(0,0,1024,640)},
}


def rgb(path):
    with Image.open(path) as im: a=np.asarray(im.convert('RGB'),dtype=np.int16)
    if a.shape!=(640,1024,3):raise ValueError(f'Bad shape for capture: {a.shape}')
    return a


def stripe_profile(image):
    # Fixed rock image strips; estimate coherent horizontal bands. Remove an
    # 11-pixel local lighting trend before Hann-window spectral power.
    out=[]
    lum=image.mean(axis=2)
    for left,right in ((370,650),(520,880),(620,960)):
        row=lum[284:394,left:right].mean(axis=1)
        trend=np.convolve(np.pad(row,(5,5),mode='edge'),np.ones(11)/11,mode='valid')
        energy=np.abs(np.fft.rfft((row-trend)*np.hanning(row.size)))**2
        lo,hi=int(row.size/15),int(row.size/3.5)
        d=energy[lo:hi]
        peak=int(d.argmax())
        out.append({'roi':[left,284,right,394],
          'dominantPeriodPx':round(row.size/(lo+peak),4),
          'peakPowerFraction':round(float(d[peak]/max(d.sum(),1e-9)),5),
          'bandResidualRms':round(float(np.std(row-trend)),5)})
    return out


def report(before,after,west):
    data=lambda p:{r['view']:r for r in json.loads((p/'report.json').read_text())}
    a,b=data(before),data(after)
    a.update(data(west))
    errors=[];details=[]
    for view,regions in REGIONS.items():
        l,r=a[view],b[view]
        sa,sb=l['diagnostics'],r['diagnostics']
        if r['pose']!=l['pose'] or sa['tex']!=sb['tex'] or sa['tex']['expected']!=sa['tex']['ready']:
            raise RuntimeError(f'Mismatched camera or imagery: {view}')
        if any(sa[k]!=sb[k] for k in ['drawn','calls','total']):
            errors.append(f'{view}: a material-only change added/removed visible geometry')
        old=rgb((west if view=='west-control' else before)/(view+'.png'));new=rgb(after/(view+'.png'))
        groups={}
        for name,rect in regions.items():
            x0,y0,x1,y1=rect
            p=old[y0:y1,x0:x1];q=new[y0:y1,x0:x1]
            d=np.max(np.abs(q-p),axis=-1)
            changed=int((d>4).sum());total=d.size
            light=lambda z:float(np.median(z.mean(axis=2)))
            ycolor=lambda z:float(np.median((z[:,:,0]-z[:,:,1])-(z[:,:,1]-z[:,:,2]))) # distinguish red-brown from yellow tan
            shift=ycolor(q)-ycolor(p)
            if name=='rock':
                if changed/total<.09:errors.append(f'{view}: no substantive rock material change in visible face ROI')
                if shift<2:errors.append(f'{view}: target remained predominantly yellow-tan instead of red-brown')
                if np.percentile(q[:,:,0],99)>239:errors.append(f'{view}: clipped/near-neon reds in cliff ROI')
            elif changed/max(total,1)>.0005:errors.append(f'{view}: material spread into {name}')
            groups[name]={'roi':rect,'pixels':total,'pixelsOver4Levels':changed,'maxChannelDifference':int(d.max()),
                          'medianBrightnessBefore':round(light(p),3),'medianBrightnessAfter':round(light(q),3),
                          'medianRedVsYellowBefore':ycolor(p),'medianRedVsYellowAfter':ycolor(q)}
        strips={}
        if view=='cliff-face':
            strips={'before':stripe_profile(old),'after':stripe_profile(new)}
            if max(o['peakPowerFraction'] for o in strips['after'])>.31:
                errors.append('cliff-face: excessively coherent repeating row stripes')
        details.append({'pose':view,'sameGeometry':sa['drawn']==sb['drawn'],
                        'submittedTriangles':sb['total'],'drawCalls':sb['calls'],'regions':groups,
                        **({'stripeProfiles':strips} if strips else {})})
    return {'schema':1,'measure':'These matched-render controls detect color localization, not photorealism.',
            'views':details,'failedGates':errors}


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--before',type=Path,required=True)
    p.add_argument('--west-before',type=Path,required=True)
    p.add_argument('--after',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    a=p.parse_args();result=report(a.before,a.after,a.west_before)
    a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(result,indent=2)+'\n')
    if result['failedGates']:raise SystemExit('\n'.join(result['failedGates']))
