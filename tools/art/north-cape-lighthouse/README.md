# North Cape Lighthouse study

The North Cape Light is a separate Prince County landmark from West Point.
The [Coast Guard list entry, light 1036](https://notmar.gc.ca/publications/list-lights/atl/atl942-en.php)
places it at the cape and describes a white octagonal tower with a red
top at 19.5 m. This study uses that structure height as an art anchor.
The [PEI Lighthouse Society’s account](https://peilighthousesociety.ca/index.php/lighthouses/public-lighthouses/28-north-cape-lighthouse)
reports an older height and the base side length. The differing height
figures are not resolved as a new survey.

The detached Three.js model has a tapered octagonal shaft, a stepped
gallery cornice, timber cross-bracing, three trim openings on one
representative face, and separate lantern glazing. The
[dated Linsdell view](https://commons.wikimedia.org/wiki/File:North_Cape_Lighthouse,_Seacow_Pond_(471248)_(9450748340).jpg)
was used to review those visible construction features. No part of the
photograph is used as geometry, a decal, texture, or distributed asset.
The chosen taper, lantern and opening dimensions are authored. The
representative face has no assigned compass bearing.

The separate [North Cape ground source](../../../data/north-cape-lighthouse-study/source.json)
contains an unresampled 384 by 384 grid in the original 1 m HRDEM
registration, converted to centimetre integers. It records 5.51 m at
the published light locator, which is not a precise foundation center.
Contains information licensed under the
[Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
The raster does not establish a shoreline, foundation, collision surface,
or the current condition of the entire station.

Neither asset is imported by the game. Before integration, reconcile
reference bearing and foundation with the site, photograph the same
normal flight views, and verify the terrain/roads, turbines and existing
building roles against stock. The study is not a navigational aid.

### Separating elevated objects from the ground

The adjacent 56 × 56 m **digital surface model** (DSM) stores exact source Float32 samples,
without imagery. Its origin is offset 164 columns and 168 rows into the ground window
above; both share the metre grid and vertical datum. Run the surface-candidates test to
reproduce the comparison. It subtracts the bare-ground model cell by cell and checks
four-connected components at 9, 12, 15 and 17 m of relief, rejecting unresolved no-data
and identifying any component truncated by a window edge.

At 12 m the two components contain 32 and 37 cells. The first has peak relief of about
19.33 m and its centre is 3.18 m from the Coast Guard light locator. The second is about
17.7 m south of that centre and has peak relief of about 69.28 m. Those distinct signatures
support separating the likely tower and nearby mast during art placement. The component
centre is **not** a surveyed foundation, the surface height is **not** a certified tower
height, and the raster yields neither orientation nor textures. The simulator still uses its
unchanged player terrain and does not ship either study raster in the playable build.

### Dated near façade

The optional detached `dated-facade` variant keeps the three sashes but adds the
small hooded vent below them and the entry canopy on the adjoining face. The
vent and adjacent canopy are visible in the 2011 view. The [provincial heritage
statement](https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=19725&pid=0)
records removal of ground-floor windows; the [Lighthouse Society account](https://peilighthousesociety.ca/index.php/lighthouses/public-lighthouses/28-north-cape-lighthouse)
identifies the replacement vent. No fourth sash, steps, fences or compass
bearing have been inferred. The new pieces follow the shaft's taper and add
89 opaque triangles to the existing opaque draw. The archived near mesh,
glazing and middle-distance geometry remain byte-identical when requested.
Neither the variant nor its photographs ship in the simulator.
