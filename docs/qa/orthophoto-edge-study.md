# Close-flight aerial-image tile joins

Enable `?orthophotoSeamStudy` in Standard. The study is limited to the three reviewed image joins below. It is off by default and does not alter imagery away from the joins, terrain, buildings, roads, or flight physics.

![Matched full-game Souris and Prince County captures with the stock join on the left and the corrected imagery on the right](orthophoto-edge-comparison.webp)

## Why the line appears

The same source mosaic is split into streamed tiles. With both tiles loaded, the stock renderer clamps each texture at its own edge. The last pixel on one side and the first pixel on the other are not necessarily the same colour. From low altitude, the seam can show up as a straight line through a field. The existing missing-tile fade is a separate safeguard and is unchanged.

At each tested join, the renderer copies two rows or columns from each of the original, already uploaded textures into one 640 × 4 or 4 × 640 strip. Both owners sample the same decoded pixels across their shared boundary. The study checks the published image IDs, exact received SHA-256 values and image grid before using the strip. There are no new imagery downloads, added draws or meshes, or GPU readbacks in the rendering path. Each live strip uses 10,240 bytes of base-level RGBA pixels. It is retired before either source texture is released or leaves the near terrain tier.

The strip is deliberately close-only. It blends out as the image footprint grows, leaves tile corners to the existing renderer, and never tries to invent a missing neighbour. Some scenery studies that replace or substantially modify the same terrain path are incompatible. [World data and attribution](../WORLD.md) describes the unchanged 2025 Copernicus source.

## What was measured

Separate fixed shared-source WebGL bench captures measured the RGB8 contrast across the edge. Terrain, sun and source-pixel positions were held constant. Lower values mean a less conspicuous line.

| Join and view | Stock median / p90 | Shared edge median / p90 |
| --- | ---: | ---: |
| Souris, north view | 17.11 / 23.35 | 1.17 / 2.39 |
| Souris, reciprocal view | 18.89 / 24.03 | 0.95 / 1.75 |
| Western PEI, north view | 13.07 / 19.32 | 1.00 / 1.85 |
| Western PEI, reciprocal view | 14.16 / 19.14 | 0.91 / 1.77 |
| Queens County, west view | 12.90 / 22.64 | 1.11 / 2.16 |
| Queens County, reciprocal view | 13.61 / 24.07 | 0.98 / 1.75 |

The scoped joins are tiles 27-13/27-14 near `46.361818, -62.281606`, 5-2/5-3 near `46.941818, -64.017376`, and 10-12/11-12 near `46.440085, -63.596875`. The four matched full-game views retained the same meshes and draw counts. A distant full-game frame was exact at all 268,800 pixels. The isolated four-tile corner control found all 9,961 qualified pixels unchanged, including when a diagonal tile was missing. These are visual comparisons, not a device performance benchmark.

In the full app, each tested reversed arrival order stayed stock until both source textures were verified and uploaded, then both sides enabled together. Moving away and returning released and rebuilt just one strip for the renewed pair. Corrupting one source produced the ordinary missing-tile fallback with no seam patch.

The compiled Kings County field departure travelled over 500 m, entered Cockpit and paused in both modes, with the same usual detail assets. Standard without the flag and Detail loaded no study module. The 315-test suite, production build and world checks passed.

## Queens County: east–west edge

This third join uses the same two-peer readiness gate and close-footprint limits, rotated to copy columns rather than rows. The GPU copy matched all 10,240 bytes sampled directly from the two source textures. In separate matched source captures, both directions reduced the colour step above without changing 9,672 focal RGB samples by more than one code from the same decoded imagery used as one continuous texture. All 11,581 qualified near-corner pixels remained exact, including under a missing non-pair tile. A distant 268,800-pixel frame was exact with both source textures still resident.

![The east–west join in matched full-game Queens County views, stock on the left and the shared edge on the right](orthophoto-queens-comparison.webp)

The two full-game Queens comparisons held imagery tile sets, draws, triangulation and camera pose fixed. Each repeat with the strip turned off matched its neutral render. In the compiled Queens field departure, both stock and opt-in flights travelled over 500 m and entered Cockpit and Pause. They used the same normal detail assets; neither stock nor Detail requested the optional module. All 316 tests, the production build and world checks passed.
