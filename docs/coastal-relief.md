# East Point and West Point: flyable coastal relief

The ground under the two light stations is built from Natural Resources Canada's 1 m bare-earth LiDAR, not estimated from a photograph. Each 256 × 256 m measured window is resampled onto the simulator's metre-scale map. Those two windows total **0.131 km²**; elsewhere the province terrain keeps its existing resolution.

| Window | Runtime grid including the blend back to the province | Compressed |
| --- | --- | ---: |
| East Point, Kings County | 129 × 145 vertices | 15,562 B |
| West Point, Prince County | 145 × 129 vertices | 11,598 B |

Source: [NRCan CanElevation 1 m HRDEM Mosaic, item 10_3](https://datacube.services.geo.ca/pgstac/api/collections/hrdem-mosaic-1m/items/10_3-mosaic-1m). The checked-in [source manifest](../data/coastal-elevation/index.json) pins the source object, native pixel offsets, hashes, sample registration, coordinate system and licence. Contains information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada). This layer uses no Google Maps or Street View pixels.

## What changes in flight

- Each ≈3.40 m × 3.27 m runtime vertex is sampled in the game's axes from the signed CGVD2013 elevations. The 1 m figure is the **input spacing**, not the shipped mesh spacing. Rendered triangles replace the old faces rather than sitting on top of them. Near the stations the contact solver samples those same triangles, including where the survey is *lower* than the old province mesh.
- The native windows contain both land and offshore observations. **Signed elevation is not a shoreline.** The existing continuous shoreline mask determines whether a point has ground or water, including outside the two stations. Water contact uses the rendered ocean plane; the edge walls cover signed land below sea level without changing its relief. Shoreline position, tide and cliff geology are not independently surveyed by this pass.
- The last measured cell tapers into the existing triangulated terrain over 16 m *outside* the measured window. Buildings, vegetation and light stations use the same local height. Ground lighting uses a local slope estimated over neighbouring measurements rather than lighting the two faces of every grid square separately; the older shading is unchanged outside the measured footprint and its narrow transition.
- A separate versioned, verified gzip pack is available for each site. A missing, corrupt or delayed pack keeps that site on the province mesh for the flight rather than changing contact beneath the player. The entire two-site transfer is **27,160 bytes**; the shipped game never opens the large source mosaic. Add `?diagnostics` to the game URL to inspect installed site IDs under `window.islandAirDiagnostics.coastalSurveys`.

## Measured limits

A held-out, nonvertex check of all 131,072 native cells across both sites found 93,074 covered-land samples. On the inner measured area, the 90th-percentile vertical difference from the source was **0.129 m at East Point** and **0.095 m at West Point**. Some narrow coastal breaks are still undersampled: the worst observed errors were **4.05 m East** and **0.89 m West**. The shoreline mask and the 3.3 m mesh therefore still limit low-altitude fidelity, even where most of the ground agrees closely with its source.

The West Point input predates the [Cedar Dunes shoreline works documented by
the Province](https://www.princeedwardisland.ca/en/news/popular-pei-provincial-park-protected-for-generations),
including reefs, a groyne and later sand nourishment. No post-construction
survey was baked in this pass. A mismatch with a later photograph is not by
itself evidence of a rendering fault; first check the capture date and overlap
with the work.

## Reproduce

With a local Python/GDAL installation, run `/usr/bin/python3 tools/terrain/bake-coastal-surveys.py` from the checkout. It uses only the two versioned native windows and the checked-in province atlas; no remote fetch, password or API key is required. `npm run check` covers pack decoding/failover, actual indexed Three.js meshes at every terrain LOD, contact and boundary continuity, and masking of the local normal field. The [legacy calibration](qa/COAST-ELEVATION-BASELINE.md) remains available for comparison. These are same-source interpolation checks, not independent survey accuracy or a claim of province-wide photorealism.

See the [runtime release gate](qa/coastal-runtime.md) for the independent
mesh/contact measurements, off-site controls, browser fault injection and
camera-locked comparisons.
