#!/usr/bin/env python3
"""Audit whether one 1 m DSM ridge explains a currently flat building.

Optional engineering QA. Reads small windows of the NRCan COGs, not whole
rasters. Creates no meshes, modifies no input files, and is never used by the game.
Usage: python tools/qa/roof-fit-pilot.py --atlas public/world/buildings > pilot.json
"""
import argparse
import gzip
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from osgeo import gdal, osr

ITEM = "10_3-mosaic-1m"
ROOT = "https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-mosaic-1m"
SITES = [
    ("Prince", "Summerside", -63.790, 46.393),
    ("Prince", "Tignish", -64.033, 46.950),
    ("Queens", "Charlottetown", -63.125, 46.240),
    ("Queens", "Cavendish", -63.408, 46.483),
    ("Kings", "Georgetown", -62.535, 46.183),
    ("Kings", "Montague", -62.650, 46.166),
]


def open_models():
    gdal.UseExceptions()
    for key, value in {
        "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
        "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif",
        "GDAL_HTTP_CONNECTTIMEOUT": "10",
        "GDAL_HTTP_TIMEOUT": "30",
        "GDAL_HTTP_MAX_RETRY": "1",
        "CPL_VSIL_CURL_CACHE_SIZE": "33554432",
    }.items():
        gdal.SetConfigOption(key, value)
    dsm, dtm = [gdal.Open(f"/vsicurl/{ROOT}/{ITEM}-{kind}.tif")
                for kind in ("dsm", "dtm")]
    gt = dsm.GetGeoTransform()
    if (gt != dtm.GetGeoTransform() or gt[1:3] != (1, 0) or gt[4:] != (0, -1)
        or dsm.RasterXSize != dtm.RasterXSize or dsm.RasterYSize != dtm.RasterYSize
        or not dsm.GetSpatialRef().IsSame(dtm.GetSpatialRef())):
        raise ValueError("DSM/DTM must be co-registered north-up one-metre rasters.")
    src = osr.SpatialReference()
    src.ImportFromEPSG(4326)
    src.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    dst = dsm.GetSpatialRef()
    dst.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return dsm, dtm, gt, osr.CoordinateTransformation(src, dst)


def inside_samples(feature, dsm, dtm, gt, projection):
    ring = np.array([projection.TransformPoint(x, y)[:2] for x, y in feature["footprint"]])
    x0, y0 = int(np.floor(ring[:, 0].min() - gt[0])) - 1, int(np.floor(gt[3] - ring[:, 1].max())) - 1
    x1, y1 = int(np.ceil(ring[:, 0].max() - gt[0])) + 1, int(np.ceil(gt[3] - ring[:, 1].min())) + 1
    if not (0 <= x0 < x1 <= dsm.RasterXSize and 0 <= y0 < y1 <= dsm.RasterYSize):
        raise ValueError("Building extends outside the specified survey.")
    x, y = np.meshgrid(gt[0] + np.arange(x0, x1) + .5, gt[3] - np.arange(y0, y1) - .5)
    inside, distance = np.zeros(x.shape, dtype=bool), np.full(x.shape, np.inf)
    for a, b in zip(ring, np.roll(ring, -1, axis=0)):
        dx, dy = b - a
        if dx == dy == 0:
            continue
        if dy != 0:
            inside ^= ((a[1] > y) != (b[1] > y)) & (x < (y-a[1])*dx/dy + a[0])
        u = np.clip(((x-a[0])*dx + (y-a[1])*dy)/(dx*dx + dy*dy), 0, 1)
        distance = np.minimum(distance, np.hypot(x-a[0]-u*dx, y-a[1]-u*dy))
    dsmb, dtmb = dsm.GetRasterBand(1), dtm.GetRasterBand(1)
    surface = dsmb.ReadAsArray(x0, y0, x1-x0, y1-y0)
    ground = dtmb.ReadAsArray(x0, y0, x1-x0, y1-y0)
    # Also fingerprint window pixels outside the mask: a survey revision can be detected.
    digest = hashlib.sha256()
    for raster in (surface, ground):
        digest.update(np.ascontiguousarray(raster, dtype="<f4").tobytes())
    height = surface - ground
    ok = (inside & (distance > 1.5) & np.isfinite(surface) & np.isfinite(ground)
          & (surface != dsmb.GetNoDataValue()) & (ground != dtmb.GetNoDataValue())
          & (height > 1) & (height < 100))
    return x[ok], y[ok], surface[ok].astype(float), ring, digest.hexdigest()


def robust_fit(design, height, training):
    a, v = design[training], height[training]
    coeff = np.linalg.lstsq(a, v, rcond=None)[0]
    for _ in range(3):
        residual = abs(a@coeff-v)
        weight = np.sqrt(np.minimum(1, .35/np.maximum(.001, residual)))
        coeff = np.linalg.lstsq(a*weight[:, None], v*weight, rcond=None)[0]
    return coeff, float(np.median(abs(a@coeff-v)))


