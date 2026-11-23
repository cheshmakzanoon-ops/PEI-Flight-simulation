#!/usr/bin/env python3
"""Reproduce the Basin Head park crossing's georeference and deck fit."""
import argparse
import hashlib
import json
from pathlib import Path
import runpy
import subprocess

import numpy as np


def project(points, source, target):
    rows = ''.join(f'{a:.11f} {b:.11f}\n' for a, b in points)
    output = subprocess.check_output(
        ['gdaltransform', '-s_srs', source, '-t_srs', target], input=rows, text=True)
    return np.asarray([list(map(float, s.split()[:2])) for s in output.splitlines()])


def acquire(root, provenance):
    from laspy import CopcReader
    from laspy.copc import Bounds
    transport = runpy.run_path(str(root / 'tools/geodata/sample-montague-hall.py'))['Range']
    transport.read.__globals__.update(URL=provenance['source'], ETAG=provenance['etag'],
                                       COPC_SIZE=provenance['assetBytes'])
    source = transport()
    with CopcReader(source, close_fd=False, http_num_threads=1) as cloud:
        p = cloud.query(bounds=Bounds(*np.asarray(provenance['extent2961'])))
        valid = ~np.asarray(p.withheld).astype(bool)
        rows = np.c_[p.x, p.y, p.z, np.asarray(p.classification),
                     np.asarray(p.intensity), np.asarray(p.point_source_id)][valid]
    return rows


def fit(root, generated, cache):
    provenance = json.loads((root / 'data/basin-footbridge/native-receipt.json').read_text())
    witness = json.loads((root / 'data/odbl/basin-head-channel/footbridge-way.json').read_text())
    raw = np.load(cache)['points'] if cache and cache.exists() else acquire(root, provenance)
    assert len(raw) == provenance['rows']
    assert hashlib.sha256(raw.astype('<f8', copy=False).tobytes()).hexdigest() == provenance['cohortSha256']
    if cache and not cache.exists():
        cache.parent.mkdir(parents=True, exist_ok=True)
        np.savez_compressed(cache, points=raw)
    way = witness['way']
    nodes = [n[1:] for n in way['nodes']]
    a, b = project(nodes, 'EPSG:4326', 'EPSG:2961')
    length = np.linalg.norm(b-a)
    along = (b-a)/length
    left = np.array([-along[1], along[0]])
    actual = np.c_[(raw[:, :2]-a)@along, (raw[:, :2]-a)@left, raw[:, 2:]]
    admitted = ((actual[:, 3] == 17) & (actual[:, 0] > 6.6) & (actual[:, 0] < 16.9) &
                (actual[:, 1] > -2.) & (actual[:, 1] < .8))
    station, cross, height = actual[admitted, :3].T
    hold = (np.floor(station)*7 + np.floor((cross+4)*.9)*11 + 4) % 5 == 0
    u = (station-11.75)/5
    matrix = np.column_stack([u**k for k in range(5)] + [cross])
    p = np.linalg.lstsq(matrix[~hold], height[~hold], rcond=None)[0]
    for _ in range(4):
        weight = 1/np.sqrt(np.maximum(.03, np.abs(height - matrix@p)[~hold]))
        p = np.linalg.lstsq(matrix[~hold]*weight[:, None], height[~hold]*weight, rcond=None)[0]
    err = np.abs(matrix[hold]@p - height[hold])
    assert (int(hold.sum()),len(station)) == (36,172)
    assert np.quantile(err,.90)<.029 and max(err)<.050
    geo = project([a, b, a+left, b+left], 'EPSG:2961','EPSG:4326').tolist()
    plan = dict(id='basin-head-park-footbridge',osmWay=way['id'],routeNodes=nodes,
                frameLonLat=geo,sourceLength=length,spanS=[6.55,16.9],
                axisCentre=-.66,trackSlope=.035,trackStation=11.7,halfDeckWidth=1.13,
                polynomialS0=11.75,polynomialDivisor=5.,heightCoefficients=p.tolist(),railHeight=1.04)
    generated.write_text('// Exact EPSG:2961 projected frame; the profile uses held-out-checked PEI 2020 LiDAR.\n'
                         'export const BASIN_FOOTBRIDGE='+json.dumps(plan,indent=2)+' as const;\n')
    print(json.dumps(dict(deckReturns=len(station),holdout=len(err),analyticP90=float(np.quantile(err,.9)),
                          largest=float(max(err)),mappedSourceLength=float(length)),indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--generated', type=Path, required=True)
    parser.add_argument('--native-window', type=Path)
    args = parser.parse_args()
    fit(args.root, args.generated, args.native_window)
