# Screening aerial joins across the PEI atlas

Low flight exposes a discontinuity when two adjacent aerial images clamp to
different end texels. A sharp line alone is not proof of a sampling artifact:
real hedges, roads and crop boundaries can produce a sharp difference too.
This scan nominates sites for matched Three.js review. It does not alter the
atlas, add resolution, or enable new scenery.

The scan authenticates the existing **245** 640 × 640 image tiles and their
four packs, and checks all **434** neighbouring pairs. It ranks **46,410**
dry grass/cropland windows, accepting a window only if every land-cover and
coast sample touched by the projected strip passes. It reports 280 qualifying
overlapping high-contrast windows before same-pair deduplication. That
number is not a count of visual defects.

For each 20-texel window, the central 16 samples contribute to the ranking.
The score compares the lower quartile of the cross-edge RGB distance against
the median distance between adjacent original texels on either side. A
single extreme pixel, a noisy neighbour, or a coastal/mixed-cover window is
not enough. The highest-ranked neighbourhood includes the central field
window [already corrected in Standard](inland-aerial-joins.md).

- [Screen output: strongest twelve distinct candidates](aerial-join-screen/signed-atlas-candidates.json)
- [Four eastern windows accepted after native and controllable-flight replay](eastern-aerial-joins.md)
- [Two western Prince County windows after actual flight and image replays](western-aerial-joins.md)
- [Two central and southern field joins from the next signed screen](central-aerial-joins.md)
- [Another west and east field pair with moving Chase checks](outer-field-aerial-joins.md)
- [Committed source attribution](../WORLD.md)

To reproduce with Python, NumPy and Pillow from a clean checkout:

```sh
python tools/qa/screen-aerial-joins.test.py
python tools/qa/screen-aerial-joins.py --out /tmp/pei-atlas-candidates.json --limit 12
```

An accepted correction still needs matched native close/reciprocal and
unaffected controls, a visible benefit, and evidence that no source colour,
ground elevations or other terrain owner changed. Keep isolated image
screen evidence separate from in-flight or device performance measurements.
