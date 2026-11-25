"""Check the published V7 inputs, registrations and receipt consistency offline.

Does not re-render a frame or replace the independent exercises in the README.
Use --strict-runtime at the tested revision, not on unrelated future commits.
"""
import argparse
import gzip
import hashlib
import json
import math
import struct
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--repo', type=Path, default=Path.cwd())
parser.add_argument('--docs', type=Path, help='Override receipt path for staging work')
parser.add_argument('--strict-runtime', action='store_true')
args = parser.parse_args()
docs = args.docs or args.repo / 'docs/qa/dalvay-lake-optics'

def read(path):
    return json.loads(path.read_bytes())

def digest(b):
    return hashlib.sha256(b).hexdigest()

def require(reason, condition):
    if not condition:
        raise SystemExit('FAIL: ' + reason)

reg = read(docs / 'independent-registration.json')
for name, expected in reg['receiptSHA256'].items():
    require(name, digest((docs / name).read_bytes()) == expected)
for name, expected in reg['testedRuntimeSHA256'].items():
    if args.strict_runtime:
        require(name, digest((args.repo / name).read_bytes()) == expected)
wire = (args.repo / reg['mask']['path']).read_bytes()
raw = gzip.decompress(wire)
require('wire payload', digest(wire) == reg['mask']['packedSHA256'])
require('decoded payload', digest(raw) == reg['mask']['rawSHA256'])
magic, width, height, x, z, dx, dz = struct.unpack('<4sHHffff', raw[:24])
require('header', (magic, width, height, x, z, dx, dz) == (b'DL01', 199, 135, -548, -296, 4, 4))
a = raw[24:]
require('size', len(a) == width * height)
source = read(docs / 'independent-source.json')
require('positive texels', sum(v > 0 for v in a) == source['alphaPositiveCentres'] == 7146)
require('full texels', a.count(255) == source['fullyAppliedCentres'] == 5433)
support = sum(max(a[i], a[i+1], a[i+width], a[i+width+1]) > 0 for row in range(height-1) for col in range(width-1) for i in [row*width+col])
require('continuous support', support == source['fullBilinearPositiveEnvelopeCells'] == 7507)
require('physical area', source['areaBilinearEnvelopeM2'] == support * dx * dz)
require('independent fence', source['wholePotentialSupportOutside12mErodedHistoricalPolygonAreaM2'] == 0 and source['minimumHistoricalBankDistanceM'] > 15)
cover = source['allPointsInAllActualBilinearCellsIntersectedESACentresAndEightNeighbors']
require('all ESA donors', cover['checksIncludingAll3x3'] == support * 4 * 9 and cover['nonClass80'] == 0)
height = read(docs / 'independent-heights.json')
views = read(docs / 'independent-views.json')
h = height['rangesM']['everyRealMaskCellAllSlopes']
require('registered geometry', height['positionAndIndexSha256'] == reg['terrain']['buffersSHA256'])
require('complete mesh intersection', height['uniqueCompleteCells'] == views['coverageCells'] == support and height['uniqueSourceTris'] == 135 and views['checkedSourcePolygons'] == 9873)
require('existing Y interval', [h['min'], h['max']] == views['oldSourceHeightRangeM'] and 2.11 <= h['min'] <= h['max'] <= 3.52)
require('all fixed views', set(views['cases']) == set(reg['frames']) and len(reg['frames']) == 3)
outside = 0
for name, result in views['cases'].items():
    native = reg['frames'][name]
    before, middle, after = result['beforeMiddleAfterSHA256']
    require(name + ' paired registration', before == after != middle and [before,middle,after] == [t['sha256'] for t in native['pass']])
    require(name + ' resident geometry', native['sameMaterialAndGeometryBeforeAfter'] and len({(t['draws'],t['triangles']) for t in native['pass']}) == 1)
    require(name + ' actual GL state', all(t['linked'] and t['error'] == 0 for t in native['pass']) and [t['active'] for t in native['pass']] == [True,False,True])
    e = result['beyondTrueCompleteSourcePlus2']
    require(name + ' exterior', e['any'] == e['max'] == 0 and result['strictPass'] and not result['witnesses'])
    require(name + ' measured effect', result['measuredWhole']['over2'] > 1000 and e['n']+result['anyFullSourcePlusConservative2AA'] == 900*600)
    outside += e['n']
require('total exterior', outside == 1160482)
route = read(docs / 'independent-route.json')
require('route choice and track', route['actualFpsSteps'] == 5833 and route['originalCodeRemainsFlyingUnstalled'] and route['defaultUnchanged'] == 'cavendish')
rawlen = route['rawBilinearMaskAtLeast0p001'][0]['horizontalPolylineM']
feather = route['planarGroundBeneathTrackAlsoPassesV7FeatherCutoff'][0]['horizontalPolylineM']
require('route scope', not route['first165mPastHouseActuallyInCore'] and math.isclose(rawlen,37.90355,abs_tol=.0001) and math.isclose(feather,33.23852,abs_tol=.0001))
print(f'PASS: {support:,} continuous cells; {outside:,} unchanged exterior pixels in registered receipts; stock route {rawlen:.2f} m raw / {feather:.2f} m feather-qualified.')
