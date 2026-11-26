# Souris warehouse: dated roof reconstruction

This asset replaces the stock office-shaped volume **in development review only**. It reconstructs the broad form of the two barrel roofs and the lower eastern section of the warehouse beside the trail. It does not install a replacement in the player, move the base terrain, change flight contact, or claim a current as-built survey.

## Source and model

- The [2020 PEI CanElevation survey](https://datacube.services.geo.ca/pgstac/api/collections/hrdem-lidar/items/PEI-Prince_Edward_Island_2020-1m) provides the original [surface](https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-lidar/PEI-Prince_Edward_Island_2020-1m-dsm.tif) and [bare-earth](https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-lidar/PEI-Prince_Edward_Island_2020-1m-dtm.tif) grids under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada). The bounded EPSG:3979 window is `[175357,25152,290,220]`. All 3,006 original grid-cell centres in the old footprint had valid paired values and measured a surface at least 2.683 m above the local terrain model.
- The [CanElevation Automatically Extracted Buildings](https://open.canada.ca/data/en/dataset/7a5cda52-c7df-427f-9ced-26f19a8a64d6) atlas identifies existing owner `q130331/189`. Only its 18 original boundary coordinates and 16 roof triangles define the reconstruction envelope. The archived stock seating supplies each old foot height. For the derived roof, the paired height difference is added to the interpolated virtual seat plus the old 0.60 m embed depth. It is **not** an orthometric height assigned to the game's coordinate system.
- `dated-cap.json` stores the rounded local footprint, its triangle layout and 2,193 interpolated relative heights, not the original elevation rasters or a photograph. At nine thin perimeter sites where supported bilinear weights were too small, the nearest supported inside-source sample was within 1.21 m. The TypeScript reconstruction rounds local plan coordinates at 10 µm and relative heights at 1 mm. The resulting typed mesh contains 4,096 roof triangles, 576 walls and 4,096 closing underside triangles. Every edge is paired; all 18 original foot ordinates are preserved. The studio can omit the underside from its view, but no player or caster uses that option.

## Verified and remaining

The [measurements](evidence.json) distinguish three checks: the emitted model's fit to its own dated input, a separate four-metre blocked test of source-field continuity using a different interpolator, and a native accelerated replay of the development model. The replay changed 11,247 pixels by more than two RGB codes; two independent sentinel-colour passes bounded all changes to the old or new visible building. Alpha and the restored frame were exact. The tested development model cost one draw and 8,716 more triangles than stock in this view. It does not establish device performance. The compact TypeScript model was checked against the replay model's vertices to within 0.022 mm horizontally and 0.50 mm vertically.

The flight view resolves the curved roof forms, but the stock outline cuts through the rolled exterior and produces overly tall proxy sides. Original lidar confirms some elevated first returns just outside the west and middle stock edge. It does not justify installing a uniform extended perimeter, changing the current terrain, or reconstructing the exact outside wall. Current eaves, exterior finish and placement remain held. The separate `q130331/99` Crockett House actor is not part of this asset.

Run the topology and renderer-geometry test from the repository root:

```sh
node --experimental-strip-types --test test/souris-pond-dated-cap.test.ts
```
