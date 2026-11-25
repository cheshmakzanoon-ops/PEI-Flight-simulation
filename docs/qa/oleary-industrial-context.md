# O’Leary | Railway-side industrial building study

The optional **O’Leary railway station pass** can also show the surveyed shape of the agricultural building beside the station: a low gabled shed and a compact tall head in place of the old office-like block. This is a study of one building’s shape, not a claim to have rebuilt the town or photographed the current site. The default view and the published [station exterior](oleary-station-exterior.md) are unchanged.

Compare the station-only view using `?departure=oleary-railway-low&olearyExteriorStudy`, then enable both with:

```text
?departure=oleary-railway-low&olearyExteriorStudy&diagnostics&qa=%7B%22olearyIndustrial192%22%3Atrue%7D
```

## Where the shape comes from

- The [federal building-footprint dataset](https://open.canada.ca/data/en/dataset/7a5cda52-c7df-427f-9ced-26f19a8a64d6) supplies the original building in the scene. The [provincial footprint lookup](https://gis.princeedwardisland.ca/server/rest/services/GeoLincData/Building_Footprints_2026/MapServer/0) independently agrees with that approximate plan boundary. No parcel or proprietary map image is shipped.
- Paired 2020 Natural Resources Canada [surface elevation](https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-lidar/PEI-Prince_Edward_Island_2020-1m-dsm.tif) and [bare-earth elevation](https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-lidar/PEI-Prince_Edward_Island_2020-1m-dtm.tif) place a compact tall mass and a much lower roof. The source recorded 21 samples at least 12 m above the local ground; the actual model puts a tall roof above 18 of them. Local transitions remain uncertain: three other tall samples and four 9–12 m samples do not support adding specific projections or equipment.
- [Larry’s July 2017 railway station photograph](https://commons.wikimedia.org/wiki/File:Converted_Train_Station,_O%27Leary,_PEI_(35416486124).jpg), CC BY 2.0, is a visual reference for the capped-head and low-shed relationship only. No pixels, background geometry, camera match or textures were derived from it. The folds and neutral finish are original, not measured. No machinery, bins, lettering, current tenant, or surrounding ground surfacing is represented by this change.

Federal source information is licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).

## Rendering and containment

The study is two opaque Three.js draws with 1,736 triangles. The whole model stays at least 0.169 m within the original outline; its base follows 398 checked positions on two unchanged native terrain facets. It replaces only 19 stock triangles in building row `q20213/192`. The unrelated station remains an independent 14-triangle ownership span within the same stock draw. No dry-ground classification, roads, trail, flight contact, or other buildings change.

Both studies authenticate the original 32,049-vertex draw, not whichever indexed version is visible. The same mesh can keep either study, both, or the exact stock. Each enabled lane qualifies separately against the unchanged high-resolution ground and only displaces its own stock geometry after its actual WebGL programs link. The earlier station-only/default execution path does not need the industrial study.

## Native comparison

Two fixed, reciprocal 42 m cameras test the same scene and lighting with the industrial study toggled off and then restored. Any nonzero RGBA changes are counted, and all pixels outside the pre-registered old/new building envelopes are compared exactly. A thrown live condition and an explicit veto each reproduce the same stock industrial frame without disabling the station.

| View | Changed pixels | Protected pixels | Protected pixels changed |
| --- | ---: | ---: | ---: |
| Groundward | 124,143 | 406,310 | 0 |
| Raised reciprocal | 104,605 | 428,514 | 0 |

The [numerical receipt](oleary-industrial-native-summary.json) records the frozen cameras, protected pixel counts, and exact frame digests. Both frames show no alpha changes, and restoring the art reproduces the first PNG byte for byte. Net cost in these scenes is 1,717 triangles and two draws, with no render-target pass. These tests do not establish device FPS or photorealism. The raised view can legitimately expose bits of the unchanged station that the larger stock industrial block had obscured.

![Fixed raised Three.js view, stock block above and the surveyed form study below](art/oleary-industrial-context.webp)

In a separate native test, intentionally breaking just the industrial roof shader left its cladding program linked and its roof unlinked. The app kept the stock industrial model and the authored station. The retained 32,007 index entries and complete PNG matched the ordinary station-plus-stock-industrial fallback exactly; the invalid shader is test-only and not part of the shipped source.

The unmodified compiled app completed a 1,061.73 m sightseeing flight from the O’Leary dispatch with both studies active, reached the signed station approach within 265 m, switched through Cockpit and Wide chase, and paused normally. All six requested building tiles were ready at the approach, with no reported GL or scenery-layer errors. This used the ordinary controls, not a locked comparison camera.
