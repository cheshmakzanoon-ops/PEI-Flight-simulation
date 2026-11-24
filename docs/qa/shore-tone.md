# Near-shore tint continuity: renderer compatibility study

Add `?shoreToneStudy` in **Standard** scenery to try an alternate colour filter for ordinary dry shoreline terrain. The effect depends on the renderer. It is not a new coastline, new beach or terrain model, image upscaler, or change to flight, lighting time, roads, water, or collisions. The default and Detail profiles keep the existing material.

[Matched native Mesa comparison](shore-tone-mesa-comparison.webp) · [Exact camera and renderer receipts](shore-tone-fixture-receipt.json)

## Why some renders showed a grid

One native OpenGL ES renderer returned exact integer normalized byte levels when linearly interpolating the existing 8-bit Cover texture. The original inferred beach-to-cliff tint converted these levels into broad steps. In the 15 m locked Kings view, 63,978 rendered tint probes had only 12 old signed levels (4 to 26 m in 2 m steps); manual interpolation between the same four stored texels yielded 2,894 levels at the diagnostic precision. Removing the grain, using local-coordinate face normals, or looking at only the original atlas colour did not account for the grid. No imagery or new survey data was introduced.

Current Chromium/ANGLE SwiftShader through the full application already preserves usable fractional values: the pre-bypass B comparisons at the three near locks changed at most one RGB code on only a handful of pixels. Do **not** expect a new visual effect on that backend. This is an opt-in compatibility fix for a demonstrated low-precision sampling case, not a colour improvement claimed for all WebGL2 devices.

## Limits and controls

- The regular Cover sample stays authoritative for all land/water discard, shoreline curtains and CPU contact. Only the two existing inferred beach/cliff colour weights can use the continuous interpolation. Fine survey materials, authored shore and harbour insets, optional seabank/soil layers and the water shader are left alone.
- A valid ordinary dry sample enters the four-fetch path only when its old tint-distance sample is in the 1–28 m band, the byte sample was not already fractional to within 1/1024 DN, and the pixel is closer than 480 m. Amount is full by 300 m or closer. A physical symmetric tile collar is exactly stock within 1 m, smooth to the normal effect by 24 m. No new asset requests, textures, geometry, draw calls or triangles.
- Exact Three geometry and shader programs were replayed in a 4× native Mesa OpenGL ES target. All seven 560×392 scene-role masks and same-material gain-zero images were byte-exact against the original, as were protected water and sky interiors. The three near county views changed 24,499 Kings / 3,731 Prince / 260 Queens pixels by more than two RGB codes. 620 m Prince and the authored East Point control were full-frame identical. The real mixed ordinary/authored owner border retained all 546 pure eligible pixels within 0.90 m exactly, with a visible effect outside the collar.
- On this software renderer, 30 timed alternating warmed draws of one 25,088-triangle mesh measured +0.139 ms median paired change at the worst close lock and +0.042 ms at the far lock where the sampler branch is skipped. These are isolated native draw timing observations, not hardware or end-to-end game FPS.

`npm test` covers optional admission, preservation of the original shader semantics outside the two tint terms, and the fractional, distance and collar early-out ordering.


In matched full-game Chromium/ANGLE SwiftShader tests, the finalized fractional bypass left all 219,520 Prince near pixels, 155,480 Kings near pixels, and 155,480 distant control pixels identical. On the compiled Cavendish low route, stock and opt-in flights both travelled more than 500 m and entered Cockpit and Pause. Both requested the same 33 ordinary world asset URLs and reported no layer warnings. All 325 tests, the production build and world validation passed.
