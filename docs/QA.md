# Independent flight/scenery acceptance record

**Scope:** regional civilian exploration of Prince Edward Island, including the three counties. This is not proof of property-level fidelity, real navigation accuracy or a high-end game performance certification.

## Verified

- **Map scale.** Comparing the real WGS84 ellipsoidal distances with the local metre grid: West Point–East Point 187.888 km vs 188.023 km (+0.072%), North Cape–East Point 168.844 km vs 169.520 km (+0.400%), Charlottetown–Summerside 53.603 km vs 53.440 km (-0.305%), East Point–Souris 24.117 km vs 24.083 km (-0.140%), North Cape–Tignish 12.354 km vs 12.359 km (+0.039%). These controls establish regional scale, not high-precision surveying everywhere.
- **Scenery evidence.** 85,866 LiDAR-derived footprints with source minimum/maximum roof estimates across all counties. Reprojected outlines and heights have intake checks; materials, roofs, vegetation positions and landmark artistic interpretations are not property surveys. Alpha and elevation checks keep mainland backdrop out of PEI and open water. At the NB bridge abutment the mainland grid records ~2 metres and subpixel shoreline coverage. Pictou is present in the backdrop, but Charlottetown is excluded from that secondary layer; NB and NS are not playable regions.
- **Hosted build.** Independent actual WebGL2 game sessions under Google Chrome for Testing (Linux software renderer). 1200×760 desktop, 390×844 portrait and 844×390 landscape. Verified dispatch, scenic departures and both runway starts in the simulation; atlas repositioning sampled across all three counties; chase/cockpit/wide views; controls; pause/resume without position drift; conditional mobile controls and credits.
- **Input.** Real browser events for keyboard and touchscreen, synthetic W3C standard gamepad state (not physical controller hardware). Observed aircraft banking +0.86 rad with keyboard, -1.09 rad with controller axis and +0.91 rad with on-screen stick. Triggers, throttle keys/touch, pause edge and audio controls changed state. Flight model tests select and rotate both CYYG and CYSU on actual terrain.
- **Transport.** Real Vite static server returned 206 for 90 detail requests during representative all-county traversal; no missing detail at captured scenes. A separate no-range static server fetched each full pack once and reused it during five cases. Automatic content decoding vs verbatim gzip is handled for .gz layers.
- **Defects corrected by iteration:** sustained keyboard rotation causing immediate stall after takeoff; merged geometry memory growth; roads disappearing when hosts label a file Content-Encoding: gzip; terrain visibly clipping through the runway; distant water moiré; opaque prop blades in front of pilot; panorama-longitude filtering seam; a bridge terminus previously appearing to end in open water. The canopy pass replaced invalid multiply blending with a tested transparent contact shadow. The low-pass regression check covers a case in which the ocean had drawn over shallow land under trees.

The deterministic suite includes a continuous 182 km West Prince to East Point simulation, and a short-final flare, touchdown and braking on Charlottetown runway 03.

## Release judgement

The province-wide geography, streaming, controls and route-level visual identity pass an exploratory development-build gate. The following remain open for an AAA/photoreal claim:

1. Compare multiple independently licensed reference viewpoints for each county in identical heading/altitude, not just satellite coverage. Verify street façades/roof geometry, port and airport signage, shoreline cliffs/sand, docks, tree canopies, the waterfront and recognizable landmark materials. Measured footprints plus generic façades are not equivalent to photographed streets.
2. Bench frame-time distributions and memory on real integrated and dedicated GPUs, touch browsers and physical controllers. SwiftShader timing is not an end-user FPS estimate.
3. Expand approach, crosswind and runway tolerance checks beyond the nominal short-final landing. Benchmark first-use loads and longer sessions, and cover tile boundaries and recovery on more hardware. Never promote this entertainment model to training claims.

## Month-one scenery and cockpit gates

See the independent [landmark comparison](qa/LANDMARK-VISUAL-GATE.md)
and the [full-atlas vegetation comparison](qa/VEGETATION-CLEARANCE-GATE.md)
for fixed before-and-after views, counts and reproduction commands.

- Fixed East and West Point comparison views hold position, 53° vertical FOV,
  125 m horizontal standoff and 45 m altitude above the camera start surface.
  In the East diagnostic, the sky is replaced with magenta to identify geometry
  gaps independent of sky colour. The baseline revealed 4,976 of 108,000
  pixels in the ground/water ROI; the distance-gated shore-face candidate
  reduced the remaining gap to 0 of 108,000 pixels in that view. The same view went from 256 to 262 draws for the combined scenery change (software-rendered QA, not a player FPS benchmark). The existing Cavendish test separately
  rejects ocean covering confirmed inland terrain.
