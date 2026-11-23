# Province House: south exterior artwork

![An in-engine technical study against its unworked control, close arcade and sculptural Ionic capitals](../../tools/art/province-house-study/proof/portico-study.webp)

The [original Three.js and TypeScript asset study](../../tools/art/province-house-study/)
rebuilds the public south elevation with three recessed arches, four smooth
Ionic columns with sculpted scrolls, dressed / rusticated sandstone, and a
shallow slate roof. The left starting image is the study's own unworked
control, **not** a capture of the current simulator.

This is production art research and source, **not a live map replacement**.
Two dated south-facing photos and the historic Parks Canada plan inform
appearance and approximate proportions. The reference images,
footprint coordinates and archival raster are not copied into the artwork.
The current mapped outlines disagree in position by about 3 m, and the
available height survey dates to conservation work. The live map keeps its
current ground and building until better exterior registration is available.

The approach mesh uses **12,953 model triangles vs. 38,321 close up**, a
66% reduction. At the fixed 37 m and 70 m views, the approach mesh matched
most pixels in the close mesh render and preserved the background.
The nominal arcade threshold was tested in actual Three.js; it is not an
as-built measurement. Generated textures still need a smaller live
budget. See the [technical receipt](../../tools/art/province-house-study/proof/report.json),
[paired tier renders](../../tools/art/province-house-study/proof/approach-hero-pair.webp),
and [build instructions and source links](../../tools/art/province-house-study/README.md).
