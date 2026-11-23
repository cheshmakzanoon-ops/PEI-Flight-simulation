# Water Street roof-height evidence

Natural Resources Canada
[CanElevation HRDEM Mosaic](https://open.canada.ca/data/en/dataset/0fe65119-e96e-4a57-8bfe-9d9245fba06b),
[STAC 10_3-mosaic-1m](https://datacube.services.geo.ca/stac/api/collections/hrdem-mosaic-1m/items/10_3-mosaic-1m).
Source shapes: [Automatically Extracted Buildings](https://open.canada.ca/data/en/dataset/7a5cda52-c7df-427f-9ced-26f19a8a64d6),
PEI 2020 LiDAR. Contains information licensed under the
[Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).

The aligned north-up 1 m raw surface and bare-earth raster window is 578 × 384
pixels, native EPSG:3979, first pixel centre **2,330,153.5 E, 292,181.5 N**.
Assets: [surface DSM](https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-mosaic-1m/10_3-mosaic-1m-dsm.tif)
and [bare-earth DTM](https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-mosaic-1m/10_3-mosaic-1m-dtm.tif).
Only valid native cells no less than 1.12 m inside the registered outline and
with plausible above-ground heights were considered. A 3 m spatial block
fold stays out of the fitted geometry and is reproduced as
`native-blind-cells.json.gz`. Rows contain atlas feature ordinal plus
`[nativeEasting − .5, nativeNorthing − .5, absolute DSM elevation metres]`
for each reserved cell. Heights use the source CGVD2013 vertical datum.
The metric reports establish rendered height fidelity against this historic
survey, not the current condition of each building.

[Model-selection receipt](roof-audit.json) records all six tested original
atlas shapes, including the one kept unchanged, and the independent
OpenStreetMap matching parts are [separately licensed](../odbl/water-street).
