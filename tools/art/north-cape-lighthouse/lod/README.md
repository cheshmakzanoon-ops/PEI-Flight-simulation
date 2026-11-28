# North Cape apparent-size transitions

The existing detached 3,924-triangle near and 560-triangle middle models
are small at the experimental metre-based switch. Their silhouettes
are close across eight bearings and two above-seat viewpoints. This
study compares exact emitted CPU Three.js position, normal and color
words at 733.2 m and 780 m, the zoom-one hysteresis boundaries of a
private preview. None of that preview code is installed by this study.

An independent fixed 4×4 subpixel sampler found a maximum 2.11% silhouette
difference and a maximum 0.25 px bounding-edge change. The simplified
diffuse response exceeded the predeclared per-sample luma budget in 34
of 96 cases. Averaging the proxy on full non-glass pixels reduces the
largest near/middle mean absolute difference to about 0.046, but does
not prove a seamless transition. The model remained about 2.5, 4.25 and
7.75 pixels high just before the old 5,200 m far removal for 700, 1,200
and 2,160-pixel-high viewports. That's an image-scale dependency, not
an actual scene witness. It does not qualify the late restore threshold,
motion, MSAA or appearance under arbitrary lighting.

The new opt-in study computes a conservative 2D screen-size bound on
the whole authored 3D box, using a supplied local-to-clip matrix and
actual drawing-buffer dimensions, not the CSS viewport or a flat range.
It preserves the prior tier while the whole box lies outside one common
clip plane, and retains full detail around uncertain near-plane or
nonfinite situations. Separate hysteresis bands surround the near and
tiny cutovers. Thresholds are research parameters, not release settings.
The host double-precision projection is not a bound on split-matrix GPU
rounding, clipping, texture shimmer, transparent coverage or scene
occlusion. Verify actual renderer matrices and moving stock controls
before considering integration.

## Reproduce

From the repository root with dependencies installed:

```sh
D=tools/art/north-cape-lighthouse/lod
node --test "$D/screen-lod.test.mjs"
node "$D/export-lod.mjs" /tmp/pei-cape-lod-exact-new.json
OPENBLAS_NUM_THREADS=1 python "$D/compare-resolved.py" /tmp/pei-cape-lod-exact-new.json "$D/PRELOCK.json" /tmp/pei-cape-lod-forecast-new.json
```

The Python proxy needs NumPy. Output paths must be new. The comparison
uses original procedural art and no reference photos, game assets, or
stock-world imagery. Nothing here installs a game departure or changes
terrain, collision, model bytes, or the playable build.
