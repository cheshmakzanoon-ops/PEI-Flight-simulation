# New Glasgow Mill: independent LiDAR pass screen

**Placement remains on hold.** The 197 fixed half-metre roof-core cells
contained 313 building-class returns. All belonged to a single
`PointSourceID` (50911) over a 0.225-second local GPS span. Although
94 cells had at least two distinct XY samples, there was no independent
second acquisition group. Do not treat individual returns or subdivisions
of one strip as independent observations. This is a result for the exact
screen and source, not a claim about coverage anywhere else.

No point elevation was selected, interpreted, fitted, retained, or exported.
Transport and decompression work at the compressed-chunk level; do not
interpret that as a claim that the original file or raw encoded chunk did
not contain height information. The model remains a detached study.

## Reproduce offline

Use Python 3.10 or later and install the offline check dependencies in a
virtual environment. From this directory:

```sh
python -m pip install numpy 'laspy==2.7.0' 'lazrs==0.9.0'
python codec-test.py
python screen.py
```

The synthetic test checks the selected LAS 1.4 format-6 fields. The default
screen checks the exact header and hierarchy packets, five frozen byte
ranges and cell roster. It does not make requests or rerun the point-data
result in [the archived receipt](fixtures/no-z-screen.json).

The optional live mode requires `pyproj` and an explicit new output path:
`python screen.py --network --out /path/to/new-receipt.json`.
It sends at most five exact HTTP Range requests to the original provider
(1,909,855 payload bytes total), refusing redirects, changed identity or
unexpected range lengths. Do not automate retries, widen the polygon or
repartition the source to obtain a pass. Even an eligibility pass would
not validate the physical flight families, vertical datum, or placement.

## Sources and provenance

Source: Government of Prince Edward Island 2020 collection, distributed
by Natural Resources Canada. See the [catalog record excerpt](fixtures/provider-project.json)
and the [federal product specifications](https://canelevation-lidar-point-clouds.s3-ca-central-1.amazonaws.com/pointclouds_nuagespoints/CanElevation-LiDARPointClouds_products_specs_EN.pdf).
Original metadata is attributed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
The committed binary files are only the LAS header/VLR and COPC root
hierarchy from the exact source in [the metadata receipt](fixtures/metadata-only.json).
The published project reports CGVD2013; the tile WKT alone did not establish
a vertical reference. No compressed point chunks are checked in.
