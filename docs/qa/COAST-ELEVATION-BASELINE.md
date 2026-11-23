# Native-resolution coast control windows

Two fixed 256 × 256 windows around the East Point and West Point light
stations give future terrain changes actual metre-grid controls on different
coasts. They are kept outside `public/`, contribute **zero player download
bytes**, and do not render or alter the present shoreline or collision.

The windows are north-first, one-metre pixel-area samples from Natural
Resources Canada's bare-earth HRDEM mosaic. Pixel centres are shifted
½ m from the upper-left corner recorded in the manifest, in NAD83(CSRS) /
Canada Atlas Lambert (EPSG:3979). Elevations are orthometric **CGVD2013**
(EPSG:6647). The int16 packing rounds to the nearest centimetre; that is
storage precision, not an accuracy claim. Both windows contain valid source
heights **including negative heights and records offshore**. The coverage
mask is not a coastline, and the source is not a bathymetric chart.

## Current near mesh versus the native samples

Four-metre-strided native cell centres, 4,096 per window, were converted to
the game's frame. The modeled near mesh uses the real plane-triangle
diagonal rather than bilinear texture values. Add the same 0.12 m lift as
the game, then remove it for the survey comparison. Distances on this
table are computed only where **both current game land masks** agree on land;
they cannot establish the true land/water boundary.

| Existing mesh scene | Cells compared | Mesh-to-source p90 | Mesh-to-source p90 within 20 m of mask | Mesh vs gameplay-contact p90 |
| --- | ---: | ---: | ---: | ---: |
| East Point | 2,584 | 3.90 m | 5.23 m (421 cells) | 0.62 m |
| West Point | 2,961 | 1.15 m | 1.06 m (288 cells) | 0.26 m |

This is a **same-source, different-resolution** comparison, not ground truth or
a measured improvement to the game. The present coarse atlas already uses
the same DTM through a resampling pipeline. There were 248 and 181
disagreements between the two existing game masks in these sparse samples.
Keep mismatched-mask points visible in future reports instead of using them
to infer source errors, tides or a surveyed shoreline. See the
[full results](terrain-mesh-baseline.json).

## Reproduce

With Python GDAL bindings, NumPy (for the optional download), and the
simulator's normal Node runtime installed:

```sh
# Offline: verifies the pinned decoded hashes before making observations.
node --experimental-strip-types --test tools/qa/rendered-surface.test.ts
python3 tools/qa/coast-window-points.py \
  | node --experimental-strip-types tools/qa/terrain-mesh-baseline.ts \
  > /tmp/pei-terrain-mesh-baseline.json
diff -u docs/qa/terrain-mesh-baseline.json /tmp/pei-terrain-mesh-baseline.json

# Optional online re-read; use a separate output directory.
python3 tools/geodata/bake-coast-windows.py --out /tmp/pei-coast-windows
```

The online prep verifies the source ETag and range support and reads only
the two windows, not the full national raster. The
[manifest](../../data/coastal-elevation/index.json) records source offsets,
native and rounded checksums, and NoData handling. Evaluate any renderable
replacement against independently selected inland/shore/slope bins,
mesh/collision agreement, neighboring LOD seams, and the existing
East Point void and Cavendish water-overdraw browser tests. Do not use the
windows to define a new coast without independent mask evidence.

Contains information licensed under the
[Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
Source: Natural Resources Canada
[CanElevation HRDEM mosaic, item 10_3-mosaic-1m](https://datacube.services.geo.ca/pgstac/api/collections/hrdem-mosaic-1m/items/10_3-mosaic-1m)
and its [product specification](https://download-telecharger.services.geo.ca/pub/elevation/dem_mne/HRDEMmosaic_mosaiqueMNEHR/HRDEM_Mosaic_Product_Specification.pdf).
