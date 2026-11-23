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

### Building streaming

The building layer starts with the index and loads compressed tiles near the
aircraft. On static hosts that support HTTP byte ranges, it transfers only the
requested tile spans of the 3.84 MB pack. Simple servers that return the full
file still work: a single shared download supplies all subsequent tile reads.
The same geometry is used in both cases; the pack does not shrink or change.
This is separate from the satellite imagery stream.

The browser gate waited for every requested mesh at Cavendish, Charlottetown,
Summerside and Montague, then flew from Montague. At the cold Cavendish
departure it transferred 128,524 bytes over 8 range responses instead of the
complete 3,844,984-byte pack (96.7% fewer building bytes). Across all four
locations the range server delivered 1,242,972 bytes in 87 responses (67.7%
fewer), while the fallback server delivered the full pack exactly once. Mesh,
draw, and triangle counts matched between servers. These are building bytes,
not total download size, frame rate, or a player throughput benchmark.

Repeat the browser test locally with `npm run build`, Python Playwright and
Chromium. Run `tools/qa/building-range-gate.py` for both `--mode 200` and
`--mode 206`; see its command line help for paths.
Add `--first-pack-503` to deliberately interrupt the first tile request.
The client keeps concurrent waiters behind the initial probe while it retries.
Transient connections and selected temporary server errors get at most two
retries; missing files, rate limits, and invalid ranges or lengths fail without
retry. Both host modes recovered every requested building mesh in browser testing;
the range-less server still transferred the complete pack only once.

### Survey-supported roofs

Three fitted roofs are rendered from screened 1 m LiDAR samples, one per
county. Read the [geometry gate](qa/ROOF-GEOMETRY.md) for the exact coverage,
measurement method and unchanged fallbacks. This does not imply that other
roofs or street-level details were surveyed at the same resolution. Larger
complexes use separate roof planes where supported: [Charlottetown waterfront](qa/quartermaster-roof.md)
and [Souris](qa/souris-roof.md).

### Near-detail scenes

The regional texture sits underneath **245** 640 × 640 WebP tiles with
roughly 9–10 m ground sampling. Tiles share a common island-wide grid,
are individually checksummed, and load around the aircraft instead of
all at once. Range-aware static hosts send a single tile's bytes; other
hosts can serve the same bundle as a fallback. Run `build_detail.py` with
the pinned colour cache to regenerate them. The source is still
satellite imagery, not street-level photography. Both texture levels use the
[same Sentinel reflectance transfer](qa/satellite-color.md). The terrain no longer draws
[synthetic furrows](qa/field-surface.md) on the generic crop category.

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

## Near-shore continuity

Land, sea and the low-altitude shore mesh use the same province-wide
signed-distance shoreline raster. The new faces connect the shoreline mask
to sea level so raised sections cannot expose the sky beneath them. The
cliff material and shoreline shape are approximations at the atlas resolution,
not a survey of rock strata, beaches or tides. At longer distances these
additional meshes are culled.

The [East and West Point light stations](landmarks/lighthouses.md) are
original, site-specific exteriors. Near both lighthouses, [playable coastal
relief](coastal-relief.md) replaces the regional terrain triangles with
heights derived from native 1 m bare-earth LiDAR. It does not add a new
shoreline or turn the remainder of PEI into a high-resolution survey.

## Woodland height and clearance

[Measured provincial stand heights](qa/forest-height-stream.md) set the
local canopy scale where inventory coverage is available. The optional
layer does not place individual trees or affect collision.

The [building-aware vegetation pass](vegetation-clearance.md) excludes
synthetic stems inside all shipped source roof footprints without applying a
broad clearance buffer. Nearby natural-looking canopies may still overlap
roof outlines; the pass is not a survey of individual trees.
