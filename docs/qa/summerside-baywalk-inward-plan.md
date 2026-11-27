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

## Reproduce the detached height and wet edge

Once the plan is generated, use another **new** output directory:

```sh
node --experimental-strip-types tools/qa/summerside-baywalk/seat-native.mjs \
  /tmp/pei-baywalk-inward /tmp/pei-baywalk-seated
```

The offline fixture contains the original N112 tile's exact position, UV and
index bytes observed in frame 315 of the normal waterfront Chase replay at
`4cc5d89`. It contains no screenshots or generated scenery. The command
authenticates all three streams and uses the original browser-reported
translation instead of estimating the stock plane. If you already have the
matching raw replay export, supply its directory as the optional third
argument. Both inputs must produce the same output bytes.

The bundle seats 29,228 cap vertices and emits 748 wet-side faces along 374
edges. Each wet side uses the cap's top indices directly. The 961 old-land
edges generate no wall. The lower edge extends below the game's fixed sea
plane for rendering only; it says nothing about bathymetry. The outputs are
not loaded by the game. They do not clear the remaining dry-side, road,
ramp or contact checks.

## Check the inherited contact join

```sh
node --experimental-strip-types tools/qa/summerside-baywalk/stock-contact-connectivity.mjs
```

The old game uses a weighted height raster for ground contact and a
triangulated grid for visible terrain. These can differ. This offline
check finds where the two stock heights could agree over the previously
recorded survey rectangle. It uses the original DEM, Cover, and the
verified frame-315 terrain geometry. It does not fit new survey data or
use the provisional court as a height source.

At two coastline points the existing heights match to numerical precision.
The tool splits the rectangle at both grid lattices. It conservatively keeps
any old-dry box that might contain a match, both mesh facets when a box
crosses their diagonal, and even boxes that only connect at a corner.
The two checked coastline points still land in separate components,
at 0.5 m and 0.25 m spacing and with a wider numerical enclosure. Thus
these two points do not provide a continuous shared-height join under the
unchanged stock fields. A connected set of possible boxes would be
inconclusive, not proof of a connection.

This result does not authorize a new grade, modified stock collision, or a
larger application area. The historical preview and ordinary route are
unchanged.
