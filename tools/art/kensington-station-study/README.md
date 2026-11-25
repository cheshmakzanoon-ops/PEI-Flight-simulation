# Kensington Railway Station — held exterior study

**Status:** registered in plan, original detached joinery and selected independently tested 2020 roof planes. There is no change to the flying world. A photograph, training fit or partial holdout is not whole-building validation. This is the existing stone passenger station in Kensington, Prince County (62 Broadway Street North), not the former freight building, the Summerside railway station, or a full rail yard reconstruction.

## Place and geometric ownership

- The current PEI civic layer returns two points for 62 Broadway St N on **PID 868646**. Names or register coordinates alone are imprecise here: the municipal/provincial record pin is tens of metres away, and the federal CRHP index is farther. Matched roof outline, parcel, dated visual reference and actual stock draw all agree on **`q032122/149`**.
- The ordered AEB roof polygon is **301.806 m²** in EPSG:2954, track-parallel length about **34.53 m**. Its current parcel intersection is **245.822 m²**. The difference is a single **55.984 m²**, **1.729 m max** track-side strip, not authorization to model ground or a contiguous building. AEB reports a roof envelope; it does not survey the enclosed wall, posts, windows or canopy framing. The Town cultural-history nominal 68 × 28 ft (20.73 × 8.53 m) refers to the building, useful only as a sanity check.
- Provenance: exact atlas `538bcf3c…`, manifest `fcc2bb4d…`, compressed packet `f85f4770…`, exact #199 stock `9a106441…`. The [NRCan Automatically Extracted Buildings 2020 outline](https://open.canada.ca/data/en/dataset/7a5cda52-c7df-427f-9ced-26f19a8a64d6) is licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada). A renderer ownership buffer isolates vertices **[9621, 9687)** on a 28,686-vertex tile. The long edge 6→5 establishes +U northeast; +V points away from the track. Negative-V carries the central gabled bay, with two open, lower, hipped canopies at opposite axial ends. These are roles and sides only, not new numeric placements.
- Nearest preserved owners /105, /458, /431 remain independently identifiable, along with all land, scenery paths, rails and boardwalk. The direct across-track pose is partially occluded by still-stock /458; end-on oblique and inside aisle view expose the correct owner. All five baseline stock images reproduce exactly before a material intervention. `roof-envelope-plan.svg` draws only horizontal facts and categorical source roles; `plan-registration.json` carries exact frame and attribution.

## Architectural and period hierarchy

