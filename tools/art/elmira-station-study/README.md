# Elmira passenger station · trackside studies

**Status: offline art and owner evidence, not a live scenery replacement.** The museum at 457 Elmira Road includes multiple structures. This work concerns the historic passenger station, not the neighbouring freight buildings, ticket administration building, caboose or miniature railway.

## What exists

- [Measured roof workshop](./roof/index.html): four Three.js views of the frozen, upper-surface-only roof plus original procedural shingles. The [one-shot independent result](./roof/independent-aggregate.json) supports these tested roof regions but not ground placement.
- [Trackside workshop](./eaves/index.html): one original, proportioned sample of the exterior finish and joinery. With the development server running, open `/tools/art/elmira-station-study/eaves/` and change between the five fixed cameras. All rendering is local Three.js. The page is not part of the flight application or production bundle.
- [Four-camera stock-owner check](./owner/fixed-frames.json): same-camera removal, identity silhouette and restoration of feature **q1331 / ordinal 195**. All 42 vertices in the recorded range belong to this stock feature. This identifies which stock geometry would need replacement; it does **not** make the visible generic gabled box a reconstruction.
- [Geometry/renderer result](./eaves/studio-gate.json): 18 separate glass panes pass forward visibility tests. Independent intersections catch the fascia-side bracket, underside, roof top, siding, lower panel and platform. No coordinates in the detached joinery sample are as-built measurements or thresholds for flight placement.

## Translating recorded features into geometry

| Evidence | Interpretation here | Limit |
|---|---|---|
| The [Canadian Register entry](https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=4604) describes a wood-shingled building, flared hipped eaves supported by timber brackets, nine-over-nine windows, panelled transomed doors, a central dormer and chimney. | The bay distinguishes the lapped wall surface from the lower boards. Timber brackets leave open space under the canopy. Two stepped sashes each contain three rows of three physically inset panes. | The page positively identifies the form, not measured window dimensions, bracket count/spacing, roof pitch, cladding colour specification or a full exterior schedule. The dormer, doors and chimney are not modelled in this bay. |
| [Province of PEI, Brian Simpson, 2004](https://www.historicplaces.ca/en/rep-reg/image-image.aspx?id=4604), side and west photographs. | The light upper wall, contrasting dark trim, sawn brace, pronounced projecting eave and timber platform are identifiable in the photographs. Relief, trim thickness and muted colours are artist interpretations. | No pixel from either image is included. These views do not establish an as-built interior or unseen elevation. |
| The [provincial museum anniversary release](https://www.princeedwardisland.ca/en/news/elmira-railway-museums-50th-anniversary-celebration), published 5 August 2025, shows the passenger station and separate buildings beyond. | The wider view corroborates the trackside context, projecting roof, divided openings and finish relationships. | Publication date is not the photograph’s exposure date or a new site survey. The [operator’s site](https://www.peimuseum.ca/visit/elmira-railway-museum) verifies address/use; its miniature train photo was not used to model the station. |

The studio uses no photography, no Google products, no downloaded facade patterns and no photographed material samples. Painted wood and bare weathered wood have separate deterministic colour, roughness and normal fields. Shingle butts overlap in space; the sawn bracket is a closed, shaped solid; roof closure boards keep the cut eave from showing sky through the edge. The glass is lit by a synthetic sky and treeline. No door placement, roof origin, precise foundation, rail or platform height is inferred from the illustrated proportions.

## Verification

```sh
node --experimental-strip-types tools/art/elmira-station-study/eaves/verify.mjs
```

The check hits every separate pane, nine further surfaces including both cheeks of a brace, bounds the model’s triangle/batch cost, and rebuilds it twice to catch unstable geometry or textures. The five rendered views also matched on repeat within the same SwiftShader session. These are geometry and repeatability tests, not a real-device frame rate claim.

**Stock scope.** Baseline `84b3253a8d12b580473d2bdfe833abe7ea3c5837`; 700 × 465 canvas, local headless Chromium. Each state rendered the same scene/camera in immediate succession. Four stock/restored pairs matched exactly. Compared with “owner removed,” all changed pixels fell within the bright owner-ID support or its one-pixel antialias boundary; the JSON reports both strict and expanded-edge counts. No surrounding feature was selected, and no 2020 native survey file was used in making this material and joinery study.


## Measured roof and placement decision

The [roof notebook](./roof/README.md) distinguishes the validated roof from the unmeasured joinery. Source: Natural Resources Canada, [CanElevation LiDAR Point Clouds](https://open.canada.ca/data/en/dataset/7069387e-9986-4297-9f55-0288e9676947), under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada). The stock footprint and independent returns relate to the same 2020 acquisition: this evaluates spatial reconstruction, not a later survey. At the independent points, the highest physical Three.js triangles passed all ten roof regions. The far yard passed, but the rendered eastern turf failed: median error −0.2169 m. No ground, roof, wall, track, threshold or stock feature was changed in flight.

For a local repeatable stock-ID capture, use the pre-specified customer-visible cameras from the original stock baseline and an external output directory:

```sh
python tools/art/elmira-station-study/owner/capture.py --out /tmp/elmira-owner --chromium /path/to/chromium
```

This is a test-only temporary Vite stage. It uses the repository’s existing fixed-scenery helper, Python Playwright, NumPy and Pillow. The script deliberately fails if the buffered renderer no longer matches the recorded draw topology.
