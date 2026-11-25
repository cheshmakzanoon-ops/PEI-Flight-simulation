# Independent exterior checks

These checks compare the original and revised Three.js geometry. They test which side of the church actually shows the three entrances, whether the roofs or feet collide with neighboring scenery, and whether the lowest step visibly meets the existing game terrain. They do not reconstruct the church from a photograph or establish surveyed architectural dimensions.

Run from the repository root with the project's Node dependencies installed, Node 24+, Python 3, NumPy and the GDAL Python bindings (`from osgeo import ogr`). Only original assets in this checkout are read. Generated files go in a temporary directory.

```sh
R="$PWD"
S=tools/qa/basilica-exterior/independent
D="$(mktemp -d)"
node --experimental-transform-types tools/qa/basilica-exterior/emit-appearance-envelope.mjs "$R" "$D/stock" 0 stock
node --experimental-transform-types tools/qa/basilica-exterior/emit-appearance-envelope.mjs "$R" "$D/updated" 0 candidate
node --experimental-transform-types "$S/fences.mjs" "$R" "$D/fences.json"
node_modules/.bin/esbuild "$S/ground.mjs" --bundle --platform=node --format=esm '--define:import.meta.env.BASE_URL="/"' "--outfile=$D/ground.mjs"
node "$D/ground.mjs" "$R" "$D/ground.json"
python3 "$S/scope.py" --repo "$R" --stock "$D/stock" --candidate "$D/updated" --fences "$D/fences.json" --output "$D/scope.json"
python3 "$S/doors.py" --stock "$D/stock" --candidate "$D/updated" --out "$D/doors.json"
python3 "$S/steps.py" --trial "$D/updated" --ground "$D/ground.json" --out "$D/steps.json"
python3 "$S/ground-contact.py" --stock "$D/stock" --trial "$D/updated" --ground "$D/ground.json" --out "$D/contact.json"
```

- **Geometry and ownership:** The full opaque projection is conservative: a projecting eave is considered even if it clears the neighboring ground vertically. The second test uses only the actual lowest horizontal structural faces. A hollow replacement wall is not a new interior floor. A known-bad 180° turn around the old datum must collide with a retained building; the revised form must not. Source building `q12000111/49` is the one pre-existing replacement, not permission to erase other nearby rows.
- **Front versus rear:** Orthographic 6 cm samples trace the true nearest front-facing triangle across each opposed face. A door tag behind opaque walls does not count. The high point of each tower is retained from the old game scale and reported separately; it is not a new LiDAR measurement.
- **Ground:** The N112 original terrain is reconstructed from the shipped game and inspected at quarter-metre horizontal spacing. The exterior is hollow, so areas without a low horizontal surface do not imply a floating room. Separate 201-point tests across each emitted tread distinguish a barely protruding tread from one that would be buried on one side of the sloping ground. The project does not introduce walkable church collision.
- **Photographic review:** [Independent dated observations](../../../../docs/qa/basilica-exterior/independent-appearance.json) identify which features are actually discernible; an occluded or detail-only image cannot corroborate a whole wall. No photograph, masked region, or point cloud is installed by these scripts.
