# Rebuild the Prince County surveyed roof

This pipeline is for **one ordered NRCan AEB roof**, not an arbitrary-site laser reader. The source manifest fixes the series, object, 10 byte ranges, reference frame and pre-model pulse/block reservation. No complete COPC is distributed. Numerical heights are never exported for withheld pulses. No third-party imagery or traced consumer map is part of this geometry. See the [visual scope and caveats](../../../docs/qa/prince-survey-roof.md).

Run from the repository root. The data step needs NumPy, laspy with lazrs COPC support, curl and GDAL's `gdaltransform`. The fitting step needs Python, NumPy, SciPy and GDAL’s Python OGR bindings with GEOS. The byte-for-byte fitting replay was run with Python 3.13.5, NumPy 2.2.4, SciPy 1.15.3 and GDAL 3.10.3.

```sh
node --version   # 22.12+; Node 24 used in the fixture.
npm ci
python tools/geodata/prince-survey-roof/rebuild-training.py --checkout . --out /tmp/pei-prince-train
OPENBLAS_NUM_THREADS=1 python tools/geodata/prince-survey-roof/fit.py \
  --train /tmp/pei-prince-train/train-points.npz \
  --datum /tmp/pei-prince-train/training-ground-reference.json \
  --out /tmp/prince-survey-roof.generated.ts --receipt /tmp/prince-training-fit.json
cmp /tmp/prince-survey-roof.generated.ts src/render/prince-survey-roof.generated.ts
```

A previously authorized byte cache may be supplied with `--offline-range-dir`; each byte range is authenticated. [local-frame.json](local-frame.json) fixes the original ordered outline in game coordinates and an orthogonal UV frame calculated only from its ordered plan. The mesh witness rechecks both the real shipped AEB bytes and the game terrain at the unchanged centroid. The fitter uses equal 0.6 m sampling cells and robust planar fits. Intersections between unlike slopes define the surveyed ridges. Shared boundary segments are split before emitting vertical closure faces.

**Actual production geometry and local streaming faults.** These commands produce the same SHA-256 `b94b2dfc1ea8e9903567aeb277cfd6eeffc5c6a49d8d4c97c4b25a99340ac646` mesh file that the independent reviewer sealed before scoring elevations. The temporary `.mjs` is a bundled QA adapter, not a shipped game file.

```sh
./node_modules/.bin/esbuild tools/qa/prince-survey-roof-mesh.mjs \
  --bundle --platform=node --format=esm --packages=external \
  --define:import.meta.env.BASE_URL='"/"' --outfile=.qa-prince-roof.mjs
node .qa-prince-roof.mjs /tmp/pei-prince-mesh
cmp /tmp/pei-prince-mesh/actual-triangles.json docs/qa/prince-survey-roof/actual-triangles.json
python tools/geodata/prince-survey-roof/predict-only.py \
  --mesh /tmp/pei-prince-mesh/actual-triangles.json \
  --inputs /tmp/pei-prince-train/predict-only-held-xy.npz --out /tmp/pei-prince-roof-predictions.npz
npm run check
node tools/verify-world.mjs
```

**Rendering.** From the checkout with installed Node dependencies, run the GPU mask harness with Python Playwright, NumPy, Pillow and a Chromium/WebGL2 executable. It freezes the camera/water in a temporary checkout and measures exact masks in two opposing directions. To exercise the comparator, repeat with `--query stockPrinceSurveyRoof`; `--query stockInlandOrtho` is an independent switch.

```sh
python tools/qa/prince-survey-roof-frames.py --checkout . --chromium /path/to/chromium --out /tmp/pei-prince-rgb
python tools/qa/inland-aerial-joins-fixture.py --checkout . --out /tmp/pei-prince-flight
(cd /tmp/pei-prince-flight && npm run build)
python tools/qa/prince-survey-roof-player.py --dist /tmp/pei-prince-flight/dist \
  --chromium /path/to/chromium --out /tmp/prince-player.json
```
