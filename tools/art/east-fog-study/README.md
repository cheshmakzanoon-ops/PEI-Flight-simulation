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
