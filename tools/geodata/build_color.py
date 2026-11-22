#!/usr/bin/env python3
"""Rebuild the PEI color mosaic. Python deps: numpy Pillow requests rasterio.

Run with the shipped color.sources.json, the terrain manifest and an output
directory. Retains the pinned upstream GeoTIFFs in a local cache (~2.4 GB).
No Google Maps or Street View data is queried.
"""
import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image
import requests
import rasterio
from rasterio.features import rasterize
from rasterio.transform import from_bounds
from rasterio.warp import Resampling, reproject


def fetch(url, path, sha):
    if not path.exists():
        tmp = path.with_suffix(path.suffix + ".part")
        with requests.get(url, stream=True, timeout=(20, 120)) as result:
            result.raise_for_status()
            with tmp.open("wb") as stream:
                for chunk in result.iter_content(1 << 20):
                    stream.write(chunk)
        with tmp.open("rb") as stream:
            if hashlib.file_digest(stream, "sha256").hexdigest() != sha:
                raise ValueError(f"Unexpected source hash: {path.name}")
        tmp.replace(path)
    else:
        with path.open("rb") as stream:
            if hashlib.file_digest(stream, "sha256").hexdigest() != sha:
                raise ValueError(f"Unexpected cached hash: {path.name}")
    return path


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--color", type=Path, default=Path("public/world/color.sources.json"))
    cli.add_argument("--terrain", type=Path, default=Path("public/world/terrain.json"))
    cli.add_argument("--out", type=Path, default=Path("public/world/color.webp"))
    cli.add_argument("--cache", type=Path, default=Path(".data-cache/pei-color"))
    args = cli.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)

    meta = json.loads(args.color.read_text())
    mask_source = next(s for s in json.loads(args.terrain.read_text())["sources"] if s["agency"] == "Statistics Canada")
    mask = fetch(mask_source["asset"], args.cache / "pei.geojson", mask_source["sha256"])
    features = json.loads(mask.read_text())["features"]
    w, h = meta["dimensions"]
    tr = from_bounds(*meta["bounds"], w, h)
    land = rasterize([(f["geometry"], 1) for f in features], out_shape=(h,w), transform=tr).astype(bool)
    def tile(row):
        stem = row["id"]
        return (
            fetch(row["url"], args.cache / (stem + ".tif"), row["visualSha256"]),
            fetch(row["classificationUrl"], args.cache / (stem + ".scl.tif"), row["classificationSha256"]),
        )
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        imagery = list(executor.map(tile, meta["sources"]))
    out = np.zeros((3,h,w), dtype=np.uint8)
    fallback = np.zeros_like(out)
    clear = np.zeros((h,w), dtype=bool)
    covered = np.zeros_like(clear)
    for visual, classification in imagery:
        rgb = np.zeros_like(out)
        scl = np.zeros((h,w), dtype=np.uint8)
        with rasterio.open(visual) as raster:
            for i in range(3):
                reproject(rasterio.band(raster,i+1),rgb[i],src_nodata=0,dst_nodata=0,
                          dst_transform=tr,dst_crs="EPSG:4326",resampling=Resampling.bilinear,num_threads=2)
        with rasterio.open(classification) as raster:
            reproject(rasterio.band(raster,1),scl,dst_transform=tr,dst_crs="EPSG:4326",resampling=Resampling.nearest,num_threads=2)
        exists = rgb.any(axis=0)
        new = exists & ~covered
        fallback[:,new] = rgb[:,new]
        covered |= exists
        clean = exists & np.isin(scl,[4,5,6,7]) & ~clear
        out[:,clean] = rgb[:,clean]
        clear |= clean
    if (covered & land).sum() / land.sum() < .995:
        raise ValueError("Imagery no longer covers the province")
    use_fallback = land & covered & ~clear
    out[:,use_fallback] = fallback[:,use_fallback]
    out[:,~land] = np.array([26,61,62],dtype=np.uint8)[:,None]
    out[:,land & ~covered] = np.array([70,91,54],dtype=np.uint8)[:,None]
    args.out.parent.mkdir(parents=True,exist_ok=True)
    Image.fromarray(out.transpose(1,2,0)).save(args.out,quality=82,method=5)
    print(f"Covered land: {(covered&land).sum()/land.sum():.5%}; clear class: {(clear&land).sum()/land.sum():.5%}")

if __name__ == "__main__":
    main()
