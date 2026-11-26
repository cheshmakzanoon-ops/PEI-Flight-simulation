# O’Leary · Access PEI roof tone

One existing flat roof changes from the stock brown palette to a broad warm grey in Standard scenery. It is not a mesh replacement, a roof repair, or a recreation of the building or streetscape. The appearance is an authored approximation, not an extracted pixel color or a current material report.

The printed Table 1 of the [November 2022 provincial assessment](https://www.princeedwardisland.ca/sites/default/files/publications/access-pei-oleary.pdf#page=7) identifies the single-storey building and its flat membrane; it does not specify color. The dated aerial observations support a broad warm-grey family only. The [named public map outline](https://www.openstreetmap.org/way/362565377) and provincial footprint FID 13494 agree with the retained stock plan. The same parcel has a much smaller separate building; this change does not touch it. No source photo, texture tile, signage or interior plan is shipped. No seams, rooftop equipment or edge geometry are added.

Only 30 stock roof vertex colors are changed, on the authenticated row `q20213/26`. Positions, normals, UVs, wall treatments, indices, bounds, material, existing bytes fetched, draw count, and flight surface stay the same. In the [native Three shader comparison](oleary-access-roof-native.json), 353, 744, 1,988 and 8,558 projected pixels changed on the roof at the fixed 26-, 28-, 30- and 32-second points. No off-roof RGBA, alpha, or t34 off-screen pixel changed; the original renderer path restored exactly. Matched software views are not device performance metrics or a terrain-relative survey.

In Standard, select **O’Leary · railway station pass** and continue toward town. The roof appears on the normal route without enabling a flag. It is separate from the station, tower and warehouse art. The comparison flag `stockOlearyAccessRoof`, Detail, incompatible choices or an existing O’Leary exterior seat preserve the historically verified O’Leary path unchanged. The option cannot displace those actors or color one of the adjacent roofs.

```sh
node --experimental-strip-types --test test/oleary-access-roof-tone.test.ts
npm run check
```

The compiled replay runs the ordinary Chase departure and checks the 30 roof and 72 wall colors on the actually submitted draw at two points on the route. The native same-pose renderer witness and the emitter checks supply the separately scoped exact RGBA and geometry comparisons.

Footprint source: [CanElevation Automatically Extracted Buildings](https://open.canada.ca/data/en/dataset/7a5cda52-c7df-427f-9ced-26f19a8a64d6), [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada); [© OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
