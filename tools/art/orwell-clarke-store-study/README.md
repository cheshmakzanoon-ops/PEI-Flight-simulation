# D.E. Clarke’s General Store · Orwell Corner

**Detached storefront art only.** The 1864 shop and its attached dwelling are one recognized historic place in Queens County. This workshop represents the observed front joinery and a shallow material return. It does not replace any flight scenery or claim the building’s measured walls, roof, sill or ground contact.

With the project dependencies installed, run `npm run dev` and open `/tools/art/orwell-clarke-store-study/`. The six fixed cameras show a dappled and evenly lit front, the entrance, glass and sash, Island sandstone and the short shingle return. Neither the atlas nor the flight application imports this study.

## What the evidence supports

| Source | In the study | Boundary |
| --- | --- | --- |
| [Canadian Register #1623](https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=1623) and [registered provincial photo](https://www.historicplaces.ca/en/rep-reg/image-image.aspx?id=1623) | Pale wood siding, three-part moulding above the shop, pilasters, large divided panes and a broad entrance under its own transom. | The designation covers the identified building’s footprint, not a photo survey or a measured model. Dressed profiles, cut siding dimensions and exact paint remain interpretations. |
| [Royal Gazette, 29 May 2004, p. 532](https://www.princeedwardisland.ca/sites/default/files/publications/royal_gazette/20040529.pdf) | The site is a part of parcel 176610, not all of Orwell Corner Historic Village. | Neither a museum-wide address nor the Register’s pin selects the roof. The neighbouring church, forge, school and other buildings are not part of this model. |
| [Two firsthand views published in August 2018](https://larrymuffinathome.wordpress.com/2018/08/01/orwell-corner-village/) | The two large display bays each have three by three lights. The separate transom has six by two; a smaller right-hand window has two six-light sashes. The photo supports three plain step rises and a single handrail; the 3D closed dark double leaves are a joinery interpretation. | The view offers no reliable physical widths, exact hardware, or verification of the entire building. It does not confirm the historic inscription is still legible. |
| [Provincial November 2022 field assessment](https://www.princeedwardisland.ca/sites/default/files/publications/orwell-corner-historic-village.pdf), printed page 2 | Asset 1, “Orwell House”, confirms the 1864 joined group and differentiates the other structures. The rear side is part of the identification evidence, not the front render. | The documented historic sandstone is illustrated as a small, worn visible band; the extents and modern footing materials are not resolved. No measured rails, walk, door threshold or structural sections are drawn. |

The shop name is re-lettered in strokes made for the study from its earlier recorded wording. It is not a photo transfer or a finding about present-day paint. Scene lighting, distant treeline reflection, shadow canopy, planks and stage soil are all generated locally. Photographs were used only to identify visible shapes and materials. This folder contains no photograph, Google content, source texture, or downloaded map image.

## Keep the real owner separate from the new art

The published simulator’s **q1030 / feature 130** is the independently identified stock geometry for the joined structure. The registration is explained in the [independent owner receipt](evidence/independent-stock-owner.json) using the rear outline, lane relationship and provenance. The [four author observations](evidence/fixed-views.json) reproduce the same owner, separately recolour seven existing roof triangles and 18 wall triangles, then restore every stock pixel. The two elevated views expose both categories. The body/roof colours are diagnostic; neither is a design annotation of the real building.

The independent [XY-only native survey gate](evidence/independent-native-xy-hold.json) passed just **5 of the 15** pre-registered roles. Ten roles lack separation or support, so the registered two-body roof and safe terrain contact cannot be evaluated as a single replacement. No surveyed Z was opened, no native heights were fitted, and the stock geometry is untouched. Better-supported eaves on each body, their roof junction, and safe independent dry ground are needed before proposing live placement.

Natural Resources Canada, [Automatically Extracted Buildings](https://open.canada.ca/data/en/dataset/7a5cda52-c7df-427f-9ced-26f19a8a64d6) and [CanElevation point-cloud catalogue](https://open.canada.ca/data/en/dataset/7069387e-9986-4297-9f55-0288e9676947) are used in identifying stock and documenting survey support. Contains information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada). No underlying reference picture, raw survey point or private cadastral shape is included.

## Repeat

```sh
node --experimental-strip-types tools/art/orwell-clarke-store-study/verify.mjs
python tools/art/orwell-clarke-store-study/render-views.py --chromium /path/to/chromium --out /tmp/orwell-studio
python tools/art/orwell-clarke-store-study/evidence/capture-stock-owner.py --checkout /path/to/stock-baseline --chromium /path/to/chromium --out /tmp/orwell-stock
```

The first test builds the original model twice, verifies all 42 glass centers and ten distinct nearby surfaces, checks the three treads, bounds model geometry and verifies independent report digests. The second needs Python Playwright and local Chromium; it repeats the actual renders while checking browser failures and external requests. The third additionally needs NumPy and Pillow; run against the recorded [baseline and camera fixtures](evidence/fixed-views.json), installed Vite and that baseline’s `fixed-scenery.py`. The [independent studio replay](evidence/independent-studio.json) closed every one of 195 targeted portal-head rays, hit shingle relief on all 54 return rays, and hit all 42 panes. These checks establish geometry and repeatability, not device performance.
