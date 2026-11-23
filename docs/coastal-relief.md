# East Point and West Point: flyable coastal relief

The ground under the two light stations is built from Natural Resources Canada's 1 m bare-earth LiDAR, not estimated from a photograph. Each 256 × 256 m measured window is resampled onto the simulator's metre-scale map. Those two windows total **0.131 km²**; elsewhere the province terrain keeps its existing resolution.

| Window | Runtime grid including the blend back to the province | Compressed |
| --- | --- | ---: |
| East Point, Kings County | 129 × 145 vertices | 15,562 B |
| West Point, Prince County | 145 × 129 vertices | 11,598 B |

Source: [NRCan CanElevation 1 m HRDEM Mosaic, item 10_3](https://datacube.services.geo.ca/pgstac/api/collections/hrdem-mosaic-1m/items/10_3-mosaic-1m). The checked-in [source manifest](../data/coastal-elevation/index.json) pins the source object, native pixel offsets, hashes, sample registration, coordinate system and licence. Contains information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada). This layer uses no Google Maps or Street View pixels.

## What changes in flight

- Each base ≈3.40 m × 3.27 m runtime vertex is sampled in the game's axes from the signed CGVD2013 elevations. The 1 m figure is the **input spacing**, not a province-wide shipped mesh spacing. Rendered triangles replace the old faces rather than sitting on top of them. Near the stations the contact solver samples those same triangles, including where the survey is *lower* than the old province mesh.
- The native windows contain both land and offshore observations. **Signed elevation is not a shoreline.** The existing continuous shoreline mask determines whether a point has ground or water, including outside the two stations. Water contact uses the rendered ocean plane; the edge walls cover signed land below sea level without changing its relief. Shoreline position, tide and cliff geology are not independently surveyed by this pass.
- The last measured cell tapers into the existing triangulated terrain over 16 m *outside* the measured window. Buildings, vegetation and light stations use the same local height. Ground lighting uses a local slope estimated over neighbouring measurements rather than lighting the two faces of every grid square separately; the older shading is unchanged outside the measured footprint and its narrow transition.
- A separate versioned, verified gzip pack is available for each site. A missing, corrupt or delayed pack keeps that site on the province mesh for the flight rather than changing contact beneath the player. The two base-site transfers total **27,160 bytes**; the shipped game never opens the large source mosaic. Add `?diagnostics` to inspect the installed site IDs under `window.islandAirDiagnostics.coastalSurveys` and refinements under `coastalRefinements`.

## Measured limits

The East Point cliff has sharp features smaller than a base grid cell. An optional **15,810-byte** pack subdivides only 518 of East Point’s 18,432 base cells, including the transition. The new triangles are spaced ≈0.85 m × 0.82 m in the simulator, interpolated from the 1 m LiDAR rather than carrying finer independent measurements. Signed land height is shared across rendering and contact; the coastline does not move. If the extra pack is unavailable, both original site grids still work as before. West Point is unchanged.

| East Point visible land, against 43,700 native observations | Base survey | With the cliff refinement |
| --- | ---: | ---: |
| 90th-percentile error | 0.117 m | 0.088 m |
| 95th-percentile error | 0.271 m | 0.135 m |
| Largest error | 4.053 m | 0.995 m |
| Native observations with more than 1 m error | 365 | 0 |

These are differences from the same source used to fit the mesh, not a second survey. The original shoreline mask limits visual fidelity near the coast; this is neither photogrammetry nor a survey of land/water boundaries.

The West Point input predates the [Cedar Dunes shoreline works documented by
the Province](https://www.princeedwardisland.ca/en/news/popular-pei-provincial-park-protected-for-generations),
including reefs, a groyne and later sand nourishment. No post-construction
survey was baked in this pass. A mismatch with a later photograph is not by
itself evidence of a rendering fault; first check the capture date and overlap
with the work.

## Distant relief

The complete 3.3 m base grid and the East Point refinement remain on close approach. At the two more distant terrain detail levels, precomputed, watertight triangles follow the same surface to within **0.09 m** at both stations. This is an error relative to the **shipped close mesh**, not a survey accuracy claim. The surrounding terrain connects to the same exterior edge at every detail level. The East Point refinement pack includes its distant topology; neither site needs more requests as the camera moves.

| Interior geometry only | Near triangles | Distant triangles |
| --- | ---: | ---: |
| East Point, with cliff refinement | 53,412 | 19,846 |
| East Point, fallback | 36,864 | 10,888 |
| West Point | 36,864 | 10,758 |

The terrain generator checks integer grid vertices and points where opposite triangle diagonals cross, rather than checking only the retained vertices. Those points include every possible maximum error between the two piecewise-planar surfaces. The runtime tests repeat the continuous bound on the decoded, edge-welded geometry and check that each interior edge has exactly two incident faces.

See the [matched distant-view gate](qa/coastal-lod.md) for scene budgets and image comparisons.

## Reproduce

With a local Python/GDAL installation, run `/usr/bin/python3 tools/terrain/bake-coastal-surveys.py` from the checkout, then run `python3 tools/terrain/bake-coastal-lod.py` to rebuild the base distant topology and `/usr/bin/python3 tools/terrain/bake-east-cliff.py` to reproduce the optional cliff pack. The bake uses only the two versioned native windows and the checked-in province atlas; no remote fetch, password or API key is required. `npm run check` covers pack decoding/failover, actual indexed Three.js meshes at every terrain LOD, contact and boundary continuity, and masking of the local normal field. The [legacy calibration](qa/COAST-ELEVATION-BASELINE.md) remains available for comparison. These are same-source interpolation checks, not independent survey accuracy or a claim of province-wide photorealism.

See the [East Point refinement release gate](qa/coastal-cliff.md) for the independent
browser census, error distributions, transects and verified fallback.

See the [runtime release gate](qa/coastal-runtime.md) for the independent
mesh/contact measurements, off-site controls, browser fault injection and
camera-locked comparisons.
