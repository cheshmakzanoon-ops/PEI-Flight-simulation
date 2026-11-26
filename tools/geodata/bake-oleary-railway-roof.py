#!/usr/bin/env python3
"""Rebuild the measured stepped roof for one exact atlas row.

The adjacent raised section is a continuous lower envelope of four planes.
A separate lower roof plane owns the rest of the inherited building plan.
The optimizer sees only ground data and training roof cells.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import runpy

import numpy as np
from scipy.optimize import least_squares


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root', type=Path, required=True)
    p.add_argument('--scratch', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    cfg = p.parse_args()
    common = runpy.run_path(str(cfg.root / 'tools/geodata/fit-farm-profiles.py'))
    plans = json.loads((cfg.scratch / 'sample-plan.json').read_text())
    assert len(plans) == 1
    c = plans[0]
    assert (c['tile'], c['i']) == ('q20213', 47)
    key = 'q20213_47'
    paths = sorted(cfg.scratch.glob('windows/group-*.npz'))
    assert len(paths) == 1
    with np.load(paths[0], allow_pickle=False) as raw:
        surface, ground, origin = (raw[f'{key}_{s}'] for s in ('surface', 'ground', 'origin'))
    yy, xx = np.indices(surface.shape)
    xx, yy = origin[0] + xx, origin[1] - yy
    inside, margin = common['mask_unit'](np.asarray(c['survey']), xx, yy)
    roof_samples = (inside & (margin >= 1.15) & np.isfinite(surface) & np.isfinite(ground)
                    & (surface - ground > 1) & (surface - ground < 25) & (ground > 0))
    survey = np.c_[xx[roof_samples], yy[roof_samples]]
    block = np.floor_divide(survey, 4).astype(int)
    training = (block[:, 0] * 7 + block[:, 1] * 3 + 2) % 6 != 0
    x, y = np.asarray(c['xy']) - origin
    y = -y
    i, j = math.floor(x), math.floor(y)
    a, b = x - i, y - j
    datum = float(np.einsum('j,i,ji', np.array([1 - b, b]), np.array([1 - a, a]), ground[j:j+2, i:i+2]))
    ll = np.asarray(common['Tback']().TransformPoints(survey[training].tolist()))[:, :2]
    xy = (ll - common['origin']) * common['scale'] - c['world']
    h = surface[roof_samples][training] - datum
    assert len(h) == 1459
    mat = np.c_[np.ones(len(xy)), xy]
    u = np.array(c['axis'])
    v = np.array([-u[1], u[0]])
    s, t = xy @ u, xy @ v
    low, high = float(np.quantile(h, .17)), float(np.quantile(h, .89))
    sa, sb = np.quantile(s, [.04, .96])
    ta, tb = np.quantile(t, [.04, .96])
    high_samples = h > np.quantile(h, .79)
    sc, tc = np.median(s[high_samples]), np.median(t[high_samples])
    init = np.array([low, high, sc, tc, .95, .75, .9, .85])
    lower = [low-1.1, high-.5, sa, ta, .13, .13, .13, .13]
    upper = [low+.9, high+1.4, sb, tb, 1.75, 1.75, 1.75, 1.75]

    def roof(p):
        l, h, x, z, a, b, d, e = p
        return [[[l, 0, 0]], [[h-a*x, *(a*u)], [h+b*x, *(-b*u)], [h-d*z, *(d*v)], [h+e*z, *(-e*v)]]]

    def error(fit):
        parts = np.array([np.min(mat @ np.array(branch).T, axis=1) for branch in roof(fit)])
        return np.max(parts, axis=0) - h

    fits = []
    for delta in (0, .25, -.15):
        start = init.copy()
        start[1] += delta
        start = np.clip(start, np.array(lower)+1e-5, np.array(upper)-1e-5)
        model = least_squares(error, start, bounds=(lower, upper), loss='soft_l1', f_scale=.24, max_nfev=120)
        e = np.abs(error(model.x))
        fits.append((.48 * np.quantile(e, .5) + .52 * np.quantile(e, .9), model.x))
    coefficients = roof(min(fits, key=lambda item: item[0])[1])
    ring = [round(point * 1e6) for xy in c['fp'] for point in xy]
    data = [[47, ring, round(datum * 1000),
             [[[round(z * 1000), round(x * 1e6), round(y * 1e6)] for z, x, y in group] for group in coefficients]]]
    dest = '// Measured roof envelopes; CGVD2013 base heights, centre-relative horizontal axes.\n'
    dest += 'export const OLEARY_COMPOUND_ROOFS=' + json.dumps(data, separators=(',', ':')) + ' as const;\n'
    cfg.out.write_text(dest)
    print('Source surface/ground SHA-256:', common['fprint'](surface, ground))
    print('Generated TypeScript SHA-256:', hashlib.sha256(dest.encode()).hexdigest())


if __name__ == '__main__':
    main()
