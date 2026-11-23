# Basin Head coastline witness

This small OpenStreetMap-derived geometry and the corresponding RG field
are © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright).
They are separated from the engine and unrelated world sources. The
[source witness](source-witness.json) records original ordered way IDs and
coordinates used by the bake, the pinned Geofabrik snapshot, and the
explicit clipping latitude. There is no external photo or scene imagery here.

The wet-side derivative uses only the mapped water between the original
banks, inset to account for sampling and quantization. Its seaward
closing chord lies in pre-existing sea. Upstream, corrections fade inside
the witnessed channel before the cut; the outer dry coast remains
authoritative. The independent bridge centreline is a check of placement,
not a bridge mesh or a claim about navigability or current depth.

The separate bank height pack uses the [NRCan HRDEM mosaic](https://open.canada.ca/data/en/dataset/0fe65119-e96e-4a57-8bfe-9d9245fba06b),
[Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada),
and the existing NRCan base terrain. The 960 × 960 native EPSG:3979
DTM read is pinned by the bake; its elevations are not a channel survey
or chart-datum conversion.
