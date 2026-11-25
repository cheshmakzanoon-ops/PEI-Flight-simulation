# Independent moving sunlight audit

These are developer-only tests for the scenery renderer. Nothing here runs in a normal flight or supplies game assets. The reference is the original three-dimensional, animated mesh and its source clock, not a generated shadow map or an external photograph. The candidate archive was sampled from actual WebGL 2 depth, not reconstructed by the test. The numeric checks read the submitted rotor and shadow draw's bound instance matrices, individual seed and clock, and original position/index buffers. The screen check leaves both the visible rotors and previous static mast shadow on, switches only the moving-ground contribution off, restores it, and compares RGB.

**Requirements:** Node 22.12+ with TypeScript support (Node 24 used for the recorded capture), the game's locked npm dependencies for both checkouts, Python with NumPy, SciPy, Pillow, GDAL Python bindings, Playwright and a compatible Chromium executable. No accounts, external terrain downloads, artwork or credentials are required. The GPU test needs WebGL 2, a working depth texture and the simulator's normal assets. Use an output directory outside either checkout; allow about 80 MB of temporary files. On SwiftShader the captures can take several minutes. No hardware frame-rate claims follow.

## Reproduce

Use the original tagged-by-hash version for the independent reference. Use a second checkout containing the candidate for the live captures. For example, a detached worktree at the exact release below can serve as `ORIGINAL`. Both must have their normal locked dependencies installed. Run from a shell, substituting the checkout/executable paths.

```sh
ORIGINAL=/path/to/original-at-fe9ff61a5fc1469d18bacbc24eb5debc20775f73
GAME=/path/to/checkout-with-moving-sunlight
AUDIT="$GAME/tools/qa/regional-wind-rotor-light"
OUTPUT=/tmp/pei-moving-light-audit
CHROME=/path/to/chrome-headless-shell
mkdir -p "$OUTPUT"

node "$AUDIT/source-poses.mjs" "$ORIGINAL" "$OUTPUT/source"
python "$AUDIT/original-rays.py" --original "$OUTPUT/source" --out "$OUTPUT/reference"

python "$AUDIT/live-depth-capture.py" --checkout "$GAME" --out "$OUTPUT/live" \
  --chromium "$CHROME" --select WCW27-reverse EKW6-reverse HCS3-reverse WCW27-cross EKW6-warm-far

python "$AUDIT/score-live-depth.py" --actual "$OUTPUT/live" --original "$OUTPUT/source" \
  --truth "$OUTPUT/reference" --output "$OUTPUT/whole-ray-physical.json"
python "$AUDIT/score-live-images.py" --actual "$OUTPUT/live" --original "$OUTPUT/source" \
  --roster "$ORIGINAL/src/render/regional-wind.generated.ts" \
  --select WCW27-reverse EKW6-reverse HCS3-reverse WCW27-cross EKW6-warm-far \
  --out "$OUTPUT/matched-optical.json"
```

Use a fresh output for each source revision, graphics device or browser. Only identical interrupted runs may share a capture directory. Repeated on/off pairs within one run must match when restored; exact PNG fingerprints can differ across browsers/graphics devices. The live capture stages a private copy, freezes the water/animation clock for each comparison and fixes camera position with the ordinary geographic game loader. It does not modify either checkout. In the published far trace two consecutive ordinary renders were identical and no moving phase drew; the portable tool also checks a third identical far render on new runs.

## What to inspect

* **Physical:** all three turbine types, all 12 original clock values, all three vanes and their outer 25%, 600-second clock wrap, repeat, two source slopes, upper clipped cases and above-caster empty control. Source-precision of an offscreen depth sample at a silhouette is not a measurement of real terrain or turbine elevation. Keep hard geometry, finite solar-area attenuation, and post-tonemapped optical comparisons separate.
* **Optical:** two genuinely different blade poses per turbine, an opposed West Cape camera and high/distant Eastern Kings. Each changed pixel is compared against nine camera rays to actual submitted N112 terrain and the finite solar projection of each plausible original 3D caster. The conservative solar/discretization/AA support does not prove pixel-exact reconstruction of outdoor sunlight. A transparent gap in canopy can reveal valid changed terrain without making the tree a shadow receiver. The distant comparison has no new moving draw; a retained target object is not evidence of immediate GPU-memory reclamation.
* **Cost:** recorded stage-specific fragment sampler/slot counts and original main-scene draw count exclude the one additional local depth draw. Inspect both separately. The functional release page records separate driver, state-restoration, fallback and playable-flight checks. Exact inputs and cameras are in [the registered protocol](independent-moving-shadow-gates.json). Results are [moving source](../../../docs/qa/regional-wind-rotor-light/moving-source.json) and [independent frames](../../../docs/qa/regional-wind-rotor-light/independent-views.json).
