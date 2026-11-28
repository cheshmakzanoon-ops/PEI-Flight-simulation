# New Glasgow field surface: two checks, no replacement

The [New Glasgow field-edge flight](../../../docs/qa/new-glasgow-field-edge.md)
shows a digitally coarse agricultural foreground. This workbench tested
one nearby 54 × 52 metre cell of the existing 3D ground, not new coverage
for the whole county. Both attempts stayed below the release bar.

## Registered field, visible in ordinary flight

The [exact cell record](evidence/registered-cell-context.json) places the
two old stock triangles (tile 13-13, indexed faces 5298/5299) wholly
inside the [2020 provincial inventory's agricultural polygon](https://gis.princeedwardisland.ca/server/rest/services/Hosted/CLUI2020_OpenData/FeatureServer/0)
52521. There is no crop type in that row. The
[historic provincial soil map](https://gis.princeedwardisland.ca/server/rest/services/Hosted/Soils/FeatureServer/0)
places the cell within its well-drained CTW unit. Neither source specifies
what was on the ground recently.

In the [actual stock browser flight](evidence/ground-stock-flight.json),
the original indexed terrain remained in the scene. A final-RGB
diagnostic identified **3,309 / 11,112 / 0** depth-retained surface
pixels at +446, +563 and +861 m respectively. The third position really
places the whole cell behind the camera. There were no alpha or
out-of-scope changes, and stock was restored exactly.

## Why the two candidates stay in the workbench

- **Relief:** The [bare-earth fit](evidence/bare-earth-fit-hold.json)
  improved error on its calibration data but introduced too much slope,
  and it did not improve enough over a plane. The held elevation rows
  were not opened. No grade, collision, outer edge or original neighbor
  was changed.
- **Pigment:** The [dated aerial measurements](evidence/dated-band-statistics.json)
  show weak, meter-scale local contrast rather than rows. The detached
  Three.js study makes an original non-repeating, two-channel texture
  with about 43 KiB of mipmapped texels. No photos or their sampled
  pixels are included. The [isolated rendering lab](evidence/detached-pigments.json)
  reused the actual camera and stock geometry. The first view was
  effectively indistinguishable, and the closer view read mainly as
  smoothing, not a more convincing surface. The ordinary game does
  not load or render this material.

Run `node --experimental-strip-types --test tools/art/new-glasgow-field-surface/field-pigments.test.mjs`
to verify deterministic pixels, the shader anchor, and resource ownership.
No public texture, new draw, gameplay change or hardware performance
improvement is claimed.

Analysis uses information licensed under the
[Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada)
and the [Open Government Licence – Prince Edward Island](https://www.princeedwardisland.ca/en/information/finance/open-government-licence-prince-edward-island).
