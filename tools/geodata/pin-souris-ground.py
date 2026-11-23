#!/usr/bin/env python3
"""Pin exact local class-2 intensity medians from one open 2020 survey strip.
Only qualifying one-metre ground-cell counts and uncalibrated intensities survive;
this is not RGB or a material/ownership survey.
"""
import argparse,gzip,hashlib,json,math
from pathlib import Path
import numpy as np
from osgeo import osr

osr.UseExceptions()
ROOT=Path(__file__).resolve().parents[2]
P=ROOT/'data/roof-tiers'
sha=lambda b:hashlib.sha256(b).hexdigest()
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--points',required=True,type=Path,help='Audited NPZ points with X,Y,Z,class,withheld,intensity,source ID,scan angle')
    parser.add_argument('--receipt',required=True,type=Path)
    args=parser.parse_args()
    receipt,=json.loads(args.receipt.read_text())
    f=json.loads((P/'souris-roof-cells.json').read_text())
    if receipt['tile']!=f['class6']['tile'] or receipt['classes']['2']!=141_398:raise ValueError('Unreviewed ground survey extent')
    pts=np.load(args.points)['points']
    points=pts[(pts[:,3]==2)&(pts[:,4]==0)]
    track=np.unique(points[:,6])
    if len(points)!=141_398 or track.tolist()!=[60611.]:raise ValueError('Ground census is not one reviewed survey strip')
    A,B=osr.SpatialReference(),osr.SpatialReference();A.ImportFromEPSG(2961);B.ImportFromEPSG(4326)
    for ref in (A,B):ref.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    to_wgs=osr.CoordinateTransformation(A,B)
    values=np.asarray(to_wgs.TransformPoints(points[:,:2].tolist()))[:,:2]
    phi,rad=46.5*math.pi/180,math.pi/180;f0=1-.00669437999014*math.sin(phi)**2
    mul=[6378137*rad*math.cos(phi)/math.sqrt(f0),-6378137*rad*(1-.00669437999014)/f0**1.5]
    def world(ll):return (np.asarray(ll)-[-63.2,46.5])*mul
    xz=world(values);outline=world(f['sourceFootprint'])
    origin=np.floor(outline.min(axis=0)-35).astype(int)
    extent=np.ceil(outline.max(axis=0)+35).astype(int)-origin
    width,height=map(int,extent)
    g={}
    for (x,z),i in zip(np.floor(xz-origin).astype(int),points[:,5],strict=True):
        if 0<=x<width and 0<=z<height:g.setdefault((x,z),[]).append(i)
    data=np.zeros((height,width,2),dtype='<u2')
    for (x,z),v in g.items():
        if len(v)>=3:data[z,x]=[round(np.median(v)),len(v)]
    raw=data.tobytes();blob=bytearray(gzip.compress(raw,compresslevel=9,mtime=0));blob[9]=255
    name='souris-ground-strip.u16.gz';(P/name).write_bytes(blob)
    mm=data[:,:,0]>0
    out=dict(schema=1,file=name,title='Souris class-2 one-metre relative intensity observations',
      license='Open Government Licence – Canada',licenseURL='https://open.canada.ca/en/open-government-licence-canada',
      sourceURL=receipt['url'],tile=receipt['tile'],quotedSourceTrack=60611,groundPoints=len(points),sourceBoundsXY=receipt['bounds'],
      sourceHorizontalEPSG=2961,rangeRequests=receipt['requests'],rangeBytes=receipt['transferredBytes'],
      note='Intensity is uncalibrated and only used for bounded relative contrast within the same survey strip, not RGB/pavement classification.',
      grid=dict(leftTopXZ=origin.tolist(),width=width,height=height,cellMetres=1,sourceMinimumReturns=3,
        layout='Little-endian uint16: class-2 median raw intensity, number of contributing points; 0,0 for unsupported cell'),
      keptCells=int(mm.sum()),sha256=sha(raw),compressedSha256=sha(blob),bytes=len(raw),compressedBytes=len(blob))
    (P/'souris-ground-strip.json').write_text(json.dumps(out,indent=2)+'\n')
    print(out['keptCells'],len(blob),out['sha256'])
if __name__=='__main__':main()
