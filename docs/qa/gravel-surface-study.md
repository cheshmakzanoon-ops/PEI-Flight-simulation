# Mapped gravel surfaces

Enable **Mapped gravel surfaces** in Dispatch under **Standard**, or use
`?gravelSurfaceStudy`. This optional treatment makes clearly mapped gravel
less uniformly orange, gives close aggregate a fine surface normal, and
softens the inside of the rendered road edge. It adds no roadbed geometry,
grade, lane marking, collision, or accesses, and does not classify any new
road. Individual stone positions, vehicle wear and colour are original art,
not surveyed PEI road conditions.

## Source and coverage

The exact pinned [PEI National Road Network 22_1](https://open.canada.ca/data/en/dataset/3d282116-e556-400c-9306-ca1a3cada77f)
authorizes only **Unpaved / Gravel** non-bridge rows. All **19,465**
published simulator road records were replayed against the source geometry
and flags before generating the ordinal bitset. It admits **2,651** rows
along **817.17 simulated kilometres** of existing simplified centreline
across all three counties. Neither unknown-status row, any of the **184**
bridges, nor dirt, pavement or painted runway are admitted. For example,
Brookvale source row 7208 has an unknown **name**, but an explicit gravel
**surface**. Actual widths and elevations remain approximations, not engineering
specifications or a claim of continuous visible coverage.

The ground texture is supplied by the existing scene. The added 2 m repeating
mineral swatch is original compacted-aggregate art, using varied 7–36 mm
illustrative chips and small signed normal slopes. No road photographs or
ground equirectangular images were used. For dimensional context the
[PEI highway specifications](https://www.princeedwardisland.ca/en/publication/general-provisions-and-contract-specifications-for-highway-bridge-construction)
describe the grading of construction aggregate, not this dated road network's
current local gravel composition. Contains information licensed under
the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
The exact colour/normal/roughness channel and digest receipt is in
[the material source record](../../public/art/aggregate/source.json).

## Admission and fidelity

No extra request in Dispatch, Detail or a default flight. An explicitly opted-in
flight requests the art at most once, while the eye is below **155 m AGL**
and within **470 m slant distance** of an exposed dry, positive gravel
triangle from the verified current road batch. It checks the actual
rendered positions, including optional seated-road offsets and the
active terrain height. A buried nearest point is conservatively not an
admission witness. The proximity search uses only nearby stock road
owner buffers, no alternate geographic index and no mesh rebuild. It
is throttled to 200 ms unless the eye moved 18 m. The warmed renderer
uses the texture only in its fixed altitude/distance/footprint bounds;
normal frames do no repeat proximity search after loading.

The **304,552-byte** gzip and its independently hashed **409,600-byte**
decoded pixels are bounded. The server may expose the exact gzip bytes
or already-decoded bytes from HTTP Content-Encoding. Missing, malformed,
incomplete, oversized or late transfers leave the old material in place;
the deadline covers both headers and body (**2.2 s**), and a reload is
needed for another attempt. The existing road batch is not delayed or
replaced while waiting. A valid map fades in and is reused when returning
to a low pass. High (220 m AGL or higher) and distant fragments use the
previous appearance. Fine mipmap reads fade before they can resolve as
coherent tile or pixel patterns.

## Verification scope

Matched **Three.js** material/geometry snapshots rendered in 4× native
EGL across Prince, Queens, Kings and Brookvale kept **2,719,629 protected
pixels** byte-identical, as well as an entire 241 m warm control. All
absent-art snapshots were exact; draw and triangle counts did not change.
A native actor witness verified real buffers, one request only near a
known eligible gravel road, no requests in two offshore controls, and
same-resource reuse after a high/low cycle. The closest-surface query
only changes texture eligibility, not flight contact.

These are controlled optics and scope tests, not a device FPS or
photographic-road survey. Some legacy pieces of the existing ribbon
still fall below the displayed terrain; this does not rebuild missing
roads, surrounding fields or specimen landscaping. A full in-game
route, image and transport check is separate from this native witness.

```sh
node --experimental-strip-types --test test/gravel-surface-study.test.ts
/usr/bin/python3 tools/terrain/bake-compact-aggregate.py --out public/art/aggregate/compact-aggregate-v1.rgba.gz
/usr/bin/python3 tools/geodata/bake-road-gravel-authority.py \
  --source /path/to/NRN_PE_22_1_GPKG_en.gpkg --out /tmp/gravel-source
npm run check
```

## Full-game visual checks

[Four matched game views](mapped-gravel-comparison.webp) show the Prince,
Queens and Kings County cases and the Brookvale approach. The app used
the normal **Begin flight** control and loaded the authenticated
texture exactly once per case. The matched pair changes only material
gain within one rendered scene. Outside the projected positive-road
triangles plus a one-pixel raster reserve, all **822,762** control
pixels were byte-identical. No draw or triangle count changed between
the frames. At 55–58 m the main visible improvement is the tone and edge,
not individually resolvable stones.

See the [frame and request receipt](mapped-gravel-frames.json). To replay
the camera and material checks, install local Python Playwright and
Chromium and run:

```sh
python tools/qa/gravel-browser.py --checkout . --deps node_modules \
  --chromium /path/to/chromium --out /tmp/pei-gravel-pairs --mode pairs
python tools/qa/gravel-browser-scope.py /tmp/pei-gravel-pairs
```

The script runs Vite from a temporary source copy and does not overwrite
the checkout. Its locked optical cameras are QA fixtures, not ordinary
player departures.

The [height-cycle receipt](mapped-gravel-height-cycle.json) starts high:
the game makes no aggregate request at 245 m or 183 m above the local
ground. In the low view it requests the art once. The high view at
221 m and 245 m is byte-identical to neutral, and descending to the same
58 m view restores the same number of changed pixels without making
another request. The locked camera cycle isolates the material's fade; it
does not infer the appearance of roads from a particular real aircraft.

The [request and virtual-flight receipt](mapped-gravel-runtime.json)
records no requests with the option off, in Detail, during a high
start, or at a low offshore control. HTTP 404, same-size corruption,
an oversized response, and a response held past the deadline all
kept the original material. Two separate ordinary virtual flights
crossed at least 500 m after Dispatch, selected Cockpit and paused
without a layer warning. The preview flight used the same single
download and still had the material active at the end.

The [mixed-road source check](mapped-gravel-mixed-source.json) lists
examples where the same road name covers different surfaces. Positive
gravel bits match the dated source geometry exactly; adjacent dirt,
paved and bridge records remain excluded. It is a source and material
eligibility check, not a statement about today's roads.

For a quick check on the compiled build, choose **Prince County · grassland
pass** after enabling the preview, or add
`?gravelSurfaceStudy&departure=prince-grassland` to the game URL. The
[compiled-bundle replay](mapped-gravel-compiled.json) loaded the material
once during ordinary flight on that existing departure.
