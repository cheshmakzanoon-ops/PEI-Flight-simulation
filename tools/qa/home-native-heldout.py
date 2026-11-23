#!/usr/bin/env python3
"""Independent reconstruction of recorded native 1 m 2020 DSM holdout blocks.
No imports from fitter; source arrays/ordered survey outline are read only.
"""
from collections import Counter
from pathlib import Path
from hashlib import sha256
from osgeo import osr
import argparse, json, numpy as np
osr.UseExceptions()
P=argparse.ArgumentParser(description=__doc__)
P.add_argument('--scratch',type=Path,required=True)
P.add_argument('--out',type=Path,required=True)
A=P.parse_args();raw=A.scratch
shapes = {f'{r["tile"]}_{r["i"]}':r for r in json.loads((raw/'residential-shapes.json').read_text())}
accepted = {f'{r["tile"]}_{r["i"]}':r for r in json.loads((raw/'rendered-house-targets.json').read_text())}
assert accepted.keys() <= shapes.keys()
sr=[]
for epsg in (3979,4326):
    s=osr.SpatialReference();s.ImportFromEPSG(epsg);s.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);sr.append(s)
transform = osr.CoordinateTransformation(*sr)
reverse=osr.CoordinateTransformation(*sr[::-1])
seen=set()
rows=[]
for path in sorted((raw/'windows').glob('group-*.npz')):
    with np.load(path,allow_pickle=False) as f:
        for key in sorted(k.removesuffix('_origin') for k in f.files if k.endswith('_origin')):
            if key not in accepted:continue
            assert key not in seen;seen.add(key)
            c=shapes[key]
            dsm,dtm,org=(f[key+'_'+label] for label in ('surface','ground','origin'))
            src=sha256(dsm.astype('<f4').tobytes()+dtm.astype('<f4').tobytes()).hexdigest()
            assert src==c['windowSHA']==accepted[key]['hash'],(key,src,c['windowSHA'],accepted[key]['hash'])
            ring=np.asarray(reverse.TransformPoints(c['fp']))[:,:2]
            assert np.max(np.abs(ring-np.asarray(c['survey'])))<.00003
            points=np.array([(org[0]+col,org[1]-row) for row,col in np.ndindex(dsm.shape)])
            # Reference plan is simple by original footprint certificate, signed ray parity uses clockwise crossing in x direction.
            dx,dy=(np.roll(ring,-1,axis=0)-ring).T
            rx,ry=(points[:,None,:]-ring[None,:,:]).transpose(2,0,1)
            with np.errstate(divide='ignore',invalid='ignore'):
                crossing=(np.signbit(rx)!=np.signbit(rx-dx))&(ry<dy*rx/dx)
                frac=np.clip((rx*dx+ry*dy)/(dx*dx+dy*dy),0,1)
            inside=crossing.sum(axis=1)%2==1
            distance2=np.min((rx-dx*frac)**2+(ry-dy*frac)**2,axis=1)
            d=dsm.ravel().astype(float);g=dtm.ravel().astype(float);h=d-g
            support=inside&(distance2>=(.99 if c['width']<=9 else 1.20)**2)&np.isfinite(d)&np.isfinite(g)&(d>-200)&(g>-200)&(h>1)&(h<25)
            # Holdout is published in fitting recipe: population partly selected by this gate.
            ids=np.floor(points/2.5).astype(np.int64)
            held=support&((ids@np.array([7,3])+1)%5==0)
            assert support.sum()==c['n'] and held.sum()==c['nHold']==accepted[key]['hold'],(key,support.sum(),c['n'],held.sum(),c['nHold'])
            xp,yp=(ring.mean(axis=0)-org)*[1,-1]
            ix,iy=(np.floor([xp,yp])).astype(int);wx,wy=xp-ix,yp-iy
            datum=float(dtm[iy,ix]*(1-wx)*(1-wy)+dtm[iy,ix+1]*wx*(1-wy)+dtm[iy+1,ix]*(1-wx)*wy+dtm[iy+1,ix+1]*wx*wy)
            assert abs(datum-c['datum'])<.00000005
            lonlats=np.array(transform.TransformPoints(points[held].tolist()))[:,:2]
            cells=np.c_[lonlats.round(10),d[held].round(7)].tolist()
            rows.append(dict(tile=c['tile'],i=c['i'],footprint=c['fp'],kind=c['kind'],county=c['county'],p90=c['p90'],oldP90=c['olderP90'],expectedDatum=datum,points=cells))
assert len(rows)==len(accepted)
print('Reconstructed',sum(len(r['points']) for r in rows),'nontraining native cells across',len(rows),'buildings.',Counter(r['county'] for r in rows))
A.out.write_text(json.dumps(rows,separators=(',',':'))+'\n')
