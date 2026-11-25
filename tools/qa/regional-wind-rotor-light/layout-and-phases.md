# Actual rotating-caster checks

These tools examine the original indexed rotor and real simulator frames; they are not assets loaded by the game. The [scenery report](../../../docs/qa/regional-wind-rotor-light.md) links the independent native-depth and frame evidence.

With the repository's npm dependencies installed, regenerate the analytical all-phase bounds and nominal attachment budget:

```sh
node --experimental-strip-types tools/qa/regional-wind-rotor-light/layout-census.mjs . /tmp/pei-rotor-layout.json
```

For a West Cape case, install Python with Pillow/NumPy/Playwright and supply a compatible headless Chromium executable. This builds a disposable QA page, fixes the observer and source clock at 0.42 s, leaves the rigid lighting and actual rotor visible, draws the scene with the moving terrain receiver on/off/on in the same tick, and checks original-frame restoration, GL errors, renderer state and actual changes in RGB. A real GPU/browser may produce different RGB hashes from the reference software renderer.

```sh
python tools/qa/regional-wind-rotor-light/west-phase-probe.py --checkout . \
  --out /tmp/pei-rotor-west --chromium /path/to/chrome-headless-shell
```

`make-phase-plate.py` takes a directory of the independently captured `{unit}-reverse-{phase}-{on,off}.png` files and an output WebP path. It crops the same location within each row and adds labels, with no contrast adjustment. It uses Pillow and DejaVu Sans.
