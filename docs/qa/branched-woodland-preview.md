# Near branched woodland preview

Add `?woodland3D` (or `&woodland3D` beside another query). This preview
replaces the closest forest billboards with actual slender trunks, tapering
branch geometry and foliage clusters at several depths. Angle changes show
parallax, intervening leaves and the inner support structure, rather than
rotating an entire pre-rendered tree toward the camera. The distant tree
layer, hedge positions, ground shadows, flight model and coastline are unchanged.

The four original silhouettes come from the same procedural tree models as
the established canopy illustrations. The replacement keeps each existing
stem's world position, height, width and broad foliage variant. Those are
the simulator's original modeled stems, **not** a new survey of every tree.
The preview changes no ground material, stand distribution, season or
surface collision. Dense canopy lighting and understorey are still simple.

## Range and device constraints

- Visible branch detail fades out between 38 and 50 m from the camera.
  A bounded 57.6 m query prepares all source stems that could enter that
  radius before the next 7.5 m camera rescan. The grid admits no more than
  121 stems even at its densest for these distances, across at most four draws.
- It fades back to the ordinary canopy as the camera climbs from 39 to
  112 m above the surface. A real multisampled drawing buffer is required.
  If absent or if the optional JavaScript chunk fails to load, the original
  canopy is used. No external tree photograph or graphics service is queried.
- These models add real work. Before view-specific submission, a matched Queens scene added four draw
  calls and 127,720 triangles. The [current view culler](woodland-volume-cull.md)
  uses the same branch art and retains the full tree roster, but omits whole
  meshes that cannot contribute to this view. The branch feature stays
  off by default. Submission counts are not device frame rates.

## Tests and art decisions

[Actual renderer comparisons](branched-woodland-comparison.webp) |
[Machine-readable check](branched-woodland-gate.json)

The first true-volume version was too sparse. A later screen-pattern fade
was also rejected because its checkerboard was plainly visible at mid
range. The shipped experiment uses a short, multisample coverage transition,
with denser, varied silhouettes. It adds near structure; it does not make
the forest, shadows, or individual tree inventories photorealistic.

The simulator retains all existing world coordinates and canopy shadow inputs
even when near geometry replaces part of the crown view. Check the distant
control and disabled-MSAA fallback separately. All comparison screenshots are
fixed normal engine renders, with the aircraft and user interface hidden so
that foliage changes can be seen.

```sh
python tools/art/build-woodland-volume.py src/render/woodland-volume.generated.ts
npm run check
python tools/qa/woodland-volume-frames.py --checkout . --deps node_modules \
  --out /tmp/woodland-frames --chromium /path/to/chromium
python tools/qa/woodland-volume-frames.py --checkout . --deps node_modules \
  --out /tmp/woodland-fallback --chromium /path/to/chromium --views queens-close --no-msaa
```

[Regular-terrain shadow seating](grounded-woodland-shadows.md) keeps the existing close forest shade footprints against the slope.
