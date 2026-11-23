# Mapped residential type support

© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
This derivative database is made available under
[ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
Its compressed JSON contains only selected way/relation IDs,
closed building outlines (listed without a repeated endpoint), house
types, the used roof/level tags, and exact mapping references. The
matching keys identify the independent Natural Resources Canada atlas
version and building ordinal. OSM contributor/account identifiers,
private information, names, business labels and addresses are omitted.

The source is the
[Geofabrik PEI extract](https://download.geofabrik.de/north-america/canada/prince-edward-island/)
from November 1, 2026. The source and derivative fingerprints are in
[the house audit](../../residential-architecture/fit-report.json).
No OpenStreetMap imagery is used. The ODbL matching database is
kept separately from the survey-derived roof shape measurements,
which follow [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
The output simulator is a produced work and retains visible
OpenStreetMap credit in the dispatch footer and map credits.

Use [the public reproduction steps](../../../docs/qa/residential-envelopes.md)
to regenerate the standalone derived database from the same snapshot.
