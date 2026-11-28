# Mapped hedgerow bands: model, source and flight check

Three individual dated field-edge bands at Freetown, New Glasgow and
St. Peters. This does not replace the province's hedgerows. The
simulator still uses the original leaf silhouettes and shadows.

The [2020 CLUI source receipt](source/receipt.json) records 24
features in three query windows. Primary projected outlines 17487,
52617 and 88010 identify tree-dominant cover, not measured crown
dimensions or height. One Prince polygon has a large legitimate hole.
The 3D candidate uses existing authored seats within those exact
outlines. It does not add plants or move the terrain, and retains each
admitted original root and its height, width, light and family words.

## Artwork status

The standalone Three.js model has trunks, forks and three-dimensional
branch-end clusters. The refined material borrows the original
game's leaf atlas, not new imagery. This covers 29, 28 and 57 selected
old seats; adjacent original trees are untouched. The largest detached
batch adds up to 57,066 triangles across four draws. That is not a
product or frame-time figure.

[Queens approach](evidence/queens-approach-held.webp) and
[Kings side view](evidence/kings-reciprocal-held.webp) show old at
left and the second detached design at right. They are **held**
comparisons, not release screenshots. The brighter first model looked
solid and artificial. The second matches stock brightness more
closely but still has less convincing leaves, and the Kings side view
retains only 68.5% of the stock role mask area. A third porous leaf
design improved the branching silhouette but lost still more of the
stock canopy coverage in several views. None is enabled.

The detached mesh and the stock marker have separate focused tests.
From the repository root:

    node --experimental-strip-types --test tools/art/hedgerow-bands/geometry.test.mjs
    node --experimental-strip-types --test tools/art/hedgerow-bands/native/hedge-visibility-marker.test.mjs

## Original hedge buffers observed in real flight

A private New Glasgow row uses ordinary Dispatch and existing initial
flight physics at 42 m above original contact. There was no camera or
clock control. At +253.005 m and +342.778 m, the
[stock receipt](evidence/queens-stock-scope.json) authenticated 3,060
and 2,956 submitted original instances from the actual four signed
requested chunks, including 112 roots inside the primary outline in
both frames. All 28 proposed roots match the original native GPU
positions, appearance values and four original shadow samples.
Those checks are not a count of depth-visible leaves.

Only seven and four of the 28 legal roots project in the original
frame pair. The [prospective alternate course](evidence/course-result.json)
uses only the stock geometry to screen physical routes. The selected
course passed a second real-flight stock check using a private test row.

| Distance from start | Projected original crowns | Visible stock role pixels |
| ---: | ---: | ---: |
| 233.272 m | 28 | 1,956 |
| 347.713 m | 27 | 10,370 |
| 712.806 m | 0 | 0 |

The [role score](evidence/queens-depth-retained-role.json) and
[native receipt](evidence/queens-depth-retained-receipt.json) distinguish
submitted geometry from visible foliage. The diagnostic changed only the
final RGB of the 28 identified old crowns, keeping the real depth and
alpha tests. Both marked frames were identical to stock at the exit;
the neutral and restored frames matched stock at every station, with no
exterior or alpha changes. This constrains where a future comparison
will be visible; no new coverage, new tree or live material is accepted.
The instrumented test rows are not in playable Dispatch.

## Repeat the original readback

Run [prepare-stock.py](native/prepare-stock.py) with an isolated
clean checkout at commit 971ae83, the existing dependency directory
and a new output path. It copies the game sources, appends test
routes and reads the two original instanced draws. It never edits
the source checkout or applies new vegetation.

From the copied app directory, run:

    node --input-type=module -e 'import {build} from "vite";await build({build:{outDir:"../build",emptyOutDir:true,copyPublicDir:false}})'
    cd ..
    find build -type f -print0 | sort -z | xargs -0 sha256sum > BUILD.sha256

Serve the stage with python3 qa/serve.py --port 4665 and use
[stock.py](native/stock.py) in a second shell with the build manifest,
Chromium and a fresh output directory. Run [score-scope.py](native/score-scope.py)
on that output and the [actual plan outlines](source/targets.json).
The [locked follow-up criteria](native/NATIVE-ART-LOCK.json) require
real visible old and new roles, stock rollback, untouched surrounding
forest and shadows, and convincing texture at original scale.

Contains information licensed under the
[Open Government Licence – Prince Edward Island](https://www.princeedwardisland.ca/en/information/finance/open-government-licence-prince-edward-island).
Canonical [mapped hedgerow inputs](../../../docs/qa/mapped-hedgerows.md)
retain their listed attribution.
