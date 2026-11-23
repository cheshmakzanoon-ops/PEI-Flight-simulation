#!/usr/bin/env python3
"""Pin the audited East Point native-ground cohort as portable 1 m cell statistics.

Usage: /usr/bin/python3 tools/terrain/pin-east-bench.py DIR_WITH_PROBE_NPZ_FILES
The offline COPC query can be reproduced from the exact tile URL, bounds and
CRS in the resulting manifest. No photograph or server is contacted here.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np

ROOT=Path(__file__).resolve().parents[2]
TILE='pei_2020_478000_711000'
PROJECT='Prince_Edward_Island_2020'
BASE='https://canelevation-lidar-point-clouds.s3.ca-central-1.amazonaws.com/pointclouds_nuagespoints/PEI'
def pin(folder):
    probe=folder/f'{TILE}-case-0.npz';cohort=folder/'bench-cells.npz'
    with np.load(probe) as archive: returns=archive['points']
    with np.load(cohort) as archive: selected=archive['group']
    if len(returns)!=8933 or len(selected)!=207:raise ValueError('Unexpected points or cohort in the audited window')
    data={};classes={}
    for e,n,h,c in returns:
        cell=(int(np.floor(e)),int(np.floor(n)))
        if c==2:data.setdefault(cell,[]).append(float(h))
        if c==9:classes[cell]=classes.get(cell,0)+1
    origin=np.min(selected,axis=0)
    cells=[]
    for e,n in sorted(selected.tolist(),key=lambda p:(p[1],p[0])):
        points=data[(e,n)]
        cells.append([int(e-origin[0]),int(n-origin[1]),len(points),round(float(np.median(points)),4),classes.get((e,n),0)])
    payload={
      'schema':1,'site':'East Point, Prince Edward Island','window':'South inner tidal bench',
      'publisher':'Natural Resources Canada, CanElevation LiDAR Point Clouds',
      'catalogue':'https://open.canada.ca/data/en/dataset/7069387e-9986-4297-9f55-0288e9676947',
      'project':PROJECT,'tile':TILE,'copcURL':f'{BASE}/{PROJECT}/{TILE}.copc.laz',
      'license':'Open Government Licence – Canada','licenseURL':'https://open.canada.ca/en/open-government-licence-canada',
      'attribution':'Contains information licensed under the Open Government Licence – Canada.',
      'horizontalCRS':'EPSG:2961','dataNotes':'Stored raw LAS heights are only compared relatively against the pinned DTM; no marine datum conversion or water level is implied.',
      'queryBoundsM':[578935.365005091,5144699.41354374,578971.365005091,5144735.41354374],
      'queryPoints':len(returns),'selectedGroundCells':len(cells),
      'sourceProbeSHA256':hashlib.sha256(probe.read_bytes()).hexdigest(),
      'supportSelectionSHA256':hashlib.sha256(cohort.read_bytes()).hexdigest(),
      'originM':origin.tolist(),'cellSizeM':1,
      'columns':['easting offset m','northing offset m','ASPRS class 2 return count','median raw height m','ASPRS class 9 return count'],
      'cells':cells}
    (ROOT/'data/coastal-bench/east-point-source.json').write_text(json.dumps(payload,indent=2)+'\n')
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('source',type=Path)
    pin(p.parse_args().source)
