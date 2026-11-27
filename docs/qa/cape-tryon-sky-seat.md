# Cape Tryon cliff-seat preview

This is an **opt-in visual repair** for documented north, grazing, and east coastal
views. Open the web build with
`?departure=cape-tryon-coast&capeTryonSkySeatReview` and begin flight.
Without that flag, the existing Standard view is unchanged. The sandstone
and sea remain separate, and the optional water study takes precedence.
The aircraft, collisions, underlying terrain, shoreline mask and flight
model are unchanged.

The three-triangle [North vertical-seat study](cape-tryon-vertical-seat.md)
preserves its original signed line. Two separately measured
[East strips](cape-tryon-east-sky-seat.md) follow one straight and one
bowed cell in the existing coverage atlas. They share the same optional
draw; none of the original wall or surrounding geometry is replaced.

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
approach, adds one draw with 55 triangles when admitted, and does not need
per-frame framebuffer or GPU-buffer readback.

## Verification

Fixed native captures of the current preview changed 324 North, 515
Grazing and 386 East RGB pixels, all on pixels with original background
coverage. The largest fixed East opening no longer has fully exposed
sky pixels; smaller openings remain. Alpha and stock rollback were
identical in all three.
The fixed views exercise both the operating renderer and exact camera
matrices; they do not imply the whole province has this scenery detail.

The compiled neutral Cape Tryon route became active after moving into
position, remained active at 160, 230, 320 and 430 m of travel, and issued
one program with no browser errors. This verifies live admission and
stability on that route, not a device performance figure. The fixed
replay is where the visible image improvement was measured.

See the [original North validation](cape-tryon-sky-seat-validation.json),
[combined validation](cape-tryon-east-seat-validation.json) and the
[fixed native](../../tools/qa/cape-tryon-sky-seat-native.py) and
[compiled flight](../../tools/qa/cape-tryon-sky-seat-flight.py) replays.
