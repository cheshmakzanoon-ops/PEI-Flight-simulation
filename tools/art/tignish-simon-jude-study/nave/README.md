# St. Simon & St. Jude · partial roof witness

**Deliberately incomplete. Not a target to fly around or a model of the whole church.** The game still uses its original stock geometry. This study evaluates only eleven roof windows where the spatially separated survey supports a comparison, not the whole nave, terrain seat, tower, cross, walls or connected outline.

The source is Natural Resources Canada’s [CanElevation archive](https://open.canada.ca/data/en/dataset/7069387e-9986-4297-9f55-0288e9676947), PEI 2020, licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada). The coordinate recipe uses EPSG:2954 local plan and CGVD2013 orthometric metres. The extraction and stock source share an acquisition: validation uses withheld locations within it, not a newer independent survey. Contains information licensed under the Open Government Licence – Canada. No photographs or raw training or withheld points are distributed.

## What was modelled

The initial [dry support check](../evidence/independent-native-xy-hold.json) found 14 of 24 eligible domains, including 11 roof and three grade controls. No tower or spire domain qualified. Only the exact positive domains were eligible to supply training. Eleven disjoint windows were cut from the known owner footprint: four opposing nave planes, two capped crown strips, three shoulders, one outer annex patch and a separate west lower gable patch. The original authorization deliberately withholds the rest. In particular neither porch, the west inner annex, the southwest shoulder, belfry, spire, capital, façade or roof connection is filled in. The low outline visible in the 3D preview is a projection guide, not a reconstructed foundation.

The sealed real mesh has **58** upward-facing Three.js triangles. Each window is clipped to the extracted owner. For a multi-facet window, the visible top rises to the lowest of its fitted plane set, with each facet emitted only where it owns that top. The original mask boundaries are unchanged and only triangle edges can overlap. The renderer reads geometry, not a height raster shortcut.

The [authorized training aggregate](authorized-training-aggregate.json) reports **1,119/1,119** actual roof rays and largest per-role training P90 absolute error **0.07856 m**. The 353 grade training values were not used to position or tune a roof. Measurements of all omitted solids remain unsupported.

## Independent result: partial roof passed, stock ground did not

The [one-shot independent aggregate](independent-held-aggregate.json) hits **891/891** actual Three.js roof rays. All 11 frozen roof domains passed, and the worst per-domain 90th-percentile absolute error was **0.269953 m**. That is not a maximum pointwise error. The detached roof patches cover **332.148499 m²**, **35.638%** of the 932.007580 m² extracted outline. No fit or geometry was changed after scoring.

The unchanged **rendered** ground passed **0 of 3** controls, across 282 separate withheld observations. Its median signed height error was −0.424 m at the east front lawn, −0.191 m at the south verge and −0.190 m at the west lawn (negative means too low). Flight contact has separate medians and is not represented by those visual values. No grading, foundation adjustments or substitute components were made. The missing tower and unsupported site seat still block a complete church release.

## Local repeat

```sh
node --experimental-strip-types tools/art/tignish-simon-jude-study/nave/verify-exclusions.mjs
node --experimental-strip-types tools/art/tignish-simon-jude-study/nave/emit.mjs --output /tmp/tignish-absolute-triangles.json
python tools/art/tignish-simon-jude-study/nave/render-views.py --out /tmp/tignish-roof-studio --chromium /path/to/chromium
```

The emitter recovers each full-precision absolute position using the Three.js group’s transform, after preserving precision in local Float32 vertex buffers. Its exact geometry hash is `69c713ca0575d306ac292c29e2514aad8a742fc08f5796f3e3d66cc54eed5835`. Open `/tools/art/tignish-simon-jude-study/nave/` with the repo dev server running. The viewer colours only roles, with the sampling holes left open. The [four browser repeats](studio-gate.json) are identical within their browser session. It does not affect the current flight application.
