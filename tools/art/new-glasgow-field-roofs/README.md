# New Glasgow field roofs: dated evidence

A check of two anonymous buildings visible from the
[New Glasgow farm-edge flight](../../../docs/qa/new-glasgow-field-edge.md).
The regular building atlas emits the two signed footprints as flat roofs.
Their existing caps and walls remain unchanged after the geometry checks.

## Measured height: keep the original geometry

The exact `q03301` building range includes outlines 11 and 13. Their
whole-perimeter points are signed. The unwarped
[2020 CanElevation DTM and DSM](https://datacube.services.geo.ca/pgstac/api/collections/hrdem-lidar/items/PEI-Prince_Edward_Island_2020-1m)
are 1 m samples in the same nominal vertical datum as the game, but do
not establish the current eaves, materials or elevations between samples.

- **11:** The [new bounded source window](evidence/q03301-11-source.json)
  supplies all selected cells. An alternate plane fit the training
  sample but had 0.767 m mean absolute error on
  [independent held strips](evidence/q03301-11-held.json), compared
  with 0.261 m for the game's existing flat cap. Keep the cap.
- **13:** The [registered inner-plane trial](evidence/q03301-13-A-terminal.json)
  had 0.791 m 90th-percentile error in calibration, above its 0.40 m
  ceiling. The holdout was not read. This does not rule out other
  roof forms; it does rule out replacing the shape with this one.

## Separate overhead appearance reference

Two neighbouring 256 px map tiles in the same
[PEI 2020 orthophoto](https://www.arcgis.com/home/item.html?id=2e9d3e4ce0c548a19cba5327607a4754)
give [a broad overhead colour cue](evidence/ortho-tone-evidence.json):
the original outline 13 is consistently light and low-chroma across
two fixed interior checkerboard groups. Outline 11 is mixed. This is
not calibrated albedo, facade photography, or evidence of current
paint. The imagery files and pixels are not included. No roof geometry,
wall detail or imagery is installed by this study.

Numerical height and building evidence contains information licensed under
the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
