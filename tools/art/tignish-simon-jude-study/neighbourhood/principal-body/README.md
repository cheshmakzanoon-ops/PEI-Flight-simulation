# Tignish building 84: a separate raw-point check

The [three-building raster comparison](../README.md) found that a ridge
fits the flat stock cap better, but not well enough to replace it.
This follow-up asks a narrower question: can a simple roof describe
the supported principal interior once the lower side tab is held out?
**No.** No artwork or terrain is enabled.

The signed nine-point AEB outline separates the principal interior
from the tab at the chord between its third and seventh vertices. The
chord is only a test boundary, not a modeled seam. A 0.710002 m inward
reserve applies both to the original outline and to the principal
portion. This geometry and the eligibility of building-class first
returns were locked before any point heights were accessed. Neither
pixel errors nor raw heights selected or deleted any membership.

The [point partition](partition.json) gives 68 fit cells from 429
eligible returns. Two spatially separated height groups have 30 and 29
one-metre cells, with 220 and 200 returns. Each complete held slab stays
out of the fit. A future partial fit is not clearance for the side tab,
whose prior five-fold design lacked one held group, or the joined wall rim.

| Model | Held absolute height error, pooled P90 |
| --- | ---: |
| Best author-fit curved candidate, two-sided ridge | **1.268 m** |
| Constant-height baseline from fit cells | 5.840 m |
| Tilted-plane baseline from fit cells | 4.991 m |
| Required to admit even this bounded hypothesis | **≤0.360 m** |

Both held slabs miss their own 0.50 m P90 limit. The frozen curve is
more plausible than either simple baseline in the upper tail, but
the remaining structure is too large to imply a verified shape.
Original building-class labels do not distinguish roof, attached
feature, and wall. Computing a rising form does not verify eaves,
ends, pitch over the full building, or a new vertical seat.
The same 2020 acquisition supplied both the gridded and raw sources;
the validation is a spatial split, not a second survey.

## Repeat for development

Use NumPy, SciPy, laspy with the lazrs backend, GDAL's
`gdaltransform`, and a repository checkout with the signed world
data available. Provide a private local copy of the archived
[NRCan 2020 COPC](https://canelevation-lidar-point-clouds.s3.ca-central-1.amazonaws.com/pointclouds_nuagespoints/PEI/Prince_Edward_Island_2020/pei_2020_321000_767000.copc.laz).
The exact SHA is in [the geometry lock](plan.json). Do not put the
69 MB source or private per-cell point heights in Git. Run sequentially:

```sh
d=tools/art/tignish-simon-jude-study/neighbourhood/principal-body
work="$(mktemp -d)"
python3 "$d/partition.py" --root . --copc "$copc" --out "$work/partition.json"
python3 "$d/point-cohort.py" --root . --copc "$copc" --mode author --out "$work/a.json"
python3 "$d/fit-shape.py" --data "$work/a.json" --out "$work/fit.json"
python3 "$d/point-cohort.py" --root . --copc "$copc" --mode hold \
  --locked-fit "$work/fit.json" --out "$work/h.json"
python3 "$d/fit-shape.py" --data "$work/h.json" --locked-fit "$work/fit.json" \
  --out "$work/result.json"
```

The separate exporter never gives the optimizer withheld ordinates.
This record includes the [model lock](SHAPE-LOCK.json),
[locked fit](frozen-fit.json) and [held aggregate](held-result.json).
Contains information licensed under the
[Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
