# Charlottetown runway 03/21: close-range asphalt

This Standard preview gives the existing flat synthetic runway an original,
filtered aggregate finish. Open the simulator with
`?departure=cyyg&runway03PavementReview`, then begin the ordinary runway 03
departure and advance the throttle. Add `&stockRunway03Pavement` to compare
the original surface in the same atlas.

[Transport Canada's 2019 opening notice](https://www.canada.ca/en/transport-canada/news/2019/01/the-government-of-canada-opens-improved-main-runway-and-connecting-taxiways-in-prince-edward-island.html)
and [Charlottetown Airport Authority's 2019 annual report](https://flyyyg.com/wp-content/uploads/2020/06/CAA-2019-Annual-Report.pdf)
document the runway work. The [dated aerodrome entry](https://imageserver.fltplan.com/afd/Canada/07AUG2025/CYYG-2575.PDF)
identifies the asphalt surface. The procedural mineral grain is not surveyed
wear or measured reflectance. No photos, source markings, texture images,
current airport conditions, or aviation procedures are copied or inferred.

The original Canvas paint texture and existing runway boundaries are used
unchanged. The preview must authenticate a known opaque asphalt swatch
before installing its shader. Every live texture sample distinguishable from
that same GPU-decoded asphalt swatch remains original, including visible
markings and detectable blends along their edges. The shader is compiled
only in terrain intersecting the already registered runway. Nothing is
downloaded or added to the geometry. 10/28's earlier finish, all other
runways, the order of intersecting strips, and flight and contact rules are
unchanged. The preview does not apply in Detail.

`tools/cyyg03-pavement-smoke.mjs` checks the compiled player's real runway
motion and scoped color, depth, markings, and restoration. It includes
the explicit stock veto, a wrong swatch, and a separate Summerside control.
