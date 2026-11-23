#!/usr/bin/env python3
"""Pin a small, audited class-6/DSM cell census; do not package raw LAS or imagery."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np

ROOT=Path(__file__).resolve().parents[2]
S=ROOT/'data/roof-tiers';S.mkdir(exist_ok=True)
NAME='souris-roof-cells.i16.gz'
def sha(b):return hashlib.sha256(b).hexdigest()

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--census',type=Path,required=True,help='Reviewed NPZ with x, y, DSM, return count, class-6 p10/median/p90 in cells')
    p.add_argument('--footprint-receipt',type=Path,required=True)
    p.add_argument('--copc-receipt',type=Path,required=True)
    args=p.parse_args()
    a=np.load(args.census)['cells']
    base=json.loads(args.footprint_receipt.read_text())
    cloud,=json.loads(args.copc_receipt.read_text())
    if base['assetAtlasSHA']!='538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557' or base['sampleWindowSHA']!='eceab1515b3ce6293549895661ee4fb45f847a4beddfe6e1433ed7bccaf8af53':
        raise ValueError('Unreviewed DSM window or building atlas')
    if len(a)!=5_595 or cloud['tile']!='pei_2020_458000_699000' or cloud['classes']['6']!=42_869:
        raise ValueError('Unexpected class-6 audit or cell count')
    x,y,z,n,lo,m,hi=a.T
    ox,oy=np.floor([min(x),min(y)]).astype(int)
    arr=np.column_stack((np.floor(x)-ox,np.floor(y)-oy,
        np.rint(z*100),np.nan_to_num(n,nan=0),np.nan_to_num(np.rint(m*100),nan=-32768),
        np.nan_to_num(np.rint((hi-lo)*100),nan=-32768))).astype('<i2')
    raw=arr.tobytes();packed=bytearray(gzip.compress(raw,compresslevel=9,mtime=0));packed[9]=255
    (S/NAME).write_bytes(packed)
    manifest=dict(schema=1,title='Souris industrial building: native roof evidence',
      license='Open Government Licence – Canada',licenseURL='https://open.canada.ca/en/open-government-licence-canada',
      attribution='Contains information licensed under the Open Government Licence – Canada.',
      buildingAtlas=base['assetAtlasSHA'],tile=base['tile'],featureIndex=base['index'],sourceFootprint=base['footprint'],
      atlasHeightAGLM=base['statedMax'],atlasLowestRecordedReturnAGLM=base['statedMin'],
      dsm=dict(collection='NRCan CanElevation HRDEM Mosaic 1m',item='10_3-mosaic-1m',
        url='https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-mosaic-1m/10_3-mosaic-1m-dsm.tif',
        dtmURL='https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-mosaic-1m/10_3-mosaic-1m-dtm.tif',
        windowSha256=base['sampleWindowSHA'],minimumFootprintInteriorDistanceM=1.5),
      class6=dict(project='Prince Edward Island 2020',tile=cloud['tile'],url=cloud['url'],
        sourceHorizontalEPSG=2961,sourceURL='https://open.canada.ca/data/en/dataset/7069387e-9986-4297-9f55-0288e9676947',
        sourceBoundsXY=cloud['bounds'],class6UnwithheldUnique=cloud['classes']['6'],transferredBytes=cloud['transferredBytes'],
        requestCount=cloud['requests'],objectBytes=cloud['objectBytes']),
      grid=dict(horizontalEPSG=3979,cellMetres=1,offsetXY=[int(ox),int(oy)],centerSuffixMetres=.5),
      layout=['column','row_northward','dsm_height_cm','class6_count','class6_median_cm','class6_p90_minus_p10_cm'],
      rows=len(arr),missing=-32768,encoding='little-endian signed int16 per field, gzip',file=NAME,
      bytes=len(raw),sha256=sha(raw),compressedBytes=len(packed),compressedSha256=sha(packed))
    (S/'souris-roof-cells.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(manifest['compressedBytes'],manifest['sha256'])

if __name__=='__main__':main()
