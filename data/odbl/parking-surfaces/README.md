# Mapped parking surface source

© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
This derivative database is available under the
[Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
The pinned source is the
[November 1, 2026 Geofabrik PEI archive](https://download.geofabrik.de/north-america/canada/prince-edward-island/prince-edward-island-261101.osm.pbf).
Source and packing checksums are in [selection.json](selection.json).

`sources.json.gz` is UTF-8 JSON. It contains the selected ground-level
`amenity=parking` way/relation identifiers, explicit surface tags and original
WGS84 rings (`[longitude,latitude]`, exterior then holes; closure omitted).
`tilePieceSourceIds` links each accepted and hazard-clipped runtime piece to
its source and tile. It contains no address labels, owners, contributor
identifiers, photographs, occupancy, access recommendations or marked stalls.

The derived `public/world/ground/odbl/v1/parking-surfaces.bin.gz` pack
contains screened local metre positions rounded to millimetres and 8-bit
edge weights. Its little-endian PKG1 header, band layout and bounded
decoder are in [parking-surfaces.ts](../../../src/render/parking-surfaces.ts).
National Road Network and aerial building sources are separately maintained
under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada);
their ordinary atlas content is not redistributed in this package.
