# Sullivan House · the canted central dormer

**Detached exterior art only.** The John P. Sullivan House is the historic main building of the Points East Coastal Inn, at 5749 Route 2, St. Peters Bay, Kings County. The workshop depicts its Second Empire-influenced front dormer vocabulary and a short decorative eave strip. It is not a complete house, an as-built elevation, an inn interior, or a flight scenery replacement.

With the project dependencies installed, run `npm run dev` and open `/tools/art/sullivan-house-study/`. Five fixed Three.js cameras show the canted sash, short swept hood, individual shingle edges and paired eave profiles. Everything is created locally, with no references fetched by the preview.

## What was observed

| Source | What it supports | Limit |
| --- | --- | --- |
| [Canadian Register of Historic Places #6275](https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=6275) | An 1870s wood-framed house. The register describes a mansard roof, canted bays, paired eave brackets, front verandah, turned posts and decorative woodwork. | Not dimensions, a finish schedule or a certified placement of an exact sill, roof slope or bracket. |
| [Registered front and oblique views with owner credit, 2022](https://www.historicplaces.ca/en/rep-reg/image-image.aspx?id=6275) | One canted central dormer, separate side dormers, the roof sweep, lowered verandah edge and the way the trim wraps the little bay. The oblique angle shows the visible hood return behind the point. | Artist keeps just the central bay and a short eave-profile sample; no inference about unseen fabric or the whole verandah. The [operator’s homepage](https://pointseastcoastalinn.com/) reproduces the front angle and is not treated as a separately dated exposure. |
| [Owner-supplied views on Tourism PEI](https://www.tourismpei.com/where-to-stay/points-east-coastal-inn) and [operator’s Island Walk article](https://theislandwalk.ca/points-east-coastal-inn/) | An exterior quarter corroborates the warm cladding and narrow sash. The landward angle separates the main mansard and smaller attached forms. The operator identifies the loft building as a separate 2025 addition. | The private source photos serve as observations only; no redistributed pixels, advertising, owner sign, modern loft building, interior or grounds. |

The three canted faces have independent sash and glass facing different directions. The roof uses staggered physical laps, closed underlay, a short slanted crest and outward-normal offsets on each cheek. Lower setback profiles remain attached to a shallow studio cut, with two distinct backed pairs demonstrated in the model. Neither the size nor the position of those pairs claims a measured verandah. Cream paint, granular shingles, mild age and glass reflections use original procedural fields; no source image was sampled.

## Exact stock identity and release decision

The extracted original owner is **q12313 / ordinal 47**, a **223.649234 m²** outline in EPSG:2954, wholly inside civic parcel **119743**. The road/registration dot is not the building centre. The front normal is slightly west of grid north toward Route 2 and the bay. The [independent registration receipt](evidence/independent-owner.json) distinguishes the adjacent church, annexes and later lofts. Those are untouched.

The [three actual stock captures](evidence/fixed-stock.json) isolate vertices `[3363, 3438)` in a 19,710-vertex tile draw on baseline `8a530bf290e1de95ae9c7e163b0f91646a26a9cd`. Straight removal changed 21,260 close, 10,126 oblique and 1,162 aerial pixels. All cleared the one-pixel antialias edge test and restored the stock frame exactly. Seven roof and eighteen wall triangles make up the selected feature; their diagnostic colours are not architectural materials. The existing primitive does not show the canted mansard silhouette. No stock triangle was changed in the project.

The [independent XY-only source gate](evidence/independent-xy-hold.json) accepted **5 of 22** original roles: just three disconnected upper roof windows and two stock ground controls. The rectangles’ **34.6524 m² / 15.494%** is at most an area ceiling from XY eligibility, not a fitted part of the house. No dormer, front pitch, whole verandah, steep return, two-body transition or safe site-seat geometry qualified. No native heights were opened or used. Keep the signed stock owner and all neighbours in live flight.

**Data attribution:** Contains information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada), Natural Resources Canada [Automatically Extracted Buildings](https://open.canada.ca/data/en/dataset/7a5cda52-c7df-427f-9ced-26f19a8a64d6) and [CanElevation](https://open.canada.ca/data/en/dataset/7069387e-9986-4297-9f55-0288e9676947). Provincial civic and parcel evidence comes from [the government civic address service](https://gis.princeedwardisland.ca/server/rest/services/civic_addresses/FeatureServer/0) and the independent receipt. Reference photos were viewed, not packaged.

## Reproduce

```sh
node --experimental-strip-types tools/art/sullivan-house-study/verify.mjs
python tools/art/sullivan-house-study/render-views.py --out /tmp/sullivan-workshop --chromium /path/to/chromium
python tools/art/sullivan-house-study/evidence/capture-stock-owner.py --checkout /path/to/stock-baseline --out /tmp/sullivan-owner --chromium /path/to/chromium
```

The offline verifier emits the 6,687-triangle model twice, checks a stable geometry and material digest, tests 54 normal/oblique rays across six glass panes and thirteen hard roof/bracket probes, and verifies the signed receipts. The browser test records five exact repeats in local Chromium/SwiftShader with no external requests or browser errors. The [independent anatomical and browser check](evidence/independent-dormer-result.json) hit all 288 angular glass rays and all 648 aperture-head and sill rays without a gap to the sky, tested the gaps between both backed bracket pairs, and exactly replayed all five sealed studio captures. Any terrain figures in this receipt are the unchanged simulator, not a ground survey. These checks do not measure real-device performance. The Python tools require Playwright; stock capture additionally needs NumPy, Pillow and the baseline’s scenery QA helper.
