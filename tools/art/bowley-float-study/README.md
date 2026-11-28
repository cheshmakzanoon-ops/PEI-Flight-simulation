# Bowley-inspired timber float section

This is **one original detached art concept**, not a reproduction of the
complete boardwalk and is not part of the game. Its deck datum is local Y=0;
+Z runs along the section. There are no site coordinates, waterline,
ground, bank, walkway connection, hinges, mapped or measured module
length, measured assembly counts, or gameplay/flight surfaces.

The nominal **1.830 m transverse clear section and 1.070 m rail height**
are dated design facts, from detail 3/L1 on sheet L2 of the 2015
[CanadaBuys tender ED001-161171/A](https://canadabuys.canada.ca/en/tender-opportunities/tender-notice/pw-pwc-008-3695)
for Bowley Pond, project R.077644.001. They are not a universal width, a
post-Fiona survey or as-built evidence. The photograph at
[Parks Canada's Greenwich overview](https://parks.canada.ca/pn-np/pe/pei-ipe/visit/greenwich)
was viewed only for its broad neutral weathered walk surface, light wood
uprights/top rail and thin infill. Its exposure, date, exact section
configuration, pixels and textures are not used here. The tender sheets
are protected attachments used as dimensional reference only. Nothing
was traced or bundled.

Authored separately: 6.60 m local section length, external extent,
staggered transverse planks and gaps, board/rail/post profiles, spacing and
counts, capped cables passing through the posts, framing and two shallow
abstract underframe cassettes. No real submerged shape, actual cable
fittings, lamp, hinge, utility or precise planter is represented. Each
wood solid has a physically modelled bevel and distinct anisotropic grain
direction, mellow reflected sky fill and local joint depth. Small deck
post/rail shadows in the final version are explicit local illustration:
the 16 ray-cast boxes are inset inside the **authored** solid members;
they never touch a terrain/pond/stock caster or receiver. No measured
weather, illumination or material age claim.

## Modular TS and deterministic preview

`bowley-float-concept.ts` imports only Three.js. In a separate study
scene, with a renderer and a neutral camera:

```ts
import {makeBowleyFloatConcept} from './bowley-float-concept.ts';
const sample = makeBowleyFloatConcept();
scene.add(sample.mesh);  // detached studio only
// When the study closes:
scene.remove(sample.mesh);
sample.dispose();
```

One opaque indexed mesh, one material, no groups, no network requests,
one generated 256×64 RGBA8 linear grain map with hardware mipmaps.
3,216 triangles / 6,912 attribute vertices / 268,128 B of input geometry
including U16 indices / 87,388 B texture including full mips. This counts
explicit submitted asset bytes and an isolated draw, not a full boardwalk
cost, shader timing, whole-world draw capacity or frame-rate promise.
The close studio shader evaluates one texture sample and, only on lit
upper tread, up to 16 author-geometry cast intervals. Repeated use at
ordinary flight scale would require its own properly authenticated
placement, batch/LOD and cost study; no player integration is supplied.

From this folder within the repository, with Node 24 and Three r187 installed at the root:

```sh
../../../node_modules/.bin/tsc --project tsconfig.json
node --experimental-transform-types --test concept.test.mjs
node --experimental-transform-types render-packet.mjs |
  PYTHONDONTWRITEBYTECODE=1 python3 studio.py ./unused-output-dir
```

`studio.py` uses Mesa EGL/GLES, Python NumPy and Pillow. It refuses to
overwrite an existing output. It uses the **original authored TS
geometry, texture bytes and Three r187-expanded shader** and records
the actual 4× raster, not a mock renderer or running flight. Both full
studio views use the prelocked framing and one true oblique reverse.
`plates/scale-only-1x.png` is a 35×25-pixel silhouette in a padded
crop at unreduced 1×. At that single-module size the plank and metal
details intentionally don't read as geometry inventory; the whole real
flight view is not tested by this image.

V1 geometry/texture/pose are identical to V2. The V2 no-cast output
matches all three V1 raw RGBA words by SHA, repeat captures with reversed
pose order match exactly, and the cast-on/off delta stays in the isolated
asset's coverage with alpha exact. Those counts are not an actual
game-world mask. The tests validate finite packed words, consistent
facing, individually closed chamfered shells, actual interior join
witnesses, off-world ownership, byte budgets and local disposal.

[Walkway and open rail](plates/walkway-and-open-rail.webp) · [Reverse view](plates/reciprocal-framing.webp) · [Unscaled distance crop](plates/scale-only-1x.png)

## World placement: HOLD

The companion independent scout found **zero** mapped centreline length
on the shipped 2020 Bowley wet support, including the entire 307 m
within the decoded texture. The cross-section facts and long perspective
outline do not support moving the present game surface, remapping the
2015 float to the current FID, or adding even a fragmentary deck. The
scout needs explicit dated edge/approach geometry under granted reuse,
actual whole-corridor wet/bank support and same-datum deck/freeboard
authority before any mounted prototype.
