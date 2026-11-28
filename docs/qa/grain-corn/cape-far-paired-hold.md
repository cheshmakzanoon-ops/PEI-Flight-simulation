# Cape Tryon | Paired far-view foliage HOLD

Ten predetermined rooted corn plants were rendered two ways during the same normal
Cape Tryon Chase flight. The original loaded field was present in every frame.
The reference was the literal weathered source geometry; the candidate used the
matching authored texture array projected on the selected billboards. The test
did not choose plants, camera poses or material parameters after looking at the
captures. Both variants remained detached from the shipped experience.

The ordinary 1,200 × 760 drawing buffer used native four-sample antialiasing at
DPR 1. Each variant had a pair of independently colored, same-coverage GPU
probes. The resolved color differences were integer sample counts everywhere,
attachment alpha and inactive samples were unchanged, and replay/restoration
was exact. Qualifying source boxes were below 24 px; no affected pixel was
outside the union of those boxes.

| Distance traveled | Candidate samples | Literal samples | Coverage ratio | Shared pixels with at least two samples per variant |
| ---: | ---: | ---: | ---: | ---: |
| 978.309 m | 432 | 624 | 69.23% | 64 |
| 1,017.799 m | 643 | 936 | 68.70% | 106 |

The predeclared acceptable coverage ratio was 85–115% at both observations.
The candidate was also brighter than the literal geometry after accounting for
coverage (about 19–20 display-luma codes mean absolute difference at shared
strong pixels). This is not a terrain reflectance measurement. At 1,854.282 m the
entire signed crop was behind the viewer, and all ten screenshots were
byte-identical to the original with the old field still present.

[Native crops from the first frame](cape-far-paired-first-1x.png) and
[second frame](cape-far-paired-second-1x.png): top stock, middle literal geometry,
bottom candidate. No crop was upscaled. Neither rendering resembles a continuous
field at these views. The candidate exaggerates the texture card silhouette as
well as losing coverage. **Do not tune opacity to match the percentage or ship
either sparse treatment.** Native source scope and optical equivalence are
different tests; neither establishes believable field art. A whole mapped-area
ground-material response can be studied separately without introducing new
foliage silhouettes or interfering with terrain depth.

[Exact summarized receipt](cape-far-paired-hold-receipt.json) ·
[Previous single-variant hold](cape-far-native-hold.md)
