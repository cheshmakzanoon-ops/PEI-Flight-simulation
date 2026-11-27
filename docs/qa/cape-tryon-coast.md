# Cape Tryon cliff pass

In Standard, select **Cape Tryon · cliff pass** to approach the headland from the Gulf. The starting height is about 82 m above the sea surface. It is a simulator sightseeing route, not advice for real flight.

Five selected cells west and east of the headland exposed the sky through the existing cliff curtains. The game now adds a near curtain that follows the original bilinear mask between the same endpoints. The old curtain, land/water classification, wave colours, terrain and collision remain unchanged. This is not a surveyed coastline update. The lighthouse is still the original coarse building; the local cliff heights and footprint position are not good enough for a trustworthy replacement.

Compare with `?departure=cape-tryon-coast&stockOpenCoast`. That flag restores the older coverage and does not remove the separate Orby Head repair. The [sandstone finish in Standard](cape-tryon-stone.md) is a separate local material and does not change any shoreline geometry. Its own comparison is `stockCapeTryonRock`. The [optional water-gap repair](cape-tryon-water-tie.md) addresses a separate rounded-zero water mask problem and does not alter land or flight contact.

![Matched views of previous and updated Cape Tryon cliff coverage](cape-tryon-coast.webp)

## What was checked

In three matched low views, **9,131** fully exposed sky pixels were covered. Some gaps remain, especially at grazing angles. No new sky pixels or greater-than-one-code sky exposure appeared in these views. Nearby controls at Orby Head and Panmure did not change. The [replay receipt](cape-tryon-coast-gate.json) also tracks the stock geometry, exactly unchanged ground enquiries and compiled browser flights. The added local coverage costs one draw and 554 triangles in the tested views; these figures do not imply a reduction in frame time.

[Parks Canada’s Cape Tryon Lighthouse record](https://www.pc.gc.ca/apps/dfhd/page_hl_eng.aspx?id=14932) describes the real tower atop red sandstone. The separate [federal elevation source](https://natural-resources.canada.ca/science-data/data-analysis/geospatial-data-tools-services/elevation-data) confirms the area's steep cliff layout, but comparison against the current simulation showed disagreement in height and local shoreline. No replacement raster, photo, wet mask or model is introduced by this repair.


## Remaining exposure

The matched 4× replay retains **279 north, 326 east and 405 grazing** full sky-colour pixels in the same review bands. The largest isolated components are 185, 218 and 405 pixels. The markers identify actual sky rather than white surf or a pale cliff. They do not identify a physical surface or justify filling every remaining component. The current geometry is also not a background-only pass: it changes some already-occupied colour pixels inside the review band. Any later background-only repair needs an independent check that those original samples stay intact.

The capture now records the exact matrices and residual component bounds. Add `--owners` to hash the local CPU geometry arrays attached to the actual draw list for ray investigation; that report does not read back resident GPU buffers.

To repeat the browser checks after building the repo:

```sh
python tools/qa/tryon-same-frame.py --checkout . --deps node_modules --poses docs/qa/cape-tryon-coast-poses.json \
  --out /tmp/tryon-frames --chromium /path/to/chromium
python tools/qa/tryon-flight.py --dist dist --out /tmp/tryon-flight --chromium /path/to/chromium
```
