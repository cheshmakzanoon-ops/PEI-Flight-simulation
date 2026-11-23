# Can the survey explain a roofline?

**Three of 24 screened outlines have independently sampled surfaces that support a simple ridge.** One is in each county. The other 21 should keep their fallback for this model. The result is a data and methodology check, **not a change to playable roofs**, a census of roof shapes, or an estimate of province-wide yield.

All 24 were in the existing renderer's flat fallback. We tested against a *better* flat baseline than its single maximum height: the median training-sample surface. A plane of arbitrary slope was a second competitor. All figures below are held-out absolute vertical errors in metres against the 1 m surface model.

| County / sample center (longitude, latitude) | Interior cells | Median flat | Single plane | Ridge | Ridge 90th percentile |
| --- | ---: | ---: | ---: | ---: | ---: |
| Prince / Summerside (−63.790211, 46.392695) | 349 | 0.57 | 0.56 | 0.14 | 0.85 |
| Queens / Cavendish (−63.408527, 46.483862) | 395 | 0.51 | 0.49 | 0.10 | 0.27 |
| Kings / Montague (−62.649000, 46.166011) | 174 | 0.54 | 0.54 | 0.08 | 0.23 |

## Reproduce

The [pilot](../../tools/qa/roof-fit-pilot.py) is optional. It uses Python 3, GDAL's Python bindings with GeoTIFF/HTTPS support, and NumPy. No Python dependency or external data request is added to the runtime, build, or CI. Run from the repository root:

```sh
python3 tools/qa/roof-fit-pilot.py --self-test
OPENBLAS_NUM_THREADS=1 python3 tools/qa/roof-fit-pilot.py --atlas public/world/buildings > /tmp/roof-fit-pilot.json
diff -u docs/qa/roof-fit-pilot.json /tmp/roof-fit-pilot.json
```

The first command checks synthetic flat, single-pitch, two-pitch and undersampled controls without an internet connection. The second checks the local pack hash, reads only small windows from two public cloud-optimized GeoTIFFs and writes numeric observations. It does not download the entire province. The [saved output](roof-fit-pilot.json) includes all 24 cases, the pack hash, and one SHA-256 per pair of raw float32 DSM/DTM windows. If the public mosaic changes, investigate updated fingerprints before comparing results. The output was reproduced on GDAL 3.10.3 and NumPy 2.2.4; other numerical libraries can differ slightly near ties.

## Selection and rejection criteria

The six fixed anchors are Summerside, Tignish, Charlottetown, Cavendish, Georgetown and Montague. Take the four nearest **eligible** footprint bounding-box centers per anchor *before looking at elevation*. Require a single ring with more than four vertices, source height 3–15 m, reported height span >1.3 m, and plan bounds at least 6 m and less than 42 m along both axes using the stated coarse metric. Those constants select a small pilot, not all PEI building types.

1. Project the outline into the common 1 m DSM/DTM grid. Discard nodata and the outer 1.5 m of each footprint. Use DSM surface height for the fit; use ground-relative height only for a broad 1–100 m sanity filter. Fewer than 48 interior pixels is insufficient.
2. Split fixed 3 m spatial blocks into four folds. Select each crest direction, offset, intercept and symmetric pitch on the **training** observations only. Eligible candidates need samples on both sides and slopes between 0.12 and 1.73 m per metre. On the held-out fold score three models: median-height flat, robust plane and two-face ridge. Three robust reweighting steps reduce but do not eliminate returns from fixtures or vegetation.
3. Accept only if held-out median ridge error is ≤0.40 m and the 90th percentile ≤0.90 m; median improvement is ≥0.25 m **and** ≥25% relative to the flat baseline and ≥0.16 m **and** ≥25% relative to the plane. Require directional agreement >0.90 (mean resultant of doubled angles) and at least three held-out pixels more than 0.8 m on **each** side of the candidate crest in **every** fold.

Seven samples had too few pixels, three had no viable ridge in at least one fold, and eleven failed the final quality gates. These thresholds are deliberately conservative **engineering hypotheses**. Some real ridges will fail, and an accepted fit can still describe vegetation, a dormer, or just part of a complex roof. These are held-out measurements from the same surface product, not an independent building survey.

## Before enabling a geometry change

- Inspect each accepted case in oblique and overhead views with the same camera, lighting, lens and level of detail before/after. Obtain separate lawful reference evidence where possible. A good residual alone cannot identify roof construction, present-day use, roofing material, or a business.
- Fit in the survey's projected metre grid. Convert the crest into the game's east/south frame correctly and register heights against the local ground. Check concave polygons, holes, exact footprint clipping, wall-to-roof joins, and heights around the rim; the pilot excluded that rim from the fit. Do not simply stretch an inferred ridge across uncaptured wings of a building.
- Expand to fresh, independently selected validation blocks containing rural outbuildings and dense settlements in each county; report **every** candidate, rejection reason, and fallback count by stratum. Do not extrapolate 3/24.
- Bake only compact, confidence-qualified geometry parameters. Preserve the existing scenery when an asset is absent or ambiguous. Report transfer size, triangles, calls and worst tested streaming hitch on a fixed flight. A province-wide effect needs province-wide coverage and visual evidence, not a screenshot of three anchors.

**Sources and attribution.** Contains information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada). The outlines are Natural Resources Canada's [Automatically Extracted Buildings, PEI 2020](https://open.canada.ca/data/en/dataset/7a5cda52-c7df-427f-9ced-26f19a8a64d6). The height windows are the Canadian [CanElevation 1 m HRDEM mosaic, item 10_3-mosaic-1m](https://datacube.services.geo.ca/pgstac/api/collections/hrdem-mosaic-1m/items/10_3-mosaic-1m) on EPSG:3979. The mosaic date is not proof of a later acquisition for a particular building. This pilot contains no Google imagery, third-party photos or surveyed shop identities.
