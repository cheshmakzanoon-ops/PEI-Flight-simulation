# A measured roof near North Rustico Lighthouse

The [North Rustico lighthouse study](../landmarks/north-rustico.md) now also
replaces the flat roof of one nearby, unnamed atlas building. The measured
upper ridge and lower attached roofs are different heights. The original
mapped outline, building placement and terrain remain in use. The muted
surface is an original neutral finish: it does not claim actual materials,
window positions, a named business, or present-day appearance.

The option is included with **North Rustico lighthouse** in Standard terrain.
For a building-only comparison, append `?rusticoMassingReview`; append
`&legacyRusticoMassing` to a lighthouse bookmark to retain the old roof.
Alternate inland or adaptive terrain and the experimental building-shadow
mode retain the stock building. Missing or unverified archive bytes also
leave the original geometry and material.

![Matched simulator frames from the same camera: stock flat roof on the left; verified upper and lower slopes on the right](rustico-neighbour-shape.webp)

## Evidence

The [NRCan PEI point cloud](https://open.canada.ca/data/en/dataset/7069387e-9986-4297-9f55-0288e9676947)
and [CGVD2013 elevation mosaic](https://open.canada.ca/data/en/dataset/0fe65119-e96e-4a57-8bfe-9d9245fba06b)
describe the 2020 survey. The two flight lines observed the upper and lower
surfaces independently. Lower returns from the same laser pulse as a real
upper return are valuable evidence for height layers but cannot serve as
observations of the visible top. An inset around uncertain eaves and a cluster
of unusually high returns were held out of the reported roof fit; the model
does not attempt to identify or reconstruct those small protrusions.

In the 1,453-point held-area test away from the uncertain step/eave band, the
old model's 90th-percentile vertical error was **3.37 m**. The independently
blocked plane fit was **4.7 cm**; real engine mesh rays were **4.2 cm** against
the same evaluation cohort. These numbers do not describe the edges,
façade, interior or every point on the building.

The renderer authenticates the original compressed atlas chunk from a single
read, then checks the exact ordered footprint and source record. It replaces
only that building's original batch vertices. The tile retains one draw and
adds 39 triangles. The other 37,884 vertices and all six of their attributes
are byte-identical, with tested neutral fallback. See the [check data](rustico-neighbour-check.json).
No paths, roads, lighting cues, terrain, shoreline or water are part of this update.

Contains information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
