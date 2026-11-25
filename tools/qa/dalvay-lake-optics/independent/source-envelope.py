"""Independent source audit of every bilinear donor, using original national geometry and original satellite classes, not an actor mask A/B. Only old static world XY and categorical cover; never opens native LAS heights."""
import argparse, hashlib, json, gzip, math, struct
from pathlib import Path as P
import numpy as np
from osgeo import ogr, gdal, osr
ogr.UseExceptions()
gdal.UseExceptions()
p = argparse.ArgumentParser()
p.add_argument('--lake-zip', type=P, required=True)
p.add_argument('--esa', type=P, required=True)
p.add_argument('--wire', type=P, required=True)
p.add_argument('--checkout', type=P, required=True)
p.add_argument('--new-views', type=P, required=True)
p.add_argument('--out', type=P, required=True)
a = p.parse_args()
H = lambda x: hashlib.sha256(x).hexdigest()
J = lambda f: json.loads(f.read_bytes())
lon, lat = (-63.070848, 46.412939)
v = 111161.08375388649
u = 76762.59317717307
xy = lambda x, y: ((x - lon) * u, (lat - y) * v)
g = lambda k, x: ogr.CreateGeometryFromWkt(k + ' (' + x + ')')
point = lambda x, z: g('POINT', f'{x} {z}')
line = lambda p: g('LINESTRING', ','.join((f'{x} {z}' for x, z in p)))

def file_sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()
assert file_sha(a.lake_zip) == 'f6994a6802535ae854a8cfaf94fb05ef9866f02606839ab3745063f24698d620'
assert file_sha(a.esa) == 'a9ecfc04b044d75d68f5144af3240fa32792c3dcc77e7b429595935c610a80b0'
assert file_sha(a.wire) == '149ee965bc52ca42e75f506a5f688dd9b3f2420264ff427c5c23e7496d190f56'
fn = '/vsizip/' + str(a.lake_zip.resolve()) + '/NHN_01CC000_3_0_HD_WATERBODY_2.shp'
src = ogr.Open(fn)
L = src.GetLayer(0)
L.SetAttributeFilter("NID='dc8e389aae854b958fc06b02e2b9b011'")
f = next(iter(L))
assert f['VALDATE'] == '1987' and f['LAKENAME_1'] == 'Dalvay Lake' and (L.GetFeatureCount() == 1)
org = f.GetGeometryRef().Clone()
assert org.GetGeometryName() == 'POLYGON'
source_crs = L.GetSpatialRef().Clone()
game_crs = osr.SpatialReference()
game_crs.ImportFromEPSG(4326)
assert source_crs.GetAuthorityCode(None) == '4617'
for crs in (source_crs, game_crs):
    crs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
assert org.Transform(osr.CoordinateTransformation(source_crs, game_crs)) == 0
poly = ogr.CreateGeometryFromJson(json.dumps({'type': 'Polygon', 'coordinates': [[xy(*p[:2]) for p in ring.GetPoints()] for ring in org]}))
wire = a.wire.read_bytes()
raw = gzip.decompress(wire)
magic, W, E, sx, sz, dx, dz = struct.unpack('<4sHHffff', raw[:24])
assert magic == b'DL01' and dx == dz == 4
alpha = np.frombuffer(raw[24:], dtype='u1').reshape(E, W)
assert not alpha[0].any() and (not alpha[-1].any()) and (not alpha[:, 0].any()) and (not alpha[:, -1].any())
pos = alpha[:-1, :-1] | alpha[:-1, 1:] | alpha[1:, :-1] | alpha[1:, 1:] > 0
zr, xc = np.nonzero(pos)
assert len(zr) > 6000
mask = gdal.GetDriverByName('MEM').Create('', W - 1, E - 1, 1, gdal.GDT_Byte)
mask.SetGeoTransform((sx + 2, 4.0, 0.0, sz + 2, 0.0, 4.0))
band = mask.GetRasterBand(1)
band.WriteArray(pos.astype('u1'))
vset = ogr.GetDriverByName('Memory').CreateDataSource('')
layer = vset.CreateLayer('bilinear', geom_type=ogr.wkbPolygon)
gdal.Polygonize(band, band, layer, -1, [])
geoms = [t.GetGeometryRef().Clone() for t in layer]
obj = geoms[0]
for m in geoms[1:]:
    obj = obj.Union(m)
