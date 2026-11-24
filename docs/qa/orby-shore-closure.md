# Orby Head shoreline gap repair

The repair is on for ordinary Standard scenery, including the Cavendish low departure. Add `?stockOrbyCoast&departure=cavendish-low` to fly the original coastline for comparison. Detail and the independent terrain and shoreline studies keep their prior behavior; the broad `legacyShoreArcs` preview still takes precedence. It repairs visible gaps in the coastline wall near Orby Head. The captured white streaks were the sky showing through missing coverage, not surf or a light-coloured rock layer.

![Matched stock and repaired Orby Head coastline, looking seaward and alongshore](orby-shore-closure-comparison.webp)

## What changed

The terrain and ocean shaders use the same bilinearly sampled land/water mask. Its zero line can bend within a coarse cell. The inherited straight wall missed that line in five selected cells containing one corner exactly on zero. The [older general preview](legacy-shore-arcs.md) skips those cells. The repair leaves the original wall in place and adds coverage along the same zero line between the same two endpoints, seated between the rendered ground and sea. Tested curve segments stay within 4.7 cm of the continuous line **in the simulator’s mask**, not of the real shore.

The selection checks the exact terrain extent, the source ID declared in the cover manifest, raster dimensions and all four decoded mask values at each cell. The source ID is a metadata check, not a full-body rehash. Ambiguous or changed cells stay on the inherited path. The repair does not change any land/water classification, water level, terrain heights, collision surfaces, access routes or planted scenery. It adds no texture or network request. The [Parks Canada trail reference](https://www.parks.canada.ca/pn-np/pe/pei-ipe/activ/sentiers-trails/gulf-shore) provides regional context, not present-day cliff geometry. The independently measured 2020 LiDAR cliff was **not** installed: the protected dry-only area was too narrow to reproduce its slope without introducing false ridges.

## Standard verification

The current [locked Standard replays](orby-standard-gate.json) used paired
green and magenta sky diagnostics. At the same camera and clock, they
removed **314** exposed sky pixels looking seaward and **692** looking
alongshore. Neither view exposed any previously covered pixel or increased
the existing partial-sky signal by more than one 8-bit level. This does not
mean the entire cliff line is gap-free.

An independent geometry check preserved all 98,972 stock shore triangles
exactly as Float32 triangles. Of 70 batches, only the one containing the
five cells was reordered. The one additional visible draw submits 526
triangles, all bounded to those five cells. The added chunk withdraws
outside its existing distance band and reconstructs the same vertices on
return. All 2,000 paired terrain and contact probes matched.

All four compiled scenarios flew more than 320 m, switched to Cockpit and
paused with one cover download each. Only ordinary Cavendish scenery
installed the repair. The stock flag, a wrong cover ID and a slightly shifted
terrain extent all left it off. All 364 tests, the build and world checks passed.

Re-run the locked frames with `tools/qa/orby-standard-frames.py` and the
compiled game with `tools/qa/orby-standard-flight.py`; both accept the path
to Chromium and `--help` shows checkout, dependency and output arguments.

## Original preview verification

Both actual WebGL comparisons used the same camera, time and fully loaded imagery tiles. We replaced only the sky’s display colour for a second pass to count pure background pixels showing below the coastline in the same 570 × 85 crop.

| View | Stock | Preview | New exposed sky in crop |
| --- | ---: | ---: | ---: |
| Seaward | 526 | 110 | 0 |
| Alongshore | 110 | 22 | 0 |

The preview reduced exposed pixels by about 80% in both views and did not remove every thin gap. Neither full frame gained any new pure-sky pixels. A separate sky-colour difference test found no new partially exposed antialiased pixels in either shoreline band at any of four thresholds. In the seaward plate, everything above and below the shoreline band was pixel-identical. The active patch added one draw and 526 triangles in both matched views. This is a local render measurement, not a frame-rate benchmark or a corrected provincial shoreline survey.

In the original preview’s compiled app, the existing Cavendish low departure passed 500 m in ordinary flight and entered Cockpit and Pause both with and without the flag. Each received one copy of the usual cover raster. A wrong cover-generation identifier left the preview off and the normal dispatch usable. All 313 tests, the production build and world validation passed.
