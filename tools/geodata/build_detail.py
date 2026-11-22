#!/usr/bin/env python3
"""Build province-wide 10 m ground colour tiles from the pinned Sentinel sources.

First run build_color.py with the same cache. Derived textures are bundled in
bounded packs so hosts with HTTP Range can stream only the requested WebP tile.
Requires rasterio, Pillow, numpy, and requests.
"""
import argparse
from contextlib import ExitStack
import hashlib
import io
import json
from pathlib import Path

import numpy as np
from PIL import Image
import rasterio
from rasterio.features import rasterize
from rasterio.transform import from_bounds
from rasterio.vrt import WarpedVRT
from rasterio.warp import Resampling, transform_bounds
from rasterio.windows import Window, bounds, transform

COLS,ROWS,SIZE=32,22,640
MAX_PACK=1_500_000
def sha(data): return hashlib.sha256(data).hexdigest()

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--cache',type=Path,default=Path('.data-cache/pei-color'))
    p.add_argument('--manifest',type=Path,default=Path('public/world/color.sources.json'))
    p.add_argument('--out',type=Path,default=Path('public/world/detail'))
    args=p.parse_args()
    m=json.loads(args.manifest.read_text())
    gs=json.loads((args.cache/'pei.geojson').read_text())['features']
    whole=from_bounds(*m['bounds'],COLS*SIZE,ROWS*SIZE)
    args.out.mkdir(parents=True,exist_ok=True)
    pack=bytearray(); packs=[]; index={}; land_px=clear_px=valid_px=0
    def flush():
        if not pack: return
        name=f'sentinel-{len(packs):02d}.pack'
        (args.out/name).write_bytes(pack)
        packs.append(dict(file=name,bytes=len(pack),sha256=sha(pack)))
        pack.clear()

    with ExitStack() as stack:
        pairs=[]
        for row in m['sources']:
            stem=row['id']
            vis=stack.enter_context(rasterio.open(args.cache/(stem+'.tif')))
            scl=stack.enter_context(rasterio.open(args.cache/(stem+'.scl.tif')))
            vrt=dict(crs='EPSG:4326',transform=whole,width=COLS*SIZE,height=ROWS*SIZE,nodata=0,warp_mem_limit=48)
            zone=transform_bounds(vis.crs,'EPSG:4326',*vis.bounds)
            pairs.append((zone,stack.enter_context(WarpedVRT(vis,**vrt,resampling=Resampling.bilinear)),
                               stack.enter_context(WarpedVRT(scl,**vrt,resampling=Resampling.nearest))))
        low=rasterize([(f['geometry'],1) for f in gs],out_shape=(ROWS*48,COLS*48),
                      transform=from_bounds(*m['bounds'],COLS*48,ROWS*48), all_touched=True)
        for j in range(ROWS):
            for i in range(COLS):
                if not low[j*48:(j+1)*48,i*48:(i+1)*48].any(): continue
                win=Window(i*SIZE,j*SIZE,SIZE,SIZE)
                land=rasterize([(f['geometry'],1) for f in gs],out_shape=(SIZE,SIZE),
                               transform=transform(win,whole)).astype(bool)
                if not land.any(): continue
                w,s,e,n=bounds(win,whole)
                out=np.zeros((3,SIZE,SIZE),dtype=np.uint8)
                fallback=np.zeros_like(out)
                clear=np.zeros((SIZE,SIZE),dtype=bool)
                valid=np.zeros_like(clear)
                for (vw,vs,ve,vn),rgb,classes in pairs:
                    if ve<w or vw>e or vn<s or vs>n: continue
                    pix=rgb.read([1,2,3],window=win)
                    exists=pix.any(axis=0) & land
                    new=exists & ~valid
                    fallback[:,new]=pix[:,new]
                    valid |= exists
                    classified=classes.read(1,window=win)
                    ok=exists & np.isin(classified,[4,5,6,7]) & ~clear
                    out[:,ok]=pix[:,ok]
                    clear |= ok
                    if np.array_equal(clear,land): break
                patch=valid & ~clear
                out[:,patch]=fallback[:,patch]
                out[:,land & ~valid]=np.array([70,91,54],dtype=np.uint8)[:,None]
                out[:,~land]=np.array([26,61,62],dtype=np.uint8)[:,None]
                land_px+=int(land.sum()); valid_px+=int(valid.sum()); clear_px+=int(clear.sum())
                temp=io.BytesIO()
                Image.fromarray(out.transpose(1,2,0)).save(temp,format='WEBP',quality=76,method=4)
                data=temp.getvalue()
                if len(pack)+len(data)>MAX_PACK: flush()
                index[f'{i}-{j}']=dict(pack=len(packs),offset=len(pack),bytes=len(data),sha256=sha(data))
                pack.extend(data)
            print(f'row {j+1}/{ROWS}, {len(index)} land tiles',flush=True)
        flush()
    if not land_px or valid_px/land_px<.995:
        raise ValueError("Detail imagery does not cover PEI land")
    meta=dict(version=1,bounds=m['bounds'],columns=COLS,rows=ROWS,tilePixels=SIZE,
              packs=packs,tiles=index,landPixels=land_px,landCoverage=valid_px/land_px,
              clearClassCoverage=clear_px/land_px,attribution='Contains modified Copernicus Sentinel data 2025.',
              sourceManifest='../color.sources.json')
    (args.out/'index.json').write_text(json.dumps(meta,indent=2)+'\n')
    print(f'{len(index)} tiles in {len(packs)} packs, {sum(x["bytes"] for x in packs):,} bytes; {valid_px/land_px:.5%} land coverage')
if __name__=='__main__': main()
