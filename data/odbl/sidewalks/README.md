# Mapped sidewalk data

© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
This derivative database is available under the
[Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
It comes from the [November 1, 2026 Geofabrik PEI archive](https://download.geofabrik.de/north-america/canada/prince-edward-island/prince-edward-island-261101.osm.pbf).
Fingerprints and counts are in [selection.json](selection.json). No map imagery,
personal information, contributor/account data, addresses or names are included.

`mapped-sidewalks.json.gz` is UTF-8 JSON. `ways` contains the contributing OSM
way IDs, their original WGS84 `[longitude,latitude]` node order, source surface
and optional source width. `widthCm` gives the in-game rendering width;
`declaredWidth` tells whether the source explicitly provided it.
`fragmentsXZcm` stores
`[style,widthCm,jointPhase,[[xCm,zCm],...],[sourceWayIds,...]]`.
Style codes are 0 cast concrete, 1 concrete slabs, 2 pavers, 3 brick, 4 sett,
5 asphalt. A scene unit is a metre, X east and Z south. The exact same selected
geometry is in the compact runtime `public/world/pedestrian/odbl/v1/sidewalks.bin.gz`
(SWK1 little-endian; [reader](../../../src/render/sidewalks.ts)).

The OSM paths and associated tags are the separately identified database.
The NRCan survey and Statistics Canada road/boundary geometry used to exclude
overlaps remain [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada)
inputs and are not redistributed inside this dataset. The shaders and original
3D appearance are not a claim that joint locations or curb heights were surveyed.
The project retains visible OpenStreetMap attribution in its footer and credits.
