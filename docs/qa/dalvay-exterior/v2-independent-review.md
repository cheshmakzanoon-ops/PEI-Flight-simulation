# Dalvay-by-the-Sea: lake-facing exterior review

**Verdict:** the optional V2 building earns a pass for recognizable lake-facing forms. It does not earn a photorealism or exact-reconstruction claim. The review compared the submitted V2 mesh with V1 and the original stock building in the running simulator. Ground, water, camera and time stayed fixed within each comparison.

From the registered dry lawn, the old near-blank roof and hard-edged lower wing now read as two front gables, a lower dormer between them and a continuous band of windows turning around a low stone base. The third feature is actual geometry, not a decal: 27 connected foundation segments turn through about 108° end to end. Some individual changes of direction are pronounced. The simulated glazing is dark and uniform; the light framing and courses of masonry are simpler than in the close photograph. Ground, neighboring stock buildings and much of the vegetation remain visibly synthetic. At flight distance, the roof arrangement can still read, but the sash and stonework cannot be graded from a few distant pixels.

At 900 × 600, the 71 m dry-lawn frame changed **30,043** pixels by more than two channel levels versus V1. The same comparison from the 487 m opposite bank changed **507**. In the wide frame the entire V2 building influenced just **807** pixels by that threshold versus the object-removed scene. This is a reason to limit distant judgments to the silhouette, not to count hundreds of pixels as independent evidence of architectural details.

### What the independent references establish

The candidate, actual mesh transforms and eight camera poses were frozen before the photographs were consulted. Only ordinary public exterior views from four preselected photographers were observed; multiple photos from one author still count as one session. The pictures were not used as textures, traced geometry, or redistributed.

| Independent session | What can actually be checked |
| --- | --- |
| [Carter W. Jeffery, July 4, 2011](https://peiheritagebuildings.blogspot.com/2011/07/speaking-of-kate-and-william-at-dalvay.html?m=0) | The specifically captioned dining-room exterior shows a rounded stone plinth, grouped windows above, pale structural divisions and a shallow eave. Strong close support for the form; not a survey of its radius. Event and crowd photographs were excluded. |
| [Tabitha Bailar, article updated August 19, 2025](https://travelcompositions.com/dalvay-by-the-sea-review/) | The photograph taken from across the lake shows the two upward gables flanking a low transverse dormer; a separate lawn view shows the principal front, not a second photographic session. The distant picture does not establish the dining-room arc in detail. The article update is not assumed to be the photograph date. |
| [Earle Hickey, July 13, 2020](https://www.flickr.com/photos/earle/50145314042/) | The genuine across-lake view independently shows the paired gables, the intervening group of upper windows and the broad lower roof/window bank. Foreground foliage hides much of the base. The HDR image was not a color target. |
| [Parxpix, July 20, 2016](https://www.flickr.com/photos/188207072@N03/50102029358) | The principal porch, peaked dormers and decorative framing are clear from the other façade. This view is a preservation check, **not** evidence for the new dining-room curve. |

These sessions support the broad architectural relationship. They do **not** establish measured dimensions, the exact service elevation, glass reflectance, modern window counts or a complete reproduction of the estate. V1 and these now-open references are not fresh blind tests for a future V3.

### Technical evidence

- [Native fixed-frame and form registrations](v2-independent-native.json): the same tick renders original, V1, V2, object-removed and restored states in each fixed camera. Alongside the whole-frame changes, a separate projection checks where changes coincide with actual, unambiguously tagged authored triangles. A pixel count is not a realism score.
- [Original-ground and ownership receipt](v2-independent-ground.json): five draw batches, 24,853 triangles and 71 physical foundation/pier/entry features. None of the 19,518 distinct projected edges crosses the original mapped building footprint. Both source terrain owners and all 241 neighboring building outlines were checked. Centimetres here describe the **simulated** mesh, not the actual estate.
- A Chromium test exposed a genuine one-unit floating-point difference in the original mesh centre, sufficient to keep an earlier build permanently at stock. RC2 calculates that centre using the same signed tile bounds and projection as the original generator; it retains strict identity and transform checks. The acceptance record below is for the corrected runtime, not the abandoned build.
