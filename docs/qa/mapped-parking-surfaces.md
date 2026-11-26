# Registered parking surface polygons

The flight atlas includes 539 mapped surface-tagged parking areas after
checking current land, structures and road/sidewalk geometry. The selected
polygons total **1.111 km²**, split into 565 pieces across 136 independently
streamed render tiles. There are separate original asphalt, gravel,
compacted, generic paved and generic unpaved material families. Cohorts
are game selection radii, not city administrative boundaries.

| Cohort | Source areas | Retained ground |
| --- | ---: | ---: |
| Summerside area | 196 | 484,567 m² |
| Charlottetown area | 148 | 292,363 m² |
| Montague area | 7 | 10,219 m² |
| Other PEI | 188 | 323,647 m² |

Only explicit surface tags are used. Known private, resident-only and
permit-only areas were excluded; unspecified access is not evidence of
public permission. Uncertain shoreline cells, tunnels, bridge decks,
parking structures, and very narrow or ambiguous remainders are excluded.
The [OpenStreetMap derivative and exact selection receipt](../../data/odbl/parking-surfaces)
are available under ODbL, with attribution in the flight interface.

## Appearance, limitations and fallback

The shapes have physically scaled fine aggregate and wear over terrain-seated
geometries, with softened edge bands inside the supported outline.
The colour and wear are original reference-level approximations; no
parking-space lines, invented vehicle positions, property names, navigation
permissions or ground photographs are rendered by this layer.
A 17–40 mm decorative surface offset conforms to the same terrain triangle,
never changing collision or grade. Raised shoreline or separate survey
inserts are excluded; an active irregular adaptive tile hides the associated
parking tile until the regular surface returns. Original terrain, water,
road, sidewalk, building and aircraft layers are retained.

The compressed 200,124-byte optional data has its own bounded, validated
transfer. It is not awaited during flight startup. A missing or damaged
pack retains the old scenery, as does a version mismatch in the supporting
road, structure, signed Cover or sidewalk source. A runtime atlas tile
is never painted over an active irregular survey just to keep a visual effect.

## Numerical and browser checks

Every runtime outline was compared to the pinned source, signed Cover and
simulated road, sidewalk and building envelopes. There are zero intersections
with any protected area, other parking polygon, the authored basilica, or
reference runway paint. The minimum measured plan separation from known road,
sidewalk and building shapes is **0.276, 0.256 and 0.694 m** respectively.
Actual emitted cap coverage differs from the packed plan by no more than
0.0034 m² per tile and surface class; 125,761 upward cap triangles are in the
full streamed atlas, not submitted all at once.

An independent Three.js witness in the three counties checked **16,587**
positive-land core and edge points on 8-, 56- and 112-subdivision active
terrain. Maximum decorative lift residual was **0.0041 mm relative to the
rendered terrain**, not a grade or real-world positioning accuracy claim.
It also checked the regular/adaptive hide, preserved hidden data, exact
restoration/refit and final disposal. A normal flight continued through
healthy, missing, corrupt and stalled optional requests. The stalled request
was aborted without stopping the flight.

```sh
/usr/bin/python3 tools/geodata/bake-parking-surfaces.py /path/to/prince-edward-island-261101.osm.pbf
node tools/qa/parking-surfaces-mesh.mjs /tmp/parking-mesh.json
/usr/bin/python3 tools/qa/parking-surfaces-scope.py /tmp/parking-mesh.json /tmp/parking-scope.json
```

Repeat the camera and transfer tests with
`tools/qa/parking-surfaces-frames.py` and
`tools/qa/parking-surfaces-flight-fault.py`.

[Open the 1,400 × 1,650 paired comparison](mapped-parking-surfaces-comparison.webp).
At matched 1,024 × 640 poses, there are 166,904, 331,832 and 135,662 visible
pixel changes in asphalt, gravel and compacted examples. The 118 m
Summerside area overview shows 30,007 visible changes. In each view, every
pixel beyond the actual projected lot mask plus one antialias fringe is
unchanged. The East Point control is identical across all 655,360 RGB pixels.
The busiest reviewed view adds ten draws and 41,605 submitted triangles;
these are software-renderer geometry counts, not an FPS benchmark.
[Raw gate evidence](mapped-parking-surfaces-gate.json) includes the exact camera
poses, exposure masks, independent mesh/runtime checks and fault results.

See [mapped parking edge compositing](parking-coverage-alpha.md) for the
multisample alpha correction on these same mapped surfaces.
