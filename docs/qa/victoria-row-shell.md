# Victoria Row, Charlottetown: fifteen attached roof parts

The south side of Richmond Street between Queen and Great George no longer
uses one nearly level generic white extrusion. The new model retains the
existing NRCan outline `q12000111/3` (3,418.15 m²) and resolves its attached
roof volumes. Saint Dunstan's Basilica, the surrounding shells, road and
terrain are unchanged. This is a measured massing change and a scoped
architectural interpretation, not a complete recreation of the whole street.

- Fifteen [attributed OSM outlines](../../data/odbl/victoria-row) and the
  Richmond Street axis organize the envelope. The original outer outline
  stays the boundary; 85.49 m² (2.50%) of narrow residual between its edge
  and the intersected OSM parts are filled inside it. Roof heights are
  fitted to Natural Resources Canada's native 1 m DSM, not OSM storey tags.
- Nine street-facing treatments use original brick, limestone, arched
  reveals, coplanar multipane glazing, cornices and painted lower joinery.
  Jambs and returns are actual three-dimensional geometry. Apertures and
  decorative courses are authored inside the exact plan, not applied to
  a street photograph. The [City's designated heritage list](https://www.charlottetown.ca/UserFiles/Servers/Server_10500298/File/Resident%20Services/Heritage/Preserving%20Heritage/RESOURCES%20DESIGNATED%20UNDER%20THE%20HERITAGE%20PRESERVATION%20BYLAW.pdf)
  and the Canadian Register's [Brown](https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=5841),
  [Cameron](https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=3137)
  and [Morris](https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=3165)
  entries describe brick and stone, mouldings, arches and corbelled cornices.
  The register guides the design, not individual measured jambs, materials,
  levels or an address-by-address reconstruction.
- No tenant, storefront brand, signage, interior, advertising or photo
  pixels are included. The model reuses the existing CC0 sky for glass.
  The street bed, public furnishings and north side are still simpler
  world layers, not part of this architecture update.

## Independent geometry checks within this increment

The [native window and model receipt](../../data/victoria-row) documents
the source and naturally stepped vertical spread. Three.js downward rays
hit the older and newer modeled roof at each of the 622 blind 1 m sample
centres (3 m blocks reserved before fitting, with a 1.05 m inset from the
registered edge). There were no missing rays or multiple unequal heights.
The upper-right values below represent percentile absolute height error,
not a minimum guaranteed rooftop accuracy.

| Blind raster error | Original | New |
| --- | ---: | ---: |
| Median | 2.67 m | 0.19 m |
| p90 | 6.64 m | 1.18 m |
| p95 | 9.40 m | 1.56 m |

All 15 source groups improved in this cohort. The render emits 362 roof
triangles and shares 149 step segments. Tests check 3,735 vertical profile
points on 1,245 actual shared roof-edge stations. The projected roof union
of the actual Float32 mesh matches the original outline within 0.001 m²
for each gap, overlap and exterior area; this is numerical agreement, not
survey-grade CAD. The same tile's 19,344 unrelated vertices are exactly
unchanged across all six geometry attributes. The existing tile adds
19,990 body triangles and no additional visible draw call in the comparison;
thickness and materials are not hardware performance claims.

```sh
/usr/bin/python3 tools/geodata/sample-victoria-row.py --root "$PWD" --out /tmp/pei-victoria --pbf /path/to/prince-edward-island-261101.osm.pbf
/usr/bin/python3 tools/geodata/bake-victoria-row.py --root "$PWD" --source /tmp/pei-victoria --verify
node tools/qa/victoria-row-mesh.mjs /tmp/pei-victoria/victoria-heldout-points.csv /tmp/pei-victoria/mesh.json /tmp/pei-victoria/actual.json
/usr/bin/python3 tools/qa/victoria-row-projection.py src/render/victoria-row.generated.ts /tmp/pei-victoria/actual.json
```

## Matched real scenes

[Open the before/after comparison](victoria-row-comparison.webp) or the
[raw validation summary](victoria-row-render-gate.json). Two pedestrian
positions inspect the arches and actual recesses; 30 m and 118 m views
check the roof massing at useful flight scales. They use identical camera,
terrain, sky and load state. Pixel gating switches only the one shell in
the same settled scene and separately identifies the old and new visible
target silhouettes. Outside those silhouettes plus a one-pixel
antialiasing tolerance there are no appearance changes, including in the
East Point control. These were Chromium WebGL software renders, not FPS
measurements or suggested low flying heights.

The four local frames change 365,764, 249,780, 143,677 and 10,063
pixels by more than four RGB levels. Their combined 1,846,327 protected
pixels, as well as all 655,360 pixels at East Point, are unchanged.
An unmodified compiled harbour departure also loaded 43 of 43 local
building tiles and flew more than 212 m without renderer errors or layer
warnings.
