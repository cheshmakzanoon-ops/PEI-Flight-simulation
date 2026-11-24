# PEI Flight Sim

**Prince Edward Island, Canada, in a browser flight simulator.**  
A province-wide, metre-scale world built in TypeScript and Three.js.

[![Verify flight build](https://github.com/cheshmakzanoon-ops/PEI-Flight-simulation/actions/workflows/verify.yml/badge.svg?branch=main)](https://github.com/cheshmakzanoon-ops/PEI-Flight-simulation/actions/workflows/verify.yml)

Follow the north shore from Cavendish, fly over Summerside and Charlottetown, or cross Kings County toward East Point. You can start in the air or depart from a runway, switch from chase view to the cockpit, and reposition from the in-flight atlas.

[Download web build](#download-the-web-build) · [Build from source](#run-locally) · [Pilot guide](docs/FLIGHT.md) · [World data](docs/WORLD.md) · [Aircraft](docs/AIRCRAFT.md) · [Production gates](docs/PRODUCTION.md) · [QA record](docs/QA.md)

> **Development build.** The map covers all three counties, not just a showcase area. The current detail level is regional: real geographic inputs and simplified 3D scenery. Accurate shopfronts, most landmarks, close-range materials and training-grade aerodynamics are not part of this build.

![Chase view above the fields and shoreline near Cavendish](docs/media/cavendish-low.webp)

*An in-engine low pass over the Cavendish coast.*

## Fly the province

| System | What is in this build |
| --- | --- |
| **World** | LiDAR-derived terrain, a 2025 satellite-colour mosaic, a refined coastline and water, 245 near-detail imagery tiles, 19,465 road segments and 85,866 LiDAR-derived building footprints. Woodland follows land cover with [streamed provincial stand heights](docs/qa/forest-height-stream.md); [roof-centred tree stems are excluded](docs/vegetation-clearance.md). Confederation Bridge, St. Dunstan’s Basilica and both [point light stations](docs/landmarks/lighthouses.md) have custom models. The [Matthew and McLean Heritage Building](docs/qa/souris-mclean.md) in Souris has a measured roof and a reconstructed storefront. The optional [former railway station in Summerside](docs/qa/summerside-railway-station.md) replaces the old flat massing with a survey-informed exterior. Surveyed roof planes refine 107 existing outlines across [Kings](docs/qa/kings-neutral-roofs.md), [Prince](docs/qa/prince-neutral-roofs.md) and [Queens](docs/qa/queens-neutral-roofs.md) counties. [Fifty-nine large roofs](docs/qa/large-roof-tone.md) use colour from the verified 2025 satellite mosaic. [Hangar 4 at Slemon Park](docs/qa/hangar-4.md) has a measured roof silhouette and lower annexes. Both lighthouse approaches use [higher-resolution measured coastal relief](docs/coastal-relief.md). [South Lake](docs/qa/south-lake.md) uses sheltered water shading without changing the shoreline. |
| **Aircraft** | An original single-engine high-wing survey plane, with an animated propeller, [moving ailerons and elevators](docs/qa/control-surfaces.md), a modeled cockpit, graduated flight instruments and synthesized engine audio. |
| **Flight** | Fixed-step civilian flight model, density-adjusted airspeed, angle-of-attack stall behavior, ground roll and runway landings. Two runway departure presets and nineteen scenic starts. |
| **Navigation** | Atlas with position and heading, true-heading and airspeed displays, plus chase, cockpit and wide-chase views. |
| **Inputs** | Keyboard, touch controls and browser-standard gamepads. |

**A first route:** Begin at Cavendish, hold a shallow bank to follow the shore, and switch to cockpit view with **V**. Open the atlas with **M** and reposition to East Point for a contrasting coast. For a ground departure, select Charlottetown or Summerside and follow the [pilot guide](docs/FLIGHT.md).

**Cavendish scenery in one step:** Select **Cavendish Dunelands · coastal pass**, then **Enable Cavendish detail**. This selects six compatible local studies without changing the other scenery settings. [What the pack enables](docs/qa/cavendish-package.md).

**Waterfront approaches:** Choose **Basin Head · low pass** or **Summerside waterfront · low pass** in the departure menu to start offshore facing the local scenery. [Flight checks](docs/qa/waterfront-departures.md).

### Scenery previews

In Dispatch, choose **Use detailed preview** to enable the [curated profile](docs/qa/scenery-profile.md). Use **Use standard** to return without losing your departure. For individual comparisons, these flags also work on their own:

| Area | Preview flag | What to look for |
| --- | --- | --- |
| North Cape | `?northCapeWind` | The [16 commercial turbines](docs/qa/north-cape-turbines.md) on the [wind farm low pass](docs/qa/north-cape-departure.md). |
| Summerside | `?spinnakersPreview&northBaywalkPreview&baywalkConcrete` | [Spinnakers’ Landing](docs/qa/spinnakers-landing.md), the [surveyed court and ramp](docs/qa/baywalk-court.md), and the [mapped concrete approach](docs/qa/baywalk-concrete.md). |
| Basin Head | `?basinChannel&basinWharf` | The [measured inlet, bridge and Cannery](docs/qa/basin-head-cannery.md) and [outer wharf](docs/qa/basin-wharf.md). |
| Charlottetown | `?beaconsfieldReview` | The [Beaconsfield Historic House exterior](docs/qa/beaconsfield-review.md), an aerial art preview near the waterfront. |
| Montague | `?montagueFoundationPreview` | The [river opening and curved Main Street bridge](docs/montague-bridge-preview.md). |
| Georgetown | `?stDavidsChurchReview&buildingShadows` | [St. David’s United Church](docs/qa/st-davids-church-study.md): survey-fitted gables and tower, original Gothic sash and a matching shadow caster. Use Standard. |
| North Rustico Harbour | `?northRusticoLighthouseStudy` | [Survey-fitted lighthouse, keeper’s dwelling and local grade](docs/landmarks/north-rustico.md). Choose **North Rustico Harbour · coastal pass**. |
| Indian River | `?indianRiverReview` | [St. Mary’s exterior and local grade](docs/landmarks/st-marys-indian-river.md). Choose **Indian River · country pass**. |
| Hog Island | `?hogIslandPhotoStudy` | [Dated aerial surface detail](docs/qa/hog-island-photo-study.md). Choose a west or east **Hog Island · dune pass**. |
| Green Gables grounds | `?greenGablesBarnReview` | [Barn and adjoining lower wing](docs/art/green-gables-barn-review.md), with the survey-supported roof kept at its exact atlas owner. |
| Cavendish Dunelands | `?cavendishWaterReview` | [Lake of Shining Waters, 2020 freshwater core](docs/qa/cavendish-water.md). Choose **Cavendish Dunelands · coastal pass** for an offshore start. |
| Near Green Gables | `?gablesTrailReview` | [Mapped gravel connection](docs/qa/gables-trail.md), with short-scale grain on the existing terrain. |
| Southwest of Green Gables | `?gablesFairwayReview` | [Source-fenced fairway colour](docs/qa/gables-fairway.md) on the verified open ground, without moving the path or golf boundary. |
| Southwest of Green Gables | `?gablesGradeReview` | [Survey-supported dry rise](docs/qa/gables-southwest-grade.md), a close-range correction to terrain and contact in one small area. |
| Greenwich Dunes | `?bowleySurveyPreview` | [Bowley Pond’s surveyed 2020 open-water core](docs/qa/bowley-water.md). Choose **Greenwich Dunes · coastal pass** for the view from offshore. |
| Prince, Queens and Kings | `?cropRowsReview` | The [field surface preview](docs/qa/crop-preview.md) adds close soil relief at three selected locations. |
| Selected grassland across PEI | `?sourceGrassStudy` | [Source-backed ground vegetation](docs/qa/province-grass.md) in all three counties, with representative **grassland passes**. |
| Selected fields across PEI | `?provinceFieldsReview` | [Expanded field detail](docs/qa/province-fields.md) streams about 79 km² of supported surface masks. In Standard, enable **Expanded farmland** in Dispatch. |
| Gravel roads across PEI | `?gravelSurfaceStudy` | [Mapped gravel surface](docs/qa/gravel-surface-study.md): a close-flight material preview for 2,651 verified non-bridge gravel records. |
| Four mapped gravel-lane sites | `?mappedLaneCanopyStudy` | [Canopy placement study](docs/qa/mapped-lane-canopy.md): hides the exact game-generated trees and shadows in surveyed open lane centres. Standard only. |
| Distant PEI coast | `?aerialPerspectiveStudy` | [Daylight haze and sea horizon](docs/qa/aerial-perspective-study.md): an opt-in optical treatment for distant coasts, the open ocean and the horizon. Standard only. |
| Orby Head | `?orbyCoastClosure` | [Shoreline gap repair](docs/qa/orby-shore-closure.md): a local preview that closes gaps through which the sky showed below the cliffs. Standard only. |
| One site in each county | `?orthophotoSeamStudy` | [Aerial-image tile joins](docs/qa/orthophoto-edge-study.md): close-flight colour continuity along three verified joins. Standard only. |
| Woodland passes in all three counties | `?woodlandView` | [Woodland scenery view](docs/qa/woodland-scenery-view.md): forest surface, close bark, near conifers and a down-looking camera. Press **V** to cycle to **Scenery**. |
| Across PEI | `?legacyShoreArcs&shoreFoamDetail&canopyLight&forestFloor` | [Coastal seam repair](docs/qa/legacy-shore-arcs.md), [shore break](docs/qa/shore-foam-detail.md), [canopy light](docs/qa/canopy-light-preview.md) and [woodland floor variation](docs/qa/forest-floor-preview.md). Compare the [mapped open-ground material](docs/qa/meadow-texture.md) with `?meadowTexture`. |

**Optional scenery studies** in Dispatch offers the Beaconsfield and Green Gables exteriors, the Dunelands freshwater core, North Rustico lighthouse, St. Mary’s exterior, Hog Island aerial detail, Ground vegetation, Close grass detail, and both farmland studies without editing the URL. Enable both Cavendish studies and choose **Cavendish Dunelands · coastal pass** to try them on the same route. Use the Prince, Queens or Kings County **fields low pass** to compare farmland relief. In Standard, [Ground vegetation and Expanded farmland](docs/qa/province-land-surfaces.md) can be enabled together.

Preview work is regional and does not change the Standard atlas.

## Download the web build

Open the [successful GitHub builds for `main`](https://github.com/cheshmakzanoon-ops/PEI-Flight-simulation/actions/workflows/verify.yml?query=branch%3Amain+is%3Asuccess).
While signed in, select the newest successful run and download **pei-flight-sim-web** from its **Artifacts** section.
For changes newer than that build, [run the current source locally](#run-locally). The ZIP is not a hosted game.

Extract the ZIP and run a static server from the extracted directory. For example:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open `http://127.0.0.1:8080` in a WebGL 2 browser. Do not open `index.html` as a file.

## Run locally

Use **Node.js 22.12 or later** and a WebGL 2 browser with hardware acceleration.

```sh
git clone https://github.com/cheshmakzanoon-ops/PEI-Flight-simulation.git
cd PEI-Flight-simulation
npm ci
npm run dev -- --host 127.0.0.1
```

Open the local address printed by Vite. The simulator loads its geographic assets from the project, without an API key. For a deployable build, run `npm run build` and serve `dist/` over HTTP(S). Opening the HTML file directly from disk is not supported.

### Essential controls

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Pitch / roll | Arrows or WASD | Left stick |
| Rudder | Q / E | Right stick left/right |
| Throttle | Hold + / − or ] / [ | Right / left trigger |
| Ground brakes | B | South face button |
| View / atlas / pause | V / M / P | Start pauses |

Press a gamepad button while the simulator has focus to activate it in the browser.

## Development

The [Province House exterior study](docs/qa/province-house-study.md) and [Summerside City Hall exterior study](tools/art/summerside-cityhall-study/README.md) include original Three.js art and reproducible checks. Both are separate from the playable atlas.

```sh
npm run check                # Flight tests, TypeScript and production build
node tools/verify-world.mjs  # Asset hashes, formats, extents and counts
```

| Directory | Responsibility |
| --- | --- |
| `src/sim/` | Map scale, terrain queries, flight dynamics and runway data |
| `src/render/` | Three.js world, aircraft, roads and streamed building geometry |
| `src/app/` | Flight deck, controls, atlas, telemetry and sound |
| `public/world/` | Runtime scenery packs and source manifests |
| `tools/geodata/` | Reproducible geographic-data processing |
| `test/` | Flight and terrain regressions |

CI verifies the data, flight regressions, production build, and a Chromium smoke route across all three counties. Next targets are finer coastal terrain, remaining close-range vegetation and façade detail, an externally benchmarked airframe, and real-device flight and graphics benchmarks. See [acceptance gates](docs/PRODUCTION.md) for the criteria used to judge those passes.

The narrow [Green Gables gravel fixture](docs/qa/gables-gravel.md) is retained as a material test, not a courtyard reconstruction.

## Scenery gallery

| Charlottetown Harbour | Confederation Bridge |
| --- | --- |
| ![Approach over Charlottetown Harbour](docs/media/charlottetown-harbour.webp) | ![Survey aircraft above the Confederation Bridge](docs/media/confederation-bridge.webp) |

| East Point Light Station | West Point Light Station |
| --- | --- |
| ![White octagonal lighthouse and fog house at East Point](docs/media/east-point-review.webp) | ![Striped lighthouse and adjoining inn at West Point](docs/media/west-point-review.webp) |

These are in-engine development captures, not reference photographs. The
[landmark notes](docs/landmarks/lighthouses.md) explain what is measured and
what was interpreted. See the [matched before-and-after evidence](docs/qa/LANDMARK-VISUAL-GATE.md).

## Credits and use

Contains modified Copernicus Sentinel data 2025. Contains information licensed under the Open Government Licence – Canada. [Source, processing and attribution details](docs/WORLD.md). No Google Maps or Street View content is included.

Built for exploration and recreation. Not for navigation, flight instruction, or airport operations.
