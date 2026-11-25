# Rebuild the Beaconsfield ground stamp

This producer is limited to the single existing optional historic-house exterior on tile 16-16. It does not infer new structures, paths, vegetation or modern landscape design. The native mosaic is an external reproducibility input, not a bundled asset. No per-return laser heights are used by this producer.

From the repository root, after installing the locked Node dependencies:

```sh
OUT=/tmp/pei-beaconsfield-grade
mkdir -p "$OUT"
npx --no-install esbuild tools/geodata/beaconsfield-grade/stock-grid.mjs \
  --bundle --platform=node --format=esm '--define:import.meta.env={"BASE_URL":"/"}' \
  --outfile="$OUT/stock.mjs"
node "$OUT/stock.mjs" . "$OUT/stock"
python3 tools/geodata/beaconsfield-grade/dtm-window.py "$OUT/stock" "$OUT/native" --acquire
python3 tools/geodata/beaconsfield-grade/bake.py "$OUT/stock" "$OUT/native" "$OUT/stamp"
cmp "$OUT/stamp/beaconsfield-contact-v1.bin.gz" public/world/beaconsfield-contact-v1.bin.gz
cmp "$OUT/stamp/beaconsfield-grade.generated.ts" src/sim/beaconsfield-grade.generated.ts

npx --no-install esbuild tools/geodata/beaconsfield-grade/check-geometry.mjs \
  --bundle --platform=node --format=esm '--define:import.meta.env={"BASE_URL":"/"}' \
  --outfile="$OUT/submission.mjs"
node "$OUT/submission.mjs" "$OUT/mesh"
node --experimental-strip-types --test test/beaconsfield-grade.test.ts
```

The Python scripts need NumPy, SciPy and GDAL with PROJ, GeoTIFF and HTTPS range support. The extractor checks a specific Government of Canada mosaic object ETag, geotransform, native data type, fixed source window and exact SHA-256. The bake uses the game’s own projection constants and actual triangulated N112 land as baseline, not spherical-degree approximations. It rounds down to centimetres, never raises a protected vertex, and normalizes the gzip OS header byte for reproducible output. An existing native window can be verified offline by running the extractor without `--acquire` [see extraction script](dtm-window.py).

**Sources.** Contains information from Natural Resources Canada’s [CanElevation 1 m bare-earth mosaic](https://datacube.services.geo.ca/pgstac/api/collections/hrdem-mosaic-1m/items/10_3-mosaic-1m), horizontal EPSG:3979, CGVD2013 heights, under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada). Source Class-2 laser holdouts are an independent evaluation of the modelling work; the mosaic may incorporate the same acquisition. Existing coast, road, pedestrian, building, parking and vegetation provenance stays in the project’s [data documentation](../../../docs/WORLD.md); these layers restrict placement rather than author new appearance. No third-party photograph or lidar point set is packed.
