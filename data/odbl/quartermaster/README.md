# Quartermaster Marina source data

[© OpenStreetMap contributors](https://www.openstreetmap.org/copyright). The isolated source records in this directory and their downloadable derivative assets are available under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Neither download is a merged copy of the province atlas.

| Record | What is pinned | Separable game derivative |
| --- | --- | --- |
| [`coast.json`](coast.json) | Ordered positions from [coastline way 251166158, version 30](https://www.openstreetmap.org/way/251166158/history). Direction distinguishes land from water. | [`quartermaster-coast.rg.gz`](../../../public/world/harbour/odbl/v1/quartermaster-coast.rg.gz): a two-channel, wet-only signed-distance and taper raster. |
| [`docks.json`](docks.json) | 33 selected linear `man_made=pier` ways; IDs, way versions, original point order, WGS84 positions and direct, source-node junctions with the three main pier axes. | [`quartermaster-docks.json.gz`](../../../public/world/harbour/odbl/v1/quartermaster-docks.json.gz): document with local-metre dock deck patch and perimeter rings, nominal model widths and accepted source lengths. |

Both omit unrelated OSM records and user/uploader metadata. They do not encode marine survey coordinates, approach/depth soundings, slip assignments, tides, current clearance or navigation instructions. Run `/usr/bin/python3 tools/terrain/bake-quartermaster-coast.py` (NumPy) or `/usr/bin/python3 tools/terrain/bake-quartermaster-docks.py` (NumPy and GDAL/GEOS) from the repository root to reproduce the asset from these committed records. The docks bake also checks the pinned basin and existing province Cover asset. See [basin development notes](../../../docs/qa/quartermaster-coast.md) and [floating dock development notes](../../../docs/qa/quartermaster-docks.md).
