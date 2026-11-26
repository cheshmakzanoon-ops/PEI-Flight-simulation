# Cape Tryon: distinguish the cliff top from inferred beach sand

The stock Cape Tryon Chase pass shows a broad sand-coloured wedge. The
generic ground shader increases its beach tint near the signed coastline
where the in-game ground is low. That mix is intended for low ground, not
a material survey. Before modelling the headland, this audit checks
whether the in-game ground there is low for the right reason.

We compared the exact Standard N112 owner `12-10` against one bounded
region of the named [PEI 2020 NRCan bare-earth elevation source](https://datacube.services.geo.ca/pgstac/api/collections/hrdem-lidar/items/PEI-Prince_Edward_Island_2020-1m).
The project date is nominal; a public source never makes a 2020 coast a
survey of current tides, erosion, cover, or material. This is separate
from the earlier undated-mosaic comparison and the existing
[Cape Tryon cliff coverage repair](cape-tryon-coast.md).

## Result

- The test sampled **47,586** game points at 2 m intervals, with 156
  independent near-mesh ray checks. Four valid native height samples were
  required for each local bilinear inference.
- At **185** game points the stock beach mix exceeded 12%, yet every
  participating 1 m survey cell was at least 16 m high. There were **118**
  such points with the stock beach mix over 25%.
- For those 185 points, median rendered ground is **8.83 m** and median
  source ground is **19.41 m**. The median of the paired differences is
  **10.72 m**, not a claim about the height of the entire cape.
- **127** high source points fall on the wet side of the retained stock
  mask. This is a reason to keep the shoreline, water depth, and tide
  decisions separate from a dry-top geometry study.

No changes to playable terrain, shoreline, cliff material, or contact
are in this audit. A privately rendered material-only version passed
scope checks but looked like an obvious dark patch and was left out.
A future dry-top model must preserve the adjoining shoreline, sourced
low ground, terrain seams, building seats and road contact.

[Exact source/frame summary](cape-tryon-dated-crest/source-comparison.json).
Contains information licensed under the
[Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
No raw source window or external photograph is in the repository.

## Reproduce

From a checkout with the locked dependencies, GDAL, PyProj and NumPy:

```sh
scratch=$(mktemp -d)
./node_modules/.bin/esbuild tools/qa/coastal-terrain-stock.mjs \
  --bundle --platform=node --format=esm '--define:import.meta.env.BASE_URL="/"' \
  --outfile="$scratch/stock.mjs"
node "$scratch/stock.mjs" --tryon-dated-window > "$scratch/stock.json"
python3 tools/qa/tryon-dated-crest.py --stock "$scratch/stock.json" \
  --out "$scratch/dated-summary.json"
```

The separate audit makes bounded source range reads. Identity, format
and exact source bytes must match; it writes only the summary.
