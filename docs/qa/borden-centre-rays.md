# Borden shoreline: centre-ray regression

This is an offline rendering regression for one known gap near Borden-Carleton. It does not change the playable shoreline, terrain, collision, charts, or camera.

The stock 112-segment terrain patch and an experimental 58-triangle closure are tested against the signed cover cell `[1231,1992]`. The fixture records the original two review cameras at 980 × 630, the eight relevant stock triangles, and the 27 specific pixels where the native 4× multisample replay needed a one-pixel fallback: seven from the southwest and twenty from the harbour. The closure triangle buffer is checked byte for byte against its pinned SHA-256.

For each pixel, the test requires three strictly ordered intersections: nearer wet ground, the closure, and then the sea plane on the dry side of the signed boundary. Rounded-out intervals must rule out a tie and show all three positions lie strictly inside the single cell. A projected bound may skip a triangle only when it wholly excludes that pixel. Synthetic cases check a positive ray, overlapping nearest depths, and off-region rays.

Run just this regression with:

```sh
node --experimental-strip-types --test test/borden-centre-ray-proof.test.ts
```

The test certifies the geometry of these centre rays, not the final colour of an arbitrary GPU draw. Enabling the repair in flight still depends on native depth, multisample coverage, and foreground draw-order checks.
