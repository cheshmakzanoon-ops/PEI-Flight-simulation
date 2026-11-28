# Cape Tryon grain-corn receiver: stock flight evidence

The existing **Cape Tryon coast** departure takes a Chase camera over a
qualified interior from the [2025 grain-corn screen](../../../tools/geodata/province-fields/grain-corn.md).
The first two frames of the existing flight show a largely smooth, dark
green foreground without distinct canopy geometry. This test establishes
space for a future original 3-D treatment, not that such a treatment is
in the game.

[Stock close-up](cape-tryon-stock.webp): an unscaled native left-foreground crop, with no marker or new appearance.

The test used a trusted click on the existing **Begin flight** button and let the flight run
with no control input, camera repositioning or simulated-clock override.
The diagnostic used the original N112 terrain mesh, in its regular place
in the Three.js draw order, with its native indexed geometry, original
view and projection, depth writes and 4× multisampling. It alternated two
temporary fragment RGB codes **after** the original colour output, and
restored the identical first/last frames. The diagnostic itself is not
part of the player.

An independent checker decoded native 1× frames and clipped the four-tap
signed source support against the actual received terrain triangles and
linked camera matrices. It required the code to appear only inside that
conservative projection, with the original alpha and exact stock restore.
The numbers in the [receipt](cape-tryon-stock-receipt.json) count pixels
showing diagnostic ownership, not new canopy pixels or independently
shaded samples. The third frame is a negative control after the support
moves behind the camera.

The original source classifications have a 30 m grid; the derived
simulator support used by this test has 4 m centres. Neither establishes
stalk height, 2025 row spacing, variety, or what the actual field looks
like now. No raw fields, source photography, or satellite images are
included. Real geometry and material still require their own silhouette,
edge, restoration and cost tests before a player release.
