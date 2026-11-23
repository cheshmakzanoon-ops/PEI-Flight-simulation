# 571 Main Street, Montague: measured cross-gable and verandah

The **Former Augustine C. Macdonald Building**, the historical alternative
name listed for 571 Main Street, replaces one generic gabled shell with
an exact-outline, source-fit exterior.
This is the second independently matched south-bridgehead exterior, not
a rebuild of the district. No current tenant, branding or interior is modeled. The previously improved former Town Hall,
including all its roof and glazed bays, stays unchanged.

- The existing NRCan atlas feature `q103301/350` supplies the whole plan
  (140.590 m² in the game grid). A
  [small attributed OSM witness](../../data/odbl/montague-macdonald) supports
  local identification; its outline does not extend the model.
- The [Canadian Register of Historic Places](https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=9151)
  documents a wood-framed building with sandstone foundations, central
  gable and a south verandah. The covered 1.07 m inboard recess has a distinct
  floor/soffit, five slender timber supports and white inboard knee
  braces. The [Province of PEI photographs dated 2007](https://www.historicplaces.ca/en/rep-reg/image-image.aspx?id=9151)
  informed the original muted ochre, red skirt and white eaves. No photo
  pixels, signage or commercial branding are included and the styling
  does not claim to reflect the property's current appearance. The inboard
  ornament, windows and dimensions are artistic interpretations, not
  surveyed details. Glass uses the existing CC0 sky. No independent
  chimney position is claimed or modeled.
- The actual roof planes use
  [Natural Resources Canada CanElevation 2020 classified LiDAR](https://canelevation-lidar-point-clouds.s3.ca-central-1.amazonaws.com/pointclouds_nuagespoints/PEI/Prince_Edward_Island_2020/pei_2020_427000_679000.copc.laz).
  A main ridge and a crossing centered gable meet a shallow southern
  plane and a lower eastern roof. Three physical wall profiles close their
  discontinuous joins. None of these changes modifies flight contact, roads,
  ground height or local water.

## Source and mesh checks

The [native receipt](../../data/montague-macdonald/native-validation.json)
pins an 11,483-record crop reproduced in 9 range requests (2.275 MB). Only 970 unwithheld class-6 points at least
0.42 m inside the original shell are eligible: 790 for fitting and 180
in spatial blocks held out from optimization. The old and current actual
Three.js meshes both intersect all 180 native rays.

| Absolute raw roof residual | Original | Source-fit |
| --- | ---: | ---: |
| Median | 0.712 m | 0.027 m |
| p90 | 1.008 m | 0.106 m |
| p95 | 2.388 m | 0.132 m |
| Maximum | 5.464 m | 3.917 m |

Two large current residuals are near the measured east step, where
class-6 returns may include the vertical shoulder. They remain in the
comparison; the small median and p90 are not claims of survey-grade
uniform accuracy. All 37,692 unrelated vertices are byte-identical
across six attributes, including the previously released Hall through
the same tile after the streamed terrain imagery blend. Roof projection gap, spill and overlap are each below
0.00028 m². Five horizontal Three.js rays reach the geometry at
1.07–1.193 m inboard of the south face, and 530 profile samples hit
the closing faces of the roof discontinuities. The
[full geometry gate](montague-macdonald-geometry-gate.json) has the details.

Replay with Python NumPy/SciPy, laspy/lazrs and GDAL CLI (OGR/Python GDAL
also needed for projection and optional OSM recheck). Supply a separate
worktree of the immediate predecessor for an actual old-mesh comparison;
it must use the same atlas and precede this replacement.

```sh
python tools/geodata/sample-montague-macdonald.py --out /tmp/pei-571
python tools/geodata/sample-montague-macdonald.py --out /tmp/pei-571 --check-pbf-only --pbf /path/to/prince-edward-island-261101.osm.pbf
python tools/geodata/bake-montague-macdonald.py --source /tmp/pei-571/native-points.npz --out /tmp/pei-571 --verify
node tools/qa/montague-macdonald-mesh.mjs /path/to/predecessor /tmp/pei-571/macdonald-heldout.csv /tmp/pei-571/mesh.json /tmp/pei-571/actual.json
python tools/qa/montague-macdonald-projection.py /tmp/pei-571/actual.json
```

## Actual game view

[Before/after gallery](montague-macdonald-comparison.webp),
[render gate](montague-macdonald-render-gate.json) and
[compiled flight gate](montague-macdonald-flight-gate.json) are software
WebGL checks, not player hardware performance or flying guidance.
The matched fixed cameras keep the scene, water, imagery and streaming
state constant and change only this one atlas feature. The existing
street, terrain, generic neighboring architecture and vegetation are
not recreated in this increment.
The actual local camera pairs at 4.95 m, 4.90 m, 22 m and 118 m show
135,032, 109,848, 34,661 and 1,983 changed pixels beyond four RGB levels
respectively. The 2,334,046 protected local and all 655,360 East Point
pixels are exactly unchanged. Scene captures submit 1,205 additional
triangles through the same existing draw calls. The unmodified production
dispatch from Montague River moved 112.16 m, with all 11 local building
tiles and 18 imagery details ready and no renderer errors or warnings.
