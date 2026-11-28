# Offline grain-corn coverage and depth atlas

This workbench bakes two original eight-stalk stands from the
[reviewed weathered Three.js anatomy generator](../grain-corn-anatomy/).
It does not add a runtime texture, change a field, or claim the
appearance or planting of a particular Prince Edward Island farm.
The [dated crop location check](../../geodata/province-fields/grain-corn.md)
is separate from the foliage art.

- **Same authored geometry, sixteen views.** Two orthographic elevation
  bands (25° and 64°) and four 90° yaw sectors. All source pages use the
  same local root and 5.2 m frame. The [contact sheet](source-angle-sheet.webp)
  shows the actual source angles. No source image, bitmap brush, map tile,
  view synthesis, or network lookup is used in this pipeline.
- **Independent colour and coverage.** Native Mesa GLES renders 256 × 256
  with actual 4× samples over transparent black. Stored RGBA8 is linear,
  associated RGB and coverage. The preview contact sheet alone applies
  a display transfer. Each angle’s mip levels are reduced from its own
  base; no neighbouring page contributes.
- **Matched source depth.** A second native pass adds the original
  eye-space depth with a centroid-qualified interpolant. The coverage
  and its original red/green colour witnesses match the first pass
  exactly. Store associated depth and its coverage in RG8, with an
  eye-depth range of 7.4–12.6 m. This is a **first moment**, not an exact
  four-sample depth surface; a coarse texel may combine unrelated leaves.
  Zero coverage has no depth. A very small coverage or a quantized zero
  red depth moment also does not establish a front surface.
- **Integer replay.** The [verification receipt](source-verification.json)
  checks 112 colour/depth pairs, exact alpha peer, known 4× alpha codes,
  strictly shared output width and the original base-page border. Each
  mip is rounded once to nearest even using its full-resolution block.
  Linear radiance, coverage and the associated depth moment are all
  checked independently against integer sums.

## Reproduce

Install the repository's locked Node dependencies. The native offline
workbench uses Python 3, NumPy, Pillow, and Mesa EGL/GLES. From this folder:

```sh
work="$(mktemp -d)"
node --experimental-transform-types atlas-packet.mjs > "$work/source.json"
PYTHONDONTWRITEBYTECODE=1 python3 bake-atlas.py "$work/colour" < "$work/source.json"
python3 depth-packet.py < "$work/source.json" > "$work/depth.json"
PYTHONDONTWRITEBYTECODE=1 python3 bake-depth.py "$work/depth" "$work/colour" < "$work/depth.json"
python3 verify-atlas.py "$work/colour" "$work/depth"
```

The bake refuses an existing output directory. The complete local
research export contains about 8 MiB of raw colour and depth words;
none is bundled in the web build or in this directory. The WebP sheet
is a display artifact, not mip input or the canonical raw comparison.

## In-flight use: HOLD

A plausible source page does not prove stable transitions between
views. Separate first-view tests exposed missing leaves with a
simple depth projection, and crossfading unaligned source views
can double edges. Do not use these pages without a captured comparison
to original held-out views, a moving-camera comparison at native pixel
scale, and local ownership, shadow, draw and cost checks in the player.
This workbench does not replace the standard game material or field data.
