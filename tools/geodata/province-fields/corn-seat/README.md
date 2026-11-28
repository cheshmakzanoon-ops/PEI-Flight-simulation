# Grain-corn canopy geometry admission

These routines do not mount scenery. They prevent two types of errors when
building rooted 3-D vegetation against a dated source support mask.

- `cropFootprint` computes a lower bound over an **entire swept rectangle**
  of a texel-centred bilinear U8 mask. It splits the rectangle at every
  texel centre. A bilinear function reaches its minimum at a corner on
  each resulting subrectangle. Checking only the corners of the original
  rectangle, or only the stem’s centre, can miss unsupported leaf tips.
  Outside-mask boxes are refused. Planar position tolerance is explicit.
- `nativeFieldSeat` reads the submitted regular mesh’s original Float32 XYZ
  and U16 indices. It refuses changed diagonals or non-grid geometry and
  uses the actual indexed triangle, not bilinear height interpolation.
  `translatedFieldSeat` accepts only an XYZ model translation, so local
  Three.js buffer coordinates are not mistaken for world coordinates.
  An actual terrain identity and stock ownership check must happen before
  calling these routines; they do not replace either check.

This is appearance-only validation. It does not change navigation,
collision, the underlying terrain or the flight model. Tests include a
missing interior texel, a densely sampled deterministic set of boxes,
both sides of the original diagonal, translated ground, and malformed
coordinates or indices.

```sh
node --experimental-strip-types --test test/grain-corn-*.test.ts
```
