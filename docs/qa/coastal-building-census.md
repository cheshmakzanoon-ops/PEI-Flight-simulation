# Screening for misplaced shoreline support

The province's coarse water mask occasionally puts a real waterfront
structure over water where a narrower quay or paved apron ought to be. This
read-only census finds places to inspect without changing scenery or
classifying every wet footprint as a mistake.

```sh
node --experimental-strip-types tools/qa/coastal-buildings-census.mjs
node --experimental-strip-types tools/qa/coastal-buildings-census.mjs --tile=q032001
```

The tool verifies the shipped Cover archive and the building pack and checks
the checksum of each tile it decodes. Each original building is sampled on a
16 × 16 grid across its projected bounding box. It uses only sample centres
inside the outline and outside holes, with the same coarse bilinear Cover
distance as the simulator. The output records the source checksums, sample
counts and original tile and row keys. It sorts fully wet sample sets before
mixed ones; within each group, the larger mapped footprints come first.
The default lists the first 40 leads. Use `--limit=200` to list all leads
in the initial dataset.

In the initial run, **67 of 85,866** original footprints had all their
interior sample centres on the wet side of the mask, and **71** had both wet
and dry sample centres. These are leads, not surveyed wet areas. The census
does not model the visual or physical overrides applied by individual
scenery layers, actual rendering visibility or changes after the survey.

## Summerside example

On the ordinary waterfront departure, two structures west of Spinnakers’
Landing appear surrounded by water. Their source rows, `q032001/18` and
`q032001/331`, both sampled entirely wet. The [July 2025 aerial
view](https://commons.wikimedia.org/wiki/File:Summerside,_Prince_Edward_Island,_Canada.jpg)
and [October 2025 aerial
view](https://commons.wikimedia.org/wiki/File:Summerside,_Prince_Edward_Island.jpg)
by Quintin Soloviev show the same roofs on a connected paved apron behind a
hard quay edge. They are linked visual references, not textures.

Do not use the report to hide a building or raise it in isolation. Piles,
piers, floating facilities and already replaced shells can legitimately
score wet. Qualifying a repair requires separately checking the current
outline, surface height, stock flyby and its land/water controls. See the
[existing, separate Spinnakers’ Landing replacement](summerside-standard-wharf.md).
