# North Cape dry-ground relief study

This is a detached geometry and source check, not an in-game terrain update.
The sharp 1 m bare-ground model and the stock 47 m atlas are both sourced
from the same Natural Resources Canada DTM and both declare CGVD2013.
The atlas uses a 32 m overview, bilinear warp and metre rounding. This
study checks the actual regular Three.js triangle reconstruction rather
than comparing the sharp source against an interpolated raster alone.

The screen rejects faces touching stock seam rows or belonging to another
tile. The strict grass cohort uses the existing signed stock Cover at
nine registered 1 m and 2 m taps, a 55 m dry margin, at least 2 m measured
elevation and bundled grass class. The narrower cohort adds holds for
mapped roads, paths, parking, building rectangles and the Coast Guard
locator. These are data and engineering buffers, not surveyed obstacles,
legal boundaries or shorelines. Parking and sidewalk records do not
intersect this particular window.

In the narrowed cohort, 18,213 source centres remain. The median
absolute difference is 0.34 m and the 90th percentile is 1.06 m, after
removing the stock display-only 0.12 m lift from the comparison. There
are 7,084 four-connected centres at least 0.50 m higher than stock in
the largest pocket. This is a comparison between two representations,
not a certified error estimate or change in real-world ground height.

## Detached Three.js replacement

One 23 × 19-centre window within stock face 20,152 is small enough to
preserve all three original outer edges. It contains 437 vertices on
a bilinear map through the four projected source corners, with less than
0.14 mm maximum horizontal difference from the GDAL-projected individual
centres. This is a reprojection residual, not physical map accuracy.

The centre 165 samples use the original 1 m source heights plus the
existing display lift. The four-cell guard interpolates the interior
back to the unchanged stock triangle. The two sides of every introduced
edge are paired; the 792 source faces plus 83 joining faces partition
the original projected area. The other 25,087 triangles and 12,769
original position, UV and normal records are unchanged. At the new
boundary, the height residual is less than 0.24 micrometres from float
packing and its normals remain the stock up vector. Interior normals
follow the new geometry.

This proves a bounded CPU mesh partition and records the packed bytes.
It does not change player terrain, grass, water, roads, building seats,
lights, collision or scenery streaming. Before any in-game trial, check
the actual current GPU receiver, whole candidate against current source
and objects, low flight approach, material boundary, and exact stock
fallback. No imagery is bundled.

## Reproduce

Install the repo dependencies and GDAL with PROJ EPSG definitions
(`gdaltransform` on PATH). Run from the repository root:

```sh
node tools/art/north-cape-lighthouse/grade/north-cape-dry-grade.mjs . /tmp/pei-north-cape-grade-new.json
cmp tools/art/north-cape-lighthouse/grade/evidence.json /tmp/pei-north-cape-grade-new.json
```

Use a fresh destination; the command refuses an overwrite. The evidence
is expected to match the pinned Three.js and current GDAL projection
pipeline. Published inputs are in
[data/north-cape-lighthouse-study](../../../../data/north-cape-lighthouse-study/)
and the stock world manifests. Contains information licensed under the
[Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).

### Isolating measured heights from extra triangles

A follow-up private native comparison uses the **same** replacement
triangles and identical horizontal centres and UVs in both new passes.
The neutral version packs every new height back on the old owner’s
plane. At the two ordinary Chase views, the neutral retessellation
produced **zero** strong RGB changes from stock. Substituting the
measured heights produced **354** and **2,531** strong changes against
that control. At the true exit, the old terrain owner still drew and
none of the comparisons changed any pixel.

[Packed/native receipts](causal-control.json) record the active
position/element scope and exact restoration. The selected stock
program does not consume a normal attribute. These results isolate
the display effect of the proposed elevation, not contact, materials,
mapped peer visibility inside the shape, or a finished view. In the
actual pictures the effect remains subtle. Both the grade and neutral
versions are still private recaptures, not player terrain.

Use the same reproduction command with an unused destination and
append `--counterfactual` to get the independently matched original
neutral position suffix and its rounding check.

The optional `verify-causal-custody.mjs` checker can read a retained
native capture directory. It verifies the four active programs and
matrices, exact PNG hashes, and near-frame buffer scope; the raw
full-scene images are not bundled with this repository study.

The [published-route flight comparison](current-route/) repeats the height-only test on the current lighthouse course, with two positive views and a geometrically confirmed unchanged exit. It is still not installed.
