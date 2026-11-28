# Prince County grain-corn receiver: HOLD

The ordinary **Prince County fields low pass** was checked as part of the
[dated grain-corn source study](../../../tools/geodata/province-fields/grain-corn.md).
No corn appeared in the simulator. This is a record of the narrow stock
ownership check that must pass before scenery can be compared.

The first complete-resolution attempt timed out in Chase at about
2,514 m, before the first intended measurement near 3,408 m. It
captured no optical evidence. A separate repeat used the same real
physics, scenery and trusted **Begin flight**. It temporarily used a
600 × 380 viewport on the long approach and restored 1,200 × 760 in
the same WebGL context before the first measurement. Two advancing
full-resolution frames were verified after restoring the viewport.
The repeat is not presented as an uninterrupted full-resolution run.

Two full-resolution 4× views of the original terrain received two
separately returned literal RGB markers. Alpha stayed exact; the
original, neutral, reset and restored screenshots matched. The
problem is not an alpha change. In both views, a small cluster of
pixels near the stock aircraft resolved to fractional amounts
incompatible with one shared integer count of changed samples.

| Native distance from departure | Pixels outside the integer witness |
| --- | ---: |
| 3,409.088 m | 142 |
| 3,461.742 m | 184 |

The refused pixels fit within the original propeller's projected
shutter disc geometry. This is a useful geometric diagnosis, not
proof of which exact draw contributed the fractional values. The
[current receipt](prince-grain-corn-hold-receipt.json) preserves both
groups, original restoration and the separate later control.
The [native stock detail](prince-aircraft-stock-1x.png) is unscaled;
it is not a marker overlay or modified aircraft.

A prospective screen cut that excludes the expanded propeller
projection in both archived poses would leave about 74% of the
original candidate centers, below its predeclared 80% gate. It was
not accepted, and the test did not crop pixels or round partial
contributions into approved sample classes. A different safe
viewing aperture or separately verified original propeller ownership
is needed before this receiver can be considered.

The reusable [four-sample audit](../../../tools/qa/four-sample-audit.py)
reports exact integer classes and refused connected regions over
the complete native image. It checks a known probe pair only;
it does not by itself prove what was drawn or where game art belongs.

Run the offline diagnostic against an unscaled reference and its two
matching probe PNGs:

```sh
python3 tools/qa/four-sample-audit.py original.png red.png blue.png \
  --a 255 41 89 --b 28 204 255 --require-integer
python3 tools/qa/test_four_sample_audit.py
```

The optional gate exits with status 2 on a refusal. The printed
fractional diagnostic is only for locating evidence and is never
used to change an accepted label.