def classify(x, y, height, ring):
    def reject(reason):
        return {"exclude": reason, "n": len(height)}

    if len(height) < 48:
        return reject("too few interior pixels")
    sx, sy = x.mean(), y.mean()
    x, y, ring = x-sx, y-sy, ring-np.array([sx, sy])
    # 3 m spatial blocks; don't shuffle neighboring 1 m raster measurements.
    folds = (np.floor((x+sx)/3) + 2*np.floor((y+sy)/3)).astype(int) % 4
    edges = np.roll(ring, -1, axis=0) - ring
    angles = np.unique(np.r_[np.arange(12)*math.pi/12,
                             np.round(np.arctan2(edges[:, 1], edges[:, 0]) % math.pi, 2)])
    plane = np.column_stack([np.ones(len(height)), x, y])
    errors, selected_angles, counts = [], [], []
    for fold in range(4):
        hold = folds == fold
        train = ~hold
        if hold.sum() < 8:
            return reject("tiny fold")
        null = np.median(height[train])
        plane_coef, _ = robust_fit(plane, height, train)
        best = None
        for theta in angles:
            across = x*math.cos(theta) + y*math.sin(theta)
            observed = across[train]
            if np.ptp(observed) < 3:
                continue
            for shift in (.35, .425, .5, .575, .65):
                crest = observed.min() + shift*np.ptp(observed)
                if (observed < crest-1).sum() < 6 or (observed > crest+1).sum() < 6:
                    continue
                model = np.column_stack([np.ones(len(height)), -abs(across-crest)])
                coef, cost = robust_fit(model, height, train)
                if .12 <= coef[1] <= 1.73 and (best is None or cost < best[0]):
                    best = (cost, theta, model[hold]@coef, across[hold]-crest)
        if best is None:
            return reject("no stable ridge")
        _, theta, ridge_prediction, side = best
        errors.append(np.c_[abs(height[hold]-null), abs(height[hold]-plane[hold]@plane_coef),
                            abs(height[hold]-ridge_prediction)])
        selected_angles.append(theta)
        counts.append(min((side < -.8).sum(), (side > .8).sum()))

    errors = np.concatenate(errors)
    flat_error, plane_error, ridge_error = np.median(errors, axis=0)
    tail = np.quantile(errors[:, 2], .90)
    # Ridge directions differing by 180 degrees are equivalent.
    agreement = abs(np.mean(np.exp(2j*np.array(selected_angles))))
    side_count = int(min(counts))
    accepted = (flat_error-ridge_error >= max(.25, .25*flat_error)
                and plane_error-ridge_error >= max(.16, .25*plane_error)
                and ridge_error <= .40 and tail <= .90 and agreement > .90 and side_count >= 3)
    return {"n": len(height), "planeCVmed": round(float(plane_error), 2), "minHoldoutSide": side_count,
            "flatCVmed": round(float(flat_error), 2), "ridgeCVmed": round(float(ridge_error), 2),
            "ridgeCVp90": round(float(tail), 2), "ridgeRepeat": round(float(agreement), 2),
            "stable": bool(accepted)}


def select(index, pack, lon, lat):
    contenders = []
    approx_metres = np.array([77000, 111000])   # Candidate sampling only; never used for the fit.
    for tile in index["tiles"]:
        w, s, e, n = tile["bounds"]
        if not (w-.02 <= lon <= e+.02 and s-.02 <= lat <= n+.02):
            continue
        offset, size = tile["offset"], tile["bytes"]
        features = json.loads(gzip.decompress(pack[offset:offset+size]))["features"]
        for feat in features:
            ring = np.array(feat["footprint"])
            size = np.ptp(ring, axis=0)*approx_metres
            if not (len(ring) > 4 and not feat.get("holes") and 3 <= feat["height"] <= 15
                    and 6 <= min(size) and max(size) < 42 and feat.get("minHeight") is not None
                    and feat["height"]-feat["minHeight"] > 1.3):
                continue
            center = (ring.max(axis=0)+ring.min(axis=0))/2
            distance = np.hypot(*((center-np.array([lon, lat]))*approx_metres))
            contenders.append((distance, center, feat))
    return sorted(contenders, key=lambda item: item[0])[:4]


def self_test():
    # Independent geometries: do not need the public rasters, atlas, or a network.
    x, y = np.meshgrid(np.arange(25.) + .5, np.arange(17.) + .5)
    x, y = x.ravel(), y.ravel()
    ring = np.array([[-2., -2.], [27., -2.], [27., 19.], [-2., 19.]])
    noise = .035*np.sin(x*2.7 + y*1.1)
    def require(result, condition, label):
        if bool(result.get("stable")) != condition:
            raise AssertionError(f"{label}: {result}")
    require(classify(x, y, 12.+noise, ring), False, "flat roof")
    require(classify(x, y, 12.-.3*x+noise, ring), False, "single-pitch roof")
    require(classify(x, y, 12.-.44*abs(x-12.5)+noise, ring), True, "well-supported ridge")
    require(classify(x[:12], y[:12], noise[:12], ring), False, "undersampled")
    print("PASS: flat, single-pitch, two-pitch and undersampled controls.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--atlas", type=Path, default=Path("public/world/buildings"))
    parser.add_argument("--self-test", action="store_true", help="synthetic controls; no network required")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    index = json.loads((args.atlas/"index.json").read_text())
    pack = (args.atlas/"tiles.pack").read_bytes()
    sha = hashlib.sha256(pack).hexdigest()
    if index["sha256"] != sha:
        raise ValueError("Local building atlas hash does not match its index.")
    models = open_models()
    cases = []
    for county, place, lon, lat in SITES:
        for _, center, feat in select(index, pack, lon, lat):
            x, y, height, ring, signature = inside_samples(feat, *models)
            cases.append({"county": county, "place": place, "lon": round(float(center[0]), 6),
                          "lat": round(float(center[1]), 6), "verts": len(ring),
                          "sourceWindowSha256": signature, **classify(x, y, height, ring)})
    print(json.dumps({"atlasSha256": sha, "hrdemItem": ITEM, "cases": cases}, indent=2))


if __name__ == "__main__":
    main()
