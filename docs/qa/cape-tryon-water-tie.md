# Cape Tryon water-gap comparison

In a built local copy in Standard, use `?departure=cape-tryon-coast&capeTryonWaterReview` and begin flight. Remove the water comparison flag for the same departure on the stock renderer. The default and the separate sandstone finish are unchanged.

Some true wet samples close to the stock coast hit exactly zero after the GPU filtered the 8-bit mask. The existing ocean discarded those samples. For this local comparison, the new draw reads the same four signed atlas texels and recomputes the blend in floating point. It admits only old-zero samples at least 7.5 cm into the signed wet classification. This fixes a rendering incongruity, not a measured tide level, coastline, survey or change to contact physics.

The one additional locally visible draw uses 44 triangles across the 22 mixed source cells. The draw envelope is 45,078 m², about 28.5% of the containing rectangle. It shares the existing water images and material settings; no new assets are fetched. It runs late in the opaque pass, at the existing sea level, without writing depth. A clear-depth equality test prevents it from painting over occupied depth samples. Glass and other transparent objects can still blend normally with the repaired background. No optional shader is presented before its detached link and the decoded geography are verified.

The [matched native checks](cape-tryon-water-tie-native.json) found **782, 530 and 849** fewer exposed sky pixels in the north, east and grazing fixed views, and **200, 452, 1,480 and 593** in the existing neutral Chase at 4, 6, 8 and 10 seconds. By 13 seconds the compared frame was unchanged. The nearby Orby and Panmure controls and the far view were exact. An independent 4× multisample replay also preserved occupied depth samples and the no-change controls. These tests use a software renderer and do not establish end-user FPS or full default-path scope.

The compiled-player check, `node tools/cape-tryon-water-smoke.mjs`, requires the same ordinary flight and real WebGL draw order and depth settings, and checks the two-sky mask and exact restoration while frozen at the same pose.
