# Stand-informed near conifer crowns

Enable **Near conifer crown shape** in Standard Dispatch, or add
`?woodlandCrownBase` to the simulator URL. This preview includes the
existing near 3D branch and fitted-shadow rendering. If the optional
crown data are unavailable, that earlier near woodland is used without
the new deformation. Standard mode is unchanged. Subpixel alpha
coverage requires a multisampled WebGL 2 drawing buffer.

## What it changes

Bringing the lowest needle foliage off the ground gives trunks and
lower branches more readable space in selected close woodland. The existing
two needle geometry templates are reused. Existing stems, heights, species
assignments, widths, upper crown geometry, broadleaf templates, terrain,
collision and shade geometry are not rewritten by the new source. This
preview doesn't claim to repair stand density; see the
[separate coverage audit](forest-canopy-closure.md).

The height-to-live-crown fraction is an estimated **stand statistic** in
PEI's 2020 Enhanced Forest Inventory, not an observation of the trees
rendered by this simulator. These are plausible art adjustments to
synthesized trees. It is not a post-Fiona inventory or an estimate of
species occupancy. The [Province's dated forestry report](https://www.princeedwardisland.ca/sites/default/files/publications/state_of_the_forest_2020.pdf)
describes the field-plot and lidar project.

The shift is limited to 1.65 m or 10% of the existing tree height, whichever
is smaller. A cubic-weighted taper fixes the original root and upper crown.
Normals account for the vertical change; the physical branches, leaves and
trunk remain connected. The deformation reaches zero at 38 m from the
camera and 39 m above the terrain, before the existing distance and altitude
transitions to simpler crowns. Eligibility is retained in the near roster,
so a late download cannot change a visible tree underneath the aircraft.

## Source and transfer

- The [official EFI2020 archive and metadata](https://data-princeedwardisland-peigov.hub.arcgis.com/datasets/8a7638bdc09648358e0b6fd14be6117a)
  supply the 20 m EPSG:2954 inventory. Contains information licensed under
  the [Open Government Licence – Prince Edward Island](https://www.princeedwardisland.ca/en/information/finance/open-government-licence-prince-edward-island).
- For plausibility, the bake uses finite EFI cells with dominant height
  6–30 m, top height at least 85% of dominant height, and base-to-live-crown
  from 0.4 m up to 82% of dominant height. It encodes `blc/domht` with
  1/128 steps. The outer world grid is reprojected by exact nearest source
  sampling, without filling unsupported cells. At runtime the four taps
  must be valid and reasonably consistent, the original height support
  must agree, and a conservative coastal exclusion is enforced.
- Across the entire encoded layer, 6,539,120 native cells pass these
  plausibility checks. The optional index describes 239 hashed rasters in
  11 packs totaling 5,841,286 bytes. Range-capable hosts download selected
  slices; other hosts download a touched pack once. The near layer uses
  at most one active request and six decoded tiles, with an 850 m
  apron around the camera's active tile. None of these assets is requested
  from Standard mode.

Rebuild with GDAL, NumPy and the pinned official source:

```sh
/usr/bin/python3 tools/terrain/bake-forest-crowns.py \
  --archive /path/to/EFI2020.zip --shape /path/to/extracted/EFI2020.shp \
  --out public/world/woodland/crown-v1
npm run check
```

[Matched grazing views](woodland-crown-base-comparison.webp) reuse the
same Three.js geometry and camera in Prince, Queens and Kings Counties
(top to bottom; old on the left, new on the right).
Every pair kept the draw and triangle counts unchanged; the effect was
confined to crown/trunk pixels and their antialias edges. There were
37,614 / 20,023 / 13,382 pixels above a two-code RGB change in these
matched 460 × 338 views. Locked 42 m and
152 m controls were byte-identical. This is close art and coverage QA,
not a GPU frame-rate claim.

For the matched renderer, motion and ordinary flight gates:

```sh
python tools/qa/woodland-crown-base-frames.py --checkout . --deps node_modules \
  --out /tmp/pei-crown-frames --chromium /path/to/chromium
python tools/qa/woodland-crown-base-motion.py --checkout . --deps node_modules \
  --out /tmp/pei-crown-motion --chromium /path/to/chromium
python tools/qa/woodland-crown-base-flight.py --dist dist \
  --out /tmp/pei-crown-flight.json --chromium /path/to/chromium
```

The fixed camera tests compare against the *same* resident 3D woodland
cohort with deformation disabled. The existing height and crown streams
both warm the selected opt-in departure. The timing of the first
inventory-height load can differ from an untouched Standard departure.
The compiled flight gate flies and pauses using ordinary controls,
including without the review, with a conflicting terrain review, and
with same-size corrupt optional data.
