"""Compute a conservative actual game-height interval over EVERY positive continuous bilinear footprint, without fitting a lake stage. Intersect each 4m donor-support rectangle with every original uploaded N112 triangle, not point samples. For a planar triangle extrema on any intersection polygon occur at its true clipped vertices."""
import argparse, json, gzip, struct, hashlib
from pathlib import Path as P
import numpy as np
p = argparse.ArgumentParser()
p.add_argument('--vbo', type=P, required=True)
p.add_argument('--pack', type=P, required=True)
p.add_argument('--out', type=P, required=True)
p.add_argument('--polygons', type=P, help='Optional cache of all exact native terrain-cell intersections for whole-pixel/centroid camera proof.')
p.add_argument('--x', type=float, default=9933)
p.add_argument('--z', type=float, default=9517)
a = p.parse_args()
B = a.vbo
meta = json.loads((B / 'live-geometry.json').read_bytes())[0]
target = np.array([a.x, a.z])
H = lambda b: hashlib.sha256(b).hexdigest()

def clip(poly, ax, limit, sign):
    out = []
    for p, q in zip(poly, np.roll(poly, -1, axis=0)):
        m = (p[ax] - limit) * sign
        n = (q[ax] - limit) * sign
        if m >= 0:
            out.append(p)
        if (m >= 0) != (n >= 0):
            out.append(p + (q - p) * m / (m - n))
    return np.asarray(out)

def window(t, left, top, right, bottom):
    out = t
    for ax, lim, sgn in ((0, left, 1), (2, top, 1), (0, right, -1), (2, bottom, -1)):
        if len(out) < 3:
            return []
        out = clip(out, ax, lim, sgn)
    return out if len(out) >= 3 else []
wire = a.pack.read_bytes()
raw = gzip.decompress(wire)
assert H(raw) == '104b60f2dfc6d0f299a7fcff0169992f5d9c51a03b7dfbfdb81ad85b871fa139'
code, W, E, x0, z0, dx, dz = struct.unpack('<4sHHffff', raw[:24])
ox, oz = np.array([9914.042434018622, 9677.795112696944]) + np.array([x0, z0])
A = np.frombuffer(raw[24:], dtype='u1').reshape(E, W)
eligible = np.maximum.reduce([A[:-1, :-1], A[:-1, 1:], A[1:, :-1], A[1:, 1:]]) > 0
assert eligible.sum() == 7507
X = ox + dx * (np.arange(W - 1) + 0.5)
Z = oz + dz * (np.arange(E - 1) + 0.5)
groups = {k: [] for k in ('everyRealMaskCellAllSlopes', 'signedNearHorizontal', 'within4mOfDecodedXZ', 'within20mOfDecodedXZ', 'vertexBoundsEvenWhenOnlySmallFractionQualifies')}
checked = set()
fac = set()
local = []
allPolys = []
allNormals = []
allIds = []
for tile, key, posk, ink in [('17-12', 'modelMatrix', 'positionSHA256', 'indexSHA256'), ('17-13', 'otherMatrix', 'position2SHA256', 'index2SHA256')]:
    pb = (B / ('terrain-grid-' + tile + '.f32le')).read_bytes()
    ib = (B / ('terrain-grid-' + tile + '.u16le')).read_bytes()
    assert H(pb) == meta[posk] and H(ib) == meta[ink]
    pv = np.frombuffer(pb, '<f4').reshape(-1, 3)
    ix = np.frombuffer(ib, '<u2').reshape(-1, 3)
    world = (np.c_[pv, np.ones(len(pv))] @ np.asarray(meta[key]).reshape(4, 4))[:, :3]
    tri = world[ix]
    xz = tri[:, :, [0, 2]]
    for i in np.flatnonzero(np.all((xz.min(1) < [X[-1] + dx, Z[-1] + dz]) & (xz.max(1) > [X[0], Z[0]]), axis=1)):
        t = tri[i]
        nx = np.cross(t[1] - t[0], t[2] - t[0])
        n = abs(nx[1]) / np.linalg.norm(nx)
        x, z = (t[:, 0], t[:, 2])
        ixx = np.flatnonzero((X <= x.max()) & (X + dx >= x.min()))
        izz = np.flatnonzero((Z <= z.max()) & (Z + dz >= z.min()))
        ys = []
        cellpairs = []
        if x.min() <= target[0] <= x.max() and z.min() <= target[1] <= z.max():
            c = t[:, [0, 2]]
            v = target - c[0]
            m = np.linalg.solve(np.stack([c[1] - c[0], c[2] - c[0]]).T, v)
            if min(*m, 1 - m.sum()) >= 0:
                local.append({'tile': tile, 'realTriangle': int(i), 'YatReadXYM': float(t[0, 1] + m @ (t[1:, 1] - t[0, 1])), 'normalY': float(n), 'triangleWorld': t.tolist()})
        for iz in izz:
            for xx in ixx:
                if not eligible[iz, xx]:
                    continue
                x1, x2 = (X[xx], X[xx] + dx)
                z1, z2 = (Z[iz], Z[iz] + dz)
                arr = window(t, x1, z1, x2, z2)
                if not len(arr):
                    continue
                q = arr[:, [0, 2]]
                aa = q[1:] - q[0]
                area = abs((aa[:-1, 0] * aa[1:, 1] - aa[:-1, 1] * aa[1:, 0]).sum()) / 2
                if area <= 1e-08:
                    continue
                allPolys.append(arr)
                allNormals.append(float(n))
                allIds.append([int(tile[-2:]), int(i), int(iz), int(xx)])
                checked.add((int(iz), int(xx)))
                fac.add((tile, int(i)))
                yy = arr[:, 1].tolist()
                groups['everyRealMaskCellAllSlopes'] += yy
                groups['vertexBoundsEvenWhenOnlySmallFractionQualifies'] += t[:, 1].tolist()
                if n >= 0.996 - 2e-05:
                    groups['signedNearHorizontal'] += yy
                    for w, key2 in [(4, 'within4mOfDecodedXZ'), (20, 'within20mOfDecodedXZ')]:
                        xl, zl = target - w
                        xh, zh = target + w
                        if x2 < xl or x1 > xh or z2 < zl or (z1 > zh):
                            continue
                        arr2 = window(arr, xl, zl, xh, zh)
                        if len(arr2):
                            groups[key2] += arr2[:, 1].tolist()
summary = {k: {'n': len(y), 'min': float(min(y)), 'max': float(max(y))} for k, y in groups.items() if len(y)}
assert len(checked) == int(eligible.sum())
q = {'method': 'Actual active GPU game geometry N112. Exact clipped vertices for all 7,507 full 4m continuous interpolation-support cells, including any dry-bias or edge variation. No new real-world/survey Z and no claim of corrected water height. Coverage includes whole support cells even below the 0.001 alpha threshold, no fitted coefficients.', 'positionAndIndexSha256': {k: meta[k] for k in ('positionSHA256', 'indexSHA256', 'position2SHA256', 'index2SHA256')}, 'uniqueCompleteCells': len(checked), 'uniqueSourceTris': len(fac), 'probeXZ': target.tolist(), 'physicalAtProbe': local, 'rangesM': summary}
a.out.write_text(json.dumps(q, indent=2) + '\n')
if a.polygons:
    np.savez_compressed(a.polygons, vertices=np.concatenate(allPolys), offsets=np.cumsum([0] + [len(s) for s in allPolys]), normalY=allNormals, identities=allIds, scopeSha256=H(raw))
print(json.dumps(q, ensure_ascii=False))
