# East Point village · two measured roof-shape hypotheses

The [playable East Point façade option](../../../docs/qa/east-point-wall-finish/)
changes materials only. This independent study goes after the simplified
roof silhouettes. It keeps the exact existing footprint of each candidate
and recreates two sloping roof caps in Three.js. Neither cap is attached
to the game's buildings. No walls, eaves, plants, contact, optics or
routes are changed.

The trial screened all **twelve** already identified ordinary wall owners
in exact signed building range q1333. A 250 × 227 m native **1 m** CanElevation
DTM/DSM crop was read with conditional range windows and no resampling.
Each eligible upper-surface point is at least 1.5 m inside the signed
plan and 1–100 m above its bare-earth counterpart. Median errors compare
a flat model, a single inclined plane and a symmetric two-plane ridge
using four spatial folds. These are held-out positions in one source
mosaic, not independent roof surveys. A low error alone is insufficient:
an inadequately supported slope, too few samples or an unstable fit
keeps the building unchanged.

| Signed q1333 row | Inboard centres | Flat / single-plane / ridge median | Ridge p90 | Detached cap |
| --- | ---: | ---: | ---: | ---: |
| 48 | 88 | 0.47 / 0.45 / 0.07 m | 0.33 m | 16 triangles; 151.534 m² exact plan projection |
| 49 | 68 | 0.35 / 0.38 / 0.08 m | 0.15 m | 8 triangles; 133.486 m² exact plan projection |

The ten other owners are explicit refusals in the
[full source screen](../../../data/east-point-roof-study/roof-scout.json).
For example, row 29 fits a ridge better overall but has only one held-out
sample on its less-supported side. Row 33 falls short of the required
improvement over the flat control. Those are useful negative outcomes:
the study does not paint any of the rejected roofs as reconstructable.

The two accepted **roof-only** geometry studies preserve all vertices
of the signed outline, the plan area and its hole-free triangulation.
Each original roof-plan triangle is cut only at the candidate crease;
the two slab normals point up. No plane-crossing triangle remains.
Coordinates use the game's local east/south frame, with an explicit
orthometric candidate ridge datum. Separating the visual roof from
the in-game wall foundation and current contact is unresolved. Roof
types, materials, widths beyond the footprint, dormers, colours and
unseen construction are not inferred from this geometry.

## Reproduce

Use the repository root and existing Three r187 dependencies, Node 24,
and GDAL with Python/NumPy. The cached replay consumes the exact public
study crop and does not access the internet. All targets must be new.

```sh
study=tools/art/east-point-measured-roofs
python "$study/screen.py" . /tmp/east-roof-replay --cached data/east-point-roof-study
python "$study/refit.py" . /tmp/east-roof-replay
cmp /tmp/east-roof-replay/roof-scout.json data/east-point-roof-study/roof-scout.json
cmp /tmp/east-roof-replay/two-roof-hypotheses.json data/east-point-roof-study/two-roof-hypotheses.json
node --experimental-strip-types --test "$study/verify.test.mjs"
```

Omit the cached option only to re-read the two official bounded source
windows. Exact Float32 digests, source grid and geodetic metadata are
recorded in the report. The [detached geometry receipt](../../../data/east-point-roof-study/detached-shape.json)
pins the actual Three.js buffer bytes. Elevation source is Natural
Resources Canada's [CanElevation HRDEM Mosaic](https://open.canada.ca/data/en/dataset/0fe65119-e96e-4a57-8bfe-9d9245fba06b),
horizontal EPSG:3979 and published CGVD2013 orthometric heights under the
[Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
The original building archive's separate provenance remains unchanged.

No photographic texture or paint sample is part of the work. Next,
sample the exact roof roles in two actual moving matched views and
validate wall-rim and window material custody before any player change.

A [separate signed wall-rim study](rim/) now couples each detached cap
to its original lower wall, since the new sloped roof would otherwise
sit behind the old flat cap. It is still not installed.
