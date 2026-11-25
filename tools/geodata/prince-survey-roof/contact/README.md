# Reproduce the local diffuse-sky contact field

Input: the byte-pinned, shipped NRCan-derived [Prince roof](../README.md), with its genuine 30 top and 68 closed wall triangles **after** Three.js emits them. No network access or photographs are needed for the lighting bake. Runtime does not raytrace.

From the repository root, with the published Node dependencies, Python/NumPy, and a C++17 compiler:

```sh
npm ci
./node_modules/.bin/esbuild tools/geodata/prince-survey-roof/contact/source-mesh.mjs \
  --bundle --platform=node --format=esm --packages=external \
  --define:import.meta.env.BASE_URL='"/"' --outfile=.qa-prince-sky-source.mjs
node .qa-prince-sky-source.mjs /tmp/pei-prince-source-triangles.txt
OPENBLAS_NUM_THREADS=1 python tools/geodata/prince-survey-roof/contact/bake.py \
  --checkout . --mesh /tmp/pei-prince-source-triangles.txt \
  --out /tmp/pei-prince-roof-sky.generated.ts --receipt /tmp/pei-prince-roof-sky.json
cmp /tmp/pei-prince-roof-sky.generated.ts src/render/prince-roof-sky.generated.ts
```

[Geometry-to-grid authoring](bake.py) checks shape and complete triangle-stream digests, creates 0.65 m local grids for three existing planes, and clamps chart padding to each receiver’s real surveyed edge. [The visibility integrator](trace.cpp) offsets rays 13 mm along the geometric normal, rejects self-hits smaller than 20 mm and fades only the first geometric hit, from 5 to 14 m. Coefficients are quantized to six bits. The game’s shader decodes the same packed words without textures, smooths the noise floor, and applies only a .74 contribution of the resulting blockage to the .61 ambient term. The .51 directional term is unchanged.

```sh
./node_modules/.bin/esbuild tools/qa/prince-roof-contact-streamer.mjs \
  --bundle --platform=node --format=esm --packages=external \
  --define:import.meta.env.BASE_URL='"/"' --outfile=.qa-prince-sky-streamer.mjs
node .qa-prince-sky-streamer.mjs /tmp/pei-prince-contact-stream.json
python tools/qa/prince-roof-contact-frames.py --checkout . --chromium /path/to/chromium \
  --views west,south --out /tmp/pei-prince-contact-gl
python tools/qa/inland-aerial-joins-fixture.py --checkout . --out /tmp/pei-contact-flight
(cd /tmp/pei-contact-flight && npm run build)
python tools/qa/prince-roof-contact-player.py --dist /tmp/pei-contact-flight/dist \
  --chromium /path/to/chromium --out /tmp/pei-prince-contact-flight.json
npm run check
node tools/verify-world.mjs
```

The native graphics fixture needs Python Playwright, Pillow, NumPy and a WebGL2-capable Chromium. It reads each live GPU `uvec4` from the actual draw program, not an offline substitute. `--query stockPrinceRoofContact` and `--under-budget` check original measured lighting through unchanged geometry. The deterministic private start in the compiled flight is not a public departure.