assert abs(obj.GetArea() - 16 * len(xc)) < 1e-05
margin = obj.Distance(poly.Boundary())
outside = obj.Difference(poly.Buffer(-12))
assert outside.IsEmpty() or outside.GetArea() < 1e-07
R = gdal.Open(str(a.esa))
b = R.GetRasterBand(1)
t = R.GetGeoTransform()
ax = sx + (xc + 0.5) * dx
az = sz + (zr + 0.5) * dz
xall = np.array([ax, ax + 4 - 1e-09, ax, ax + 4 - 1e-09])
zall = np.array([az, az, az + 4 - 1e-09, az + 4 - 1e-09])
ex = np.floor((lon + xall / u - t[0]) / t[1]).astype(int)
ez = np.floor((lat - zall / v - t[3]) / t[5]).astype(int)
xlo = ex.min() - 4
zlo = ez.min() - 4
vls = b.ReadAsArray(xlo, zlo, ex.max() - xlo + 5, ez.max() - zlo + 5)
bad = []
vals = []
for rz in [-1, 0, 1]:
    for cx in [-1, 0, 1]:
        bb = vls[ez - zlo + rz, ex - xlo + cx]
        vals += np.unique(bb).tolist()
        bad.append(int((bb != 80).sum()))
assert not any(bad)
root = a.checkout / 'public/world'
fa = J(root / 'buildings/index.json')
pack = (root / 'buildings' / fa['file']).read_bytes()
assert H(pack) == fa['sha256']
lx, hx, lz, hz = obj.GetEnvelope()
xb = [lx - 250, hx + 250]
zb = [lz - 250, hz + 250]
build = []
road = []
tileChecked = []
for q in fa['tiles']:
    left, bottom, right, top = q['bounds']
    minx, minz = xy(left, top)
    maxx, maxz = xy(right, bottom)
    if maxx < xb[0] or minx > xb[1] or maxz < zb[0] or (minz > zb[1]):
        continue
    wire0 = pack[q['offset']:q['offset'] + q['bytes']]
    assert H(wire0) == q['sha256']
    tileChecked.append(q['id'])
    for i, r in enumerate(json.loads(gzip.decompress(wire0))['features']):
        if len(r['footprint']) < 3:
            continue
        rr = [xy(*q) for q in r['footprint']]
        poly0 = ogr.CreateGeometryFromJson(json.dumps({'type': 'Polygon', 'coordinates': [rr + [rr[0]]]}))
        a0, a1, b0, b1 = poly0.GetEnvelope()
        if a1 < xb[0] or a0 > xb[1] or b1 < zb[0] or (b0 > zb[1]):
            continue
        build.append((obj.Distance(poly0), q['id'], i))
rawr = gzip.decompress((root / 'roads.bin.gz').read_bytes())
rsha = H(rawr)
assert rsha == J(root / 'roads.json')['sha256']
s, ver, n = struct.unpack_from('>4sHI', rawr)
assert (s, ver) == (b'PEIR', 1)
o = 10
for i in range(n):
    nn, flags = struct.unpack_from('>HB', rawr, o)
    o += 3
    pts = np.frombuffer(rawr, dtype='>u4', count=nn * 2, offset=o).reshape(nn, 2).astype(float)
    o += nn * 8
    xx = (pts[:, 0] / 100000.0 - 65 - lon) * u
    zz = (lat - (pts[:, 1] / 100000.0 + 45)) * v
    if xx.max() < xb[0] or xx.min() > xb[1] or zz.max() < zb[0] or (zz.min() > zb[1]):
        continue
    width = [2.0, 2.8, 3.6, 4.8, 6.4][flags & 7]
    road.append((obj.Distance(line(list(zip(xx, zz)))) - width, i, width))
