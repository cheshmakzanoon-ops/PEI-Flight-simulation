# Tignish: three nearby roof forms checked against LiDAR

This is an offline comparison of three existing buildings near
St. Simon & St. Jude, not a new departure or a replacement for the
church. It made **no changes** to roofs, walls, terrain or the flight
model. Original outlines, ownership and textures remain in Standard.

The experiment compares the actual signed renderer shapes with
alternatives fit to a 2020 airborne survey. It keeps all finite
1 m source centres at least 0.71 m inside each complete plan outline,
without removing high or low measurements after seeing their fit.
Five fixed spatial folds hold out entire 3 m blocks, so a prediction
is never scored on the cells it was fitted on.

| Stock owner | Current roof | Native cells | Actual stock held P90 | Best tested ridge held P90 |
| --- | --- | ---: | ---: | ---: |
| `q221232/84` | Flat cap | 173 | 4.182 m | 1.201 m |
| `q221232/220` | Gable | 551 | 0.716 m | 0.848 m |
| `q221232/257` | Gable | 556 | 0.733 m | 0.795 m |

For the stock shape alone an additive height offset is learned
from each fold's training data. It adjusts only the comparison,
not any building or datum in the simulator. Error values are the
90th percentile of absolute height error in withheld blocks, pooled
by building. The comparison uses exactly the same sample locations.

## What stays on hold

The two larger gables already in the simulator beat the tested refits.
The flat roof improved materially in this experiment, but the new
ridge failed the locked 0.55 m pooled and 0.80 m per-fold limits.
The signed /84 wall tops share the full flat rim, so lowering the
cap conditionally would leave unsupported wall tops as well.
A more complex future shape needs independent measured support for
its low roof portions, joins and upper walls. The evidence does not
establish current roof colours, building use, or permission to replace
the neighboring church.

The [signed numeric input description](fixtures/source.json),
[predeclared limits](PRELOCK.json), [stock comparison lock](STOCK-COMPARISON.json)
and [full held-results receipt](receipt.json) make the decisions inspectable.

## Reproduce from the repository root

Install the project dependencies and prepare signed world assets using
the repository setup. The numerical command uses NumPy and GDAL Python
coordinate transforms.

```sh
here=tools/art/tignish-simon-jude-study/neighbourhood
work="$(mktemp -d)"
npx --no-install esbuild "$here/replay-stock.mjs" --bundle --platform=node \
  --define:import.meta.env.BASE_URL='"/"' --format=esm \
  --outfile="$work/replay.mjs"
node "$work/replay.mjs" "$work/stock-p.f32le"
OPENBLAS_NUM_THREADS=1 python3 "$here/screen.py" --root . \
  --stock-pos "$work/stock-p.f32le" --out "$work/screen.json"
```

The two archived numerical arrays are a bounded 256 m × 256 m section of
the [NRCan CanElevation PEI collection](https://open.canada.ca/data/en/dataset/7069387e-9986-4297-9f55-0288e9676947);
they are not photo pixels or a source TIFF. Original outlines use
[NRCan Automatically Extracted Buildings](https://open.canada.ca/data/en/dataset/7a5cda52-c7df-427f-9ced-26f19a8a64d6).
Contains information licensed under the
[Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
