# Clarke’s General Store | Right-display bench

**Detached, dated Three.js art study. Not a flight scenery update.** The original [Orwell storefront](README.md) remains unchanged. `orwell-display-bench.ts` adds a movable dark bench under the large display to the right of the entry, not another building or permanent part of the shop.

[Matched low view from the entry side](bench-optics/lowEntry-matched.webp) · [Matched low view from the other side](bench-optics/lowAisle-matched.webp)

## Which bench

- The [Province of Prince Edward Island register photograph](https://www.historicplaces.ca/en/rep-reg/image-image.aspx?id=1623) ([image 11919](https://www.historicplaces.ca/hpimages/Thumbnails/11919_Large.jpg), reviewed JPEG SHA-256 `a0ba73793551bac4bb37fd8b8c7fbe1b22f162bfa578344ccbc30546a3e7ba03`) shows a dark reddish bench below the right display. The photograph is undated. It corroborates the position, not the identity or material of the item.
- Larry Muffin At Home’s [Orwell Corner Village](https://larrymuffinathome.wordpress.com/2018/08/01/orwell-corner-village/) post, published August 1, 2018, independently shows the bench in [IMG_3905](https://larrymuffinathome.wordpress.com/wp-content/uploads/2018/08/img_3905.jpg?w=800) (reviewed SHA-256 `09f7783be57f999d0b8f5a64341313991668a9dc6a3c41b7543217fc1bd23fe2`). This view supports shaped dark ends and an open back with two dark boards. The pale bands are consistent with the wall visible through the gaps, not evidence of pale slats.

These are publicly viewable qualitative references, not reused images or a claim of a reusable image licence. No photos or samples of source pixels are in the art. The support/seat construction, profile, colour and scale are original interpretations of the pictured forms. The publication date is not an as-built date or evidence the same bench is there now.

## What changed

The original 10 meshes, 5,540 triangles, buffers and generated materials are unchanged. The added two opaque meshes contain 404 triangles and no textures. The cheeks and boards have individually closed surfaces. End-on rays verify that all five boards seat in both cheeks and that the bands in the back are actual gaps. The right-hand entrance, rail and treads have no geometry changes. All four feet touch only the study’s neutral floor; the small contact marks in these images are bounded, analytically generated **studio lighting**, not an exported stage or terrain feature.

The two 840 × 580 matched Mesa/EGL views link the actual Three.js r187 material programs with the exact built-in DFG integration texture (16 × 16 RG16F) and the original generated maps, in a new neutral workshop environment. This comparison is not the original browser viewer.

| Camera | Changed by more than 3 RGB codes | Visible stock-entry/glazing role pixels | Outside scope, alpha, or protected pixel changes |
| --- | ---: | ---: | ---: |
| Near entry, 1.43 m studio eye | 8,282 | 148,309 | 0 |
| Opposite oblique, 1.04 m studio eye | 7,985 | 114,548 | 0 |

All repeated original/added images and the immediate stock restoration were byte-exact. Four closure/attachment tests and the original 42-pane verification passed. An earlier wider-angle variant showed actual projected overlap with the guarded old entry/window roles (129 and 432 pixel positions); those views are held, not marked exact. The final bench moved 0.130 m within the same display bay, and the two final views were independently screened against full projected peer support before the final paired renders. This is not a claim that oblique views never occlude neighbours.

## No placement

Runtime owner `q1030/130`, its signed tile and [independent owner registration](evidence/independent-stock-owner.json) remain unchanged. The [XY-only survey gate](evidence/independent-native-xy-hold.json) passed only 5/15 roles and did not open any elevation values. This model neither repairs nor guesses the shop/dwelling roof, facade seating or ground. It does not modify other village assets, roads, protected neighbours or the simulator.

## Repeat

From this directory with the repository dependencies installed:

```sh
node --experimental-strip-types verify.mjs
node --experimental-strip-types --test qa/bench.test.mjs
out="$(mktemp -d)"
node --experimental-strip-types qa/export-bench.mjs "$out/fixture"
EGL_PLATFORM=surfaceless LIBGL_ALWAYS_SOFTWARE=1 PYTHONDONTWRITEBYTECODE=1 \
  python3 qa/render-bench.py --fixture "$out/fixture" --out "$out/views"
```

The offscreen runner needs Mesa EGL, NumPy and Pillow. It does not use Chromium or reference photos. [Paired-render receipt](bench-optics/receipt.json).
