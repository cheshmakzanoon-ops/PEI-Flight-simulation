# Terrain-seated nearby woodland shadows

The optional `?woodland3D` preview now seats the closest eligible **existing**
forest shadows against the same regular terrain facets used by the renderer.
The old renderer placed each projected shadow on a single horizontal plane
anchored to the tree's stem. On slopes, the plane could cut into or float
above the land before the correct darkening reached the surface.

The shadow's plan-view size, offset, orientation, alpha texture, tree type
and projected color stay the same. The new mesh splits its original footprint
on the regular terrain faces and places them 24 mm above that surface for
visual separation. This does not change the estimated time of day, tree
positions, elevations, other shadows, ground material or aircraft collision.
The shadow artwork remains a stylized approximation, not a separately
measured transmission model of every branch.

- The nearest accepted stems fade over the original 38–50 m viewing range
  and use the existing 39–112 m AGL blend. More distant, unapproved
  and unselected stems keep the old shadow.
- Shore, runways, specifically surveyed terrain and admitted adaptive
  tiles retain the original path. Changes in adaptive admission refresh
  only the dependent near footprint list; they do not remove shadows
  permanently. No effect occurs without the existing near-woodland option.
- Support is only for regular near terrain. The selected branch set guarantees
  the floor's neighboring terrain tile is still using regular near detail.
  No new lights, occlusion atlas, visible tree positions or download are added.

## Fixed render and geometry checks

[Locked view comparisons](grounded-woodland-comparison.webp) |
[Verification receipt](grounded-woodland-shadow-gate.json)

Across three sampled near woodland areas, 5,631 of 49,450 probes hit
locations where the old horizontal projection lay below the regular ground;
13,910 sampled points were more than 0.45 m above it. These samples describe
existing simulator geometry, not measured shadows in PEI. The replacement
uses the renderer's existing land contours and one extra batched draw.
The close views change only the union of old and new shadow projections.
The high, non-admitted control is exact. Both optional woodland art modes
can be enabled together without moving the foliage or floor geometry.

```sh
npm run check
node --experimental-transform-types tools/qa/woodland-shadow-contact.mjs
python tools/qa/grounded-tree-shadow-frames.py --checkout . --deps node_modules \
  --out /tmp/grounded-shadow-views --chromium /path/to/chromium
```