assert o == len(rawr) and build and road and (min(build)[0] > 0) and (min(road)[0] > 0)
reg = J(a.new_views)
cmp = {}
original = {}
for k, cc in reg['views'].items():
    hand = np.array(xy(cc['lon'], cc['lat']))
    uv = np.array([cc['east'], cc['south']])
    eye = hand + cc['nearDist'] * uv
    seg = line([hand, eye])
    point0 = point(*eye)
    ti = np.arange(0, cc['nearDist'] + 1e-05, 0.25)
    q = hand[None, :] + ti[:, None] * uv
    rr = (q - np.array([sx, sz])) / 4 - 0.5
    jj = np.floor(rr).astype(int)
    w = np.mod(rr, 1)
    weighted = 0.0
    dt = np.array([0.25] * len(ti))
    dt[0] = 0.125
    for i in [0, 1]:
        for j in [0, 1]:
            xx = np.clip(jj[:, 0] + i, 0, W - 1)
            zz = np.clip(jj[:, 1] + j, 0, E - 1)
            weighted += alpha[zz, xx] / 255 * (w[:, 0] if i else 1 - w[:, 0]) * (w[:, 1] if j else 1 - w[:, 1])
    cmp[k] = {'eyeInActualPositiveBilinearSupport': bool(obj.Contains(point0)), 'separatedFromPositiveBoundaryM': point0.Distance(obj.Boundary()), 'exactViewLineCrossingPositivePotentialM': seg.Intersection(obj).Length(), 'integratedFully255RunApproxM': 0.25 * float((weighted >= 1 - 1e-12).sum()), 'integratedAlphaWeightedMApprox': float((weighted * dt).sum())}
q = {'scope': 'Independent whole-source proof, not a new water surface, lake level or a camera photograph. Retains year limitations. Conservative support includes arbitrarily small positive contributions from all four adjacent texels, larger than actual shader cutoff. Geometric area differs from counting nonzero texel centres. Shore/data provenance estimates not statements about present-day water.', 'wireSha256': H(wire), 'sourceNHNArchiveSHA256': file_sha(a.lake_zip), 'namedOriginalNID': f['NID'], 'originalValDate': f['VALDATE'], 'originalReportedHorizontalAccuracyM': int(f['ACCURACY']), 'license': 'NHN OGL Canada; ESA WorldCover 2021 CC BY 4.0. No original image or photo used as shader texture.', 'alphaPositiveCentres': int((alpha > 0).sum()), 'fullyAppliedCentres': int((alpha == 255).sum()), 'fullBilinearPositiveEnvelopeCells': len(xc), 'areaBilinearEnvelopeM2': obj.GetArea(), 'minimumHistoricalBankDistanceM': margin, 'wholePotentialSupportOutside12mErodedHistoricalPolygonAreaM2': 0 if outside.IsEmpty() else outside.GetArea(), 'allPointsInAllActualBilinearCellsIntersectedESACentresAndEightNeighbors': {'sampleBlockCornerLookups': int(ex.size), 'checksIncludingAll3x3': int(ex.size * 9), 'uniqueClasses': sorted(set(vals)), 'nonClass80': sum(bad), 'originalESAsha256': file_sha(a.esa)}, 'allOriginalAEBAndNRNWithin250mBoundingRectangle': {'nearestAEBSeparationMAndOwner': min(build), 'examinedRings': len(build), 'examinedOriginalTileIds': tileChecked, 'nearestSignedRoadRibbonConservativeClearanceMAndNumberHalfWidth': min(road), 'roadsChecked': len(road), 'roadGeometrySHA256': rsha, 'coverageCaveat': 'Roads conservatively buffered centerlines; no claim about a future footpath or the date of unknown foliage. Actual ground-only shader and fixed camera cannot shift or paint original independent scene objects.'}, 'actualLockedLakeViews': cmp, 'oldFlightCollider': 'unchanged by shader design; this calculation does not substitute a real player contact check.'}
a.out.write_text(json.dumps(q, indent=2) + '\n')
print(json.dumps(q))
