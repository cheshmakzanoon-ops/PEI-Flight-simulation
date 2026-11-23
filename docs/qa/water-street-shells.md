# Water Street, Summerside: surveyed massing and frontage geometry

Five original building-atlas records in the historic Water Street corridor
had almost a uniform elevated cap. Some records combine multiple attached
structures. The selected rebuilds keep each exact registered outline but
distinguish the surviving lower roof sections and their vertical transitions.
The original atlas still supplies the entire surrounding city and the styling
does not change roads, sidewalks, weather or flight collision.

Original brickwork, weathered low-slope roofing, deep glass reveals and window
frame geometry replace the generic flat facade grid in these five shells.
The glazing reflects the same existing CC0 sky direction. The commercial-facing
walls were selected using the matching open-map road and building parts.
No tenant, store signage, commercial graphics, photograph or invented interior
is reproduced. Window placement, widths, trim, materials and the detail of a
rounded heritage corner remain artistic approximations, not a recorded facade
survey. The surrounding scenery is visibly simpler and unchanged.

## Public evidence

- [City of Summerside Official Plan](https://summersideca.hosted.civiclive.com/UserFiles/Servers/Server_19514871/File/Building%20%26%20Development/Zoning%2C%20Rules%20Bylaws/Summerside%20Official%20Plan%20%28effective%20Jan%2023%202025%29%20FINAL.pdf)
  identifies historic Water Street as narrow, contiguous mixed-use downtown
  frontage. It supports the relationship between the shells and the street,
  not site-measured windows or claims about occupancy.
- The Canadian Register of Historic Places documents the masonry, flat roof
  and later extension of the [Journal building on Queen Street](https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=10109)
  and the utilitarian [former vault at 310 Water Street](https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=11162).
  The recorded mural and plaques were not used. A different block containing
  a documented bank footprint was held back because its fit was still too poor.
- [Native elevation receipt and blind cells](../../data/water-street) are
  separate from [ODbL building-part and road references](../../data/odbl/water-street).

## Blind Three.js geometry

| Atlas feature | 1 m native cells held back | Previous p90 roof-height error | New p90 |
| --- | ---: | ---: | ---: |
| q032001/108 | 98 | 1.82 m | 0.35 m |
| q032001/137 | 596 | 6.10 m | 1.50 m |
| q032001/172 | 198 | 3.99 m | 0.21 m |
| q032001/267 | 472 | 7.36 m | 1.32 m |
| q032001/326 | 11 | 1.46 m | 0.26 m |

Downward rays through the actual streamed body hit one roof on all
1,375 held-back cells. The unaffected buildings in the same stream have
26,349 byte-identical vertices across all six recorded attributes. The
geometry pipeline checks shared vertical closure where fitted roofs meet,
maintains the source roof outline, and places glazing 170–245 mm behind the
outer wall. A 1 m aerial survey cannot determine facade components. The
14,326 additional triangles are in an existing streamed batch, not an
additional scene draw. Review counts below are software renders, not
hardware performance results.

```sh
/usr/bin/python3 tools/geodata/sample-water-street.py --pbf /path/to/prince-edward-island-261101.osm.pbf --out /tmp/water-street-source
/usr/bin/python3 tools/geodata/bake-water-street-split.py --root "$PWD" --source /tmp/water-street-source
/usr/bin/python3 tools/qa/water-street-heldout.py /tmp/water-street-cells.json
node tools/qa/water-street-mesh.mjs /tmp/water-street-cells.json
/usr/bin/python3 tools/qa/water-street-edge-witness.py src/render/water-street.generated.ts
```

The independent review ray-cast another 6,716 native interior cells
(5,019 locally stable, not a second training holdout). Projected cap unions
matched each source outline to sub-square-centimetre numerical tolerance,
with zero overlapping roof area. [Raw geometry/renderer gate](water-street-render-gate.json)
contains both cohorts and their separate results.

## Matched visual review

[Open the 1,400 × 1,650 before/after plate](water-street-shells-comparison.webp).
The 2.9 m inspection eye is below the roof and shows actual jambs and glass
insets; it is not a suggested flight height. The 18 m street and 118 m
approach verify massing at more representative visual ranges. There are
255,157, 293,146 and 53,697 visibly changed pixels respectively in the
original 1,024 × 640 frames. Switching the actual older and newer building
batch in the same fully loaded scene produces **zero changes outside the
old/new silhouettes plus one antialiasing pixel**. The affected common-area
median luma at the 118 m view is 115.79 → 82.13, largely due to darker
bitumen instead of the former blue roof paint; the rest of the frame did
not darken. No background image, hidden street change or new lighting
profile is used.
