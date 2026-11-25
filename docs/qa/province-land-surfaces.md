# Ground vegetation and Expanded farmland together

In **Standard** scenery, open **Optional scenery studies** in Dispatch. Select **Ground vegetation** and **Expanded farmland**, then apply. Both default to off. A direct bookmark is `?departure=kings-grassland&sourceGrassStudy&provinceFieldsReview`.

Each option is a close-range optical effect on the existing terrain. Neither changes the geometry, water or aircraft contact. The dated source classes do not establish current growing conditions. The furrows and grass detail are authored materials, not ground-level imagery of the sites.

## Where the two current masks meet

The masks use the same 4 m lattice, but their files, authentication, GPU arrays and requests are separate. With the [corrected farmland geography](province-fields.md), **979 tile addresses** are common to the 3,331 grass tiles and 1,525 farmland tiles. Sharing a tile does not mean that all its pixels overlap: just **4 sample centres** meet in both masks. Across all 2 × 2 bilinear neighbourhoods there are **13 potentially mixed patches**, at most **208 m²** before accounting for opacity or visibility. See the [complete archive comparison](farmland-v2/land-overlap.json).

Where both contribute, established farmland shading takes precedence as its opacity increases; partial boundaries fade. The game never takes a grass coverage value as a field direction or vice versa. The upper bound for the two resident RG8 mask arrays remains **1,081,600 bytes** total; each stream has at most two outstanding tile requests. The compressed directories are 249,810 bytes for grass and 115,861 bytes for farmland. Standard without either option requests neither directory.

Use the [mask comparison](../../tools/qa/province-land-support.py) and the [compiled combination/fault test](../../tools/qa/province-land-player.py) to repeat these checks. An invalid field directory must not prevent the grass archive from authenticating, and vice versa. See [the grass study](province-grass.md) and [Expanded farmland](province-fields.md) for the two source histories.

**Historical comparison:** the [nine matched renders](province-land-surfaces-comparison.webp) and [earlier release check](province-land-surfaces-check.json) used the retired v1 farmland placement. They illustrate the shader’s blending rule, not a verified mixed site in the corrected generation.
