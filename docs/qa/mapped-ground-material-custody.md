# Mapped ground material custody

A current OpenStreetMap area can carry a `surface` value first recorded on
an older shape. A recent geometry edit is not evidence that anybody
surveyed the surface again. The same way revision can also acquire a
different outline when an existing member node moves.

The offline [surface history audit](../../tools/geodata/audit-osm-surface-history.py)
looks for the last change to the currently observed surface value. It
reconstructs that earlier outline using the archived node versions effective
on the tagging date, and the later outline using the node versions effective
on the requested observation date. It reports added and removed area and
the common area in PEI Double Stereographic (EPSG:3979).

Use authoritative history exports and pass the complete histories of the
member nodes needed at both dates. Input gaps, deleted nodes, open or
self-intersecting ways and missing surface tags fail closed. The tool
doesn't download data, infer material widths, trace photos, process
multipolygon relations or edit the atlas.

```sh
/usr/bin/python3 tools/geodata/audit-osm-surface-history.py WAY_ID way-history.json node-history.json \
  --observed-at 2026-11-26T10:19:00Z --output /tmp/surface-overlap.json
/usr/bin/python3 tools/geodata/test-audit-osm-surface-history.py
```

`node-history.json` uses the official `elements` format with all versions of
each required node combined in one list. It is evidence input, not an art
asset or data shipped to the player. Keep provider files separate and cite
their applicable data terms.

Even a perfect overlap only shows that the map outlines agree. Apply a
surface to the playable world only after independent recent evidence
supports its location and character, the actual native ground and roadway
renderers agree, and it is visibly useful on a registered route. A positive
terrain fit does not prove that a court is paved; mixed gravel, hardpaths
and timber can occupy a single old map area.

## Founders’ Food Hall example

The official [way 285024017 history](https://api.openstreetmap.org/api/0.6/way/285024017/history.json)
records concrete at version 4 in 2022 and carries the value forward through
the geometry revisions to version 7 in 2026, without a new surface value.
Using the official history of all 26 required node IDs at the two effective
dates, the audit found:

| EPSG:3979 measurement | Approximate area |
| --- | ---: |
| Outline when the material was tagged | 603.03 m² |
| Outline on November 26, 2026 | 704.63 m² |
| Common area | 536.66 m² |
| Added outside the old tagged outline | 167.97 m² |

Nearly 24% of the later **unclipped source outline** was not present when
the tag was set. This is separate from the simulator's eventual placement
and protection clips, which use the game's own metre coordinates. The
[renovation architect’s current exterior photography](https://sablearc.com/founders-food-hall/)
also distinguishes gravel, narrow paved access and a separate timber
walk beside the lawn. The audit does not identify their exact boundaries;
no ground change from it is enabled in the player. OpenStreetMap data:
[© OpenStreetMap contributors (ODbL)](https://www.openstreetmap.org/copyright).
