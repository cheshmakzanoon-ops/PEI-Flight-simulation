"""Measure the recorded simulator track, not an aviation route or surveyed water level.

Sample intervals use the first/last qualifying 90 Hz samples, without estimating
inter-frame crossings. The named lake is a separate exact polyline intersection
with the 1987 hydrographic polygon in the game's horizontal coordinates.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from osgeo import ogr, osr

ogr.UseExceptions()
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--track', type=Path, required=True)
parser.add_argument('--lake-zip', type=Path, required=True)
parser.add_argument('--polygons', type=Path, required=True)
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
track_data = json.loads(args.track.read_bytes())
samples = track_data['track']
origin = track_data['origin']
assert len(samples) == 5833 and track_data['defaultId'] == 'cavendish'
assert all(r[5] is False and r[6] == 'flying' for r in samples)
assert all(0.01110 < b[0]-a[0] < 0.01112 for a, b in zip(samples, samples[1:]))

# In V7 the two additional shader predicates are a world height interval and
# the original receiver's normal. The thresholds below must be valid for EVERY
# source polygon before they are used to classify the ground beneath the path.
with np.load(args.polygons, allow_pickle=False) as polys:
    assert polys['scopeSha256'].item() == '104b60f2dfc6d0f299a7fcff0169992f5d9c51a03b7dfbfdb81ad85b871fa139'
    assert np.min(polys['normalY']) >= .998
    h = polys['vertices'][:, 1]
    assert h.min() >= 2.11 and h.max() <= 3.52

with args.lake_zip.open('rb') as stream:
    assert hashlib.file_digest(stream, 'sha256').hexdigest() == 'f6994a6802535ae854a8cfaf94fb05ef9866f02606839ab3745063f24698d620'
zip_layer = '/vsizip/' + str(args.lake_zip.resolve()) + '/NHN_01CC000_3_0_HD_WATERBODY_2.shp'
dataset = ogr.Open(zip_layer)
layer = dataset.GetLayer(0)
layer.SetAttributeFilter("NID='dc8e389aae854b958fc06b02e2b9b011'")
assert layer.GetFeatureCount() == 1
feature = next(iter(layer))
assert feature['VALDATE'] == '1987'
geom = feature.GetGeometryRef().Clone()
native = layer.GetSpatialRef().Clone()
world = osr.SpatialReference()
world.ImportFromEPSG(4326)
for crs in (native, world):
    crs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
assert native.GetAuthorityCode(None) == '4617'
assert geom.Transform(osr.CoordinateTransformation(native, world)) == 0
local = ogr.Geometry(ogr.wkbPolygon)
for ring in geom:
    out_ring = ogr.Geometry(ogr.wkbLinearRing)
    for lon, lat, *_ in ring.GetPoints():
        out_ring.AddPoint_2D((lon + 63.2) * 76762.59317717307, (46.5 - lat) * 111161.08375388649)
    local.AddGeometry(out_ring)
line = ogr.Geometry(ogr.wkbLineString)
for _, x, z, *_ in samples:
    line.AddPoint_2D(x, z)

def intervals(predicate):
    spans, active = [], []
    for ix, sample in enumerate(samples):
        if predicate(sample[3]):
            active.append(ix)
        elif active:
            spans.append(active)
            active = []
    if active:
        spans.append(active)
    def summarize(ix):
        first, last = samples[ix[0]], samples[ix[-1]]
        length = sum(math.hypot(samples[b][1] - samples[a][1], samples[b][2] - samples[a][2]) for a,b in zip(ix, ix[1:]))
        return {'seconds': [first[0], last[0]],
                'southOfManorM': [first[2] - origin['z'], last[2] - origin['z']],
                'horizontalPolylineM': length, 'samples': len(ix)}
    return [summarize(ix) for ix in spans]

raw = intervals(lambda a: a >= .001)
feather = intervals(lambda a: a >= .001 and a*a*(3-2*a) >= .001)
closest = min(samples, key=lambda f: math.hypot(f[1]-origin['x'], f[2]-origin['z']))
assert raw and feather
out = {'sourceNeutralRun': track_data['start'], 'defaultUnchanged': track_data['defaultId'],
       'actualFpsSteps': len(samples), 'sampleTimeSec': [samples[0][0], samples[-1][0]],
       'closestOriginalManorCentroidAfterS': closest[0],
       'closestManorM': math.hypot(closest[1]-origin['x'], closest[2]-origin['z']),
       'rawBilinearMaskAtLeast0p001': raw,
       'planarGroundBeneathTrackAlsoPassesV7FeatherCutoff': feather,
       'named1987LakeIntersectionLengthM': line.Intersection(local).Length(),
       'minimumActualFlightClearanceM': min(s[4] for s in samples),
       'originalCodeRemainsFlyingUnstalled': True,
       'first165mPastHouseActuallyInCore': any(0 <= s[2]-origin['z'] <= 165 and s[3] >= .001 for s in samples),
       'scope': 'Ground under stock simulated track, not actual visible screen pixels, pilot telemetry or current real shoreline. Sample interval endpoints quantized to stock 90 Hz. Game clearance is from the unchanged simulated contact surface.'}
args.out.write_text(json.dumps(out, indent=2) + '\n')
