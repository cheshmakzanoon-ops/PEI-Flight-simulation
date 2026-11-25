# Production and acceptance gates

## One world, three coverage levels

1. **Continuous coverage:** PEI is in scope from day one. Each build keeps west, central and east explorable. Coordinates and distances use metres; keep coastlines, positions and runway headings traceable to data.
2. **Regional detail:** Refine imagery and terrain in tiles. Validate coast and rivers first, then field boundaries, roads, settlement footprints and tree cover. Put high-detail assets in the budget nearest the aircraft.
3. **Landmark and approach detail:** Hand-author priority structures and calibrate them against independently licensed sources or original photography. Approximate buildings are not labelled as exact reproductions.

The [Indian River Festival Pavilion](art/indian-river-pavilion-model.md)
is an example of a vetted source and original art asset kept outside the
live map until its independently measured placement can be proven.

## Data intake

Record source URL, provider, acquisition/version date, licence, attribution, input and output checksums, spatial reference and transform for every derived dataset. Separate code and third-party data terms. Reject imagery with unclear redistribution or derivation rights. Do not use scraped Google Maps, Google Earth or Street View imagery or digitize models from it. Candidate sources include Statistics Canada's cartographic boundaries, Natural Resources Canada's HRDEM and Copernicus Sentinel-2. Name only material actually used in release credits.

## Review and release

- **Geography:** Compare control points in Prince, Queens and Kings; check sea level, land/water mask and land-to-sea tile edges.
- **Visual:** Capture matched daylight approaches, a shore pass, a wide valley or farm pass and a town pass. Reject seams, visibly tiling materials, placeholder landmarks and hard atmospheric cutoffs. Do not describe the whole map as photorealistic until this holds across representative regions at both cruise and approach altitude.
- **Flight:** Verify input dead zones, throttle state, stall behavior, approach and touchdown; test frame-rate independence and recover cleanly from focus loss and controller disconnect.
- **Performance:** Report frame times, loading and memory with browser, device, viewport and graphics setting. Software-rendered cloud tests are useful for regressions, not end-user FPS claims.
- **Release:** A downloadable build needs a pinned commit, clean build, repeatable test instructions and visible third-party data attribution.

The [six-site coastal terrain intake](qa/coastal-terrain-intake.md) is a
repeatable bare-earth and in-engine ray baseline in all three counties.

## Active production programme

This is an ongoing simulator project, not a finished photorealistic release.
Each pass ships a verified improvement on the same full-province map. Review
scenery, the aircraft and its flight model independently; higher scores in
one area do not make another area ready.

| Pass | Scenery | Aircraft and flight |
| --- | --- | --- |
| 1 · Baselines and defects | Fixed matched captures in all counties; close visible shoreline gaps; keep all existing flight routes playable. | Inspect model and cockpit at consistent views. Make stall response and instrument readings testable. |
| 2 · Source fidelity | Validate finer terrain and a matching coastal mask near beaches and cliffs. Classify imagery rights and coverage; check that vegetation does not intersect surveyed structures. | Select a specific documented airframe variant. Establish exterior dimensions and measured stall, glide, climb and runway benchmarks before tuning. |
| 3 · Close-range assets | Expand local imagery and original assets for shores, towns, farmland, airfields and landmarks. Track gaps; do not imply every place has the same fidelity. | Author close-range exterior and cockpit materials. Add force and response behavior under controlled mass, weather and configuration. |
| 4 · Integration | Re-fly every county at approach and cruise altitudes, with a visual comparison and a recorded streaming budget. | Verify full flight profiles, keyboard and controller, and publish evidence of both wins and remaining gaps. |

Report before/after for each change with fixed position, view, elevation above
the ground, focal length, weather/lighting and graphics settings. For a coastal
regression, reject sky visible through a ground-to-water seam as well as water
painted over confirmed land. For close landmarks, check silhouette, elevation,
alignment, adjoining structures and synthetic clutter. For flight diagnostics,
the benchmark should record configuration and units along with the result.
See [aircraft development and validation](AIRCRAFT.md) and the [QA record](QA.md).
