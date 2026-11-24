# Raw survey cross-check for simple fitted roof envelopes

This is an offline QA tool, not game code, and does not change the map or fetch any files when launching the game. It catches local roof forms that can be missed by an otherwise good fit to blocked, 1 m raster cells. It neither fits a new roof nor certifies the original outline, exterior finishes, chronological condition, playable floor, or grade. A pass is a necessary source check for this pilot, never a substitute for rendered silhouette, eave, contact, adjacent scope, and active-mode tests.

**Source credit:** Natural Resources Canada, [LiDAR Point Clouds (CanElevation Series)](https://open.canada.ca/data/en/dataset/7069387e-9986-4297-9f55-0288e9676947) and [High Resolution Digital Elevation Model (CanElevation Series)](https://open.canada.ca/data/en/dataset/957782bf-847c-4644-a757-e383c0057995), [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada). Use the named 2020 PEI project. The September 2020 HRDEM catalogue time is not the exact UTC acquisition time of each return. The underlying footprint is an exact existing Natural Resources Canada [Automatically Extracted Buildings](https://open.canada.ca/data/en/dataset/7a5cda52-c7df-427f-9ced-26f19a8a64d6) atlas record, not a new survey of walls. No images, orthophotos, private GIS excerpts, or raw point cloud files are bundled.

The fixture pins both public COPC object names, full sizes and exact ETags. It also pins the existing complete atlas SHA-256, each owner tile digest, ordered footprint and recorded roof envelope. Point Z stays in the source's CGVD2013 orthometric metres. Horizontal positions travel from source NAD83(CSRS) UTM zone 20N (EPSG:2961) into the EPSG:3979 metre grid, and from there through WGS84 into the game's tangent X/Z coordinates. This changes no elevations. Point class 6 means a return associated with a building; an anomalous cluster may contain roof or other above-ground structure, and does not by itself identify an annex, dormer or exact geometry. The raw returns and HRDEM may derive from the same flight(s): this check bypasses raster resampling, but is not independent epoch validation.

## Running the QA

Use Python 3.11+, NumPy, GDAL's `gdaltransform` on PATH, and `laspy` with the `lazrs` COPC backend for live retrieval. Verified with GDAL 3.10.3, laspy 2.6.1. With dependencies already installed:

```sh
python tools/qa/test-roof-copc-coherence.py
python tools/qa/roof-copc-coherence.py \
  data/roof-qa/roof-copc-coherence-v1.json \
  public/world/buildings /tmp/roof-copc-coherence.json
```

The first command uses only synthetic records and mocked responses, no socket or external data. The second issues bounded HTTPS ranges to only the pinned NRCan objects. It verifies exact 206, requested extent/size/ETag and uses If-Match. Redirect targets are not requested. Each object has a 12 MB, 100-range-attempt, 170-second admission budget. Intermittent access can cause a transparent failure; do not substitute newer tiles or unpinned objects. Record a separate fixture if the public data revision changes. The optional `--private-window-cache DIRECTORY` replays separately stored, SHA-256-pinned projections (the only allowed file is a bounded `points.npy` member in a per-owner NPZ; the seven columns are EPSG:3979 E, N, source Z, class, withheld, flight source ID, GPS time). No local cache data is needed for public replay. No raw rows are included in the aggregate output.

## What the checker measures

1. Authenticate the existing atlas pack and named owner slice; match the exact ordered source outline. Read the direct 2020 COPC crop for the plan with a 3 m horizontal collar.
2. Accept only non-withheld class-6 returns at least 0.71 m inside. Independently keep only whole 1 m cells certified by the centre's clearance from the closed source plan and at least three accepted raw points in each cell.
3. Measure signed native Z to the proposed game-space roof planes. Cells with an absolute signed median above 0.40 m are connected only edge-to-edge, and only within the same residual sign. Hold a patch with two connected cells; hold coverage below 60%, a support plane with fewer than 50 returns, or per-plane p90 above 0.45 m. These are conservative study thresholds, not official survey tolerances and not a proof of roof semantics.
4. Compare to the [recorded exact scores](roof-copc-coherence-expected.json). Do not silently relax a negative. Compare render-derived north/east and reciprocal near-angle silhouettes, preserved lower contact, and zero unrelated changes separately.

| Existing atlas roof | Inboard Class 6 points | Whole native cells with ≥3 points | Largest coherent mismatch | Result |
| --- | ---: | ---: | ---: | --- |
| Charlottetown `q120010/152` | 1,739 | 246 / 248 | 0 | No coherent interior contradiction at this threshold |
| Souris `q130331/180` | 4,583 | 349 / 349 | 2 lower | Hold the proposed simple gable |
| Souris `q130331/98` | 1,482 | 206 / 206 | 9 lower | Hold the proposed simple gable |
| Souris `q130331/167` | 1,704 | 258 / 259 | 9 higher | Hold the proposed simple gable |

The three Souris envelopes are deliberately included as negative QA inputs only and were **not** mounted in the game. For the Charlottetown row the two slopes' absolute raw point p90 differences are 0.321 m and 0.290 m. This is distinct from the blocked raster/actual render ray comparison and supports only the broad envelope, not minor fixtures or openings.
