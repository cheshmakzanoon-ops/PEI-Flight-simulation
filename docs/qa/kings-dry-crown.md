# Kings County dry crown: 2020 LiDAR terrain study

In Standard scenery, use `?kingsDryCrownStudy&departure=kings-coastal-ridge` for the virtual offshore approach, or select **Kings County · coastal ridge pass**. The preview restores a measured inland coastal ridge around 46.43759, −62.78097 (terrain owner `21-12`). It is a deliberately small, dry-only study, not a new shoreline, a claim about post-Fiona ground, or a navigation layer. Maps, roads, aircraft and existing imagery stay as they are. With no flag, conflicting experimental terrain/vegetation modes, older occupant preflight modes (St. Mary’s or Baywalk), missing or late data, an unverified atlas or stock N56/N8 terrain, the original grade stays active.

## Geometry, contact and source

- Natural Resources Canada, [High Resolution Digital Elevation Model (HRDEM)](https://open.canada.ca/data/en/dataset/957782bf-847c-4644-a757-e383c0057995), PEI 2020, nominal project date 15 September 2020, EPSG:3979 and CGVD2013. Distributed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada). The two [original DTM](https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-lidar/PEI-Prince_Edward_Island_2020-1m-dtm.tif) / [DSM](https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-lidar/PEI-Prince_Edward_Island_2020-1m-dsm.tif) sample windows are `[135140,37202,350,350]`. Their concatenated little-endian Float32 values (DSM then DTM) hash to `f87f494fb9865c1472493634e0c98c23e14e8390ad7fd629f3fb06ee3d5ae7a6`. The DSM is a source/protection witness, never the surface installed for physics.
- The inset uses 2 m-spaced DTM samples (even source row *and* column), bilinear interpolation in native coordinates, 36 m support taper and an additional native dry-safety taper. The 129×129 wire format contains centimetre offsets from the original N112 facets, then an 8-bit support field. Every affected footprint stays away from the signed coast: the incident vertices are at least +74.21 m in the stock Cover scalar. Cover, the ocean plane and curtains are unchanged.
- Only currently submitted N112 terrain can use the insert. Its footprint and seamless stock-grade collar are smaller than a single tile; unchanged parent faces keep the same plane. Original contact remains independent and retained outside the support. Within full support, collision uses the submitted triangle. Across the collar, its inherited difference from original render grade tapers rather than jumping at the boundary. The old coarse grades remain untouched. The correction is full through 4.5 km of the owner centre and tapers out by 5.2 km, before both 5.3 km entry and 6.2 km exit stock LOD thresholds. This same amount is applied to the near vertex offsets, the renderer’s terrain-height sampler, contact and native normal strength. At zero, the original N112 mesh and shader return exactly, including a camera cut across the cutoff before the next regular sweep. The interior fade and re-entry follow the existing 250 ms terrain sweep, not an unconditional per-frame mesh update. No repeated mesh builds while blending and no coarse changes; the optional measured mesh retains about 1.005 MB of attribute/index data beyond the old near mesh while that owner is resident. The generated profile cap applies only after the exact pinned bytes verify, not to arbitrary survey assets.
- All 55,151 packed road segments (including crossings with endpoints outside the crop), 8,275 packed sidewalk segments and 136 parking tiles were checked against the incident-support envelope plus 25 m, with no intersections. The actual stock near roof/forest draw and absolute canopy shadow envelope have no local overlap. The separately pinned 1,686-record hedge chunk has no roots or estimated shadow overlap within 578 m. These checks are for shipped actors, not an inventory of all real lanes/access.
- Compressed 8,024 B; decoded 49,923 B. No new imagery or textures. Optional HTTP transport has byte bounds, accepted wire/decoded hashes, and a finite deadline. Its terrain, cover, mapped road, sidewalk, parking and hedgerow pins prevent install against an unknown combination. The sole overlapping AEB owner is `q12303`: the actual index and its single HTTP 206 owner body are authenticated before the grade is armed. On a valid opted-in launch the normal 23,754-byte owner range is obtained earlier, once, and the exact 548 decoded rows are reused by both first draw and later revisits. No redraw, extra owner request, or province-wide building read. With a bad/late/missing owner, or on a range-less host, the grade remains off and normal building streaming stays available.

## Verification

[Actual matched stock and measured-terrain views](kings-dry-crown-comparison.webp)

2,051 untouched native 1 m source centres inside full support (not used to fit the terrain heights, from the *same* survey) had visual elevation p90 error **10.084 m → 0.139 m**, using the engine’s consistent +0.12 m offset. The full-core contact p90 improved **9.863 m → 0.139 m**. In three actual terrain views, independent LOS rays located 736 / 881 / 1,461 jointly visible held-out centres; 392 px-frame projected vertical p90 error was **32.74 → 0.64**, **32.24 → 0.60**, **33.23 → 0.37 px**. These local improvements do not estimate error elsewhere on PEI. The full-strength C plate is byte-identical to the original reviewed A plate. At 5.2 km and 6.201 km actual zero-strength matched images are exactly stock (439,040 pixels total); at the 4.85 km halfway lock nine pixels change, with 219,070 pixels outside the conservative projected envelope unchanged.

122,500 local stock/candidate positions were tested on the actual World sampler. All 16,939 wet positions and all 111,043 unsupported positions were exactly unchanged. 493 real near Three rays agreed with the active sampler within 0.031 mm. 1,570 protected outside rays were unchanged within 0.010 mm; old vertex buffers, shoreline curtain geometry and the exact N56/N8 owner buffers were separately compared. Tests covered 112→56→8→56→112 and the unchanged sewn tile edges. The largest local installed relative change is 11.99 m, adding 10,024 submitted near triangles and no draw in the matched locked scenes. This is not a device FPS measurement. A separate rollover replay tested 75 fixed distance/hysteresis poses and 3,416 direct Three rays through the submitted transitional surface. All 14 zero-stock buffers and 13,300 associated height samples were exact. At 25 m camera steps on the conservative witness bearing, the measured contribution moved by at most 0.198 pixel at 1080p / 53°; this is not a guarantee about arbitrary views or stock LOD transitions.

The close comparisons use unchanged ortho tiles, shaders and environment (560×392, native OpenGL ES reproduction of the exact Three buffers and programs). The ridge reads correctly from both directions, but original coarse colour/shore faceting remain visible. All 280,440 protected RGB pixels beyond the insert and its stitching envelope were byte-identical. Some weak sampling differences occur on the untouched-plane retessellation apron; measured heights, actor ownership, water and sky controls stay unchanged. Native source on the taper is deliberately not reproduced exactly. This is not a whole coast, texture, or visual-fidelity claim.

The packaged game’s offshore departure flew **504.1 m on stock** and **503.5 m with the measured terrain active**; both runs switched to Cockpit and paused without layer warnings. Each used one original AEB owner-range response. A same-length corrupted AEB response kept the terrain study off and allowed normal dispatch. The full-game distance sweep restored exact stock visible and contact heights at the cutoff, after the lower-detail switch and after returning, and restored the zero-gain view immediately after a same-clock outward move. These tests used the built game and the original source assets on a local range-capable service. All 323 tests, the production build and world validation passed.

### Reproduce the numerical asset

Use an isolated work directory, with the project’s dependencies installed and local official `public/world` assets. The bake uses Python GDAL, NumPy and SciPy; only the two 350×350 GDAL source windows are needed. Run `npm test` for bounded-loader, exact AEB draw reuse plus eviction, and flag controls. The nearby actor audit is read-only and the optional render proof uses the independently documented fixed view points.

```bash
# ROOT is the repo directory; CROP is an empty scratch directory you own.
cd "$CROP"
ln -s "$ROOT/node_modules" node_modules
export PEI_PUBLIC="$ROOT/public" SCOUT="$PWD" PEI_WORLD="$ROOT/public/world"
Q="$ROOT/tools/qa/kings-crown"
python "$Q/fetch-native.py"
python "$Q/raw-grid.py"
"$ROOT/node_modules/.bin/esbuild" "$Q/actual-core.mjs" --bundle --platform=node \
  --format=esm --external:three '--define:import.meta.env.BASE_URL="/"' --outfile=actual-core.mjs
node actual-core.mjs
python "$Q/dry-scope.py"
node --experimental-strip-types "$Q/stock-nodes.mjs"
python "$ROOT/tools/geodata/bake-kings-dry-crown.py" --out "$PWD/rebaked"
sha256sum rebaked/public/world/coastal/dry-v1/kings-crown-2020.g11.gz
# Replay exact stock/active Three buffer and contact tests on the shipped art:
"$ROOT/node_modules/.bin/esbuild" "$Q/actual-grade.mjs" --bundle --platform=node \
  --format=esm --external:three '--define:import.meta.env.BASE_URL="/"' --outfile=actual-grade.mjs
CROWN_ROLLOVER=1 node actual-grade.mjs
python "$Q/make-heldouts.py"
```

Retain `90a63ef6da545818c78d0b5b2ac2e733e6432f4054ee7428cd1784d140b6f0e4` as the exact pinned compressed bytes. Gzip headers may differ across Python versions; compare the decoded SHA-256 `0325e8411891a47cc35804a2eab6d8c2e957a3cc78d8afcc15e1dfc358d4bd9a` when reproducing on another system.
