# Which departures pass near the existing 16 m terrain candidates?

This is a work-prioritization screen, not a flight validation, real aerial
survey, or measure of visual quality. The unmodified province-scale
terrain and cover continue to supply the stock view.

The screen follows the published start position and heading of 58
existing departure definitions. The two runway starts are deliberately
excluded: it does not press throttle or perform takeoff. From each of the
other 56 starts, it runs the actual fixed-step, neutral-control aircraft model
for up to 18 seconds with the base dry-land/ocean contact. It measures
distance from the simplified course to the **centres** of authenticated
optional 16 m relief cells. It does not claim those cells were visible,
activated, reached or safe for an aircraft.

| Departure roster label | Airborne runs | At least one candidate within 250 m | All sampled AGL below 175 m |
| --- | ---: | ---: | ---: |
| Prince County | 18 | 5 | 15 |
| Queens County | 18 | 3 | 16 |
| Kings County | 18 | 6 | 14 |
| Pituamkek Sandhills | 2 | 0 | 2 |
| **Total** | **56** | **14** | **47** |

Labels are the routes' launch groups, not county boundary calculations.
Only two routes satisfy both of these coarse pre-conditions within
their 18-second windows: some candidate within the corridor *and* at
least one sample at or above 175 m AGL. The two events need not coincide.
Actual live terrain readiness additionally depends on matching broader
source and collision checks, streaming, current mesh level, residency,
and the real position. Earlier installs can remain below that height in
the optional mode, so the low-altitude count is not a runtime admission
prediction. Different headings and travel beyond the launch track are
not represented.

## Coverage and prioritization

All 199 existing indexed relief members were decoded. Their signed
52,975 cells leave **51,416 screened dry, source-supported cell centres**
after the inner mesh seam, the fixed 8-13 sidewalk veto, the base
approximate coast check and finite elevation support. Counting each
such parent cell as fully present would represent about **146 km²**
against approximately **5,725 km²** of atlas land calculated on the same
local tangent scale. This roughly 2.6% figure is a placement screen, not
a percentage of the simulator that is finished. In particular, signed
asset masks, shoreline insets, site grades, and terrain residency are not
equivalent to the dense 1 m real-world source.

Look first at longer dry tracks with no candidate near the opening approach:
**Miscouche · woodland pass** in Prince, **Hunter River · Confederation
Trail pass** in Queens, and **Kings County · inland meadow pass**. Their
19 sampled positions are dry in the base raster, but none is within 250 m
of a screened centre. They are useful checks for what needs to become
visible next, not permission to replace their scenery, contact or protected
obstacles. The local proof work at lighthouses and railway stations does
not resolve these gaps.

## Reproduce

The script reads the shipped sources only, verifies the relief index,
every whole pack and each compressed/decompressed member, and validates
the base roads, terrain, cover, buildings and hedge index pins.
It applies the exact north-first candidate bit order and a fixed near-course
width. The near-course distances use the piecewise-linear interpolation of
one-second neutral positions, not screen-space projection. All sources
and licenses are documented in [adaptive relief](adaptive-relief.md).
See the [complete per-route report](atlas-route-survey-screen.json).

```sh
node --experimental-strip-types tools/qa/atlas-route-survey-screen.mjs /tmp/pei-neutral-route-screen.json
cmp docs/qa/atlas-route-survey-screen.json /tmp/pei-neutral-route-screen.json
```
