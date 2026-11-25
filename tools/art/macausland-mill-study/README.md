# MacAusland Woollen Mill frontage study

An original Three.js/TypeScript model of the visible north frontage and a short east return at the working MacAusland Woollen Mills in Bloomfield Corner. This is a detached studio study in normalized authoring units. It is not an in-flight asset, survey, construction record, or representation of the complete mill.

- `mill-front.ts` builds real clipped steel ribbing, two independent roof layers, 96 photo-counted front glass plates, simplified east-return sashes, folded eaves, a recessed split slider, and paired service raceways. The cropped remainder of the raised east return is not reconstructed.
- `fabrication.ts` builds beveled, material-batched triangles, correct wall normals, and named scene meshes.
- `finish.ts` generates original albedo, roughness and normals in memory. The studio generates its own continuous reflection and diffuse light. No source photography is sampled, projected, copied, embedded, or shipped.
- `evidence/` contains the dated source, exact packaged owner and independent closure/rejection receipts. No source photographs, point data, terrain heights, or image-derived textures.
- [Engineering and art notes](../../../docs/qa/macausland-mill-study.md) explain the limits, camera program and stock hold.

From the repository root, use the locked dependencies and visit the detached URL:

```sh
npm ci
npm run dev
# tools/art/macausland-mill-study/ on the printed dev server URL
node --experimental-strip-types tools/art/macausland-mill-study/verify.mjs
```

For deterministic fixed frames with Python Playwright and a local Chromium executable:

```sh
python tools/art/macausland-mill-study/render-views.py \
  --out /tmp/pei-macausland-studio --chromium /path/to/chromium
```

The author’s stock-isolation route requires a clean **c541e42** snapshot, its packaged assets, usual dependencies and local Chromium. It patches only a temporary QA copy, neither the checkout nor the running game:

```sh
python tools/art/macausland-mill-study/evidence/capture-stock-owner.py \
  --checkout /path/to/c541e42 --out /tmp/pei-macausland-owner \
  --deps /path/to/repo/node_modules --chromium /path/to/chromium
```
