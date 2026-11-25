# Independent Seacow Head exterior checks

The playable visual change is a documented, **authored** replacement for one generic 22-triangle tower, not a lidar reconstruction, surveyed visitor experience, or navigation instrument. This reproduces the independent geometry, the original placeholder, guarded live rendering, and three frozen cameras. Do not copy photographs into the project. For what the photographs support and contradict, see [the appearance assessment](../../../../docs/qa/seacow-exterior/independent-appearance.json).

Use a clean checkout with dependencies installed, Node with TypeScript stripping, Python with NumPy, Pillow and Playwright, and a compatible WebGL2 Chromium build. The target camera is fixed at **900×600**. Run one browser at a time. Each probe stages a transient copy and never edits production code.

From repository root (replace the checkout and Chromium paths as necessary):

```bash
QA=tools/qa/seacow-exterior/independent
OUT=$(mktemp -d)
# Use the previous commit checkout for a separate old normal baseline if available.
OLD=/path/to/unchanged-checkout
CHROMIUM=/path/to/chrome-headless-shell
python "$QA/vbo-cameras.py" --checkout "$OLD" --out "$OUT/old" --chromium "$CHROMIUM"
node --experimental-strip-types "$QA/old-owner.mjs" "$OLD" "$OUT/old-owner.json"
```

Run the companion `../emit-exterior.mjs` to create the actual four original authored Float32 buffers and its `emitted-exterior.json`. Then check physical supports. The 136 pre-specified samples include shared corners; extras include each emitted subedge and all intervening original terrain triangle crossings, so an air gap between samples cannot be hidden by those corners alone.

```bash
python "$QA/read-emitted.py" "$OUT/emitted/emitted-exterior.json" "$OUT/foot.json"
python "$QA/contact.py" --site "$OUT/old" --foot "$OUT/foot.json" \
  --output "$OUT/contact.json" --xyz-request "$OUT/contact-sites.json"
python "$QA/candidate-cameras.py" --checkout "$PWD" --out "$OUT/near" --chromium "$CHROMIUM" \
  --pose-baseline "$OUT/old/results.json" --old-owner "$OUT/old-owner.json" \
  --foot "$OUT/contact-sites.json" --flag seacowExteriorStudy
python "$QA/high-cameras.py" --checkout "$PWD" --out "$OUT/high" --chromium "$CHROMIUM" \
  --pose-baseline "$OUT/old/results.json" --flag seacowExteriorStudy
python "$QA/optical-mask.py" --stock "$OUT/old" --trial "$OUT/near" \
  --old-mesh "$OUT/near/oldXYZ-geometry.json" --new-mesh "$OUT/near/newXYZ-geometry.json" \
  --same-tick --views northwest-visitor southwest-offshore --out "$OUT/scope.json"
```

The normal trial captures and restores the actual compound owner override; it does not fake a “stock” grey material. It reads the original GPU terrain buffers, 3D world matrices, all six unchanged original building attributes and every drawn index, plus flight-ground and visual-ground queries. The same-tick paired source/simulation images must restore byte-for-byte. Normal multi-run screenshots and same-tick comparison are different protocols: the original offshore preflight still streamed an imagery tile; its tiny exterior differences are recorded in [the complete views report](../../../../docs/qa/seacow-exterior/independent-views.json), not silently suppressed. Never force the normal active condition in the 535 m stock-only negative.

The source survey is an optional **separate eligibility failure**, not a required asset download. With `laspy==2.6.1`, lazrs and NumPy, the following only reads authenticated public byte ranges and non-elevation dimensions; it never exports point records. If the published data identity/schema changes, it refuses the substitute. Original point-source ID, scanner channel, time and classification all corroborate **one** observed scan, not the two independent lines planned. Do not replace the missing independent evidence by looking at heights.

```bash
python "$QA/source-horizontal.py" --cache "$OUT/source-cache" --out "$OUT/source-check.json"
```
