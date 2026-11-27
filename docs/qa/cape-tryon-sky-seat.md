# Cape Tryon cliff-seat preview

This is an **opt-in visual repair** for the north and grazing coastal
views. Open the web build with
`?departure=cape-tryon-coast&capeTryonSkySeatReview` and begin flight.
Without that flag, the existing Standard view is unchanged. The sandstone
and sea remain separate, and the optional water study takes precedence.
The aircraft, collisions, underlying terrain, shoreline mask and flight
model are unchanged.

The three-triangle strip is the original
[measured vertical-seat study](cape-tryon-vertical-seat.md). It extends a
short straight wall upward to just below the rendered cliff crest, on its
original signed line. It does not change the wall's footprint or replace
the surrounding geometry.

## Why it renders as background

A normally depth-writing version changed occupied pixels in the East
control, where the separate east gaps were not addressed. That version is
not used. The opt-in strip instead paints immediately after the exact
registered sky, without testing or writing depth. Ordinary opaque foreground
draws happen afterward and keep their existing samples. The effect reuses
read-only source shader and uniform inputs; it does not clone or alter
stock materials, geometry buffers or textures.

The preview verifies the signed atlas and live local terrain, actual
sky/strip ordering, recognized opaque coverage and the ordinary four-sample RGBA8/depth24 WebGL 2
framebuffer. Rendering is restricted to the aperture and only while the
registered renderer is active. Unexpected resources, optional water,
a failed shader, unknown depth-only colour ownership or a different sample count
leave the existing rendering in place. It links one local shader on
approach, adds one draw/three triangles when admitted, and does not need
per-frame framebuffer or GPU-buffer readback.

## Verification

Fixed native captures of the installed preview retained the 257 and 515
changed RGB pixels in the North and Grazing comparisons, all on pixels
with original background coverage. The East occupied control had no
changed pixels. Alpha and stock rollback were identical in all three.
The fixed views exercise both the operating renderer and exact camera
matrices; they do not imply the whole province has this scenery detail.

The compiled neutral Cape Tryon route became active after moving into
position, remained active at 160, 230, 320 and 430 m of travel, and issued
one program with no browser errors. This verifies live admission and
stability on that route, not a device performance figure. The fixed
replay is where the visible image improvement was measured.

See the [validation receipt](cape-tryon-sky-seat-validation.json) and the
[fixed native](../../tools/qa/cape-tryon-sky-seat-native.py) and
[compiled flight](../../tools/qa/cape-tryon-sky-seat-flight.py) replays.
