# Summerside Baywalk: repeatable court plan

The ordinary waterfront approach currently shows an inland pool at this site.
This offline check reconstructs a conservative outline from the existing
signed [north Baywalk source pack](../../data/baywalk/README.md) and the
original stock land mask. It does not enable scenery or alter flight contact.
The [historical Baywalk preview](baywalk-court.md) is a separate configuration.

## Run the check

From a repository checkout, with Node 24 (the CI runtime), choose a **new** output
directory:

```sh
node --experimental-strip-types --test tools/qa/summerside-baywalk/signed-envelope.test.ts
node --experimental-strip-types tools/qa/summerside-baywalk/inward-plan.mjs /tmp/pei-baywalk-inward
```

The tool authenticates the original terrain manifest and heights, decoded Cover and court fields.
It partitions the court grid at the original atlas lattice boundaries and
cuts the faces using two conservative signed lower bounds. A per-vertex
reserve takes the largest bound among incident faces. Both sides of an
internal edge therefore use the same linear decision rather than creating
an independent seam.

The report includes four little-endian buffers: projected X/Z metres and
zero-based triangle indices, the ordered perimeter indices, and one role
byte per perimeter edge (1 for the new wet frontier, 2 for the old-land
interface). Treat the SHA-256 hashes in the report as custody for that run.

## What it establishes

With the current inputs, the plan retains approximately **6,687 m²** across
57,119 plan triangles. It has one 1,335-edge perimeter, with about 94.35 m
at the new waterside and 239.96 m along old land. These are simulation plan
measurements, not a present-day survey or approval to build a real wall.

A closed outline does not prove a closed 3D shoreline. The retained
shore faces, land-to-court height and coverage, original timber ramp and
road transitions must be qualified in the active renderer before changing
the standard route. No photos, textures, grading, new water mask, or
contact data are emitted by this tool.
