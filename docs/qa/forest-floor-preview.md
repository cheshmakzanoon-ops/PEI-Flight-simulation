# Woodland floor surface preview

Add `?forestFloor` for a close-layer experiment, or add it alongside the
near woodland geometry. Muted leaf litter and fibrous ground texture soften
the flat green tone beneath existing forest scenery. Lighting uses fine
surface normals and occlusion from two scaled stock scans on the **existing
terrain mesh**. The floor layer adds neither tree positions nor new geometry.

The scans are Rob Tuytel's
[Forest Ground 01](https://polyhaven.com/a/forrest_ground_01) and
[Forest Ground 03](https://polyhaven.com/a/forrest_ground_03), both CC0.
They represent stock natural substrates, not a survey of what grows at a
particular position in PEI. The two packed maps preserve relative luminance,
OpenGL tangent normals and occlusion; a controlled earth-tone mix retains
the existing large-scale shading and moderate green from the satellite layer.
Continuous world-coordinate texture shifts and pixel-footprint filtering
reduce repeated tiling at oblique views.

We resolve the source forest label as an exact **categorical texel** from the
legacy roughly 47 m Cover atlas, not a bilinear value that might coincidentally
equal the forest code. Known shore, separately surveyed or specialized
terrain, steep and distant faces keep their usual materials. The edge fades
only on the forest side of class change. Woodland shadows, roads, canopy
placement, aircraft ground contact, water and the original atlas all keep
their existing geometry. A 42 m transition on ordinary terrain keeps the optional photo layer away from protected survey, harbour and specialty tile boundaries, including diagonals.

Both lossless 384 × 384 maps total 989,030 bytes. The regular simulator
does not fetch them. The opt-in starts the optional pair when the camera is
near low forest, fades the material in once both validate, and leaves the
normal scene alone if either fails. No device frame-rate target is claimed.

## Matched checks

[Actual renderer comparisons](forest-floor-comparison.webp) |
[Machine-readable report](forest-floor-gate.json)

The two locked near frames retain the same draw counts and triangle counts
and change only the eligible ground projection. The high control retained
all 456,192 pixels and requested no floor images. Corrupting one image left
the same number of exact legacy pixels in a separate near render. The
combined near-crown run also left tree, shadow and geometry buffers intact.
These are scoped visual tests, not a claim of surveyed vegetation or completed
understorey.

## Reproduction

[Texture source and hash receipt](../../public/art/forest-floor/sources.json)

Save raw files from the receipt as `<id>-<kind>.jpg` in a directory;
then repack exactly using:

```sh
python tools/terrain/pack-forest-floor.py /path/to/downloads \
  public/art/forest-floor/sources.json public/art/forest-floor \
  src/render/forest-floor.generated.ts
npm run check
python tools/qa/forest-floor-frames.py --checkout . --deps node_modules \
  --out /tmp/forest-floor-views --chromium /path/to/chromium
```

## Connected cover at low altitude

[Compare stock woodland duff with the broader material variation](forest-floor-depth-comparison.webp).
The optional shader now varies damp litter and moss in metre-scale patches
before adding the original two close textures. As the finer grain filters
away, the broader variation preserves some surface contrast instead of
revealing a flat green carpet. This represents plausible material variation,
not mapped floor species, water content or forest management.

In matched low scenes with `?forestFloor&woodland3D`, 189,928 Queens and
137,104 Prince pixels changed by more than two RGB levels, all inside the
eligible ground or its one-pixel edge. Draws and submitted triangles were
identical. The 360 m Queens control held all 456,192 pixels and loaded no
forest-floor textures. There are no new image downloads or geometry.
See the [depth gate](forest-floor-depth-gate.json) for counts and replay with:

```sh
python tools/qa/forest-floor-depth.py --checkout . --deps node_modules \
  --out /tmp/forest-floor-depth --crowns --chromium /path/to/chromium
```

A separate [compiled West Point departure](forest-floor-depth-flight-gate.json)
entered the near forest after 421 m of ordinary flight, loaded the material,
and paused without renderer errors. The default departure also passed and
did not initialize the floor. Reproduce with `forest-floor-depth-flight.py`
under `tools/qa`.
