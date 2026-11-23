# PEI farm scenery data

This pass joins 2020 Natural Resources Canada building footprints and 1 m
elevations to the Province of PEI’s 2020 Corporate Land Use Inventory
`AGR/FM` farmstead class. The row bundle is a derivative for scenery, not a
farm registry. It does not identify owners, uses of individual buildings,
openings, cladding, current conditions, or site activity.

- `clui-farmsteads-receipt.json`: exact ArcGIS query, sorted-ID digest,
  and content fingerprints for all 3,107 farmstead polygons. Raw
  polygons are not required by the game.
- `fit-report.json`: method and building-level held-out statistics for
  the selected 929 rows.
- `native-window-evidence.json.gz`: deterministic compressed audit
  rows, sorted by atlas tile and original undisturbed feature ordinal.
  Each row has one little-endian float32 DSM+DTM window fingerprint,
  model family, interior source sample counts, withheld sample error and
  approximate material variant; none of this file is fetched by the game.
- `src/render/farm-shells.generated.ts`: compact feature keys,
  survey profile corners and illustrative access-side/style IDs.

Contains information licensed under the
[Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada)
(Natural Resources Canada 2020 PEI LiDAR building/DEM products and Statistics
Canada National Road Network PEI edition 22_1) and the
[Open Government Licence – Prince Edward Island](https://www.princeedwardisland.ca/en/information/finance/open-government-licence-prince-edward-island)
(Province of Prince Edward Island 2020 Corporate Land Use Inventory).
No third-party photograph pixels are in either data artifact.

See [farm countryside scenery](../../docs/qa/farm-architecture.md) for data
screening, imagery references, exact restrictions and reproduction.
