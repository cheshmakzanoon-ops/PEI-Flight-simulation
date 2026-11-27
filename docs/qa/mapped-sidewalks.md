# Registered 3D sidewalks

Sidewalks first appear as separate ground-level scenery, not as painted lines
on the road, invented driveways or accessibility routing. The optional
53.5 kB compressed pack covers 179.4 km of source-supported lines (2,035
accepted fragments across 115 render tiles) after checking building, road and
coast clearances. It installs only alongside the matching province Cover,
building atlas version and checked road geometry. Nothing in the terrain,
road, runway, shore or flight model is regraded by this change.

| Mapped cohort | Retained distance | Contributing source ways |
| --- | ---: | ---: |
| Charlottetown area | 118.25 km | 948 |
| Summerside area | 46.27 km | 338 |
| Other PEI | 14.89 km | 104 |

Cohorts describe the project's fixed city-radius selection, not municipal
boundaries. The pinned map does not provide eligible surface-tagged lines
around Montague under these gates; the simulator does not make up missing
sidewalks. See [exact selection receipt](../../data/odbl/sidewalks/selection.json)
and the [separate OpenStreetMap source exports and license](../../data/odbl/sidewalks/).

## What the model represents

- Anchor geometry requires an explicitly mapped OSM sidewalk and surface tag.
  Cast concrete is the most common class, with small groups of precast slabs,
  paving stones, brick, sett and asphalt. No road-centre offsets, inferred
  driveways, unmarked crossing stripes, access labels or tile imagery are used.
- Approximately 4.69 km have a usable source-tagged width. Otherwise the
  authoring default is 1.50 m or 1.35 m around Summerside, based on public
  [Charlottetown](https://www.charlottetown.ca/UserFiles/Servers/Server_10500298/File/Resident%20Services/Bylaws%20and%20Regulations/Official%20Plan%20and%20Zoning%20and%20Development%20Review/City%20of%20Charlottetown%20Official%20Plan%20-%20PH-OPA.1-003.pdf)
  and [Summerside](https://www.summerside.ca/UserFiles/Servers/Server_4499283/File/Tender%20Documents/2020/Tender%20-%20Sidewalks%202020.pdf)
  design documents. These are modeling defaults, not site-measured widths.
- Caps are split at the exact regular terrain triangle boundaries; an original
  82 mm profile seats the top and an anchored skirt closes its edge in close
  views. Surface textures, bevels, joints, weathering, material colours
  and slab heights are **artist approximations**, not itemized observations.
  Thin paths have an altitude/range fade and use the optional existing
  building-shadow receiver without a second shadow pass.
- A missing source tag, bridge/tunnel/indoor layer, conflicting structure,
  coarse coastal uncertainty, narrow duplicate, unsupported turn or separate
  terrain insert can leave deliberate gaps. This is not an accessibility,
  pedestrian-routing or maintenance asset. Current elevation inherits the
  approximate ground underneath; it is not a grade survey.

## Reproduction and checks

```sh
/usr/bin/python3 tools/geodata/bake-sidewalks.py /path/to/prince-edward-island-261101.osm.pbf
node tools/qa/sidewalk-mesh-audit.mjs /tmp/sidewalk-mesh.json
/usr/bin/python3 tools/qa/sidewalk-scope-audit.py /tmp/sidewalk-mesh.json /tmp/sidewalk-scope.json
```

Replay the actual Three.js meshes against the unchanged NRN rendered strip
widths and all 85,866 building envelopes. The renderer produced 8,275 non-
overlapping plan quads. No road, building or shoreline overlap was found.
The closest actual simulated road and building outline distances were 0.410 m
and 0.831 m, respectively. All 184,068 whole-path interval checks passed the
signed-land interpolation control; source centreline sample error remained
less than 7 mm from centimetre quantization. All 32,500 cap triangles stay
seated in each of the three regular terrain LOD grids in the independent
artificial grade check. This is rendering precision relative to the map,
not an accuracy guarantee for real walks.

Repeat camera and interrupted-transfer checks using
`tools/qa/sidewalk-frames.py` and `tools/qa/sidewalk-flight-fault.py`.

[Open the paired 1,344 × 1,590 comparison plate](mapped-sidewalks-comparison.webp).
Renders use locked cameras and the existing Three.js scene; only sidewalk
visibility changes between frames. On 1024 × 640 frames, mapped paths account
for 17,946 visibly changed pixels in Charlottetown, 19,866 in Summerside and
47,168 in the Kensington bend. Every pixel more than one anti-aliasing fringe
from the independently masked sidewalk geometry remained identical, as did all
655,360 pixels in the East Point offsite control. Terrain ray probes saw caps
less than 0.01 mm away from their intended **82 mm offset from the actual
rendered terrain**, not a physical curb survey. The largest measured difference
in the close views is eight additional draws and 24,868 submitted triangles.
Counts are from Chromium/SwiftShader and are not a hardware FPS benchmark.
The real flight launch continued with a healthy, missing, corrupt or
stalled pack. The optional stalled body was aborted. Ground imagery and
surrounding generic building meshes are unchanged and remain visibly limited.
[Raw counts and cases](mapped-sidewalks-gate.json).

The [matched canvas-opacity check](path-coverage-alpha.md) measures a
separate correction to coverage during the original sidewalk fade.
