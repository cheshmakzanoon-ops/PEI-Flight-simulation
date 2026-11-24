# Shore-breaker detailing

Standard water uses shorter, lower-contrast breaker crests and weaker
wash instead of a broad white ribbon. The close pattern breaks up along
the coast and fades before the details become too small. Use
`?stockShoreFoam` for the older generic ribbon effect.

Legacy shoreline, adaptive terrain, orthophoto, building-shadow and
selected estuary studies keep their established water baseline unless `?shoreFoamDetail` is intentionally selected. Detail
retains its existing preset. `?stockShoreFoam` overrides those general
foam choices, not independent local nearshore previews.

The effect is original procedural art, not a wave, bathymetry, wind or
tide model. It reads the same shoreline-distance input and leaves the
water surface, draw geometry, masks and physical contact untouched.
Existing sheltered-water adjustments still apply. Shore glint, terrain
cliffs, local vegetation, buildings, and the underlying atlas are separate
systems and are not changed here.

![Three matched shoreline views with the original and updated breaker treatment](shore-foam-comparison.webp)

The [original matched scene record](shore-foam-render-gate.json) keeps the camera,
loaded imagery tile IDs, draw count and submitted triangles fixed in each
pair across all three counties. A separate [same-scene mask and
phase gate](shore-foam-mask-gate.json) checks the actual visible water
silhouette at two wave phases. Outside that silhouette and its one-pixel
antialiasing allowance, every RGB value matches stock at both phases.
These are optical checks in Chromium SwiftShader, not GPU performance claims.

The [controlled time samples](shore-foam-motion-gate.json) compare eight
successive shader phases at the same Queens camera. Across the visible water
mask, p99 successive RGB change was 5 levels in stock and 3 in the broken-crest version,
with an eight-level maximum in both. This measures controlled samples,
not hardware frame pacing or moving-camera aliasing. The
[compiled flight check](shore-foam-flight-gate.json) also flew and paused
both new waterfront routes with this option active.

## Replay

```sh
npm run check
python tools/qa/broken-foam-lab.py --chromium /path/to/chromium --out /tmp/pei-foam
python tools/qa/shore-foam-standard-frames.py --chromium /path/to/chromium --out /tmp/pei-foam-mask
python tools/qa/shore-foam-standard-flight.py --dist dist --chromium /path/to/chromium --out /tmp/pei-foam-flight
python tools/qa/foam-motion-check.py --chromium /path/to/chromium --out /tmp/pei-foam-motion
python tools/qa/waterfront-departures.py --dist dist --chromium /path/to/chromium \
  --foam-detail --out /tmp/pei-foam-flight.json
```

The first capture compares the two compiled shaders in the actual scene.
The second uses two temporary water-only colors to resolve partial
multisample coverage, and holds the wave phase at two fixed times. The
production game includes neither diagnostic shader nor camera override.


[Standard validation](shore-foam-standard-gate.json) uses matched low
views in all three counties at two fixed wave phases. All 887,824 non-water pixels matched exactly, including the
edge samples identified with the two complementary masks. Compiled ordinary, stock, Detail, legacy and authored Basin
Head departures retained their intended selections.
