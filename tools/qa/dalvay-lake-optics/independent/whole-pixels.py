"""Exact geometric conservative coverage for centroid-interpolated optics, irrespective of MSAA sample pattern. Each original 4m donor-support cell is intersected with every visible actual N112 face. A 1x1 pixel intersects a projected convex footprint iff its axis-aligned square and every convex edge overlap (separating axis theorem). No nearest sample, hand-authored IDs, fudge at the horizon or source extrapolations."""
import argparse, json, hashlib, math
from pathlib import Path as P
import numpy as np
from PIL import Image
from scipy.ndimage import maximum_filter, distance_transform_edt

def usize(s):
    return np.linalg.norm(s)

def nt(v):
    return v / usize(v)

def project(lon, lat):
    rad = np.pi / 180
    phi = 46.5 * rad
    e = 0.00669437999014
    f = 1 - e * math.sin(phi) ** 2
    mx = 6378137 * rad * math.cos(phi) / math.sqrt(f)
    mz = 6378137 * (1 - e) * rad / f ** 1.5
    return np.array([(lon + 63.2) * mx, (46.5 - lat) * mz])

def cam(rec):
    q = rec['pose']
    d = rec['diag']
    cx, cz = project(q['lon'], q['lat'])
    look = np.array([cx, d['baseH'] + q['h'] * 0.5, cz])
    eye = np.array([d['x'], d['eyeY'], d['z']])
    expected = np.array([cx, cz]) + nt(np.array([q['east'], q['south']])) * q['dist']
    assert max(abs(expected - eye[[0, 2]])) < 1e-06
    z = nt(eye - look)
    x = nt(np.cross([0.0, 1.0, 0.0], z))
    y = np.cross(z, x)
    M = np.identity(4)
    M[:3, 0] = x
    M[:3, 1] = y
    M[:3, 2] = z
    M[:3, 3] = eye
    return M

def stats(dg, m):
    en = dg[m]
    return {'n': int(np.count_nonzero(m)), 'any': int(np.sum(en > 0)), 'over2': int(np.sum(en > 2)), 'over8': int(np.sum(en > 8)), 'max': int(en.max(initial=0))}
p = argparse.ArgumentParser()
p.add_argument('--polygons', type=P, required=True)
p.add_argument('--vbo', type=P, required=True)
p.add_argument('--paired', type=P, required=True)
p.add_argument('--out', type=P, required=True)
a = p.parse_args()
h = lambda f: hashlib.sha256(f.read_bytes()).hexdigest()
j = lambda f: json.loads(f.read_bytes())
p = np.load(a.polygons)
assert p['scopeSha256'].item() == '104b60f2dfc6d0f299a7fcff0169992f5d9c51a03b7dfbfdb81ad85b871fa139'
source = j(a.vbo / 'live-geometry.json')[0]
assert source['glErrors'] == 0
V = p['vertices']
offs = p['offsets']
iy = p['normalY']
idx = p['identities']
assert len(set(((i[2], i[3]) for i in idx))) == 7507
Yrange = (V[:, 1].min(), V[:, 1].max())
assert Yrange[0] > 2.11 and Yrange[1] < 3.52
assert np.min(iy) > 0.998
Pj = np.asarray(source['proj']).reshape(4, 4).T
near = source['clip'][0]
cases = {}

def clipnear(poly):
    out = []
    for v, w in zip(poly, np.roll(poly, -1, axis=0)):
        sv = -v[2] >= near
        sw = -w[2] >= near
        if sv:
            out.append(v)
        if sw != sv:
            out.append(v + (w - v) * ((-near - v[2]) / (w[2] - v[2])))
    return np.asarray(out)

