# Small-footprint foliage transport

This workbench tests a **detached far-distance rendering method**, not
playable scenery. It uses two original eight-stalk clusters generated
from the [weathered maize anatomy](../grain-corn-anatomy/). One cluster
is evaluated at a time. Nothing is mounted in the world, added to the
web distribution, or tied to a real planting arrangement.

At small projected sizes, cropping a few high-angle views or switching
between them can change the canopy silhouette. This workbench uses
24 yaw sectors per turn at three low elevations (10°, 14.5°, 19°).
For each cluster, 72 independent angle pages are baked from the
original leaves using actual native 4× samples. The 144 total pages
carry linear, associated colour and coverage. The four explicit mips
per page use 783,360 input bytes, with no cross-page reduction. The
[existing depth atlas](../grain-corn-atlas/) remains a different tool;
the shader here does not infer or modify a depth surface.

## Evidence

- Ten unseen static angles compared with real native original 4× geometry
  reduced to 16 and 32 pixels. The controls are the nearest and linearly
  blended views from the older sparse atlas, regenerated from the
  **same** weathered generator. The dense shader keeps coverage and
  reduces silhouette error against those controls.
- 120 linked Three.js r187 shader frames on a native Mesa 4× linear
  RGBA8 target, at actual 20 and 23 device pixels. The frozen motion
  includes a yaw seam, changing inclination and subpixel placement.
  Each frame is compared with exact-area integration of the
  independently rendered 256 × 256 original geometry, not with a
  colour-corrected screenshot or the atlas at another size.
- The [native contact strip](native-motion-contact.png) fits unscaled
  native crops of the geometry reference and shader output side by
  side. The [receipt](source-proof.json) preserves coverage, phase
  stability and two-background luma error. It does not claim that
  every frame is identical or every narrow leaf is visible.

Reproduce with the repository's locked Node 24 dependencies, Python 3,
NumPy, SciPy, Pillow and Mesa EGL/GLES:

```sh
tool="$PWD/tools/art/grain-corn-far-proof"
"$tool/replay.sh" "$(mktemp -d)/far-check"
```

The bake creates a new local output, captures both real native angle
and motion sets and verifies their metrics. No source imagery or
offline binary atlas is committed.

## In-flight use: HOLD

This is orthographic texture transport with a single isolated
cluster, no live flight camera or ground support. It tests a small
footprint, not near or mid-distance geometric fidelity. It has not
established perspective motion, multi-cluster repetition, clipping,
foliage and road occlusion, correct in-world alpha and depth, distance
transition, lighting, or frame cost at field scale. Any future pilot
preview must stay inside a verified crop receiver, prove a placed
sub-24-pixel bound using the actual view, and fail back to stock.

The separate [native Cape Tryon hold](../../../docs/qa/grain-corn/cape-far-native-hold.md)
records what happened when a first constrained patch reached genuine
flight: linked output and restoration were measurable, but the result
looked like a separate swatch and failed the original full-sample rule.
No in-flight treatment is enabled.
