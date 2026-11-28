# Three-county ground detail: test the terrain scale before painting

Grass texture was too fine to read from the tested flight height.
A stronger repeating pattern was visible, but looked more like
fabric than a field. This workbook tests whether the native
PEI terrain data can provide a larger, genuinely local signal
instead. **Nothing is installed in the simulator.** It uses no
new panorama, turf texture, game mesh or contact surface.

## Survey data and actual aperture

The three independent Prince, Queens and Kings grassland departures
begin 78 m above their original ground. Two recorded neutral
camera stations use the same original Three.js indexed ground mesh,
unmodified flight logic and fixed comparison region. For each station,
we kept the rays falling strictly inside the detached grass owner.
The [six compressed occupancy rasters](roi/manifest.json) are exact
counts per original 1 m source cell, not camera screenshots or live
whole-scene depth. The two stations cover **different ground**
in all three counties. They are not temporal tests of the same grass patch.

The [acquisition receipt](evidence/native-source.json) shows 38 bounded
requests and 13,220,695 transferred bytes across the complete repeat.
Each compressed block came from the primary resolution of the original
licensed data. The two sources have the same 1 m grid and were not
resampled. No TIFF or source photography is included here. The reader
does not run during gameplay or CI.

The analysis requires complete grass bilinear footprints from the
existing signed inventory, the original dry class, an observation halo,
and clear distance from mapped roads, building envelopes, paths, parking
and tall measured source cells. A height cap is not proof that all
woods, hedges, fences or current infrastructure have been recognized.

## Findings

| County | Median 8 m block surface separation | P90 minus P10 of independently eligible 8 m blocks | Result |
| --- | ---: | ---: | --- |
| Prince | 0.053 m | 0.015 m | Below 0.13 m required variation |
| Queens | 0.022 m | 0.012 m | Only five blocks with enough qualifying source cells |
| Kings | 0.076 m | 0.087 m | Below required variation |

The two measured surfaces are bare earth and top-surface
models. Their difference does **not** tell us grass height, how much of
it was growing, species or colour. The very low signal is a reason
not to invent three-dimensional turf at medium flight distance.

A separate [bare-earth slope check](evidence/bare-earth-optics.json)
asks what the measured slopes would do to directional light, without
moving the ground. At the two independently registered stations, P90
normal changes were **3.72° / 1.49°** in Prince, **0.91° / 1.24°** in
Queens and **1.38° / 2.55°** in Kings. Prince’s first station and
Kings’ second met the original 1.5° and light response gates. None
met both gates at both stations. These are geometric predictions,
not pixel or graphics performance measurements; they justify
no replacement material yet.

## Repeat the checks

Run from the checked-out project root with its signed world assets and
installed Node dependencies. The offline scripts use NumPy, SciPy,
pyproj, Requests and Python GDAL; stock geometry is emitted by Three.js.

```sh
here=tools/art/province-ground-relief
work="$(mktemp -d)"
mkdir "$work/headers"
origin=https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-lidar/PEI-Prince_Edward_Island_2020-1m
for kind in dtm dsm; do
  curl --fail --silent --show-error --range 0-8191 --max-filesize 8192 \
    -H 'Accept-Encoding: identity' -D "$work/headers/$kind.hdr" \
    "$origin-$kind.tif" -o "$work/headers/$kind.bin"
done
python3 "$here/read-paired.py" --headers "$work/headers" \
  --plans "$here/windows.json" \
  --plans-sha256 d430a7013376245da647ebff3a33a3b57633feddfb4333d6063997740730ea82 \
  --out "$work/paired"
for name in peer-paths mask-support export-stock; do
  npx --no-install esbuild "$here/$name.mjs" --bundle --platform=node \
    --define:import.meta.env.BASE_URL='"/"' --format=esm --outfile="$work/$name.mjs"
done
node "$work/peer-paths.mjs" . "$here/windows.json" "$work/peers.json"
node "$work/mask-support.mjs" . "$here/windows.json" "$work/masks"
node "$work/export-stock.mjs" "$work/stock"
python3 "$here/analyze-whole-aabb.py" --repo . --plan "$here/windows.json" \
  --source "$work/paired" --peer "$work/peers.json" --mask "$work/masks" \
  --out "$work/separation.json"
python3 "$here/bare-earth-optics.py" --repo . --plan "$here/windows.json" \
  --source "$work/paired" --peer "$work/peers.json" --mask "$work/masks" \
  --stock "$work/stock" --roi "$here/roi" --out "$work/optics.json"
```

The download is bounded and rejects changed source headers, ETags or
range lengths instead of silently admitting alternate data. The
[separation](evidence/surface-separation.json) and
[optics](evidence/bare-earth-optics.json) receipts retain the full
measurements. The [rowstore test](test-rowstore.py) checks reconstruction
for one to four native LZW blocks without a network request.

Contains information licensed under the
[Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada)
and the [Open Government Licence – Prince Edward Island](https://www.princeedwardisland.ca/en/information/finance/open-government-licence-prince-edward-island).
Near surfaces use the existing project's attributed
[province grass sources](../../../docs/qa/province-grass.md).
