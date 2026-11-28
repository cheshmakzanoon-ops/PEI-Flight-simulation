"""Select the actual NW Cavendish overlap from the two dated Parks Canada datasets.

Uses the original source coordinates and reports the WGS84 conversion separately.
A dated transect point is not evidence of a current shore, color or elevation.
"""
import argparse
from collections import Counter
import csv
from hashlib import sha256
import json
import math
import os
from pathlib import Path
import subprocess

BBOX = (-63.458, 46.474, -63.398, 46.513)
SOURCE_PACKAGE = "12e17685-405d-4f7e-8c46-404323daf70d"
RESOURCE = {
    "ground": ("922a4f59-0e48-4fca-a8a1-fc326aef0f62", "097f60f49446bfd6e416ea7c0bb43eea620ba8b4e517db02aaa628b6c607064a"),
    "remote": ("bb427057-8e4a-48f8-937c-fca6bfe5ead1", "40f5652d83aa8c5ad0bb4e6c644a44f7eb38a465c067a3c562916c4a07dcde2b"),
    "dictionary": ("ded19511-30b3-47fd-8d55-d4ae7baf1ed7", "cbde973215ffafb2238c8b67e68c4f36e9d71c8840f6891403c22ff8dfcd26d0"),
}

def read_source(path, key):
    if sha256(path.read_bytes()).hexdigest() != RESOURCE[key][1]:
        raise ValueError("Unexpected Parks Canada " + key + " bytes")
    with path.open(newline="", encoding="cp1252") as f:
        return list(csv.reader(f))

def ground(row):
    mat, site, year, ordinal, crs, e, n, observer = row
    return mat, site, int(year), int(ordinal), crs, e, n, observer, None

def remote(row):
    place, mat, y1, y2, crs, *_ = row
    obj, transect, day = row[10:13]
    if not day and obj == transect == "0" and row[13:] == ["0"] * 9:
        return None  # Explicit no-intersection placeholder; there is no point here.
    parts = day.split("/")
    if len(parts) != 3 or len(parts[2]) != 4 or not 1 <= int(parts[0]) <= 12 or not 1 <= int(parts[1]) <= 31:
        raise ValueError("Unexpected dates in Parks Canada remote source")
    year = int(parts[2])
    if year not in (int(y1), int(y2)) or int(obj) <= 0 or int(transect) < 0:
        raise ValueError("Unexpected survey period or index")
    return mat, transect, year, int(obj), crs, row[14], row[15], place, int(y2)-int(y1)

def normalize(rows, name):
    parser = ground if name == "ground" else remote
    selected = []
    skipped = 0
    for line, row in enumerate(rows, start=3):
        v = parser(row)
        if v is None:
            skipped += 1
            continue
        mat, site, year, ordinal, crs, x, y, observer, interval = v
        if (mat not in ("Till", "Sandstone") or not site or
                crs.casefold() != "nad83 csrs pei double stereographic" or
                not 300000 < float(x) < 490000 or not 650000 < float(y) < 780000):
            raise ValueError("Unexpected coordinate, class, or projection at " + str(line))
        selected.append((line, mat, site, year, ordinal, x, y, observer, interval))
    coords = "".join(f"{r[5]} {r[6]}\n" for r in selected)
    run = subprocess.run(["gdaltransform", "-s_srs", "EPSG:2954", "-t_srs", "EPSG:4326"],
                         check=True, input=coords, text=True, capture_output=True,
                         env={**os.environ, "PROJ_NETWORK": "OFF"})
    out = []
    regional = Counter()
    for r, p in zip(selected, run.stdout.splitlines(), strict=True):
        lon, lat, _z = map(float, p.split())
        if not math.isfinite(lon + lat) or not (-65 < lon < -61 and 45 < lat < 48):
            raise ValueError("Converted point lies outside conservative PEI bounds")
        line, mat, site, year, ordinal, x, y, observer, interval = r
        regional[f"{observer}/{mat}"] += 1
        if BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]:
            out.append({"csvLine": line, "substrate": mat, "transect": site, "year": year, "sample": ordinal,
                        "originalEN": [x, y], "wgs84": [round(lon, 10), round(lat, 10)], "observerOrPlace": observer,
                        **({"recordIntervalYears": interval} if interval is not None else {})})
    counts = {"sourceRows": len(rows), "explicitEmptyIntersections": skipped,
              "regionalObserverOrPlaceAndMaterial": dict(sorted(regional.items())),
              "keptByClass": dict(sorted(Counter(r["substrate"] for r in out).items())),
              "keptByYear": dict(sorted(Counter(r["year"] for r in out).items()))}
    return out, counts

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    for k in RESOURCE:
        p.add_argument(k, type=Path)
    p.add_argument("output", type=Path)
    args = p.parse_args()
    read_source(args.dictionary, "dictionary")
    all_rows = {}
    counts = {}
    for k in ("ground", "remote"):
        raw = read_source(getattr(args, k), k)
        all_rows[k], counts[k] = normalize(raw[2:], k)
    result = {
        "scope": "Historical independent point-level substrate check in the exact Q447 NW Cavendish rectangle. No shoreline reconstruction, vertical field, color or current condition.",
        "publisher": "Parks Canada", "license": "https://open.canada.ca/en/open-government-licence-canada",
        "record": "https://open.canada.ca/data/en/dataset/" + SOURCE_PACKAGE,
        "declaredSource": "Nad83 CSRS PEI Double Stereographic", "normalizedProjection": "EPSG:2954 to EPSG:4326; source realization not specified",
        "boundsWGS84": BBOX,
        "resources": {k: {"id": v[0], "sha256": v[1]} for k, v in RESOURCE.items()},
        "counts": counts, "points": all_rows,
    }
    with args.output.open("x") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
        f.write("\n")
