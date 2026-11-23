# Victoria Row native elevation witness

Contains information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
Source: [Natural Resources Canada High Resolution Digital Elevation Model Mosaic](https://open.canada.ca/data/en/dataset/0fe65119-e96e-4a57-8bfe-9d9245fba06b),
Charlottetown source item `10_3-mosaic-1m`, DSM and bare-earth DTM.
`native-validation.json` pins the window, paired-band hash, cohort and fitting
results for this single NRCan atlas record. The first sample centre is
2,384,412.5 E, 301,037.5 N in EPSG:3979; samples are spaced one metre and
north-first. Heights are in metres. This is not a roof-component survey,
street grade modification or present-day architectural availability report.

`tools/geodata/sample-victoria-row.py` re-reads just this native window.
The count and hash apply to the ordered DSM/DTM float32 band content, not
the downloader's archive metadata. Historical architectural register
references, original joinery and terrain are separate from this receipt.
