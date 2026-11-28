# Galvanized chain fabric

A reusable detached Three.js enclosure for sites with independently known post
locations. The [dated North Cape view by Robert Linsdell](https://commons.wikimedia.org/wiki/File:North_Cape_Lighthouse,_Seacow_Pond_(471248)_(9450748340).jpg)
shows the kind of galvanized posts, top rail and diamond fabric under study.
This asset does not copy the photograph or use it to infer post spacing,
terrain, perimeter, present condition, or a site's exact material.

Pass metre coordinates relative to a local origin. Each point supplies a post
footing height; the renderer does not modify the grade or invent intermediate
ground contact. Open and closed runs use a single indexed solid-metal draw.
The close variant adds one draw for all fabric panels. A periodic analytic wire
mask integrates the projected fragment footprint, then fades the wire relief
as the individual diagonals become unresolved; the middle variant deliberately
retains only the supports. It uses no images, decals, new textures or
distributed photographic pixels.

The example test fixture is a four-post rectangle, **not North Cape**. It
checks true three-dimensional posts/rails, continuous panel seating as the
ground slopes, and a maximum of 328 triangles and two roles for that example.
The material requires a compatible 4× multisampled renderer and uses a
strictly positive derivative width before discard. RGB replaces covered
samples, while destination alpha is preserved. It is not imported
by the simulator, and no named site or collision geometry changes. Before
mounting any real enclosure, verify the grounds, dated location and live
near/far optical transition in context.

Optional isolated renderer check: run `python3 tools/art/galvanized-chain-fabric/verify-mask.py`
on a machine with a 4× multisampled EGL/OpenGL ES 3 context. Mesa 25.0.7
produced 13,848 covered pixels face-on, 13,982 after a subpixel shift,
15,674 obliquely and none once unresolved. Five grayscale bins in the near
sample show effective 4× coverage stepping. The test links the exact
wire-mask function, not the complete Three.js PBR scene or a site view.
