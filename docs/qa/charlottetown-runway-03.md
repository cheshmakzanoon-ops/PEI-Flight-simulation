# Charlottetown runway 03/21: close-range asphalt

In Standard, choose **Charlottetown · runway 03** to see the original
filtered aggregate finish as you advance the throttle down the strip. No
special URL setting is needed. To compare the old flat surface in the same
atlas, use `?departure=cyyg&stockRunway03Pavement`.

[Transport Canada's 2019 opening notice](https://www.canada.ca/en/transport-canada/news/2019/01/the-government-of-canada-opens-improved-main-runway-and-connecting-taxiways-in-prince-edward-island.html)
and [Charlottetown Airport Authority's 2019 annual report](https://flyyyg.com/wp-content/uploads/2020/06/CAA-2019-Annual-Report.pdf)
document the runway work. The [dated aerodrome entry](https://imageserver.fltplan.com/afd/Canada/07AUG2025/CYYG-2575.PDF)
identifies the asphalt surface. The procedural mineral grain is not surveyed
wear or measured reflectance. No photos, source markings, texture images,
current airport conditions, or aviation procedures are copied or inferred.

The original Canvas paint texture and existing runway boundaries are used
unchanged. The renderer must authenticate a known opaque asphalt swatch
before installing its shader. Every live texture sample distinguishable from
that same GPU-decoded asphalt swatch remains original, including visible
markings and detectable blends along their edges. The shader is compiled
only in terrain intersecting the already registered runway. Nothing is
downloaded or added to the geometry. 10/28's earlier finish, all other
runways, the order of intersecting strips, and flight and contact rules are
unchanged. Historic Detail and explicit QA scenes retain the original finish.

`tools/cyyg03-pavement-smoke.mjs` checks the compiled player's real runway
motion and scoped color, depth, markings, and restoration. It includes
the explicit stock veto, a wrong swatch, and a separate Summerside control.

The independent matched Chromium comparison showed 41,212 and 41,063
changed pixels during the first two ground-roll views at 830 × 554. The
paired support masks resolved subpixel edges; every outside pixel and all
alpha values stayed exact. The 42,601 and 50,601 fully resolved visible
marking samples also stayed exact. This is a visual comparison, not a
hardware performance or real pavement measurement.
