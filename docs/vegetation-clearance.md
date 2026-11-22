# Why trees no longer grow through roofs

The land-cover layer says whether a roughly 47 m square is woodland. It cannot locate individual trees beside narrower buildings. In the original placement pass a 12 m deterministic grid scattered trunks across that area even where a measured roof occupied the same ground. This was especially visible on low approaches through populated areas.

A build-time spatial join compares the **actual jittered point for each candidate stem** to each exterior building ring. It honors interior rings and rejects non-woodland, off-land and runway candidates, exactly as the renderer does. We skip just those intersecting stem cells. We do **not** clear a bounding box around the building: trees beside the walls and branches that legitimately extend over roofs are retained. The two authored lighthouse sites have a separate, narrowly bounded crown-clearance rule. Neither system claims to survey real individual trees.

| Current source build | Result |
| --- | ---: |
| NRCan PEI roof footprints checked | 85,866 |
| Footprints with at least one otherwise eligible stem | 12,557 |
| Unique centre-of-stem intersections | 18,038 |
| 192 × 192 m vegetation tiles containing an exclusion | 6,620 |
| Sorted cell identifiers after delta coding | 25,499 bytes |
| Resident table | 72,152 bytes, plus a reusable 32-byte tile mask |

The source archive currently contains **no interior rings**. A synthetic courtyard is kept in the regression suite so a future source with interior rings need not erase trees in its courtyards. Soil, tree species, and survey dates do not become more precise as a result of this filter.

The added parcel is compiled into the app rather than fetched separately. In a like-for-like Vite production build the main JS grew by about 25.6 kB **gzipped**. A tile cache miss uses one binary search and sets at most 256 bits; an unchanged frame does not search footprints. There are no additional GPU draws, materials, or per-building GPU resources for this feature.

## Reproduce

From the repository root (Node 22.12+; no network or new packages):

```sh
node --experimental-strip-types tools/geodata/bake-tree-clearance.ts --check
npm test
```

To rebuild after a deliberate change to a source atlas, the metre projection, runway checks, vegetation grid or seed algorithm, run the same baker without `--check`. Review the regenerated source hashes, counts and mask changes. The full-atlas regression reproduces the actual parcel, decodes it, and checks every emitted runtime mask bit. Existing coastline, vegetation and roofing limitations still apply; see [World data and attribution](WORLD.md).

Sources: [Natural Resources Canada Automatically Extracted Buildings, PEI 2020](https://open.canada.ca/data/en/dataset/7a5cda52-c7df-427f-9ced-26f19a8a64d6) under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada); [ESA WorldCover 2021 v200](https://doi.org/10.5281/zenodo.7254221), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), including modified Copernicus Sentinel data (2021). The generator operates on the project's already attributed terrain, shoreline and land-cover inputs.
