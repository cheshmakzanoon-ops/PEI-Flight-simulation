# Hunter River: a bounded measured-rise mesh prospect

This detached CPU study tests one original terrain triangle in the
signed 14-14 atlas tile. It is not a change to Hunter River or the
aircraft surface. The [stronger separation near the trail](../)
was not selected. It did not survive the independent trail and woodland
checks. The retained window is a different small open target on the
same corridor.

The [screen](evidence/strict-support.json) uses the exact nearby signed road,
sidewalk, parking and building generations; the actual Confederation Trail
section data, with a 23 m reserve beyond a conservative ribbon envelope;
signed hedge roots and their expanded rendered shadow support; and both
the native stand-height and crown-height texture support, with a 28 m
reserve around positive source samples. The simpler grass/cropland and
dry-land screen is still required. These are conservative local filters
for these shipped generations, not a field survey or exhaustive proof of
all current vegetation, infrastructure, scenery or shadows. The first
retained source rectangle is at least 89.600 m from the tested ribbon;
it has 418 original 1 m centres with an unfeathered source-minus-base
range of +0.855 to +1.352 m. Do not use the screen to clear whole cells.

## Exact geometry and counterfactual

The [packed proof](evidence/detached-wire.json) provides both a measured
candidate and a same-topology, planar counterfactual inside original
triangle **6308** [3182,3295,3183]. Every original position and UV
record remains bit-for-bit intact; all 25,087 other triangles remain
unchanged. The new interior is joined by identical outer edges and an
indexed planar skirt. The height correction fades to the original plane
over six 1 m sample rows. Areas match in plan, and the represented
old-plane boundary error from Float32 storage is under 0.000002 m.
The reconstruction adds 418 positions and 836 triangles, not a
second object layer or duplicate collision surface.

Candidate and planar control share **the same** X/Z, indices, added UV,
and exploratory normal data. Only 340 Y records differ, with max
represented gain about 1.279 m. Native validation must establish that
these normals are not sampled by the expected stock program; no
independent bump or normal-map effect is installed by this checkpoint.

A [rough 1200×760 Chase projection](evidence/lens-forecast.json), using the
unchanged fixed-step flight model and stock lens defaults, puts the
candidate inside the predicted frame for the first seven seconds. For
example at six seconds (323 m from launch), the projected region is about
89 × 24 pixels and the changed vertices' vertical p90 is about 3.33
pixels. This is mathematical screen projection, not actual submitted
geometry, lighting, temporal quality, occlusion or a count of changed
display pixels. Next compare ordinary flight, same-frame stock,
same-topology zero, actual measured height and stock restore before
considering any placement. No gameplay, renderer, UV atlas, installed
normal input or flight-contact change is made here.

## Re-run

From the repository root with GDAL, pinned Node dependencies and the
three previously licensed [source windows](../../../../data/inland-focal-scout/):

```sh
study=tools/terrain/inland-focal-scout/hunter-prospect
node --experimental-strip-types "$study/build-detached.mjs" /tmp/hunter-support.json /tmp/hunter-wire.json
node --experimental-strip-types "$study/pixel-scout.mjs" /tmp/hunter-support-again.json /tmp/hunter-wire.json /tmp/hunter-lens.json
cmp /tmp/hunter-support.json "$study/evidence/strict-support.json"
cmp /tmp/hunter-wire.json "$study/evidence/detached-wire.json"
cmp /tmp/hunter-lens.json "$study/evidence/lens-forecast.json"
```

Elevation source is Natural Resources Canada's CanElevation HRDEM Mosaic
under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
The existing ODbL-derived route/exclusion sources and the surrounding atlas
retain their existing licenses. No open height samples are given a new data
license by this study.
