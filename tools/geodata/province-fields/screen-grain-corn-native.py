"""Reproduce aggregate 2025 PEI grain-corn screening without emitting locations."""
import argparse
from collections import Counter
from hashlib import file_digest
import json
from pathlib import Path

from matplotlib.path import Path as Polygon
import numpy as np
from osgeo import gdal, ogr, osr
from scipy.ndimage import binary_erosion, label

PINS = {
    "aci_2025_pe_v1.tif": "d8538b2d567490fa66b9864cb5bb66cff45b6c8cadc654ceb191f49d04d5bd79",
    "aci_2025_pe_confidence_v1.tif": "9a44fffc81e511526dfae1f94d417c38f173ff7e38ba8767f887bcab31bb1258",
    "pe-fields-2023.gpkg": "29008797e85fd50d8a7ca8b0a796161ce49b0af4a0a2761ff70bb651cff85602",
}
CLASS = 147
CONFIDENCE = 80
STEP = 30
RESERVE = 35.0
CONNECTION = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]])


def verify_sources(source):
    for name, pin in PINS.items():
        with (source / name).open("rb") as f:
            if file_digest(f, "sha256").hexdigest() != pin:
                raise ValueError(f"source digest mismatch: {name}")


def field_centres(field, core, origin, projection, counts):
    boundary = field.GetGeometryRef()
    if not boundary or boundary.GetGeometryCount() != 1:
        counts["notSingleOriginalArea"] += 1
        return
    shell = boundary.GetGeometryRef(0)
    if shell.GetGeometryCount() != 1 or not shell.IsValid():
        counts["holesOrInvalid"] += 1
        return
    geom = shell.Clone()
    geom.Segmentize(8.0)
    geom.Transform(projection)
    ring = np.asarray(geom.GetGeometryRef(0).GetPoints(), dtype=float)[:, :2]
    if len(ring) < 4 or not np.isfinite(ring).all():
        counts["badNativeRing"] += 1
        return
    if not np.array_equal(ring[0], ring[-1]):
        raise ValueError("unclosed native source boundary")

    x0, y0 = ring.min(axis=0)
    x1, y1 = ring.max(axis=0)
    ox, oy = origin
    height, width = core.shape
    i0 = max(0, int(np.floor((x0 - ox) / STEP)))
    i1 = min(width, int(np.ceil((x1 - ox) / STEP)))
    j0 = max(0, int(np.floor((oy - y1) / STEP)))
    j1 = min(height, int(np.ceil((oy - y0) / STEP)))
    if i0 >= i1 or j0 >= j1 or not core[j0:j1, i0:i1].any():
        return
    counts["withinCropCoreBoundingBox"] += 1
    rows, cols = np.nonzero(core[j0:j1, i0:i1])
    xy = np.c_[ox + STEP * (cols + i0 + .5), oy - STEP * (rows + j0 + .5)]
    inside = Polygon(ring, closed=True).contains_points(xy)
    if not inside.any():
        return

    points = xy[inside]
    near2 = np.full(len(points), np.inf)
    for a, b in zip(ring[:-1], ring[1:]):
        segment = b - a
        length2 = segment @ segment
        if length2 > 1e-12:
            q = points - a
            t = np.clip((q @ segment) / length2, 0, 1)
            near2 = np.minimum(near2, np.sum((q - t[:, None] * segment) ** 2, axis=1))
    usable = near2 >= RESERVE**2
    if not usable.any():
        return
    rows, cols = rows[inside][usable], cols[inside][usable]
    board = np.zeros((j1 - j0, i1 - i0), dtype=bool)
    board[rows, cols] = True
    groups, total = label(board, CONNECTION)
    largest = int(np.bincount(groups[board], minlength=total + 1).max())
    return rows + j0, cols + i0, largest


def scout(source):
    verify_sources(source)
    gdal.UseExceptions()
    ogr.UseExceptions()
    osr.UseExceptions()
    crop = gdal.Open(str(source / "aci_2025_pe_v1.tif"))
    quality = gdal.Open(str(source / "aci_2025_pe_confidence_v1.tif"))
    grid = crop.GetGeoTransform()
    if grid != quality.GetGeoTransform() or grid[1:3] != (STEP, 0) or grid[4:] != (0, -STEP):
        raise ValueError("crop and confidence must use the same north-up native grid")
    kinds, confidence = crop.ReadAsArray(), quality.ReadAsArray()
    if (kinds.shape != confidence.shape or kinds.shape != (crop.RasterYSize, crop.RasterXSize)
            or not crop.GetProjection() or crop.GetProjection() != quality.GetProjection()):
        raise ValueError("crop and confidence arrays or coordinate systems are incompatible")
    confirmed = (kinds == CLASS) & (confidence >= CONFIDENCE) & (confidence <= 100)
    core = binary_erosion(confirmed, np.ones((3, 3), bool), border_value=0)
    outlines = ogr.Open(str(source / "pe-fields-2023.gpkg"), 0)
    layer = outlines.GetLayer(0)
    field_srs, raster_srs = layer.GetSpatialRef(), crop.GetSpatialRef()
    for srs in (field_srs, raster_srs):
        srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    projection = osr.CoordinateTransformation(field_srs, raster_srs)

    counts = Counter()
    claimed = np.zeros(core.shape, np.uint32)
    connected9 = 0
    for field in layer:
        counts["originalPolygons"] += 1
        support = field_centres(field, core, (grid[0], grid[3]), projection, counts)
        if support is not None:
            rows, cols, largest = support
            counts["polygonsWithStrictIndependentInterior"] += 1
            claimed[rows, cols] += 1
            connected9 += int(largest >= 9)
    return {
        "purpose": "Dated native class/outline overlap scout only, not game eligibility or current appearance.",
        "datasetYear": 2025,
        "fieldOutlinesYear": 2023,
        "classCode": CLASS,
        "minimumConfidence": CONFIDENCE,
        "nativeGridMetres": STEP,
        "nativeCoreNeighbourhood": [3, 3],
        "nativeEdgeGuardM": RESERVE,
        "nativeProjection": "Source GeoTIFF WGS 84 Albers Equal Area",
        "sourcePins": PINS,
        "confirmedCount": int(confirmed.sum()),
        "core3x3Count": int(core.sum()),
        "uniqueNativeOverlapCentres": int((claimed > 0).sum()),
        "ambiguousOriginalOverlapCentres": int((claimed > 1).sum()),
        "polygonsWithAtLeast9Connected": connected9,
        "stats": dict(counts),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True, help="new aggregate JSON file; no feature data")
    options = parser.parse_args()
    if options.out.exists():
        parser.error("--out already exists")
    receipt = scout(options.source)
    with options.out.open("x", encoding="utf-8") as output:
        json.dump(receipt, output, indent=2, sort_keys=True)
        output.write("\n")


if __name__ == "__main__":
    main()
