# Coastal terrain intake across three counties

This is a repeatable comparison of six public landmark anchors, two in each county. It changes no game terrain. It compares the existing fine Three.js terrain mesh and flight contact with Natural Resources Canada’s one-metre bare-earth elevation mosaic. East Point and West Point include their loaded coastal surveys. The offline Point Prim control deliberately omits the on-demand local correction, so its number does not describe the promoted site in ordinary play.

| County | Public anchor | Median native-adjusted height minus base render within 8 m |
| --- | --- | ---: |
| Prince | West Point | +0.01 m |
| Prince | Cape Egmont | +3.32 m |
| Queens | Cape Tryon | +7.75 m |
| Queens | Point Prim, base control only | +2.12 m |
| Kings | East Point | +0.00 m |
| Kings | Panmure Head | +2.79 m |

These differences explain why new lighthouse models cannot simply replace the stock buildings at Cape Egmont, Cape Tryon or Panmure. At Cape Tryon, some source elevations more than 4 m above the mosaic datum still fall in cells the game treats as water. An elevation threshold alone cannot determine shoreline position, tidal state or present-day land ownership. Terrain, coastal coverage, flight contact, and adjoining paths need separate checks before a live change.

The [baseline](coastal-terrain-intake-190.json) includes signed ranges, lead-in land and shoreline bands, source fingerprints and 49 mesh ray cross-checks per anchor. It stores no raw raster windows. Terrain data comes from the [NRCan HRDEM Mosaic](https://open.canada.ca/data/en/dataset/0fe65119-e96e-4a57-8bfe-9d9245fba06b), under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada). This mosaic selection alone does not establish a capture date for every pixel.

## Repeat from the project root

With project dependencies installed, a Node.js runtime, and Python with GDAL and NumPy:

```sh
scratch=$(mktemp -d)
./node_modules/.bin/esbuild tools/qa/coastal-terrain-stock.mjs \
  --bundle --platform=node --format=esm '--define:import.meta.env.BASE_URL="/"' \
  --outfile="$scratch/stock.mjs"
node "$scratch/stock.mjs" > "$scratch/stock.json"
python3 tools/qa/coastal-terrain-raster.py --out "$scratch/native"
python3 tools/qa/coastal-terrain-reconcile.py --stock "$scratch/stock.json" \
  --raster "$scratch/native" --out "$scratch/terrain-baseline.json"
```

The optional audit makes bounded range reads for six public elevation windows. It does not run during ordinary builds or inside the game.
