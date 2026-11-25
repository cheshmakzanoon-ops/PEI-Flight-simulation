# Main Confederation Trail geodata

© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright). This derivative database and the corresponding packed vectors in `public/world/trails/odbl/v1/` are available under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). The material shader and images rendered by the simulator are separate original work.

- Relation [4740520](https://www.openstreetmap.org/relation/4740520), version **61**. This is the main Tignish–Elmira relation, not the branches.
- `trail-source-and-sections.json.gz` includes the exact 109-member order, sanitized way IDs/revisions, coordinates and relevant surface/width/ground tags, plus all released centimetre sections. No account fields, uploader details, edit timestamps, photos, or surveyed heights are bundled in this database.
- `qualification.json` records source and asset SHA-256, atlas pins, the protection layers and admitted metres. Its lengths are in the simulator’s WGS84 tangent approximation, not an official surveyed chainage.
- The three per-strip fields are surface kind (0 compacted, 1 fine gravel), whether width was explicitly tagged, and nominal full width in cm. Their way ID and section roster follow. Section rows are `[centreXcm, centreZcm, offsetXcm, offsetZcm, endFeather0to255]`. Tile-clipped counterparts share one offset and feather.

The datasets that qualify coverage (terrain and signed land cover, buildings, roads, sidewalks, parking, and runway definitions) have their own [source credits](../../../docs/WORLD.md). They are not relicensed here. Trail tags describe the frozen input and are not real-world access or travel guidance.

To re-run selection with GDAL, NumPy and Node, supply the [OSM full-relation JSON](https://www.openstreetmap.org/api/0.6/relation/4740520/full.json) with exact SHA-256 `66e19f29e054cc034a55aaf1c78ea9b5046c2c3de1c138561b256d2189cf9fe3`; an API export from a newer revision will not qualify. The archive here contains the complete sanitized source selection and derived vector geometry so reading the compiled result does not require the historical API response.

```sh
/usr/bin/python3 -B tools/geodata/bake-confederation-trail.py /path/to/exact-relation-v61.json
node --experimental-strip-types --test test/confederation-trail.test.ts
```
