#!/usr/bin/env python3
"""Verify pinned centimetre windows and export native cell centres in WGS84."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import struct

from osgeo import osr


def observations(manifest_path, stride):
    if not 1 <= stride <= 16:
        raise ValueError("Use a sampling stride between 1 and 16 cells.")
    spec = json.loads(manifest_path.read_text())
    grid = spec["grid"]
    if grid["horizontalCRS"] != "EPSG:3979" or grid["verticalCRS"] != "EPSG:6647":
        raise ValueError("This baseline expects the pinned horizontal and vertical datum.")
    if grid["metresPerPixel"] != [1, -1] or grid["heightScaleMetres"] != .01:
        raise ValueError("Unexpected height window encoding.")
    osr.UseExceptions()
    src = osr.SpatialReference()
    src.ImportFromEPSG(3979)
    dest = osr.SpatialReference()
    dest.ImportFromEPSG(4326)
    for crs in (src, dest):
        crs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    transform = osr.CoordinateTransformation(src, dest)
    result = []
    for w in spec["windows"]:
        cols, rows = w["cols"], w["rows"]
        path = manifest_path.parent / w["file"]
        raw = gzip.decompress(path.read_bytes())
        if len(raw) != cols*rows*2 or hashlib.sha256(raw).hexdigest() != w["sha256Decoded"]:
            raise ValueError(f"Wrong decoded bytes in {path.name}")
        left, top = w["upperLeftOuterEdgeM"]
        values = struct.unpack(f'<{cols*rows}h', raw)
        nodata = grid["noData"]
        if values.count(nodata) != w["noDataCells"]:
            raise ValueError("Wrong NoData count in pinned height window.")
        coords, heights = [], []
        # Deterministic native grid validation set; no interpolated source samples.
        for row in range(stride//2, rows, stride):
            for col in range(stride//2, cols, stride):
                h = values[row*cols+col]
                if h == nodata:
                    continue
                coords.append((left+col+.5, top-row-.5))
                heights.append(h*.01)
        result.append({"id": w["id"], "points": [
            [lon, lat, round(h, 2)]
            for (lon, lat, _), h in zip(transform.TransformPoints(coords), heights, strict=True)
        ]})
    return result


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--manifest", type=Path, default=Path("data/coastal-elevation/index.json"))
    p.add_argument("--stride", type=int, default=4)
    args = p.parse_args()
    print(json.dumps(observations(args.manifest, args.stride), separators=(",", ":")))
