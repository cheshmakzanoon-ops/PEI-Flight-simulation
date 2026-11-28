# East Point Fog Alarm Building: detached roof study

This is research geometry, not a new playable scenery preset. The installed
East Point and West Point light stations, terrain and flight paths are unchanged.
The original East model placed the smaller roof on the wrong end. The
source-supported order is **tower, lower wing, main roof**. Keep this distinction
when reviewing future integrated scenery.

## Sources and scope

- The signed 2020 Automatically Extracted Buildings geometry already present in
  `public/world/buildings` identifies the fog alarm building as `q1333/65`
  and the separate tower as `q1333/26`. The analytical exterior overlaps the
  original roofprint at 0.866 intersection over union, compared with 0.682 for
  the stock design. A footprint match is not an eave or wall survey.
- Natural Resources Canada's [CanElevation LiDAR Point Clouds](https://open.canada.ca/data/en/dataset/7069387e-9986-4297-9f55-0288e9676947),
  PEI 2020, supplied first exposed classified building returns. The
  [product specification](https://canelevation-lidar-point-clouds.s3.ca-central-1.amazonaws.com/pointclouds_nuagespoints/CanElevation-LiDARPointClouds_products_specs_EN.pdf)
  documents CGVD2013. A separate bare-ground check tied the cloud elevations to
  the official terrain grid without a fitted height offset. Study geometry is
  an original interpretation. Contains information licensed under the
  [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
- The [Canadian Register entry](https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=19205),
  the [2023 PEI State of the Coast report](https://www.princeedwardisland.ca/sites/default/files/publications/2023_pei_state_of_the_coast.pdf)
  and [Quintin Soloviev's August 2023 aerial](https://commons.wikimedia.org/wiki/File:East_Point_Lighthouse_from_above_-_Prince_Edward_Island_-_PEI_(Quintin_Soloviev).png)
  support the identity and visual ordering. No reference pixels, imagery or raw
  classified point data are included or loaded.

## Reproduce the detached geometry

Run `node --experimental-strip-types --test test/east-fog-detached-study.test.ts`.
The tests check the closed exterior, typed geometry fingerprints and exact
preservation of the original opaque tower and outdoor foghorn streams.
An external neutral Chase comparison used the existing East Point lighthouse
departure at 4.0 and 4.7 seconds. The geometry changed visible building pixels
only, leaving both later out-of-aperture controls and the West Point flyby
unchanged. This is optical scope evidence, not approval for release.

The held roof-interior check used points from the same 2020 survey that were
not available to the author. On the main roof, the 90th-percentile absolute
error was 0.206 m over 52 half-metre cells, versus 2.415 m for stock. On the
lower roof it was 0.217 m over 26 cells; the stock roof is absent at those
coordinates, so there is no comparative height error. These scores do not
validate modern eaves, the join, windows, railings, decking or the site shadows.
The scene requires separate visual and physical review before integration.

## Returned eaves and red fascia

[The detached cornice study](east-fog-cornice-study.ts) adds authored red
fascia, exposed rakes, and short eave returns to the corrected two-gable
envelope. The [Canadian Register of Historic Places](https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=19205)
identifies the eave returns and trim as character-defining. The red
finish reuses the simulator's existing station palette. The sections,
projection, and joints are authored visual dimensions, not a field
survey. No photograph, texture, or inferred window layout is included.

All four original Float32 streams for the 402-vertex roof and wall
envelope are unchanged. The study adds 20 closed trim pieces, seated
through their respective wall plane rather than floating as flat cards.
Each long board stops at a small butt joint below its own fitted eave.
The packed trim remains below even the extended roof slopes, and its
plan projects less than 61 mm beyond the corresponding fitted body
outline in this detached model, not beyond a surveyed building outline.
Run the geometry, topology, and scope checks with:

```sh
node --experimental-strip-types --test test/east-fog-cornice.test.ts
```

This file is not imported by the flight renderer. The fog house remains
stock in the live simulator. Close-game comparison, coherent middle- and
near-distance silhouettes, and the matching ground shadow/contact
treatment still need qualification before replacing it. The stock window
geometry does not fit the corrected shell; dated, registered references
are needed before placing windows on the new model.

## Two authored rear-wall sash windows

The [detached sash study](east-fog-authored-sashes.ts) adds two of the
three openings visible in period photographs of the high rear wall.
It does not add a complete window inventory, adapt the opposite
entrance face, or reuse the original simulator's window locations.

- F. Pound’s 2009 rear elevation and contrasting north elevation in
  the [Canadian Register image gallery](https://www.historicplaces.ca/en/rep-reg/image-image.aspx?id=19205)
  establish the wall’s orientation and the visible casing/plinth layout.
- Cosmos Mariner’s [July 2019 photo](https://www.hmdb.org/PhotoFullSize.asp?PhotoID=496662),
  [Peg Frizzell's close photograph published in 2020](https://fanningsparks.com/beacons-of-light/),
  and the cited August 2023 aerial corroborate the high rear wall and
  visible openings. The deck and railing partly obstruct the lower
  photograph edges. The historic red surround and pale upper lights
  are authored interpretations, not claims about today’s paint.

The two authored center fractions are 0.28 and 0.715 along the high rear
wall, starting from its join with the lower wing. This is normalized
placement from dated visual references, not a survey. The model uses an
illustrative plinth datum and authored thickness, not a foundation or
ground derived from the photos. The upper and lower divisions have
recessed opaque panes separated by a raised meeting rail; no transparent
sort, cutout, new shader, or photo texture is involved.

Run the standalone geometry study checks from the project root:

```sh
node --experimental-strip-types --test test/east-fog-authored-sashes.test.ts
```

This source is not imported by the game. It changes no building, ground,
collision, coastline or light in the playable build. Native trim/sash
visibility, shadow/contact and consistent distance-level integration are
separate work.

## Assemble the authored exterior

The [detached assembly](east-fog-combined-surface.ts) keeps the corrected
opaque envelope, tower and outdoor exhibits in their existing packed
slots. It appends the two current sash studies and the solid cornice as
separate spans of the same geometry. Its check preserves the exact
stored envelope position, normal, color and cladding words, and does
not accept an indexed or grouped replacement draw.

Separate native normal-camera trials found each window visible at both
near checkpoints without touching other scene pixels. The trim also
passed its two closer checks; at the earlier checkpoint, it changed
partial coverage but did not cover an entire pixel. Both studies
returned to the original scene with bit-exact images. The assembly
does not reuse those results as proof for the combined render. Ground
contact, the cast shadow, and the middle-distance transition still
need joint review. The assembled surface is not in the playable build.

```sh
node --experimental-strip-types --test test/east-fog-combined-surface.test.ts
```

## Original roof and siding finish

The [detached material study](east-fog-surface-finish.ts) layers a restrained
rib rhythm on the corrected roof and subtle variation on the siding.
The cited August 2023 aerial supports the visual roof rhythm, not an exact
rib spacing, roof product, current paint color or measured weathering.
No photo, texture, new material slot, change to shadows, or geometry is
introduced. The finish belongs only to the corrected walls and roof.
It blends out from 177 m to 245 m of view-space range.

In a separate ordinary Chase comparison, the building was visible with
the finish fully off, then showed restrained changes over the roof and
siding at two closer views. Pixels outside the visible surface and both
restored views matched the original. This is an isolated material test:
the live station still uses the old finish, and the assembled geometry
and corrected terrain lighting need a separate combined review.

```sh
node --experimental-strip-types --test test/east-fog-surface-finish.test.ts
```

## Fitted ground contact and cast

The [detached receiver study](east-fog-ground-light-study.ts) checks the
existing East Point terrain receiver source, then substitutes two optional
terms. Contact follows the fitted wings; the cast comes from finite rays
against the [closed bulk geometry](east-fog-static-caster.glsl) in the
simulator's existing daylight direction. Both terms retain their original
behavior when disabled. West Point, the tower and the yard material are
not modeled by these new terms.

An isolated ordinary-flight comparison with the corrected bulk measured
contact and cast separately and together. The new shadow removed the old
dark patch outside the fitted structure and added shade along the corrected
footprint. Neither a terrain change nor a whole-site survey is implied.
This source remains outside the playable renderer. It does not include the
trim's separate fractional shadow, facade detail or a live level transition.

```sh
node --experimental-strip-types --test test/east-fog-ground-light-study.test.ts
```

## Keep the two distance levels consistent

The [fixed-distance geometry study](secondary-fog-lod.ts) keeps the
same fitted shell in the near and middle levels. The cornice recedes
toward its fitted roof pivots and the sashes translate into their own
wall over 500–640 m. Neither operation changes the shell, exhibit or
tower. The authored details are fully enclosed by 600 m, before the
original 690 m inbound and 750 m outbound level switches.

The [detached vertex equation](secondary-fog-vertex-program.ts) uses
the same shape model. It has linked against the original Three.js shader
in isolation; no frame timing, middle-distance optics, collision,
weather, alternate sun or release is implied. The actual figure needs
both old culling bounds, the original LOD history and a verified
stock fallback. Trim cast must follow the moving trim, not stay behind
as a fixed ground mark.

```sh
node --experimental-strip-types --test test/east-fog-secondary-lod.test.ts
```
