# Three exact 1 m inland terrain windows

These three 320 × 320 m **bare-earth source windows** are centred on the
12-second anchor of a separate [offline departure screen](../../../docs/qa/atlas-route-survey-screen.md).
They are not aerial imagery, a replacement heightfield install, tree or
bridge geometry, or a description of current on-the-ground conditions.

| Departure corridor | Valid 1 m samples | Native source elevation span | 90th-percentile absolute separation from the regular atlas mesh |
| --- | ---: | ---: | ---: |
| Miscouche woodland, Prince | 102,400 | 7.46–11.82 m | 0.460 m |
| Hunter River trail, Queens | 102,400 | 18.61–42.35 m | 3.565 m |
| Kings inland meadow | 102,400 | 53.89–71.58 m | 0.733 m |

Hunter River is the strongest of these three starting points for local
terrain work. Its higher whole-window differences include forest cover.
A single parent cell in the coarse open grass/cropland screen has a
3.238 m p90 separation; that does not establish a safe full-cell
replacement. The existing signed trail, buildings, woods/hedges,
roads, water, collision and other protected features still require
independent exclusions. The other two windows are deliberately retained
as smaller-effect comparisons rather than presented as equal successes.

The comparator recreates the regular 112-cell Three.js terrain tile,
using original Float32 geometry axes and the original two triangles at
each cell. It removes the common 0.12 m display lift before comparing.
All kept centres lie within the base dry-land/cover screen and more than
80 m from the approximate stock coast. It compares to the **regular**
surface, not the current local survey variants, living runtime shape,
pilot contact or camera line of sight. Stored centimetre encoding adds
at most 0.005 m numeric rounding; this is **not** a claim of centimetre
survey accuracy.

## Source and replay

Natural Resources Canada, [CanElevation HRDEM Mosaic DTM](https://open.canada.ca/data/en/dataset/0fe65119-e96e-4a57-8bfe-9d9245fba06b).
The first 4,096 bytes and ETag of the official 1 m COG are pinned. Both the
initial probe and subsequent GDAL requests use If-Match. The reader
asks only for the overlapping full-resolution cloud raster blocks; no
regional mosaic or reprojected resample is downloaded or packaged. The
GeoTIFF stores NAD83(CSRS) / Canada Atlas Lambert (EPSG:3979).
It does not embed a vertical CRS. The
[official mosaic specification](https://download-telecharger.services.geo.ca/pub/elevation/dem_mne/HRDEMmosaic_mosaiqueMNEHR/HRDEM_Mosaic_Product_Specification.pdf)
defines the vertical reference as CGVD2013 (EPSG:6647). Only individual
horizontal source sample centres are transformed for the comparison.

[Source windows and registration](../../../data/inland-focal-scout/) are
unmodified 1 m sample locations, with signed centimetre values and both the
source Float32 and published data digests. Contains information licensed
under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
The separately bundled base atlas and land-cover provenance is unchanged.

From the repository root (GDAL/NumPy Python bindings for intake and
gdaltransform and the existing Node dependencies for comparison):

```sh
python tools/terrain/inland-focal-scout/intake.py docs/qa/atlas-route-survey-screen.json /tmp/pei-new-inland-windows
node --experimental-strip-types tools/terrain/inland-focal-scout/compare.mjs /tmp/pei-new-inland-windows /tmp/pei-compared-inland.json
cmp /tmp/pei-compared-inland.json data/inland-focal-scout/compare.json
```
