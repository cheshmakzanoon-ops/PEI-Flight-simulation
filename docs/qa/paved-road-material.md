# Photographic aggregate on mapped paved roads

The existing mapped **paved** ribbons now pick up a physically scaled surface
at close view: sharp aggregate, subtle directional normals and dry roughness.
The large, blurred variation on the old near road material fades out as the
new texture becomes visible. Roads remain the original road-network strips.
No lanes, curb positions, potholes or road markings were surveyed or added.
Dirt, gravel, bridge and runway materials are out of scope.

The two calibrated stock textures are
[Asphalt Track](https://polyhaven.com/a/asphalt_track) by Dimitrios Savva
and [Asphalt 07](https://polyhaven.com/a/asphalt_07) by Charlotte Baglioni,
both CC0. These scans were not captured on Prince Edward Island. We retain the
existing road palette and introduce the images' local luminance, aggregate
normal and roughness at their stated 2.0 m and 2.5 m tile scales. A slow
world-coordinate blend rotates one pattern to avoid a visible repeating
grid. The bitmap's row direction is reconciled with the source OpenGL normal
convention. Signed normal bytes never affect material opacity. The final
texture files include their original [asset and fingerprint receipt](../../public/art/pavement/sources.json).

Two verified 512 × 512 lossless maps total 1,197,156 bytes. The browser
does not request them on a fresh approach at 155 m AGL or higher. Below
that height both download independently; partial, missing or invalid data
leave the prior shader appearance in place. Both maps are required to fade
into the new grade, taking about 650 ms after decoding. Anisotropic filtering
and footprint-aware derivatives turn the aggregate off before it can shimmer
at distance. Browser timings depend on the device and connection.

## Matched captures

[Before and after](paved-road-comparison.webp) | [Machine-readable checks](paved-road-gate.json)

The same Three.js scene, framing and geometry were used on each side. At
the Summerside 2.9 m inspection eye, 60,544 pixels changed by more than two
RGB codes; the 18 m approach had 42,878. Every change was contained in the
existing paved projection plus a one-pixel antialias fringe. Submitted draws
and triangles were identical in both comparisons. The fresh 215 m East Point
control remained exact over all 495,000 pixels and requested neither map.
With both maps fully loaded, the inland dirt control remained exact over all 495,000 pixels. A missing-map test at the curb also returned all 495,000 legacy pixels.
This is a near-road artwork check, not a device frame-rate benchmark or a
claim about the accuracy of individual marks on Water Street.

Reproduce the 1K source channels using the URLs and SHA-256 in the receipt.
Save the originals as `<id>-<kind>.jpg` in one download folder. Repack
and regenerate the hash allowlist as follows:

```sh
python tools/terrain/pack-asphalt-material.py /path/to/downloads \
  public/art/pavement/sources.json public/art/pavement \
  --ts src/render/pavement.generated.ts
npm run check
python tools/qa/paved-road-frames.py --checkout . --deps node_modules \
  --out /tmp/pei-pavement --chromium /path/to/chromium
```

The fixed inspection viewpoints hide the aircraft/UI; they do not imply
that real flight is allowed at those altitudes over streets.
