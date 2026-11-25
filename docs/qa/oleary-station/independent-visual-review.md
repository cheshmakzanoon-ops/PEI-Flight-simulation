# O’Leary Railway Station: independent exterior review

**Approved as a scoped documentary exterior, not as photorealistic scenery.** The fixed native views show the broad hipped canopy, a square east office, a smaller north projection, deep braces, paired west freight leaves, and a partially wrapped supported platform in their expected relationships. The [2013 register images and description](https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=20441) and [2017 trail view](https://commons.wikimedia.org/wiki/File:Converted_Train_Station,_O%27Leary,_PEI_(35416486124).jpg) were visual references only. No photograph, aerial texture or facade pixel was transferred. The panes in the authored asset remain mostly flat opaque blue and the painted trim is too uniform at close range. Bare original terrain and generic surroundings still do not resemble the photographed trail, grass and storage buildings. No contemporary condition, precisely measured color, survey dimensions or completed town scene is claimed.

## Fixed native visual comparisons

| Posed camera | RGB pixels >2 vs stock | Roof surface-only change >2 | Clapboard / timber / foundation change >2 |
|---|---:|---:|---:|
| 21.0 m east/north | 155,099 | 6,777 | 8,964 |
| 21.7 m west freight | 157,296 | 195 | 10,780 |
| 12.2 m east material | 416,913 | 23,456 | 38,578 |
| 21.1 m raised roof | 126,671 | 4,500 | 5,756 |
| 164.1 m distance | 1,532 | 0 | 0 |

The [pre-candidate camera and ground registration](independent-camera-lock.json) fixed all five native world poses. The [signed independent projected masks](independent-signed-scopes.json) were derived from the decoded model positions, actual transforms, and 14 original selected triangles. The [raw-frame analysis](independent-native-material.json) independently reconstructed the camera matrices and checked the full RGBA difference at 900 × 600 in 45 same-tick pairs. Outside the appropriate owner/part envelope plus two antialiasing pixels, every channel difference was zero in every pair. Exact restoration and remount recovered the same bytes. The same-draw albedo/surface probe isolates roughness and bump-normal response; the 164 m silhouette still changes against stock, but all material-only pixel changes are exactly zero. These are localized shader effects, not measured optical properties or an FPS benchmark.

The temporary diagnostic that deliberately removes both old and new station occluders reveals a few alpha-blended original background pixels inside their overlap. The west reciprocal also reveals selected baseline background pixels when the detailed silhouette leaves a few pixels of the original background uncovered. The comparison uses strict full RGBA outside the model envelope, identifies these in-scope silhouette changes with the same empty-owner background, and requires exact alpha on the active-material pairs and restores. No material program writes additional transparency, passes or world textures.

## Independently signed seating and renderer limits

The original visible 3–7 N112 support is unchanged. Every exact authored vertex fits an XZ rectangle whose nearest original World rim is **469.98 m** away. It intersects only the stock facets beginning at index offsets **32976/32979**. Both world-facet position/index data and all **102** exact floor witnesses are unchanged across every one of the **81** original neighboring native LOD combinations. A whole unsutured position-array hash would incorrectly reject the actually streamed tile. The [factored stock data](independent-stock-grade-rim.json) authenticate every XYZ scalar exactly once: 12,321 interior vertices plus 448 rim vertices in the current original seam pattern, with the full original index independently signed. This establishes game seating only, not new ground or collision.

The Node.js CPU fixture and the tested Chromium renderer produce distinct exact floating-point outputs. The signed browser and CPU UV states differ in 41 negligible V scalars, all outside q431. The exact original renderer arrays remain unmodified; an unknown profile falls back. Cosmetics are different from the separately checked browser startup/program-failure evidence. These native render comparisons used Chromium/SwiftShader with the final O1D numerical shader; they are not claims about all hardware or an uninstrumented flight.
