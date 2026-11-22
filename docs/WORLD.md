# World data and scale

PEI Flight Sim uses a local WGS84 tangent approximation centred at 46.5° N,
63.2° W. X is east, Y is up, and Z is south. A world unit is a metre.
Terrain and texture bounds are `[-64.47, 45.94, -61.93, 47.10]` in
west–south–east–north order. Both rasters are north-first and pixel-area
registered. This is not a surveyed or navigation-grade projection.

| Layer | Input | In-game representation |
| --- | --- | --- |
| Land and coast | Statistics Canada 2021 Census cartographic boundary, PRUID 11 | Rasterized coast mask at approximately 95 m spacing. Narrow sandbars and small islands can disappear at this spacing. |
| Elevation | NRCan CanElevation HRDEM Mosaic, bare-earth LiDAR | 2,048 × 1,360 signed little-endian metre samples. Of 634,164 land cells, 634,142 have measured data. Twenty-two missing near-shore samples are filled at sea level. |
| Surface colour | Copernicus Sentinel-2 L2A, nine scenes acquired in 2025 | Cloud-screened 4,096 × 3,072 natural-colour mosaic. All mask land pixels have an image value; 99.958% passed the accepted scene-class filter. Fine street and roof detail do not come from this texture. |
| Roads | Statistics Canada National Road Network, PEI 22_1 | 19,465 source centreline segments. Width, grade and appearance are visual approximations. |
| Buildings | NRCan Automatically Extracted Buildings, PEI 2020 airborne LiDAR | 85,866 detected footprints with measured roof heights across 295 chunks. Heights and footprints do not establish facade materials, signs, floor plans, occupancy or current businesses. |
| Runways | OurAirports public-domain threshold coordinates | Three strips at Charlottetown and Summerside. Paint and ground detail are simplified. |

## Attribution

Contains modified Copernicus Sentinel data 2025. The source scenes were
accessed via [Earth Search / Sentinel-2 COGs](https://registry.opendata.aws/sentinel-2-l2a-cogs/)
and are used under the [Copernicus Sentinel data licence](https://ewds.climate.copernicus.eu/licences/ec-sentinel).

Contains information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
Sources: [Natural Resources Canada HRDEM Mosaic](https://open.canada.ca/data/en/dataset/0fe65119-e96e-4a57-8bfe-9d9245fba06b),
[Statistics Canada 2021 Census cartographic boundaries](https://www150.statcan.gc.ca/n1/pub/92-160-g/92-160-g2021001-eng.htm),
[Statistics Canada National Road Network](https://open.canada.ca/data/en/dataset/3d282116-e556-400c-9306-ca1a3cada77f),
and [NRCan Automatically Extracted Buildings](https://open.canada.ca/data/en/dataset/7a5cda52-c7df-427f-9ced-26f19a8a64d6).
Runway thresholds are from the [OurAirports data export](https://ourairports.com/data/).
No Google Maps, Google Earth or Street View assets are shipped.

## Verify and rebuild

```sh
node tools/verify-world.mjs
```

The verifier checks the committed assets and manifests without contacting
any provider. The scripts under `tools/geodata/` regenerate the data
from the versioned sources listed in `public/world/`. GDAL and its Python
bindings are required for the vector and terrain tools; the colour tool
uses Rasterio, NumPy, Pillow and Requests. Read each script's `--help`
before running it. The colour script caches gigabytes of source scenes;
do not add source TIFFs or GeoPackages to Git. Check the manifests and
regenerate the checksums whenever a source version or processing rule changes.

## Detail production

The island-wide dataset makes geography continuous; it does not make
every scene photorealistic. The next visual pass adds higher-resolution
terrain tiles, legally reusable regional aerial photography, detailed
materials for sandstone and tidal flats, and surveyed or hand-modelled
landmarks. Assess these at both cruise altitude and approach altitude.
