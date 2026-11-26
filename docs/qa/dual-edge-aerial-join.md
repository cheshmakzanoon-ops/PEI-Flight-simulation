# Two independent aerial joins on a shared terrain tile

The existing central field join uses the west edge of the signed aerial tile
`11-11`. The new Queens County join uses its east edge against `12-11`.
Previously the tile material could only bind the first pair, so fixing the
east edge would mean losing the established west-edge correction.

Standard can now attach separate edge uniforms to that same terrain draw.
The established pair stays in the first lane; the second has its own
authenticated two-texture receipt, gain, and GPU strip. Retiring either
outer neighbour withdraws just that pair, while retiring the shared source
withdraws both. No terrain mesh, imagery file, collision, or draw is added.

The added Queens window is centred at **46.50978409, −63.51750000** in the
[provincial county boundary service](https://gis.princeedwardisland.ca/server/rest/services/county_zones/FeatureServer/0),
with north-origin source rows `[114,134)` and 2-texel tapers. Each pair
has the existing 10,240-byte resident-strip cap. The shader checks its
declared sampler budget before installing multiple lanes. If it cannot
safely add a lane, it keeps the original first lane rather than withholding
the existing correction.

## Verification

The actual old central join was captured in both builds. The stock,
joined, and two exact-role marker PNGs all matched byte-for-byte. The
new east-side close views changed only within their rendered stock
witness, with alpha, rollback, draw and triangle counts exact. The
median 0.70 m near terrain RGB step changed from **30.38 to 3.03** in the
first heading and **33.61 to 3.09** in the other direction. High,
out-of-window and mirrored controls were unchanged.

The [compiled controllable test](dual-edge-aerial-join/compiled-player.json)
travelled 152.782 m, activated the new lane as Standard, switched to
Cockpit and paused without scenery warnings. Its
[virtual QA corridor](dual-edge-aerial-join/virtual-corridors.json) is
not a public departure or real-navigation guidance. Reproduce the native
views with `tools/qa/tracadie-frames.py --cohort inland` and
`--views central-field,queens-shared-west`. The latter also has
`-reciprocal`, `-high`, `-outside`, and `-flipped` controls.
[Native receipts](dual-edge-aerial-join/render-checks.json).
