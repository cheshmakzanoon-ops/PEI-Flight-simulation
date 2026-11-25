# Replaying the Dalvay Lake optical checks

The effect paints two existing terrain meshes. It does **not** create a flat lake mesh, a surveyed water elevation, a modern shoreline, reflections of the manor or trees, or a new flight collision surface. The numbers below qualify this effect only.

### What was observed

Three registered 900 × 600 software-WebGL captures each toggled **active → stock → active**, inside a single camera tick. The first and last frame matched byte for byte. Renderer program links succeeded, WebGL reported no error, and all three states retained the same draw and triangle totals within each view.

| View | Pixels differing by >2 RGB levels | Peak channel change | Unchanged pixels beyond the source + 2 px |
| --- | ---: | ---: | ---: |
| Opposite bank toward the manor | 209,047 | 107 | 297,722 |
| Approach over the lake | 195,784 | 87 | 338,524 |
| Southwest garden, **not** across the lake | 13,067 | 67 | 524,236 |

“Exterior” means outside the projection of **every possible nonzero bilinear footprint** on the two actual terrain meshes, enlarged by two pixels for antialiasing. A possible source pixel can still be occluded by scenery. Results do not establish FPS, zero GPU cost, identical behavior on every device, the accuracy of the old landscape, or architectural quality. A former exterior leak at screen pixel (725,303) was 11 pixels beyond any possible coverage in the opposite-bank view: the old code could evaluate an extrapolated world position on a grazing triangle. V7 matches stock there, RGB (136,148,151).

### Verification graph

1. **Source**: original hydrography + 2021 categorical raster + the shipped mask + existing AEB building/NRN road geometry → independent fence, donor classes and clearances. Native NHN coordinates are **NAD83(CSRS), EPSG:4617**. They are transformed into **WGS84, EPSG:4326** with explicit longitude/latitude axis order before the game projection. The mask's full bilinear extent stays ≥15.131 m inside the **1987 mapped** bank; the source itself reports 23 m horizontal accuracy. This is not a ±15 m guarantee about the real shore. No source photo is present in the package.
2. **Geometry**: two live N112 terrain uploads, their real model matrices and the shipped mask → 7,507 continuous cells clipped against 135 native terrain faces → 9,873 convex intersections. All 39,408 clipped vertices have game Y between 2.120 and 3.5064 m. This is a bound on the *existing game receiver*, not the lake's elevation.
3. **Pixels**: project those intersections using the registered camera and projection, clip at the near plane, intersect convex footprints with whole pixel squares, add a two-pixel reporting ring, compare the three matched native captures. The comparator exits nonzero for any exterior change or incomplete view set.
4. **Route**: run the selectable departure through the actual 90 Hz flight source and original terrain/cover, then intersect the polyline with the transformed 1987 polygon and evaluate the shipped stencil under the ground track. The neutral run flew over 102.78 m of the named historic polygon. The first-to-last qualifying samples cover 37.90 m of the raw mask (alpha ≥.001); 33.24 m also pass the inward shader feather. This is about 315–349 m **past** the manor, not within the first 165 m. It measures ground under the aircraft, not how much water the pilot saw. Cavendish remains the default.
5. **Registration**: [actual artifacts and receipts](../../../../docs/qa/dalvay-lake-optics/independent-registration.json) include SHA-256 of the packed/decoded mask, source files, exact fixed-frame and readback registrations, and the deterministic flight trace. The compressed source tile and raster, simulated PNGs, staging workspaces, and large intermediate geometry are not stored in Git. PNG encoders/drivers may differ: use the geometric test and matched same-tick comparison, not cross-machine PNG byte identity, to assess a new capture.

### Commands

From a checkout of the tested revision with Node 22.12+ (the recorded run used Node 24) and Python 3.11+. For the optional source and geometry replays, install NumPy, SciPy, Pillow and GDAL's Python bindings. Native scene recreation additionally needs Playwright for Python, a compatible Chromium and the project's installed npm dependencies; the helper uses the existing fixed-scenery harness in an external temporary directory. Use a fresh output directory outside the checkout. Do **not** run the analytical tools with Python's `-O` (assertions are part of the gates).

```sh
T="$PWD/tools/qa/dalvay-lake-optics/independent"
D="$PWD/docs/qa/dalvay-lake-optics"
W="$(mktemp -d)"
P="$PWD/public/world/dalvay-optics/2021-visual-core.dlb"

# No dependencies or network; verifies registrations and the actual shipped bytes.
python3 "$T/verify.py" --repo "$PWD" --strict-runtime

# Supply the original files, not a JPEG, thumbnail or alternative survey edition.
# The two official download URLs are recorded in independent-registration.json.
NHN=/absolute/path/to/nhn_rhn_01cc000_shp_en.zip
ESA=/absolute/path/to/ESA_WorldCover_10m_2021_v200_N45W066_Map.tif
python3 tools/geodata/rebuild-dalvay-lake-optics.py --nhn "$NHN" --world-cover "$ESA" --out "$W/rebuilt.dlb"
cmp "$P" "$W/rebuilt.dlb"
python3 "$T/source-envelope.py" --lake-zip "$NHN" --esa "$ESA" --wire "$P" --checkout "$PWD" --new-views "$T/lake-bearings.json" --out "$W/source.json"

# Resident standard terrain: uses actual gl.getBufferSubData and restores bindings.
CHROMIUM=/absolute/path/to/chromium
python3 "$T/capture-geometry.py" --checkout "$PWD" --out "$W/vbo" --chromium "$CHROMIUM" --select dalvay-principal-nw
python3 "$T/height-envelope.py" --vbo "$W/vbo" --pack "$P" --polygons "$W/intersections.npz" --out "$W/heights.json"

# Fixed-tick V7/off/V7 capture — stock refers to the middle draw, not another flight.
python3 "$T/capture-pairs.py" --checkout "$PWD" --out "$W/paired" --chromium "$CHROMIUM" --views dalvay-facing-mansion-across-named-lake dalvay-approach-over-named-lake dalvay-lake-side
python3 "$T/whole-pixels.py" --polygons "$W/intersections.npz" --vbo "$W/vbo" --paired "$W/paired" --out "$W/views.json"

node --experimental-strip-types "$T/route-track.mjs" "$PWD" "$P" "$W/track.json"
python3 "$T/route-coverage.py" --track "$W/track.json" --lake-zip "$NHN" --polygons "$W/intersections.npz" --out "$W/route.json"
```

Compare the JSON outputs with `independent-source.json`, `independent-heights.json`, `independent-views.json` and `independent-route.json` under `docs/qa/dalvay-lake-optics/`. Floating point geometry and projection depend on GDAL/PROJ and the JS engine. Hardware screenshots need not have the reference hashes, but any nonzero exterior change still fails that replay. Simulator verification is not real-world navigation advice.
