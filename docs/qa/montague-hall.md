# Montague bridgehead: former Town Hall

The former first Town Hall at 567 Main Street now has a shallow roof and an
original two-level exterior instead of the four-row generic block. The
existing Natural Resources Canada building outline (`q103301/232`,
137.710 m²) is retained. The native roof fit does not alter the shoreline,
terrain, flight contact, roads or neighbouring buildings. It is one scoped
landmark in Kings County, not a reconstruction of all of Montague.

- Natural Resources Canada's [2020 source point cloud](https://canelevation-lidar-point-clouds.s3.ca-central-1.amazonaws.com/pointclouds_nuagespoints/PEI/Prince_Edward_Island_2020/pei_2020_427000_679000.copc.laz)
  and [native 1 m DSM/DTM](https://datacube.services.geo.ca/stac/api/collections/hrdem-mosaic-1m/items/10_3-mosaic-1m)
  support the roof shape. A separately [attributed OpenStreetMap building
  way and consecutive Main Street points](../../data/odbl/montague-bridgehead)
  verify identity and the front edge, not a new outer plan. The newer mapped
  footprint and the source atlas are not identical; this pass does not draw
  the additional mapped extent.
- The [Canadian Register of Historic Places](https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=8910)
  documents the hill-set building, raised parapet, wood shingles, cement
  base and three former fire-truck bays. The bay reveals, painted joinery
  and glazing are original geometry and material work, not measured jamb
  dimensions. The dark glazing uses the game's existing CC0 sky.
  There are no reproduced photographs, logos, signs, tenant details or
  interiors. Exterior colours and trim are interpretive.
- The former post office opposite it is not added: the available small
  source sets do not agree closely enough on its full plan and roof. Other
  town ground and buildings remain visibly simpler in low views.

## Geometry and source tests

The [source receipt](../../data/montague-hall/native-validation.json)
holds the bounded native data fingerprints. A robust plane uses 763
unwithheld building returns at least 0.53 m inside the footprint. Another
189 returns, separated in 2 m native spatial blocks before fitting, are
tested against the actual Float32 Three.js mesh and the predecessor. All
189 rays hit the roof without duplicate unequal heights.

| Held-back raw roof return error | Original | Fitted |
| --- | ---: | ---: |
| Median absolute | 4.936 m | 0.027 m |
| p90 absolute | 5.115 m | 0.053 m |
| p95 absolute | 5.149 m | 0.065 m |

These are checks on the sampled roof, not vertical accuracy guarantees.
The 1 m all-class surface is a related survey product and includes
rims and mixed returns. Its 107 guarded samples improve from 5.062 m
to 1.950 m p90, with a 5.58 m maximum residual still present. Parapet
height and glass placement are not included in the native-fit claim.
The exact [mesh and plan reports](montague-hall-geometry-gate.json)
include 777 closing parapet samples, projected Float32 gap 0.00044 m²,
spill 0.00023 m² and no projected overlap. All 35,799 unrelated
vertices in the tile are byte-identical across six attributes. Actual
front rays reach glass 0.290 m behind each of the three bay openings.

Replay (Python 3 with NumPy; the point-cloud invocation also needs
laspy/lazrs and GDAL CLI, and raster/bake/projection need Python GDAL):

```sh
python tools/geodata/sample-montague-hall.py --layer copc --out /tmp/pei-montague
python tools/geodata/sample-montague-hall.py --layer raster --out /tmp/pei-montague --pbf /path/to/prince-edward-island-261101.osm.pbf
python tools/geodata/bake-montague-hall.py --root "$PWD" --source /tmp/pei-montague --verify
node tools/qa/montague-hall-mesh.mjs /tmp/pei-montague/hall-blind-world.csv /tmp/pei-montague/mesh.json /tmp/pei-montague/actual.json
python tools/qa/montague-hall-projection.py /tmp/pei-montague/actual.json
```

## Matched game render

[Before and after](montague-hall-comparison.webp) and
[render gate](montague-hall-render-gate.json) use the actual Three.js
scene at 3.75 m, 7 m, 23.5 m and 117 m above the camera's surface, plus an
unchanged East Point control. The camera, complete local imagery and
building load state, and time are locked. Only the old/new target shell
is toggled. No RGB change occurs in the 2,382,912 off-target pixels
in the four local frames (outside the target masks plus one AA pixel)
or in the 655,360 East Point pixels. The four local views add 626
submitted triangles and no draw calls. This is software WebGL visual
evidence, not a player FPS rating or evidence for flying near the ground.

A separate [compiled-player gate](montague-hall-flight-gate.json) took the
unmodified Montague River dispatch 113.28 m with all 11 local building
tiles and 18 detail tiles ready; no render errors or layer warnings.

```sh
python tools/qa/montague-hall-frames.py --checkout . --out /tmp/pei-montague-frames --chromium /path/to/chromium
npm run build
python tools/qa/montague-hall-flight.py --dist dist --out /tmp/pei-montague-player --chromium /path/to/chromium
```
