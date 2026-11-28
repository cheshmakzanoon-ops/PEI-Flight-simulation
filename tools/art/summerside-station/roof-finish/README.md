# Former Summerside Railway Station · lapped roof finish

Two matched, unscaled **detached EGL** plates: [street quarter](plates/street-quarter-matched.png)
and [harbour quarter](plates/harbour-quarter-matched.png). The left is
the already shipped authored station, not the generic-box fallback.
The right changes only the pitched roof surface. The hip, cross gable,
dormers, broad bracketed eaves, doors and masonry stay exact. The new
surface follows the fold where the cross gable meets the long roof
instead of applying a single flat screen pattern to the entire shape.

Three sizes of authored detail work in local metres: restrained warm
charcoal tonal families elongated mildly toward the eave, a narrow cap
and darker drainage throat at 15 actual shared edges, and a staggered
15.5cm lapped course with subpixel coverage filtering, millimetre-scale
optical relief and roughness variation. The relief does not displace the
surface. The pitch-following coordinates use the actual packed face
normals. The 2017 exterior roof reads dark gray with uneven tone.
Material type, exact course size, surface condition today, valley and cap
fittings are **illustrative**, not surveyed. No pixels from the consulted photographs, map imagery or murals are incorporated. The treatment is not photogrammetry.

## Source and fit

- [Canadian Register of Historic Places, 192 Water Street](https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=10102&pid=0)
  documents the 1927 station, hip, expansive bracketed eaves, off-centre
  cross gables and small dormers. This is the same existing Standard
  station on **Summerside waterfront · low pass**, not an earlier rail
  layout or an interior.
