# Streamed 16 m inland relief preview

Add `?surveyRelief` to the simulator URL (or `&surveyRelief` if a query is
already present). Aircraft, coast and runway defaults are unchanged when
the option is off. For the option, begin above 175 m (574 ft) over the normal
contact surface so verified meshes can install before descending. Subsequent
low passes keep previously installed terrain in place. If the optional
download is missing or fails validation, the old atlas remains available.

This preview replaces real 3D terrain triangles in qualifying inland cells.
It is not a normal-map effect, a rendered decal or a reconstruction of a
different data source. The tested normal-only experiment was rejected
because its comparison never differed by more than two display RGB codes.

## Coverage and provenance

- 52,975 candidate coarse cells in 199 source-backed tile entries. The
  runtime seam moat leaves 51,441 candidates before the survey and sidewalk
  tile exclusions (less than 147 km²), not a replacement for the entire province. Different
  viewpoints see different selected cells; many areas still use the older
  surface. The engine holds at most **two** refined near meshes at once.
- Natural Resources Canada's [CanElevation HRDEM Mosaic](https://datacube.services.geo.ca/stac/api/collections/hrdem-mosaic-1m/items/10_3-mosaic-1m)
  distributes the bare-earth raster. This layer reads the **16 m overview**,
  in CGVD2013, not the 1 m raster. Samples are warped to the local grid
  (15.867 × 15.264 m tangent units) and stored as signed decimetres. The
  underlying raster also covers water: the existing signed coastline remains
  authoritative. No new land or water classification derives from elevation.
- Every accepted cell and its foundation protection are checked against the
  existing road strips, building bounds, forest cover, hedge root and full
  potential attached-shadow footprints. The engine declines to override
  existing irregular survey pieces or change runway contact. The older
  `?inlandRelief` patches take precedence if both options are supplied.
  A known sidewalk crossing excludes its whole terrain tile at the pinned
  sidewalk generation.
- The bounds and the five existing source generations are pinned. The
  exact generated index and individual compressed and decompressed members are
  checked before installing data. The [selection bits and license notes](../../data/odbl/adaptive-relief/)
  identify data separately from the government's elevation samples.
- No Google Maps or Street View assets are collected, traced, stored or
  served by this preview.

## What changed in the engine

The replacement splits only admitted 112-grid source cells. A shared vertex
receives the same height from both adjacent refined cells. Refined-to-regular
edges are genuinely stitched into the old plane; the measured-side change
ramps across half a parent cell instead of leaving a sharp height step.
A one-cell collision-transition band blends from the inherited render facets
to the existing physics surface. Signed water, runways and protected scenery
still use the earlier logic. Decode jobs stage data only. Eligible meshes
and their contact surface change together before simulation, at high AGL,
and retire when the aircraft is well away. No extra material or mesh overlay
is needed.

A Range-capable server sends the needed gzip members only. Static sites
without Range can fall back to a holding cache of at most 13.48 MB for the
complete optional dataset, in 27 packs. Default flight does not request
the relief index or packs. The densest measured comparison adds 56,478
submitted triangles and no draws. Dense mesh creation took 30 ms median and
46 ms at p95 in the local Node proxy. The less dense samples took 12–13 ms
median. These are not device frame rates or promises of no streaming hitch.

## Verification

[Matched browser frames](adaptive-relief-comparison.webp) | [Check receipt](adaptive-relief-gate.json)

In an unmodified browser flight over Cavendish, the preview installed two
near meshes and stayed in flight. With the option off, the same route never
requested any terrain-preview assets. The controlled low/high/low/relocation
test started with decoded data and unchanged contact, admitted terrain only
once high enough, kept the same measured ground during descent, then
restored the legacy surface after departing. The underlying triangles and
physics agreed within 0.03 mm in 378 independent sampled ray tests. These
are consistency measurements against the submitted mesh, not a claim of
centimetre (or sub-millimetre) real-world map accuracy.

## Reproduction

The survey archive check uses a small HTTP range with a pinned ETag before
reading its intersecting overview. Build with GDAL, NumPy and SciPy:

```sh
/usr/bin/python3 tools/terrain/bake-province-relief.py --world public/world --out /tmp/pei-relief-atlas
/usr/bin/python3 tools/terrain/relief-contact-study.py public/world /tmp/pei-relief-atlas /tmp/pei-relief-study.json
/usr/bin/python3 tools/terrain/select-adaptive-relief.py public/world /tmp/pei-relief-atlas /tmp/pei-relief-guarded
/usr/bin/python3 tools/terrain/pack-adaptive-relief.py /tmp/pei-relief-guarded public/world/terrain-adaptive/v1 --ts src/sim/relief-index.generated.ts
npm run check
node --experimental-strip-types tools/qa/survey-relief-budget.mjs
python tools/qa/survey-relief-flight.py dist /tmp/pei-relief-flight --chromium /path/to/chromium
python tools/qa/survey-relief-motion.py --checkout . --deps node_modules --out /tmp/pei-relief-motion --chromium /path/to/chromium
```

The terrain comparison fixture `tools/qa/survey-relief-frames.py` uses a
fixed inspection camera and swaps the same near mesh for one frame. No scene
elements, lighting, viewing parameters or surface textures change between
the two renders. Compare normal runtime with the flight test separately.

The [all-departure positioning screen](atlas-route-survey-screen.md)
describes which short launch corridors pass near the existing signed
candidates. It is separate from the browser admission and motion checks.
