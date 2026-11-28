# Panmure Head: preserve the join to the surrounding terrain

This offline packet reshapes **one full cell of the existing terrain
mesh**, not the whole peninsula. It is separate from the
[wider detached cut](../wide/README.md), whose join to the coarser
terrain remains on hold. Nothing in this directory is loaded by the
simulator or changes what the plane collides with.

The ordinary high-detail tile `25-18` has two adjacent triangles with
identical continuous height, normal and UV planes. Replacing that pair
with 452 triangles lets the surface blend partway towards the
[1 m bare-earth elevations](../source/source.json) without altering
any of the four shared outer edges. The original 12,769 vertices are
retained in the proposed splice; only 225 new vertices are appended and
only six original index entries (the two old faces) are removed. All
four stock neighbors use the same original edge in the opposite order.

| Offline property | Result |
| --- | ---: |
| Peak visual change | +0.382 m |
| Largest candidate slope after the shader's Float32 translation | 6.05% |
| Connected area raised by at least 0.25 m | 183.10 m² |
| Minimum projected triangle altitude in the shader coordinate basis | 0.217 m |
| Maximum neutral height difference in the shader coordinate basis | 0.000465 mm |
| New splits along the original four surrounding edges | 0 |

The 20 m transition is a **partial** blend. It has no fully weighted
source nodes. The active triangles remain inside a signed dry footprint
that excludes mapped water, roads, buildings, lighthouse features and
woodland. The minimum reserve to this archived mask is 0.572 m. The land-cover data, original UV and normal boundary values,
and low-detail/contact terrain are not edited. The alternative could still
cause an optical difference at the edge; a CPU numerical result is not a
full-world image or a framerate measurement.

The [packet receipt](packet/receipt.json) includes the stock indices,
source hashes and the neutral/raised streams. The
[numerical study](numerical-study.json) records the source guard and both
coordinate checks. The verifier takes owned copies of byte-addressed data
and rejects mismatched old terrain, coordinate basis, and resolution.
It does not have a renderer or any way to mount the alternate.

## Reproduce the exact stock comparison

After installing the project dependencies and fetching or generating the
signed world assets as described in the repository setup, run from its root:

```sh
here=tools/art/panmure-dry-grade/compact
scratch="$(mktemp -d)"
npx --no-install esbuild "$here/replay-stock.mjs" --bundle --platform=node \
  --define:import.meta.env.BASE_URL='"/"' --format=esm \
  --outfile="$scratch/replay.mjs"
node "$scratch/replay.mjs" "$scratch/stock"
cmp "$here/stock-replay-expected.json" "$scratch/stock/receipt.json"
PANMURE_STOCK_DIR="$scratch/stock" node --experimental-strip-types \
  --test "$here/test-compact.mjs"
python3 "$here/check-topology.py" "$here/packet" "$scratch/stock"
```

This tests exact stock custody and reconstructs the replacement index buffer
and vertex streams. It does not reproduce the recorded numerical survey
fit; those packet bytes and study are supplied for inspection. With GDAL and its Python bindings, the archived dry-mask reserve can
also be checked with `python3 "$here/check-dry-domain.py"`. A native
flight draw, depth-retained comparison and the full departure aperture
are separate acceptance steps before any game-facing change.

Contains information licensed under the [Open Government Licence –
Canada](https://open.canada.ca/en/open-government-licence-canada).
