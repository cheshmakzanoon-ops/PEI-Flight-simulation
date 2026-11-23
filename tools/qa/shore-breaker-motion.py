#!/usr/bin/env python3
"""Read advancing crest distances from the actual temporary browser shader."""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image

CLOCKS = (12., 12.4, 12.8, 13.2)

def peaks(rgb, y):
    r, g, b = rgb[y].T
    ok = (b == 255) & (g >= 6) & (g <= 200) & (r >= 35)
    # Collapse each continuous crest lobe to the weighted centre of its highest
    # response. Do not choose a nearby candidate based on its motion direction.
    ids = np.flatnonzero(ok)
    result = []
    for run in np.split(ids, np.flatnonzero(np.diff(ids) > 1)+1):
        if len(run) < 3:
            continue
        strong = run[r[run] >= .80*np.max(r[run])]
        values = g[strong]*40./255.
        if np.ptp(values) > 2.4:
            continue
        result.append((float(np.mean(strong)), float(np.mean(values))))
    return result

def measure(root, name):
    arrays = []
    for phase in CLOCKS:
        with Image.open(root/f'{name}-{phase:g}.png') as frame:
            arrays.append(np.asarray(frame.convert('RGB'),dtype=np.int16))
    reports = []
    h,w = arrays[0].shape[:2]
    for y in range(round(h*.48),round(h*.95),17):
        each = [peaks(rgb,y) for rgb in arrays]
        for x,d in each[0]:
            if not 14<x<w-14 or not 2.4<d<28:
                continue
            track=[(x,d)]
            for candidates in each[1:]:
                x0,d0=track[-1]
                usable=[v for v in candidates if abs(v[0]-x0)<w*.06 and abs(v[1]-d0)<2.9]
                if not usable:
                    break
                track.append(min(usable,key=lambda v:abs(v[1]-d0)))
            if len(track)!=len(CLOCKS):
                continue
            delta=track[-1][1]-track[0][1]
            reports.append(dict(row=y,startPixel=round(x,2),
                                proxyMetres=[round(v[1],3) for v in track],
                                signedChange=round(delta,3)))
    shifts=np.array([row['signedChange'] for row in reports])
    if len(set(row['row'] for row in reports))<4:
        raise ValueError(f'{name}: fewer than four trackable screen transects')
    median=float(np.median(shifts));toward=float(np.mean(shifts<-.3))
    if median>=-.65 or toward<.75:
        raise ValueError(f'{name}: crest travel not shoreward (median {median:.3f}, fraction {toward:.3f})')
    return dict(view=name,clock=CLOCKS,tracked=len(shifts),medianChangeM=round(median,3),
                fractionToward=round(toward,3),tracks=reports)

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--capture',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--views',default='east-close,west-close')
    args=p.parse_args()
    data=[measure(args.capture,v) for v in args.views.split(',')]
    args.out.write_text(json.dumps(data,indent=2)+'\n')
    for row in data:
        print(row['view'],row['tracked'],row['medianChangeM'],row['fractionToward'])
