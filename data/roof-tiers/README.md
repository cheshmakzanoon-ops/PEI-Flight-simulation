# Local classified roof evidence

Contains information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).

The [Quartermaster census manifest](quartermaster-roof-cells.json) describes one footprint in the unchanged [PEI 2020 NRCan building atlas](https://open.canada.ca/data/en/dataset/7a5cda52-c7df-427f-9ced-26f19a8a64d6). Its companion [compressed census](quartermaster-roof-cells.i16.gz) contains only one-metre cell aggregates, not the raw provincial raster, raw point returns, an image or interior plans.

Each six-value little-endian `int16` record contains an integer column/row offset, DSM height in centimetres, number of available unwithheld class-6 building returns in the cell, class-6 median height in centimetres, and class-6 interquantile (p90−p10) spread in centimetres. The manifest supplies exact EPSG:3979 origin and order, original horizontal COPC CRS, official links, footprint indices, evidence fingerprints and missing sentinel. The roof evidence comes from [CanElevation 1 m DSM and DTM](https://datacube.services.geo.ca/stac/api/collections/hrdem-mosaic-1m/items/10_3-mosaic-1m) and [CanElevation LiDAR Point Clouds](https://open.canada.ca/data/en/dataset/7069387e-9986-4297-9f55-0288e9676947), not modern street photography. They are different representations of a related survey, not independent captures. No raw classification by itself proves a named rooftop use or present-day construction.

[Method and testing](../../docs/qa/quartermaster-roof.md).

The [Souris manifest](souris-roof-cells.json) and [compressed census](souris-roof-cells.i16.gz) follow the same format for the Kings County footprint `q131 #221`. See the [Souris ridge and upper-tier gates](../../docs/qa/souris-roof.md).
