# Production and acceptance gates

## One world, three coverage levels

1. **Continuous coverage:** PEI is in scope from day one. Each build keeps west, central and east explorable. Coordinates and distances use metres; keep coastlines, positions and runway headings traceable to data.
2. **Regional detail:** Refine imagery and terrain in tiles. Validate coast and rivers first, then field boundaries, roads, settlement footprints and tree cover. Put high-detail assets in the budget nearest the aircraft.
3. **Landmark and approach detail:** Hand-author priority structures and calibrate them against independently licensed sources or original photography. Approximate buildings are not labelled as exact reproductions.

## Data intake

Record source URL, provider, acquisition/version date, licence, attribution, input and output checksums, spatial reference and transform for every derived dataset. Separate code and third-party data terms. Reject imagery with unclear redistribution or derivation rights. Do not use scraped Google Maps, Google Earth or Street View imagery or digitize models from it. Candidate sources include Statistics Canada's cartographic boundaries, Natural Resources Canada's HRDEM and Copernicus Sentinel-2. Name only material actually used in release credits.

## Review and release

- **Geography:** Compare control points in Prince, Queens and Kings; check sea level, land/water mask and land-to-sea tile edges.
- **Visual:** Capture matched daylight approaches, a shore pass, a wide valley or farm pass and a town pass. Reject seams, visibly tiling materials, placeholder landmarks and hard atmospheric cutoffs. Do not describe the whole map as photorealistic until this holds across representative regions at both cruise and approach altitude.
- **Flight:** Verify input dead zones, throttle state, stall behavior, approach and touchdown; test frame-rate independence and recover cleanly from focus loss and controller disconnect.
- **Performance:** Report frame times, loading and memory with browser, device, viewport and graphics setting. Software-rendered cloud tests are useful for regressions, not end-user FPS claims.
- **Release:** A downloadable build needs a pinned commit, clean build, repeatable test instructions and visible third-party data attribution.
