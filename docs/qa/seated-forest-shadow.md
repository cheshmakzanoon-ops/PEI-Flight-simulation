# Close terrain-seated forest shade

**Opt-in study:** add `?seatedForestShadows` to a Standard flight URL (or
`&seatedForestShadows` to an existing query). No change is enabled by default.
The renderer seats a subset of existing canopy shade polygons onto
the terrain in low woodland views instead of drawing those polygons as flat
discs. Tree positions, canopy heights, light direction, flight and collision
are unchanged. These are approximated ground receivers, not surveyed tree
shadows. The study falls back to stock at height, on changed terrain, or in
protected scenery including St. Mary’s.

## Source and safety

The image-free 24 m exclusion atlas is derived from the simulator’s
[attributed road, runway, building, sidewalk and parking data](../WORLD.md).
The grid includes data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) and ships under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/), with [asset attribution](../../public/world/woodland/v1/canopy-receiver-fence-LICENSE.txt). It marks conservative padded cells to keep the study off transportation and
building geometry; it is not a new land map or a claim of exact current
footprints. The [source receipt](canopy-receiver-fence-source.json) lists
the source fingerprints. The optional transfer is 468,451 bytes compressed.
Invalid or unavailable content leaves stock shade intact. Alternate terrain
and certain hand-authored scenery or shadow modes take precedence. While moving, still-valid shadows carry across a camera shift. A reused tree
slot must match all six float fields and the actual terrain owner before it
can affect the scene. New unverified trees keep stock shade. A big relocation
can briefly restore stock while the new area is validated.

The production code validates the decoded terrain and land-cover fingerprints,
road and building metadata, the mapped path and parking assets, and the atlas
hash before arming. The bake also validates the complete building archive and
each tile used to construct the exclusion grid.

Run from the repository root with installed dependencies and the shipped
world pack to regenerate the atlas, its TypeScript pins and source receipt:

```sh
bundle=$(mktemp /tmp/pei-shadow-fence.XXXXXX)
node_modules/.bin/esbuild tools/geodata/bake-forest-shadow-fence.mjs \
  --bundle --platform=node --format=esm \
  --define:import.meta.env.BASE_URL='"/"' --outfile="${bundle}.mjs"
node "${bundle}.mjs"
rm -f "$bundle" "${bundle}.mjs"
```

## Verification

The [compiled browser receipt](seated-forest-shadow-gate.json) records the
pre-integration visual review of this receiver implementation with a fixed
camera and frame instrumentation. Low woodland witnesses in all three
counties showed only bounded local changes, with 273,527 projected exterior
pixels unchanged across those witnesses. The road, high-altitude and
St. Mary’s control images were pixel-identical. The no-flag St. Mary’s
control and the blocked study each retained four existing shade receivers.
A deliberately corrupted download also produced the stock image, without
extra geometry. A 115-frame motion test saw positive re-entry, no stale
enhanced frames and no enhanced high-altitude frames. The measured receiver
work peaked at 4.30 ms in that browser run; this is not a GPU, FPS, hardware
or province-wide quality guarantee.

A [separate normal-control flight](seated-forest-shadow-flight.json)
travelled 284 m from a private QA departure into cockpit view and Pause. The
revised receiver remained active through all 60 observed low-flight frames
across three tree roster generations, with one optional data request and a
maximum measured adapter time of 2.00 ms in that run. The earlier prototype
only engaged for 6 of 54 frames; this test is why it was held at review.

The [revised fixed-motion check](seated-forest-shadow-motion.json) preserved
all 143 low moving frames, eight unchanged high frames, immediate low re-entry
and zero stale active revisions. The four stationary comparison renders were
byte-identical to the first visual review.