def raster(pp, out):
    xy = pp
    W, E = (out.shape[1], out.shape[0])
    mins = xy.min(0)
    maxs = xy.max(0)
    lo = np.maximum(0, np.ceil(mins - 1.0 - 1e-07).astype(int))
    hi = np.minimum([W, E], np.floor(maxs + 1e-07).astype(int) + 1)
    if np.any(hi <= lo):
        return 0
    p0 = xy[0]
    u = xy[1:] - p0
    area = (u[:-1, 0] * u[1:, 1] - u[:-1, 1] * u[1:, 0]).sum()
    if abs(area) < 1e-10:
        return 0
    if area < 0:
        xy = xy[::-1]
    ex = np.roll(xy, -1, axis=0) - xy
    X, Y = np.meshgrid(np.arange(lo[0], hi[0]) + 0.5, np.arange(lo[1], hi[1]) + 0.5)
    good = np.ones(X.shape, bool)
    for (a, b), (dx, dy) in zip(xy, ex):
        good &= dx * (Y - b) - dy * (X - a) >= -0.5 * (abs(dx) + abs(dy)) - 1e-07
    out[lo[1]:hi[1], lo[0]:hi[0]] |= good
    return int(good.sum() > 0)
poses = {r['name']: r for r in j(P(__file__).with_name('fixed-poses.json'))}
records = j(a.paired / 'results.json')
assert len(records) == len(poses) == 3 and {r['name'] for r in records} == set(poses), 'Incomplete or unknown registered frame set'
for r in records:
    lock = poses[r['name']]
    assert all((r['pose'][k] == v for k, v in lock['pose'].items()))
    assert all((r['diag'][k] == v for k, v in lock['diag'].items()))
    assert (r['width'], r['height']) == (900, 600) and (not r.get('errors')) and (not r['diag'].get('layerWarnings'))
    name = r['pose']['site']
    M = cam(r)
    v = (V - M[:3, 3]) @ M[:3, :3]
    W, E = (r['width'], r['height'])
    buf = np.zeros((E, W), bool)
    npoly = 0
    for lo, hi in zip(offs[:-1], offs[1:]):
        q = v[lo:hi]
        if q[:, 2].min() > -near:
            continue
        if q[:, 2].max() >= -near:
            q = clipnear(q)
        if len(q) < 3:
            continue
        screen = (q[:, :2] / -q[:, 2, None] * [Pj[0, 0], -Pj[1, 1]] + 1) * [W * 0.5, E * 0.5]
        npoly += raster(screen, buf)
    safe = maximum_filter(buf, size=5)
    A = a.paired / (name + '-before.png')
    B = a.paired / (name + '-middle.png')
    C = a.paired / (name + '-after.png')
    assert h(A) == h(C)
    new = np.asarray(Image.open(A).convert('RGB'), 'i2')
    old = np.asarray(Image.open(B).convert('RGB'), 'i2')
    diff = np.max(abs(new - old), axis=2)
    extr = ~safe
    fail = np.argwhere(extr & (diff > 0))
    dt = distance_transform_edt(~buf)
    assert np.max(diff) > 8 and len(extr.nonzero()[0]) > 500
    cases[name] = {'fullSourceIntersectionsInView': npoly, 'wholePixelAnyRealCoverage': int(buf.sum()), 'anyFullSourcePlusConservative2AA': int(safe.sum()), 'measuredWhole': stats(diff, np.ones(diff.shape, bool)), 'beyondTrueCompleteSourcePlus2': stats(diff, extr), 'witnesses': [[int(x), int(y), int(diff[y, x]), float(dt[y, x])] for y, x in fail[:12]], 'regressionPixel725x303': {'admittedGeometrically': bool(buf[303, 725]), 'distanceToAnyCoveredPixel': float(dt[303, 725]), 'stock': old[303, 725].tolist(), 'active': new[303, 725].tolist()}, 'beforeMiddleAfterSHA256': [h(A), h(B), h(C)], 'strictPass': len(fail) == 0}
a.out.write_text(json.dumps({'method': 'All continuous eligible original mesh–cell polygons; perspective clip near, analytical convex polygon versus closed pixel square with arbitrary centroid evaluation, and a two-pixel reporting ring. Mask, source terrain and existing grade not changed. No assumption that every eligible pixel actually sees water past foreground objects.', 'coverageCells': 7507, 'checkedSourcePolygons': len(offs) - 1, 'oldSourceHeightRangeM': list(Yrange), 'cases': cases}, indent=2) + '\n')
print(json.dumps({k: [v['measuredWhole']['over2'], v['beyondTrueCompleteSourcePlus2'], v['regressionPixel725x303']] for k, v in cases.items()}))
if not all((v['strictPass'] for v in cases.values())):
    raise SystemExit('FAIL: pixels changed outside plausible registered source ±2px; see output witnesses.')
