# Mapped parking edge compositing

The fade at the edge of an existing mapped parking surface is a sample
coverage mask, not a request to show the browser background. On true
multisampled alpha framebuffers, this material now preserves the alpha
already written underneath it. Its color, sample coverage, scene depth,
geometry, texture, data, lighting and draw count are unchanged. The
non-multisampled fallback, roads, trails and other scene materials keep
their prior behavior.

The [native flight and compositor receipt](parking-coverage-alpha-gate.json)
compares the released material along ordinary O’Leary and Charlottetown
flights, with a no-lot Georgetown control. Each matching active pair
has unchanged raw RGB and draw and triangle counts. At one O’Leary
camera, the actual page screenshot changed 309 pixels, all within
the parking alpha correction. The restored screenshot is byte-identical.
This is a renderer correction, not a change to mapped lot locations.
