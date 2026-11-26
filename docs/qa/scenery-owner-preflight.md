# Scenery owner intake

Before replacing a landmark, verify what the game already sends to the GPU.
A map outline's height field is not necessarily the current rendered roof.
The convention centre's packed row, for example, is already emitted as
seven measured roof levels.

```sh
node --experimental-transform-types tools/qa/scenery-owner-preflight.mjs \
  q120010 313 standard /tmp/founders-stock-owner.json

node --experimental-transform-types --test tools/qa/scenery-owner-preflight.test.mjs
```

The tool verifies the complete packed atlas and its selected chunk, decodes
the signed terrain and existing coastal survey meshes, and runs the native
building generator twice. Turning span recording on must keep all
native attributes byte-identical. It then emits a separate temporary
geometry with just that source row cleared. Every retained attribute
must match the two outside spans from the original geometry. The report
records the original index width that a scoped replacement would need.

The Standard fixture uses the authenticated downtown roof cohort when
applicable and enables the same core town-wall profile as a normal flight.
When the renderer emits its signed 16-bit wall attributes, they are checked
along with the six base attributes. The legacy fixture skips both options.
The regression test
deliberately covers a 32-bit Summerside owner and a 16-bit Charlottetown
owner so the larger shared region cannot be mistaken for the earlier
streamed-tile size.

This is **read-only CPU evidence**, not permission to remove a stock
building. Other optional renderer profiles, actual world loading and shadow
ownership, present-day facades, visible ground, and GPU depth still need
separate checks.

### Fixed-camera compositing check

Use native canvas PNGs from the same frozen route frame, not viewport
screenshots. Capture the stock frame, bounded replacement and restored
stock in that order without moving the camera or advancing the clock.
The box is half-open and must be clipped to the native canvas. The
browser test environment already installs `pngjs`.

```sh
node tools/qa/scenery-frame-invariant.mjs \
  stock.png candidate.png restored.png 132,555,343,718 report.json
```

A PNG from the same frame with both the exact stock span and the
replacement hidden can be passed as the final argument. This fourth
capture helps distinguish an actual candidate alpha defect from exposing
existing content at a lower roof silhouette. Matching an uncovered
pixel requires all four channels. This witness explains a difference;
it does **not** override the strict alpha, scope or rollback gate.
