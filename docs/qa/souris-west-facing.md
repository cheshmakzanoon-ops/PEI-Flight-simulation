# Souris waterfront · southwest wall material

The original waterfront pass shows rows of generic office windows on a long, predominantly opaque southwest wall. The new finish is an original interpretation of its broad oxide-red masonry colour, pale upright breaks and muted base. It covers one verified central portion of a single existing wall above the town. It does not treat the entire school, add entrances or windows, reconstruct the roof, refer to its interior, or treat the source’s historic geometry as current to the centimetre.

The [province’s location record](https://www.princeedwardisland.ca/en/point-interest/souris-regional-school) establishes the public exterior identity at 15 Longworth Street. The public provincial building index and [named OpenStreetMap outline](https://www.openstreetmap.org/way/200527089) corroborate the asset’s plan. Quintin Soloviev’s [close December 2024 view](https://commons.wikimedia.org/wiki/File:Souris_Regional_School_in_Souris,_Prince_Edward_Island.jpg) and [separate wide flight view](https://commons.wikimedia.org/wiki/File:Souris,_PEI_aerial_view_(2024).jpg) both face this southwest wall. They support broad visual materials and ordered features, not dimensions or a present-day finish survey. No source image, texture, insignia or view-derived geometry is included.

## One authenticated draw

The existing NRCan atlas tile `q130333/32` retains its original dimensions, levels, indices, bounds, and position, normal, colour, UV and roof flag data. The authorised surface is zero-based outer edge 26 (native diagnostic tag 27). A tighter finish envelope leaves both ends untouched. The full tile has 13,953 vertices; only six one-byte façade selectors can change. There is no extra draw, range request, render target, shadow map, texture, terrain or flight dependency. The shared values for scene uniforms and old shading remain on the original receiver path. Signed source, drawn role, domain, and real detached shader link must agree before the renderer can switch. Refusal or invalidation restores the same stock material and selector attribute without replacing neighboring geometry.

Choose **Souris · waterfront pass** in Standard and look toward the town. The qualified finish loads with the original building tile. Detail, explicit incompatible comparisons and `stockSourisWestFacing` keep the older material. In stock and comparison modes the coast, terrain, and aircraft are identical. Site appearance is a tightly scoped improvement, not a photoreal province or an estimate of device performance.

Separately, an [exact Mesa comparison](souris-west-native-appearance.json) held the signed building batches, terrain occlusion and ordinary camera matrices unchanged. At seconds 4, 6 and 8, 310, 449 and 703 visible pixels differed by more than two RGB codes, respectively. No pixel outside the depth-tested support, no alpha, and no off-screen comparison pixel changed. Both the disabled shader and a return to the original material reproduced the original frame exactly. This standalone check is not the full browser replay or a frame-rate measurement.

## Verification

```sh
node --experimental-strip-types --test test/souris-west-wall.test.ts
npm run check
```

The [first dedicated Chromium replay](https://github.com/cheshmakzanoon-ops/PEI-Flight-simulation/actions/runs/45762698343/job/139716650462) tested the exact opt-in candidate before its inclusion in Standard. The three actual flight frames changed 268, 383 and 575 pixels by more than two RGB codes, with unchanged surrounding pixels and alpha. Veto skipped the added shader entirely, and a refused program left the original material in use. The ongoing Chromium replay checks the existing route in three matched views, uses the actual depth-buffer path to locate the approved façade pixels, and compares exact restoration, unmarked surroundings, receiver draw count, and veto or program refusal. It does not insert a camera discontinuity or use a second test-only scene.

Data attribution: [CanElevation Automatically Extracted Buildings](https://open.canada.ca/data/en/dataset/7a5cda52-c7df-427f-9ced-26f19a8a64d6), [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada); [GeoLinc](https://gis.princeedwardisland.ca/server/rest/services/GeoLincData/Building_Footprints_2026/MapServer), [Open Government Licence – Prince Edward Island](https://www.princeedwardisland.ca/en/information/finance/open-government-licence-prince-edward-island); [© OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
