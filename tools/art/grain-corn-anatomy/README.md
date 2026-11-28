# Original late-season grain maize anatomy

A detached, **performance-oriented** Three.js study, not a photographic
hero model or in-game scenery. Standalone editable stems, overlapping
sheaths, eleven alternating full-width blades with real rise, curve and
tip drop, curved off-axis foliage, differing warm/living pigments,
a closed husk and fine branched tassel tips. One unmounted draw each
for a single specimen (1,936 triangles) or the triple (5,808).
No borrowed imagery, textures, variety, management or field dimensions.

Qualitative morphology references: [University of Minnesota Extension,
Corn growth and development](https://extension.umn.edu/agriculture/crop-production/corn/growth-and-development)
describes the collar, wraparound sheath and arched blade; [NSW DPI’s
maize development guide](https://www.dpi.nsw.gov.au/__data/assets/pdf_file/0007/516184/Procrop-maize-growth-and-development.pdf)
distinguishes alternating leaves, a midrib, sheath, tassel and ear.
[University of Delaware Cooperative Extension](https://www.udel.edu/academics/colleges/canr/cooperative-extension/corn-growth-stages-and-management/)
corroborates dry lower foliage and reproductive anatomy; those guides
don't document a particular PEI plant or season.

2025 AAFC class 147 labels grain corn in the
[Annual Crop Inventory](https://agriculture.canada.ca/imagery-images/rest/services/annual_crop_inventory/2025/ImageServer/info/iteminfo).
That is a different question from current plants, silage distinction for
a particular appearance, stage, brightness, silhouette, height, soil,
row orientation or plot boundaries. Those properties are not taken from a
map or claimed. All art here is authored; no map coordinates included.
No runtime mount, physics, stock terrain, imagery, any previous stock
selection, or textures changed. The separate far experiments were held
and are neither included nor exposed by this package.

In a separate studio scene:

```ts
import {makeCornStudy} from './corn-study.ts';
const stand = makeCornStudy('near'); // 'near-single' for one stem
scene.add(stand.mesh);
// On teardown:
scene.remove(stand.mesh);
stand.dispose();
```

TypeScript and the portable structural tests use the repository's Three
r187. From this directory:

```sh
../../../node_modules/.bin/tsc --project tsconfig.json
node --experimental-transform-types --test art.test.mjs
node --experimental-transform-types render-packet.mjs |
  PYTHONDONTWRITEBYTECODE=1 python3 studio.py ./unused-output-dir
```

Studio rendering uses Python NumPy, Pillow and Mesa EGL/GLES; it refuses
to overwrite. `plates/` shows the real emitted art using Three r187's
expanded shader and a simple private matte display floor. Both unscaled
1200×760 local camera renders have actual 4× raster coverage and
exact immediate repeat. Neither is a live sim frame or field claim.

Use the raw RGBA digest to compare two renderer runs. A different lossless
WebP encoder can produce different bytes while decoding to the same image.
