# Tignish detached ground profile

A source-matched ground model in the vicinity of St. Simon and St. Jude.
It carries a 96 × 96 grid of original bare-earth CGVD2013 metre samples
and a bounded local coordinate registration. It does **not** replace the
simulator's terrain, roads, collision, or building foundation. The checked
areas are three newly defined outer controls, not a retest of the church
study's earlier failed seating controls.

| Outer control | Distinct classified ground first returns | Actual triangular surface P90 error | Maximum absolute error |
| --- | ---: | ---: | ---: |
| East lawn | 440 | 0.0135 m | 0.0314 m |
| South verge | 406 | 0.0151 m | 0.0397 m |
| West lawn | 445 | 0.0180 m | 0.0466 m |

The tests use exact Three.js vertex/index output and intersect the two
potential top triangles at each of the 1,291 admitted points. These
controls are spatially bounded comparisons between the registered
bare-earth product and the same official archive source, not independent
survey accuracy estimates or a field reinspection. The 0.44 mm local
plan-registration bound is approximation against the coordinate conversion
on this window, not the source survey's horizontal accuracy.

The [source record](../../../data/tignish-grade-study/source.json)
pins the [Natural Resources Canada CanElevation](https://open.canada.ca/data/en/dataset/7069387e-9986-4297-9f55-0288e9676947)
source files. The published collection label is PEI 2020. The native
tile's GPS week-time was used for distinguishing measurements, not to
infer when within a calendar year the individual points were acquired.
The ground mesh has no imagery, physical contact, grading operation,
reconstructed building seat, or lighting change.

Contains information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