- The lighthouse tests confirm structure height, low/mid mesh budgets and
  departure heading. Only three exact source extrusions are suppressed. No
  formula verifies architectural appearance; matched views and source
  references are required for the art review.
- Check the physical cockpit instruments with the game running. Each dial uses
  the same unit and angle mapping for the texture and its needle. The HUD
  remains available and moves out of the panel's way in cockpit mode.

With Python Playwright, Pillow, Chromium and the usual local npm dependencies
installed, run the optional fixed-camera tool on a checkout:

```sh
python tools/qa/fixed-scenery.py --checkout . --out /tmp/pei-coast \
  --chromium /path/to/chromium --void-probe --views east-close
python tools/qa/coast-void-gate.py /tmp/pei-coast/east-close.png
```

Remove `--void-probe` for normal visuals. The tool makes its camera and sky
changes only in a temporary checkout. Its output is regression evidence,
not proof of photorealism or of performance on a player's device.

For an unmodified production player, the optional route test accepts the
already-built `dist` directory and an explicit Chromium binary (also requires
NumPy). It changes neither the camera nor any production shader:

```sh
npm run build
python tools/qa/player-routes.py --dist dist --out /tmp/pei-routes \
  --chromium /path/to/chromium
```

It starts both lighthouse approaches and records actual travel, then checks
the original Cavendish coastal overdraw case after two relocations.

## Coastal terrain and materials

- [East Point cliff relief](qa/coastal-cliff.md): a browser survey census, matched views and asset failure tests.
- [Souris southwest exterior material](qa/souris-west-facing.md): exact receiver, one façade, independent route proof and fallback.
- [Souris Town Hall authoring study](../tools/art/souris-town-hall-study/): detached scene checks for the original frontage and qualified roof surfaces.
- [Souris waterfront departure](qa/souris-waterfront-pass.md): offshore start, unchanged controls and a measured transit past the town.
- [St. Mary’s exterior workshop](../tools/art/souris-st-mary-study/): original twin towers, procedural stone and a matched detached Chase-angle comparison. Site placement remains unverified.
- [Raw LiDAR roof check](qa/roof-copc-coherence.md): a bounded source check for secondary roof features that raster holdouts can miss.
- [Charlottetown measured roof](qa/queens-survey-roof.md): original LiDAR points, blocked raster cells, wall seating and an in-game comparison.
- [Town façade fit](qa/town-wall-study.md): existing wall spans, window margins, neutral rendering and unchanged stock geometry.
- [East Point sandstone](qa/east-sandstone.md): matched terrain materials, a licensed reference and a West Point control.
- [Nearshore breakers](qa/shore-foam.md) and [road materials](qa/road-material.md): fixed-camera appearance and material-isolation checks.

## Cache behavior when shipping scenery updates

The static build preloads one content-addressed Three.js chunk and keeps
application code in a separate content-addressed chunk. Initial downloads
still need both, and changes to the renderer, its imports or the toolchain
may change both hashes. This is not offline caching and depends on the host's
normal HTTP cache policy.

To check a routine application-only change, build twice from otherwise
identical source with a different dispatch subtitle. The app chunk name must
change while the Three.js chunk name and SHA-256 remain equal:

```sh
npm run build
sha256sum dist/assets/three-*.js
ls dist/assets/index-*.js
```

In the introduction test the unchanged Three.js chunk was 577.31 kB minified
(146.08 kB gzip). This measures reusable bytes on subsequent matching builds,
not a first-load reduction or browser throughput.

## Cold atlas startup

`tools/qa/atlas-cold-gate.py` starts the unchanged production bundle in a
fresh browser and delays each required atlas response by 600 ms. With
`--expect parallel`, the colour, cover metadata, cover data and panorama
requests must all arrive before the terrain manifest is released; elevation
still waits for its manifest and existing validation. Dispatch must
transition into flight with no browser or HTTP errors. In one matched
software-rendered run this moved dispatch from 5.20 s to 3.45 s. The run
proves the dependency change under a repeatable latency fixture, not typical
startup speed, mobile CPU impact or a new download-size claim.

Each `main` push keeps its own verification run and linked artifact.
A new pull request revision still supersedes that pull request's earlier
in-progress check. Confirm the commit SHA on a successful `main` run
before selecting its web build artifact; completion order can differ
from commit order.
