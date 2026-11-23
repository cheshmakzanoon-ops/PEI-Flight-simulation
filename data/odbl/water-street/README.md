# Water Street reference geometry

© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
[Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/).

`building-part-support.json.gz` contains only the selected OSM public building
way IDs/types and their support rings, plus the exact named public road
centreline geometry used to distinguish street-facing walls. Coordinates
are WGS84 `[longitude, latitude]`; source rings omit the closing vertex.
There are no usernames, contributor details, address labels, photos,
storefront/business labels or occupancy data.

The input is the [November 1, 2026 Geofabrik PEI extract](https://download.geofabrik.de/north-america/canada/prince-edward-island/prince-edward-island-261101.osm.pbf),
SHA-256 `a194019961a640669474f9679a23a8fb9a7522d3ff08f0852e61c4d20d6d4bd7`.
The separately licensed Natural Resources Canada LiDAR roof sample archive
is in [data/water-street](../../water-street). The added Three.js geometry
is a produced work derived from the source references, not OSM imagery.