- The prior survey account is in the base project's
  [station evidence](../../../../docs/qa/summerside-railway-station.md). Its licensed 2020 input is the
  [NRCan high-resolution elevation product](https://open.canada.ca/data/en/dataset/0fe65119-e96e-4a57-8bfe-9d9245fba06b)
  ([Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada)).
  The prior 559 held roof hits and .085/.072m p90 residuals are old
  same-epoch calibration, not new measurements.
- The [first original photo](https://commons.wikimedia.org/wiki/File:Gare_de_Summerside_01.jpg)
  and [two reciprocal source views](https://commons.wikimedia.org/wiki/File:Gare_de_Summerside_02.jpg)
  [of the exterior](https://commons.wikimedia.org/wiki/File:Gare_de_Summerside_03.jpg)
  are dated Aug 14, 2017 by Fralambert, each CC BY-SA 4.0. Visual
  observation only; no reference images are included.
- Exact input is the shipped summerside-station-C-v1.bin.gz companion
  (wire c27cc893…, raw 34ee6d8a…), atlas row q032001/163. Packed
  positions, normals, UV, indices, colours, texture, transform, other
  meshes, existing terrain/contact and caster remain unchanged.
  The 15 physical joins were independently checked against continuous
  adjacent EBO edges with distinct face normals, not traced from photos.


## Detached lighting correction

The first detached plates in commit `267e0a1` omitted Three r187's
existing `dfgLUT` sampler binding in the raw EGL harness. Those
programs rendered with an unrelated unit-0 texture at that uniform.
The plates and image receipts here are re-rendered with the exact
shipped 16×16 RG16F lookup on independent unit 5; its binary16
data SHA-256 is
`b41ba8e2bd29fa007dfbf034d4d58b853f378062183847846b1f6d228f2c7e79`.
Lookup texels use linear filtering, edge clamp, no mipmaps or colour
conversion. Original albedo stays on unit 0; the resolve target is
not sampled. No art, terrain, geometry, input camera, or software
tolerance changed. This corrects the detached light response, not
the installed game or a missed real-device benchmark.

## Actual rendering evidence

The r187 ShaderLib and WebGLProgram generate the original and patched
MeshStandard material GLSL with the game's sun/hemisphere colour
settings, ACES and log depth. EGL Mesa GLES3.2 links those programs and
draws the ten exact original station parts into 4× RGBA8/D24 with
explicit resolve. The neutral studio plane and sky are **not PEI
terrain or a product frame**. A white-only original roof pass uses
the same depth and geometry.

| Matched render | Roof pixel bounding box (upper ends exclusive) | Pixels with any RGB delta >3 | Changes outside old roof | Alpha changes |
|---|---:|---:|---:|---:|
| Street quarter | [38,238,836,484] | 56,033 | 0 | 0 |
| Harbour quarter | [32,225,869,625] | 83,597 | 0 | 0 |
| Detached flyby-scale | [412,312,636,395] | 4,782 | 0 | 0 |
| Turned away | none | 0 | 0 | 0 |
| Archived normal Chase n360, isolated re-render | [770,506,896,544] | 854 | 0 | 0 |
| Archived normal Chase n420, isolated re-render | [850,616,1062,700] | 3,178 | 0 | 0 |

Cold repeated stock, linked gain zero and the first unpatched and linked
rollbacks were whole-frame byte exact across 28 deterministic
mixed-order captures per view. Four focused tests and strict no-emit TypeScript pass. The tests
cover authentic asset custody, literal crease attachment, one-word
faults, refusal of optional shadow mode and restore of borrowed
resources. At close range the worn surface makes the original slopes
and joins read more distinctly. At normal flight size it is visible but
deliberately lower-key. Existing pinpoint light artifacts near a few
old tiled roof joins were seen in both states; not addressed by a
material-only change.

The archived in-scene Chase poses on spinnakers-low used a deterministic QA traversal. They show the
unmodified station unobscured around n360 and n420, ~302m and ~213m
from the camera to station origin and ~605.469m and ~706.469m neutral
physical displacement from launch. The archive roof projects to
~126×38 and ~212×84 pixels. The extra [first](plates/native-aperture-n360-matched.png)
and [second](plates/native-aperture-n420-matched.png) comparisons apply
those exact drawn camera matrices to the isolated Three owner after a
translation to local coordinates. They are not in-game after images.
The neutral render does not validate the actual aircraft, shoreline,
city occlusion, ground, or moving peers.

## Ready for private player QA, not installed

The single module exports
`prepareRailRoofFinish(verifiedStandardRailArtwork.group)`. Only
prepare on the same Standard owned artwork after its existing asset,
row, ground and owner checks. It keeps the same mesh, material and
texture object. Gain starts at zero; `set(true)` requests gain but
is not a GL readiness claim. `set(false)` does not reallocate, and
`release()` restores only owned hooks without disposing borrowed
resources or clobbering a newer owner. The independently optional
building-shadow shader is rejected. This isn't a general surface flag.

Cost: **no new triangles, draws, textures, samples, network requests,
material instances or vertex attributes**. The one existing
268-triangle roof draw adds two vec3 varyings and one uniform; for
gained fragments it evaluates four short hash-noise fields, 15
finite-segment distances and a derivative bump. No device FPS claim.

Before release, use those two real apertures in the actual ordinary
flight with a native same-frame linked comparison and non-vacuous
registered depth roles. Require byte-exact unpatched/gain-zero/restore,
no RGBA changes outside the old roof coverage, unchanged actual
terrain/roads/water/aircraft/shadows and protected peer submissions,
no new requests, and exit, ignored, stock and shadow comparisons. Check
motion as well as stills. The original game-owned station remains unchanged; this art study is not installed.

## Rebuild

Run from the repository root. Node uses the existing pinned Three r187.
Python, EGL/Mesa, Pillow and NumPy are needed only to regenerate the
detached image receipts. Each export requires a fresh directory. No
browser or imagery download is needed.

```sh
roof=tools/art/summerside-station/roof-finish
node --experimental-transform-types --test "$roof/qa/rail-roof-finish.test.mjs"
./node_modules/.bin/tsc --target ES2022 --module nodenext --moduleResolution nodenext --skipLibCheck --strict --noEmit "$roof/rail-roof-finish.ts"
lut=$(mktemp -d)
node "$roof/qa/export-dfg.mjs" "$lut"
node --experimental-transform-types "$roof/qa/export-studio.mjs" /tmp/pei-roof-new-proof
python "$roof/qa/render-studio.py" /tmp/pei-roof-new-proof /tmp/pei-roof-new-render "$lut"
# Optional detached re-render with the archived ordinary lens:
node --experimental-transform-types "$roof/qa/export-studio.mjs" /tmp/pei-roof-new-route /path/to/baseline.json
python "$roof/qa/render-studio.py" /tmp/pei-roof-new-route /tmp/pei-roof-new-route-render "$lut"
```

[evidence/detached-egl.json](evidence/detached-egl.json) pins the cold and mixed-order
lanes at every detached lab pose. The
[archived-camera receipt](evidence/archived-camera-egl.json) pins the
separate re-render with the archived real Chase matrices. Neither is a
matched live gameplay frame. The candidate source remains outside the
game import graph.
