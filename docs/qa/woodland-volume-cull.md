# Fewer tree triangles, the same woodland

The closest trees in the optional [Woodland scenery view](woodland-scenery-view.md) keep their original trunks, branches and leaf clusters. The renderer now skips a tree’s 3D branch mesh when it can prove the entire mesh lies outside the camera or its original distance blend is already zero. It does not thin the forest, shorten the range, invent tree locations or change any artwork. Ordinary Standard scenery does not gain this option automatically.

Choose a woodland departure in any of the three counties and enable **Woodland scenery view**. To compare the submission counts, keep that same option and append `&stockWoodlandVolumeCull` to its URL. The stock switch alone does not turn on woodland. A matching screenshot should look **identical**; the difference is how much geometry the renderer submits.

## Measured in the renderer

The two columns below count actual branched-tree triangles in the same view, not triangles in the entire frame. The old circle is the same selection of original trees in both cases.

| Fixed county view | Old circle | View-specific submission | Original trees admitted |
| --- | ---: | ---: | ---: |
| Prince | 123,154 | 42,902 | 69 |
| Queens | 127,720 | 32,280 | 72 |
| Kings | 131,202 | 37,420 | 74 |

The three original rosters totaled **382,076** branched-tree triangles; the matching draws submitted **112,602** (70.5% fewer). Every compared full-frame RGBA value, including the separately rendered tree-only output, was identical in all three forward comparisons. The preregistered test also covered 15 county/heading combinations and 48 distinct Queens motion configurations on the original optimized revision; the final defensive revision was tested separately in four normal, overridden and restored Queens views. A nominal 152 m high control submitted no branch meshes on either path. These are fixed cases, not an assertion about every camera on every device. [Independent renderer readback](woodland-volume-cull/independent-views.json). [Compiled player checks](woodland-volume-cull/player.json). These measurements establish fewer submitted triangles, not an increase in frame rate on any particular GPU.

The final renderer also matched all six low-angle views with both bark and raised conifer crowns active. Those pairs preserved 23 lifted crowns in Prince, 28 in Queens and 5 in Kings, with exactly the original shadow geometry. The forward views also checked the instance values read from the GPU. [Bark and crown readback](woodland-volume-cull/crown-bark.json).

## What stays in the full circle

The renderer still selects every original tree eligible for the 57.6 m roster, blended from fully detailed at 38 m to the original canopy at 50 m. The full selection still owns the billboard transition, grounded shadows and qualifying crown lift. Shadows can remain in view when the tree that casts them is behind the camera. Ground, flying and collision do not change.

For the 3D draw only, a second instance stream keeps the original order and exact per-tree attributes. It uses the final ordinary perspective camera before the GPU uploads that draw. Clipping conservatively bounds all four template meshes, the full permitted vertical crown adjustment and an additional 0.75 m on every side. An unsupported projection, an offscreen target, XR, or a replacement scene material or donor shader falls back to the historical full circle. The old altitude blend and real multisampling requirement still apply. No texture, geometry template or external data download was added. [Source and bounds contract](woodland-volume-cull/source-contract.json).

To reproduce, run `npm run check` and use the [native three-county camera replay](../../tools/qa/woodland-volume-cull/README.md). The [original woodland comparison](branched-woodland-preview.md) shows the visual difference between flat and near-branched trees. That is a separate comparison from this same-pixel submission change.

To compare the real departures in the compiled game, install the harness dependencies in the [QA instructions](../../tools/qa/woodland-volume-cull/README.md), set `BROWSER` to the Chrome headless executable and run:

```sh
npm run build
python tools/qa/woodland-volume-cull/player.py --dist dist --chromium "$BROWSER" --out /tmp/pei-woodland-players --counties prince queens kings --modes culled
python tools/qa/woodland-volume-cull/player.py --dist dist --chromium "$BROWSER" --out /tmp/pei-woodland-controls --counties prince --modes stock standard no-msaa
```
