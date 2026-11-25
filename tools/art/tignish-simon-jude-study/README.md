# St. Simon & St. Jude · Tignish exterior workshop

**A detached church detail, not a scenery replacement.** This is the 1859–1860 St. Simon and St. Jude Roman Catholic Church at 208 Maple Street, Prince County. The original Three.js sample combines one positively visible entrance-face lancet with an illustrative stepped side buttress. It is not the wall’s measured placement, the entire church, or its interior. Stock flight assets are unchanged.

With the simulator dependencies installed, run `npm run dev` and open `/tools/art/tignish-simon-jude-study/`. The local viewer has five fixed cameras: dappled overview, diffuse elevation, pierced crown, splayed brickwork and buttress setbacks. The studio has no runtime imports or outside texture requests.

## What is known

| Source | What it establishes | How the study uses it |
| --- | --- | --- |
| [Canadian Register of Historic Places #1642](https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=1642) and its [parish/Cundall gallery](https://www.historicplaces.ca/en/rep-reg/image-image.aspx?id=1642) | The main church is local brick in a High Gothic vocabulary. The register distinguishes the entrance tower, sharply sloped roof, pointed windows, and corner and side buttresses. The historical Cundall view is catalogued circa 1862; the parish image carries no exposure date. | Model the shape and material vocabulary rather than copying pixels or assuming one photograph captures the site today. The nearby parochial house is not inserted into this church model. |
| [Town of Tignish’s history](https://www.townoftignish.ca/historic-tignish) | Local red Island bricks, prepared at a brickyard south of town. | Generate a new authored clay texture with pores, restrained kiln variation and warm matte brick; the colour is not a sampled swatch of the real church. |
| [Malcolm Thurlby, *Nineteenth-Century Churches in Prince Edward Island and their Place in the Gothic Revival*, 2006](https://dalspaceb.library.dal.ca/server/api/core/bitstreams/a44c2e0f-3510-421d-82ad-f15922f87774/content), figs. 25, 26 and 28 and p. 77 | The entrance tower projects at compass east (liturgical west), with two separate porches near that end. The sanctuary is square ended, with a north chapel and south vestry in compass coordinates. | [The XY diagram](evidence/xy-plan.svg) distinguishes those directional roles and three stock neighbours. Diagram markers do not assert wall, eave or sub-roof boundaries. |
| [17 September 2013 camera original](https://commons.wikimedia.org/wiki/File:St._Simon_and_St._Jude_Roman_Catholic_Church.jpg) and [10 October 2025 aerial original, Quintin Soloviev](https://commons.wikimedia.org/wiki/File:St._Simon_%26_St._Jude_Church_(Tignish).jpg) | A slimmer lancet frame around elongated lights, three small pointed apertures, three rounded trefoils, stepped red-brown buttress brick and narrow pale setback bands; distinguish the masonry belfry from the green spire. | Clear physical cuts, splayed courses, thin joinery webs, individual beveled brick faces and sloping setback caps. The geometry, glass reflection and lighting are new. No source photo, texture, map or street-view image is included. |

The [archived community history](https://epe.lac-bac.gc.ca/100/205/301/ic/cdc/tignish/eng/religion.html?nodisclaimer=1) mentions a 185-foot steeple. Its measurement endpoints, modern cross and current ground datum are not defined. That figure supplies **no coordinates or scale** to the study.

## What the game actually draws

The public stock record **q221232 / ordinal 98** is the solo church outline. It is a 19-point, **932.007580 m²** extracted outline in EPSG:2954, inside parcel 6726. Ordinals **84** and **278** are separate shapes on the same parish lot; **43** is on another lot, and none is included. The present renderer is a tall tan generic box with rows of windows and without the church’s entrance tower and needle profile. Simply re-colouring it would not fix the silhouette.

The [three fixed owner frames](evidence/fixed-owner-frames.json) point at the original game at three different distances. They remove only vertices `[6642, 6807)` from the 18,048-vertex tile draw, repaint that owner in a diagnostic colour, and restore the exact frame. The east street view removed 73,430 pixels. In all three, every change fits within the owner support or its one-pixel antialias band. The existing scene captures and the offline studio are separate; no photograph substituted for a scenery frame.

The [independent dry survey check](evidence/independent-native-xy-hold.json) found adequate horizontal support in **14 of 24** predeclared zones and **none of six tower/spire zones**. That is an eligibility screen, not a vertical fit or whole-church placement result. The metric gap at the very silhouette-defining structure makes full replacement inappropriate. The exact tower, wall lines, foundation and contacts remain unvalidated. The separately scoped [nave result](nave/README.md) validates 891 independent roof rays across 11 detached patches, 35.64% of the extracted plan. All three rendered ground checks failed. The original lancet is still a separate illustration, not a metric opening.

## Reproduce

```sh
node --experimental-strip-types tools/art/tignish-simon-jude-study/verify.mjs
python tools/art/tignish-simon-jude-study/render-views.py --out /tmp/tignish-studio --chromium /path/to/chromium
python tools/art/tignish-simon-jude-study/evidence/registration.py --out /tmp/tignish-xy
python tools/art/tignish-simon-jude-study/evidence/capture-stock-owner.py --checkout /path/to/stock-baseline --out /tmp/tignish-stock --chromium /path/to/chromium
```

The studio’s own geometry test traces 45 points through the 15 distinct physical openings, fourteen brick/setback/stone probes and the original tile receipts. The repeated model has 12,460 triangles in nine batches. Five local Chromium/SwiftShader captures repeat exactly; see [the browser gate](evidence/studio-gate.json). The [independent emitted-bay check](evidence/independent-bay-result.json) hit true glass on all 75 aperture rays and closed all 2,397 silhouette rays (seven terminate on the intended solid backstop). These are not real-device performance results. Python studio rendering uses Playwright; XY work requires NumPy and PyProj, and stock frame comparison also uses Pillow and the baseline’s fixed scenery QA helper. The stock baseline is `fbf8947860acd411b486fe4cd4983d8a6f51ca51`.

**Data attribution:** Contains information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada), Natural Resources Canada [Automatically Extracted Buildings](https://open.canada.ca/data/en/dataset/7a5cda52-c7df-427f-9ced-26f19a8a64d6) and [CanElevation point cloud catalogue](https://open.canada.ca/data/en/dataset/7069387e-9986-4297-9f55-0288e9676947). The archival and contemporary images link to their original publishers for study. No image pixels or raw survey returns are distributed.
