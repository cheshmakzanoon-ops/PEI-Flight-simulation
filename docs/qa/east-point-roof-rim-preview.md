# East Point roof forms preview

To try the rebuilt roofs on a local build, append
`?departure=east-light&eastPointRimPreview=1` to the simulator URL.
Wait for **East Point roof forms preview ready.** in Dispatch before
choosing **Begin flight**, then view the approach in Chase. An early
launch keeps the original geometry for that flight. Choose the
departure again to retry. Do not combine this option with the separate
East Point wall finish: a URL requesting both keeps both original.

The two former flat caps are rebuilt from admitted local 1 m elevation
data. Their upper wall edges were cut and stitched to the new roof
forms without moving the lower walls or the footprints. This adds 78
triangles to the same existing building draw. The default scenery,
nearby buildings, turbines, roads, coastline, and aircraft handling
are unchanged by the option. The original measured roof sources and
limitations remain in the [source study](../../tools/art/east-point-measured-roofs/rim/).
This is not a current survey of the roofs or their foundations.

The exact player build submitted the new geometry at both ordinary
Chase checkpoints and again after a fresh Begin on the same selected
row. A plain browser launch also rendered the alternate positions with
diagnostics absent. The [matched comparisons](../../tools/art/east-point-measured-roofs/rim/ordinary-chase/)
show the original and rebuilt roofs drawn within the same frames;
the view was unchanged once the roofs were out of view. The preview
falls back on unsupported renderer settings and never replaces the
original material or default geometry. Native checks kept the original roof when
antialiasing was unavailable or the verified module arrived after Begin.
The prior wall preview still reached its original active draw independently.

## Rebuild the scoped geometry data

With dependencies installed, run the following from the repository
root. The command writes a fresh file and refuses to overwrite one.

```sh
out="$(mktemp -d)"
node --experimental-strip-types tools/art/east-point-measured-roofs/rim/replacement.mjs --preview-wire "$out/wire.ts"
cmp "$out/wire.ts" src/render/east-roof-rim-wire.generated.ts
```
