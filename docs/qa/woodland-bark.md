# Photographic close woodland bark

Enable **Close bark grain** in Standard Dispatch, or add
`?woodlandBark`. The option uses the existing 3D branches and works
alongside [Near conifer crown shape](woodland-crown-base.md). It adds
reflectance and small-scale shadow variation to the existing trunk and
branch surfaces. It does not move or add trees, change leaf rendering,
modify terrain or collision, or change the tree shadow geometry.

Two generic scans supply patterned luminance and occlusion:
[Rob Tuytel's Bark Brown 01](https://polyhaven.com/a/bark_brown_01) for
furrowed broadleaf-style surfaces and
[Dimitrios Savva's Pine Bark](https://polyhaven.com/a/pine_bark) for
conifer-style surfaces, both released under CC0. These are generic
appearance references, **not photographs of the simulator's tree
positions or species observations from PEI**. Both references are
in the [input and hash receipt](../../public/art/bark/sources.json).

The single 256 × 256 packed-data texture contains two calibrated
luminance and two occlusion channels. Two vertical projections use
continuous instance-local coordinates, avoiding the old circular UV
cut. A deterministic phase per stem keeps the same bark patch from
repeating on adjacent copies. The material uses two explicitly
mip-filtered lookups in eligible wood, not in leaf fragments.
The photo contribution fades from 11 to 25 m from the camera.
The optional map begins loading below 55 m over the ground when a
normal near woodland roster is present. Until its contents verify,
the previous bark shader is retained. Standard mode does not
request this asset.

The asset is 259,534 compressed bytes (262,144 decoded). We tried
adding separate matching normal maps. In three actual matched views,
no normal-only pixel changed by more than two RGB code values, so
those maps and their extra transfer were left out. The natural grain
and short-range contrast are the retained benefit. No device FPS
claim is made.

## Rebuild

Download the four original 1K JPEGs in the receipt and name them
`<id>-Diffuse.jpg` and `<id>-AO.jpg`. Save the corresponding
Poly Haven API file manifests as `<id>.json`. The script verifies
the pinned input bytes. With Python, NumPy and Pillow:

```sh
python tools/art/pack-woodland-bark.py --input /path/to/reference-files \
  --out /tmp/pei-bark-repack
cmp /tmp/pei-bark-repack/wood-v1.rgba.gz public/art/bark/wood-v1.rgba.gz
cmp /tmp/pei-bark-repack/sources.json public/art/bark/sources.json
npm run check
```

## Matched renderer checks

[Matched Three.js views](woodland-bark-comparison.webp)
compare the old and new bark on the same resident crown models. The first
two rows view opposite sides of a Queens County trunk; the third is a
Kings County grazing view. The replaced pixels stay within the submitted
wood or its one-pixel antialias region. The submitted geometry and draw
counts are unchanged in each match. Turning the scan gain to zero and
restoring the old shader without the new branch produce identical pixels.

The [frame receipt](woodland-bark-frames.json) includes the source scope
and short warmed local rendering timing samples. Those numbers describe
the software test renderer, not performance on a player's computer.

The [motion and fallback gate](woodland-bark-motion.json) includes
18 camera positions in the same real scene. Each pair uses the same
camera, stock geometry and lighting; all differences stay in wood.
The damaged decoded texture returns the earlier bark pixel for pixel.
A high 152 m control keeps the same image and makes no bark request.
The [ordinary-controls departure gate](woodland-bark-flight.json) uses
the compiled West Point flight and pauses after the descent.

```sh
python tools/qa/woodland-bark-frames.py --checkout . --deps node_modules \
  --out /tmp/pei-bark-frames --crown --chromium /path/to/chromium
python tools/qa/woodland-bark-motion.py --checkout . --deps node_modules \
  --out /tmp/pei-bark-motion --crown --chromium /path/to/chromium
python tools/qa/woodland-bark-flight.py --dist dist \
  --out /tmp/pei-bark-flight --chromium /path/to/chromium
```
