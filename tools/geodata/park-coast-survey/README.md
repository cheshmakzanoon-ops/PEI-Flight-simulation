# Parks Canada historical check: northwest Cavendish

A useful way to verify the [historical CanCoast classification](../cancoast-headlands/)
is to compare it with independent, dated transect observations. This study keeps
the exact northwest Cavendish rectangle already reviewed. The observations
do not settle the archetypal "red cliff" art question across the whole named
Cavendish coast.

| Source | Valid points inside this rectangle | Nearest clipped CanCoast distance, median | Median stock approximate shore distance |
| --- | ---: | ---: | ---: |
| Measured ground transects, 2008–2010 in this rectangle | 60 Till | 59.8 m | +60.3 m |
| Digitized shoreline transects, 2010 and 2012 | 58 Till | 64.8 m | +65.0 m |

The regional class here is compatible with the broad CanCoast *thick and
continuous till* class, but **there are no sample/segment pairs within 25 m**
in either source. This is not correlation at feature scale. The other
Cavendish remote-sensing transects include 952 Sandstone observations, all
outside the northwest rectangle. Do not exchange these material categories
at the edge of a bounding box or color the entire coast from this result.

Parks Canada's observations specify northing/easting in a provincial NAD83
(CSRS) double stereographic system. The source does not state a precise
realization; this replay uses GDAL's generic EPSG:2954 → EPSG:4326
transformation with network grids disabled. It preserves the original
easting/northing strings and CSV line identifiers. It excludes 19 explicit
remote-sensing placeholder records with zero coordinates and no intersection
date rather than plotting them as points. Further, each positive signed
distance is relative to the simulator's coarse decoded cover/terrain
approximation, positive landward. The dataset does **not** establish the
current cliff, water's edge, elevation, wetting, erosion velocity,
materials at a mesh vertex, or a legal boundary.

## Reproduce

Get the three CSV files from the [Parks Canada catalogue record](https://open.canada.ca/data/en/dataset/12e17685-405d-4f7e-8c46-404323daf70d)
([machine-readable metadata](https://open.canada.ca/data/api/3/action/package_show?id=12e17685-405d-4f7e-8c46-404323daf70d)).
Pass the ground survey, remote survey and data dictionary in that order
from the repository root. The importer refuses unrecognized files.

```sh
python tools/geodata/park-coast-survey/retain.py GROUND.csv REMOTE.csv DICTIONARY.csv /tmp/cavendish-points.json
node --experimental-strip-types tools/geodata/park-coast-survey/compare.mjs /tmp/cavendish-points.json /tmp/cavendish-compare.json
```

The comparison loads the existing signed terrain/cover, never edits them,
and checks the nearest clipped segment in the simulator's same horizontal
projection. Both output JSONs are under
[`data/park-coast-survey`](../../../data/park-coast-survey/). Consult the
[provincial projection definition](https://www.princeedwardisland.ca/sites/default/files/legislation/l02-2-1-land_survey_act_spatial_referencing_regulations.pdf)
for the reference meaning. Provenance: Parks Canada, *Coastal Erosion -
Prince Edward Island*. Contains information licensed under the
[Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
