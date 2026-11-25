# Independent wind-ground light audit

These are development tools, not game dependencies. They produce real 840 × 540 source-player comparisons with the original turbines and rotor phases retained. The second render disables only the direct-ground shadow count; the third restores it on the same tick. The color change is checked against the independent, original three-dimensional tower/socket/nacelle geometry and true mounted ground, not the candidate texture itself. The actual linked fragment program is reflected separately from the vertex program. No extra render pass is added to the game.

Run from a checkout containing the wind-light feature. Install the game's existing npm dependencies, Python Playwright/Pillow, and NumPy/SciPy/GDAL with Python bindings. Use a Playwright-compatible Chromium executable. The pinned camera recipe is in `independent-shadow-gates.json`. Output directories should be outside the checkout.

```sh
AUDIT=/path/to/this/directory
REPO=/path/to/PEI-Flight-simulation
OUTPUT=/tmp/pei-wind-light-audit
mkdir -p "$OUTPUT"
node "$AUDIT/source-geometries.mjs" "$REPO" "$OUTPUT/original-mesh"
python "$AUDIT/shadow-capture.py" --checkout "$REPO" --out "$OUTPUT/live" \
  --chromium /path/to/chrome-headless-shell \
  --select EKW6-reverse HCS3-reverse WCW27-reverse EKW6-far
python "$AUDIT/trace-native-pixels.py" --actual "$OUTPUT/live" \
  --source "$OUTPUT/original-mesh" --out "$OUTPUT/verdict.json" \
  --select EKW6-reverse HCS3-reverse WCW27-reverse EKW6-far
```

A software-rendered frame does not establish real-hardware FPS. PNG byte hashes can vary between GPU/browser versions. The support, darkening, correct fallback and scope checks are the meaningful comparisons. The high receiver test is a warm far view, not a network-cold test. Earth/vegetation, roads and coatings are not independently surveyed by this tool. The caster excludes the rotor and spinner; this is static direct-sun tower shading, not a shadow-map of all scenery or a measured real-world time of day.
