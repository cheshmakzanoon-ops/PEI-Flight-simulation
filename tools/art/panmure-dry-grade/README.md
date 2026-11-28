# Panmure Head: measured dry pasture relief

A detached surface variant for the inner Panmure Head pasture in Kings
County. It does not change the simulator or its existing
[low pasture material](../../../docs/qa/panmure-pasture.md). The elevation
inputs are not aerial photography.

The two [native sample windows](source/) are exact 124 × 185 Float32
DTM and DSM crops from Natural Resources Canada's
[CanElevation HRDEM Mosaic](https://open.canada.ca/data/en/dataset/0fe65119-e96e-4a57-8bfe-9d9245fba06b),
in horizontal EPSG:3979 and vertical CGVD2013. Contains information
licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
The [source receipt](source/source.json) pins both remote objects,
original registration and decoded data. No resampling or photo texture
is applied.

Compared with the reconstructed existing N112 stock triangle surfaces,
607 selected dry centres in the small mapped interior are 0.54–0.92 m
higher in the native DTM (median 0.68 m). This is local comparison
between representations, not a measurement of a live rendered frame
or terrain error across Panmure Head. The candidate selects just the
largest complete connected native-square cluster in one existing
triangle, `25-18/3185`: 162 squares and 200 measured nodes. That
selected subset's original native difference is 0.54–0.71 m.

The [packed replacement](evidence/detached-face.json) preserves all
three original boundary edges and original vertex streams. It appends the unchanged regular receiver’s normal words to the new vertices. It replaces
one triangle with 441: 324 source-grid triangles and 117 triangles
for the stock-linear ring. A shader-coordinate rounding check found two
collapsed triangles in an earlier ring. The current packet flips only
those two ring diagonals, preserving all positions, and checks that
every triangle remains positive after the normal world-Float32
translation. A 3 m internal guard fades back to the
original plane while 18 nodes reach the full measured height. Peak
new display lift above the old surface is 0.676 m. A neutral packet
uses exactly the same triangulation and UVs, but every new height
comes from the old plane. This gives a future in-flight test a control
for tessellation alone. The perimeter preserves the original triangle
extent; none of the published aircraft contact or shoreline changes.

## Why the variant is not installed

The transition is illustrative, not measured. The independent slope
check found original native triangle grade around 4.2% at the 90th
percentile and 6.7% at maximum in this patch. The narrow authored
guard reaches 30.2% and 38.9%, respectively. It may look like an
artificial mound. Stock physical contact remains up to about 0.67 m
below the new visual surface. These are decisive reasons to keep this
candidate out of the game, not results to hide behind the source
resolution. Seek a wider surveyed dry transition with all mapped
surfaces protected before a release.

## Repeat the offline proof

Run from the repository root with repository dependencies, GDAL/PROJ,
Python 3 and a fresh directory. No internet is required to rebuild
from the pinned crop:

```sh
p=tools/art/panmure-dry-grade
out="$(mktemp -d)"
cp "$p/source/source.json" "$out/receipt.json"
for b in dtm dsm; do gzip -dc "$p/source/$b.f32.gz" > "$out/$b.f32"; done
node --experimental-strip-types "$p/qa/screen-stock.mjs" . "$out"
python3 "$p/qa/select-cells.py" "$out"
node --experimental-strip-types "$p/qa/build-face.mjs" . "$out"
cmp "$p/evidence/detached-face.json" "$out/detached-face.json"
```

[Selection and source hashes](evidence/receipt.json) distinguish the
input comparison from the triangle subset. Live position/index
readback, collisions and motion have not been tested for this variant.

The [wider 20 m transition](wide/) is a separate detached attempt to remove the artificial mound. It has a much gentler checked slope but is not installed either.
