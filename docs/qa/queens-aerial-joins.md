# Queens County: two additional low-altitude image joins

Two existing imagery boundaries in Queens County now interpolate between
their original end texels in Standard. The correction changes only how
the ground texture is sampled beside the join. It does not add detail to
the source photography or alter mapped ground, buildings, roads, or flight.

| Location (lat, lon) | Signed owner tiles | Half-open 20-texel window |
| --- | --- | --- |
| Southwestern field, 46.20363636, −63.43179980 | `13-16` / `13-17` | Columns 41–61, west to east |
| Inland field, 46.24779545, −63.27937500 | `14-16` / `15-16` | Rows 94–114, north to south |

Both crossed distinct signed tiles. These windows have no shared owner
with other Standard pairs. Both of their
parents must match before activation. The [official county boundaries](https://gis.princeedwardisland.ca/server/rest/services/county_zones/FeatureServer/0)
identify both test coordinates as Queens County. The
[full-atlas scan](aerial-join-screen.md) found both candidates. It does not
automatically promote a contrast score into a terrain change.

## In-engine checks

Two matched views per location measured the RGB8 step across the same
0.70 m terrain sample pairs:

| View | One heading, stock → joined | Reciprocal, stock → joined |
| --- | ---: | ---: |
| Southwestern field | 29.63 → 2.60 | 30.17 → 2.36 |
| Inland field | 21.80 → 2.37 | 23.18 → 2.29 |

The four close captures had zero alpha drift, zero changes outside their
exact native strip witness, exactly matching draw/triangle counts and an
exact stock restoration. The distance and orientation controls stayed
stock. Each resident pair uses **10,240 bytes** derived only from its
already-loaded textures and no new imagery requests. The close correction
fades out by 330 m and respects the existing `?stockInlandOrtho` switch.

The [dual-edge join](dual-edge-aerial-join.md) covers a different Queens pair
that shares a parent tile with an existing correction.

[Native render receipts](queens-aerial-joins/render-checks.json) ·
[Private compiled replays](queens-aerial-joins/compiled-player.json) ·
[Virtual locations only](queens-aerial-joins/virtual-corridors.json).

Both compiled replays travelled over 150 m, reached the signed strip,
switched to Cockpit and paused without scenery warnings. These are
simulator checks, not suggested routes for a real aircraft. To repeat
the native captures, use `tools/qa/tracadie-frames.py --cohort inland`
with `queens-southwest-fields` or `queens-inland-fields` in `--views`.
The flight reproduction follows the [earlier three joins](expanded-inland-aerial-joins.md#flight-controls-and-fallback):
substitute the virtual locations above and add `--normal-only` to
`expanded-aerial-player.py`.