| Evidence | Supported for art | Explicitly withheld |
| --- | --- | --- |
| [Parks Canada, national site #583](https://www.pc.gc.ca/apps/dfhd/page_nhs_eng.aspx?id=583) and [PEI entry #20380](https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=20380), with [2009 F. Pound design-detail images](https://www.historicplaces.ca/en/rep-reg/image-image.aspx?id=20380) | Low reddish-gray fieldstone body, higher gable, central track-side projecting telegrapher bay with broad arch, light painted wood and stone detail, open end hip roofs with columns and decorative brackets. | No absolute elevation, exact bay/form dimensions, or current field fittings. |
| [Town railway history](https://kensington.ca/wp-content/themes/ktown/chip/english/railway/station.htm), [CANRAIL 332 archive](https://exporail.org/canrail/canadian_rail_1962_1989/canadian-rail-332-1979.pdf), and [Town Official Plan §2.5 fig. 4](https://kensington.ca/assets/Town-of-Kensington-Official-Plan-2023_FINAL-2023-1.pdf) | Independent scale reasonableness and distinction between the building walls and the larger cover. Fieldstone belongs to the walls; roofing and canopies are distinct. | No new outer wall positions, floor datum or railline from the older drawings. The 2023 publication does not date its illustrative photograph to 2023. |
| [F. Lambert Aug 2017: trackside](https://commons.wikimedia.org/wiki/File:Gare_de_Kensington_01.jpg), [Broadway](https://commons.wikimedia.org/wiki/File:Gare_de_Kensington_02.jpg), [opposite track oblique](https://commons.wikimedia.org/wiki/File:Gare_de_Kensington_03.jpg) | Roles seen from independent directions. Mixed size, round and fractured stone rather than a planar tile grid. The arch has a substantial surround and recessed pale joinery; muted original exterior colors are preferable. | Business equipment, branding, cars, seating, accessibility fixtures, recent ground surface or upper location not reproduced. |
| [Municipal listing #19248](https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=19248); [June 2020 CAO report, railyards item 6](https://kensington.ca/assets/COC-Tentative-Agenda-June-2020-website.pdf); [September 2020 CAO report](https://kensington.ca/assets/Tentative-Agenda-September-2020-website.pdf) | 2007 wood shingle restoration is historical. Dorian storm damage subsequently led to a roof replacement that the June 2020 report identifies as complete, before the July–September 2020 PEI survey season. | The 2020 report does not establish the replacement finish. Do not install the 2007/2017 shingle material or infer new drains/heat pump locations. |
| [PEI civic address layer](https://gis.princeedwardisland.ca/server/rest/services/civic_addresses/FeatureServer/0) and [PEI property parcel layer](https://gis.princeedwardisland.ca/server/rest/services/property_parcels/MapServer/0) | Public horizontal address locator and selected parcel boundary as factual cross-checks. | No detailed vertical survey or implied property, operating or access claim. |

## Original Three.js surface and geometry

**Stone (C).** No copied bitmap. Original seeded toroidal packing lays 1,843 rounded, wedged and irregularly broken stones/chips across a 3.84 × 3.84 m procedural sample, with 67.9% plan occupancy in its authored texture and editable earthen mortar. Tileable albedo and normals use a 768 px grid, physical grain and finite-difference relief with mipmaps. Trilinear/anisotropic filtering plus a world-footprint crossfade keep distant stones and highlights from scintillating. The procedural dimensions are the artist sample's repeat size, not measurements of the real walls. The separate weathered wooden-shingle coupon is a **pre-2020 historical comparison only**.

**Joinery.** A detached exterior-development coupon only: a genuinely cut wall aperture, individual segmental dressed blocks, sill lip/slope, layered recessed wood rails and true open glass panes instead of a decal. It identifies the track-side arch language without asserting total frontage, roof pitch, surveyed proportions, present-day operation or existing furnishings. Its coordinates are local studio coordinates; no geodetic transform is exported. No archived or Google photo pixels, copied drawings, signs, vehicles or site objects are embedded.

## Independent partial roof result

The source is the original PEI 2020 [Natural Resources Canada CanElevation LiDAR Point Clouds](https://open.canada.ca/data/en/dataset/7069387e-9986-4297-9f55-0288e9676947), object `pei_2020_350000_709000`, CGVD2013 orthometric metres. Contains information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada). The artist fitted only the 496 explicitly sealed training rows. The reviewer independently decoded spatially and pulse-disjoint reserved parts of the **same** airborne acquisition; this is not a second instrument. Neither raw nor partitioned returns, photos, exact pulse keys or source imagery are in the capsule.

The immutable emitted Three.js Float32 roof witness (`4fd9a033…`) passed all eight admitted groups. **273 of 273 reserved rays hit actual emitted triangles**, with a worst per-role 90th-percentile absolute height difference of **0.262 m** and a worst absolute median bias under **0.084 m**. The track-facing main slope continues onto the lower track-side extension, with a separate rear pitch. The lower end hips are shelter roofs, not the enclosed stone body.

| Admitted role | Hits | P90 absolute |
| --- | ---: | ---: |
| Southwest track face | 33 | 0.031 m |
| Northeast track face | 31 | 0.070 m |
| Southwest rear face | 26 | 0.114 m |
| Northeast rear face | 24 | 0.160 m |
| Northeast ridge | 19 | 0.262 m |
| Southwest track extension | 47 | 0.044 m |
| Northeast track extension | 41 | 0.036 m |
| Southwest canopy | 52 | 0.129 m |

The central track-facing bay surfaces and northeast terminal canopy facet are intentionally cut out. The southwest ridge contains an unresolved high cluster and was not scored. The generic primary plane remains visible there as part of this witness; it is not a validated southwest ridge or a chimney reconstruction. The northeast canopy group, both bay groups and all three dry ground groups also remained unopened. No held result was used to adjust the sealed model. In the immutable fit recipe, `preregisteredPlanSha256` names the horizontal plan digest (`710e1cf0…`), not the independent held-design digest (`aed374ae…`). Training metrics and held results are reported separately.

## Release gate

This remains a partial study, not a whole replacement. Keep stock `q032122/149` and the adjacent ground and scenery intact. A future candidate requires its own evidence for the central bay alignment, the northeast terminal facet, southwest ridge, sensitive post/wall seating, and replacement roof finish. Verify the actual rendered ground and the two original axial clearances, protected owners and paths, matched external poses and ordinary player flight. Ground and collision samplers are not interchangeable evidence. No footing, grade, track, boardwalk, sign, vehicle or neighboring scenery is part of this study.

### Reproduce the standalone study

With this repository's installed development dependencies, run

```sh
npm exec -- vite tools/art/kensington-station-study --host 127.0.0.1 --strictPort
```

Open the local URL shown by Vite. These previews are not imported by the simulator. To recreate the emitted geometry receipt, use Node 22+:

```sh
cd tools/art/kensington-station-study/fit
node --experimental-strip-types exact-roof-rays.mjs < /dev/null
```

This writes local `emitted-roof-proof.json` from the sealed model. It requires neither photo files nor point returns. Whole or partitioned source elevations are not included. `fit/emitted-training-ray-summary.json` concerns only development training; the separately sanitized `fit/held-aggregate.json` records independent point/spatial holdout aggregates and exclusions.
