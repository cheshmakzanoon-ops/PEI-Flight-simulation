# Province field pack build

The tools use the exact game meshes and public geographic source versions.
Follow [the crop-source guide](../crop-preview/README.md) to acquire the
AAFC inputs and build `supported-fields.json`. Raw rasters and intermediate
masks stay in your scratch directory. NumPy, SciPy, Matplotlib, GDAL and
the repository's locked Node dependencies are required.

From the repository checkout (substitute the actual scratch locations):

```sh
ROOT="$PWD"
SRC="/path/to/crop-source"
WORK="/tmp/pei-field-bake"
mkdir -p "$WORK"
./node_modules/.bin/esbuild tools/geodata/province-fields/actual-world.mjs \
  --bundle --platform=node --format=esm '--define:import.meta.env.BASE_URL="./"' \
  --outfile="$WORK/actual-world.mjs"
(
  cd "$WORK"
  node actual-world.mjs "$ROOT" "$SRC/supported-fields.json"
  PEI_RECON="$SRC" PEI_WORLD="$ROOT/public/world" \
    python "$ROOT/tools/geodata/province-fields/qualify.py"
  python "$ROOT/tools/geodata/province-fields/pack-field-shards.py" \
    private-1km-mask.npz packed
)
cmp "$WORK/packed/index.fcr.gz" public/world/fields-province/index.fcr.gz
node --experimental-strip-types tools/geodata/province-fields/verify-field-archive.mjs \
  "$WORK/packed" "$WORK/decoded-receipt.json"
```

Qualification compares against the actual N112 terrain triangles and
pinned stock roads, building footprints, walkways, parking and runways.
Only support cells from the guarded mask are archived. A default special
Souris terrain owner is removed before packing. The surrounding excluded
cells, accepted centers, quantized directions, and edge halos are
part of the independent review (*see the release receipt*).

The runtime index uses little-endian FCR1. It contains a bounded pack
table and sorted signed X/Z records with offset, size, and SHA‑256 for both
the compressed shard and the decoded RG8 layer. The layers use a 1,024 m
square, 4 m cells and a two-cell neighboring halo in every direction.
In each texel R is a discrete authored angle and G is coverage. Only
coverage interpolates. The format carries no point clouds, field
ownership, labels, or source photographs.
