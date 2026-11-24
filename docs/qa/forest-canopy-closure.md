# Forest canopy closure audit

**Finding:** The shipped woodland looks too open against the dated closure
evidence in two contrasting 2020 Miscouche stands. Improving individual branch shapes does not fill the
larger gaps. This is a measured blocker for changing the stand layout,
not an estimate of tree count or a claim that these two plots represent PEI.

| CLUI field | Provincial crown closure | Standard rendered cover | Native surface >8 m above ground | Native surface >10 m above ground |
| --- | ---: | ---: | ---: | ---: |
| 0490312, mixed red maple / conifer | 55% | 36.579% | 53.855% | 30.193% |
| 0560971, maple-led mixed hardwood | 85% | 52.047% | 90.594% | 84.166% |

Crown closure is the Province’s interpreted stand attribute. Rendered cover
counts pixels in the matching rasterized stand footprint in the actual stock Three.js
orthographic canopy pass, with the foreground and background geometry hidden.
The other two columns count native 1 m DSM minus DTM pixels above each
stated threshold. The thresholds are fixed diagnostics, not per-stand
calibration or ways to derive tree counts. Resolutions and spaces differ;
do not subtract the percentages as a literal survey measurement. Field 0560971
is denser under all three diagnostic methods.

## Source and scope

- [PEI CLUI2020 service](https://gis.princeedwardisland.ca/server/rest/services/Hosted/CLUI2020_OpenData/FeatureServer/0)
  supplies the exact whole stand polygons. The
  [public woodlot plan](https://www.princeedwardisland.ca/sites/default/files/publications/pid.miscouche_pid63644.2025mar.pdf)
  lists the matching field IDs, crown classes and characteristic heights.
  The plan lists the portions within that public woodland, not the
  hectares of the full polygons requested here.
- [Natural Resources Canada, 2020 PEI High Resolution Digital Elevation Model](https://open.canada.ca/data/en/dataset/0fe65119-e96e-4a57-8bfe-9d9245fba06b)
  provides the same-grid, one-metre DSM and DTM tiles. Positive subtraction
  is a structural measure; it does not identify individual crowns or
  separate tall scrub from trees. No post-Fiona canopy remeasurement enters this audit.
- Uses data under their respective
  [Prince Edward Island licence](https://www.princeedwardisland.ca/en/information/finance/open-government-licence-prince-edward-island)
  and [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
  The source rasters and geometry are fetched for QA, not shipped in the app.

## Reproduce

Download these two registered, public source polygons. Query the exact
fields, output projection, and encoding used for this audit:

```sh
curl -fsS --get 'https://gis.princeedwardisland.ca/server/rest/services/Hosted/CLUI2020_OpenData/FeatureServer/0/query' \
  --data-urlencode "where=fieldid IN ('0490312','0560971')" \
  --data-urlencode 'outFields=objectid,fieldid,landuse,cover1,cover2,cover3,cover4,cover5,per1,per2,per3,per4,per5,height,crown,hectares,stocking,covertype' \
  --data-urlencode 'returnGeometry=true' --data-urlencode 'outSR=4326' \
  --data-urlencode 'f=geojson' > /tmp/pei-closure-stands.geojson

/usr/bin/python3 tools/qa/forest-closure-native.py \
  --stands /tmp/pei-closure-stands.geojson --out /tmp/pei-closure-native

python tools/qa/forest-closure-audit.py --checkout . --deps ./node_modules \
  --stands /tmp/pei-closure-stands.geojson --out /tmp/pei-closure-render \
  --chromium /path/to/chromium
```

The first check requires GDAL and NumPy. The renderer check uses the same
Playwright/Chromium dependencies as the existing fixed-scenery QA. Both
reject changed polygon bytes. The browser uses a temporary copy of the
source and stock assets, reads the published height tiles and uses actual
canopy alpha, not hand-drawn disk proxies. It renders the normal scene,
then isolates the stock forest crown mesh without its hedge append range.
It counts pixels exceeding two RGB codes in the canopy-only pass. These
figures establish a comparison baseline, not a device benchmark.

See the [source-grid receipt](forest-canopy-closure-native.json) and
[stock renderer receipt](forest-canopy-closure-stock.json). An acceptable
next pass must improve both cases without filling real small clearings,
widening into roads or water, or altering the flight collision surface.
Keep long-range, oblique, and moving low-altitude checks separate so an
overhead score cannot hide a poor silhouette or a hard transition.
