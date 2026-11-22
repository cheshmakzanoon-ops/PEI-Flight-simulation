# World data and scale

PEI Flight Sim uses a local WGS84 tangent approximation centred at 46.5° N,
63.2° W. X is east, Y is up, and Z is south. A world unit is a metre.
Terrain and texture bounds are `[-64.47, 45.94, -61.93, 47.10]` in
west–south–east–north order. Both rasters are north-first and pixel-area
registered. This is not a surveyed or navigation-grade projection.

| Layer | Input | In-game representation |
| --- | --- | --- |
| Land and coast | Statistics Canada 2021 Census cartographic boundary, PRUID 11 | Rasterized coast mask at approximately 47 m spacing. Narrow sandbars and small islands can disappear at this spacing. |
| Elevation | NRCan CanElevation HRDEM Mosaic, bare-earth LiDAR | 4,096 × 2,720 signed little-endian metre samples. Of 2,536,776 land cells, 2,536,619 have measured data. 157 missing near-shore samples are filled at sea level. |
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

### Near-detail scenes

The regional texture sits underneath **245** 640 × 640 WebP tiles with
roughly 9–10 m ground sampling. Tiles share a common island-wide grid,
are individually checksummed, and load around the aircraft instead of
all at once. Range-aware static hosts send a single tile's bytes; other
hosts can serve the same bundle as a fallback. Run `build_detail.py` with
the pinned colour cache to regenerate them. The source is still
satellite imagery, not street-level photography.

### Additional environment sources

- Land cover is adapted from [ESA WorldCover 2021 v200](https://doi.org/10.5281/zenodo.7254221),
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Contains modified
  Copernicus Sentinel data (2021), processed by the ESA WorldCover consortium.
  Broad classification informs vegetation placement, not exact tree positions.
- The photographic sky is [Kloofendal 48d Partly Cloudy (Pure Sky)](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky)
  by Greg Zaal and Jarod Guest, [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
  It's a lighting reference, not satellite weather or a photograph of PEI.

### Confederation Bridge

The visible bridge follows the [National Road Network](https://open.canada.ca/data/en/dataset/3d282116-e556-400c-9306-ca1a3cada77f)
linework in the PEI 22_1 and New Brunswick 15_0 GeoPackages, joined at their
shared endpoint. Mesh dimensions follow published design references from
the [operator](https://www.confederationbridge.com/about-us/),
[VINCI](https://www.vinci-construction-projets.com/en/realisations/confederation-bridge/)
and [Transport Canada](https://tc.canada.ca/en/marine-transportation/publications/tp-13681-guidelines-navigation-under-confederation-bridge-04-2025).
The deck profile and pier details are visual approximations, not a
structural or navigation model.


### Charlottetown and mainland context

St. Dunstan's Basilica uses an original approximate exterior model. The
nave centre and orientation follow the 2020 NRCan building footprint; the
twin spires, roofline, sanctuary, and Gothic facade are based on the
[Parks Canada heritage description](https://www.pc.gc.ca/apps/dfhd/page_nhs_eng.aspx?id=581).
No photographs are baked into the landmark.

The bridge joins the visible Cape Jourimain shoreline. A low-detail
New Brunswick and Nova Scotia backdrop provides the view across the
strait; those provinces have no playable airfields or ground operations.
The backdrop manifest records the source, resolution and fallback used
for its colours and elevations.
