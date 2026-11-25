# Panmure Head exterior study

This is a standalone Three.js art station, not a game asset or landing surface. The renderer compares an original lower tower with two plausible lantern variants against the same camera and light. Measured data supports parts of the lower form, gallery height and main roof, but cannot establish the roof facet count, hidden sides, door orientation, glass construction or present-day site.

From the repository root:

```sh
npm ci
./node_modules/.bin/vite tools/art/panmure-detached --host 127.0.0.1
```

Open the local URL with `?cap=8&refined&gallery` or `?cap=12&refined&gallery`. Remove `gallery` for the full exterior. Add `access` for the detached, interpretive carpentry study. There are no source photographs, maps or raw survey points in this directory.

To verify the independent local build with Playwright:

```sh
./node_modules/.bin/vite build tools/art/panmure-detached
python tools/art/panmure-detached/capture.py \
  --dist tools/art/panmure-detached/dist --chromium /path/to/chromium --out /tmp/panmure-exteriors
```

See the [status, public references and evidence](../../../docs/qa/panmure-detached-exterior.md). This station does not replace any scenery in the full game.
