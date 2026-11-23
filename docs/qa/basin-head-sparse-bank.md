# Basin Head native bank: sparse tessellation

The optional inlet preview no longer subdivides flat, unused parts of
its whole native bank rectangle. The active geometry preserves the same
4,252 weighted height and normal vertices. The inactive area retains its
original parent triangles, with subdivided edges only where neighbours
require an exact join. This does not change the source data, water
classification, collision policy, shore placement, or art.

The actual close terrain tile drops from 81,898 to 41,618 triangles,
a reduction of **40,280**. In the paired Three.js West and lagoon
cameras there are 40,280 fewer submitted triangles in each, with the
same draw counts and imagery. The East Point view is unchanged in all
453,600 pixels and in render counts. This measures submitted geometry,
not a hardware frame-rate improvement.

The retained supported vertices and normals are checked against the dense
mesh in `test/native-bank-mesh.test.ts`; the accepted coordinate tolerances
are 0.7 mm horizontally and 0.05 mm vertically. In the two now-tessellated
close frames, 95 and 83 of 453,600 pixels, respectively, move by more
than two RGB levels. These are isolated samples, not an identical
rasterization claim. There is no visible change to the established
terrain shape in these views.
