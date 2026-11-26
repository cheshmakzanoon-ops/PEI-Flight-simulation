# Cape Bear: relocated timber lighthouse study

This original Three.js model and the adjacent survey test inputs are archived
here for review. The simulator does **not** load them. Cape Bear retains stock
scenery, flight contact, and dispatch options.

## Exterior and sources

This is the museum’s historic square tapered tower, decommissioned in 2011
and relocated in 2015. It is not the separate operating steel aid to
navigation. [Parks Canada’s designation](https://www.pc.gc.ca/apps/dfhd/page_hl_eng.aspx?id=14953)
supports the nominal 12.2 m height, timber shaft, red gallery, octagonal iron
lantern and vane. [Tourism PEI](https://www.tourismpei.com/attractions/cape-bear-lighthouse-and-marconi-station)
confirms the move. The province’s [coastal policy report, Figure 13](https://www.princeedwardisland.ca/sites/default/files/publications/2023_pei_interim_coastal_policy_recommendations.pdf#page=21)
and [Hayden Soloviev’s July 2025 photograph](https://commons.wikimedia.org/wiki/File:Cape_Bear_Lighthouse_and_Marconi_Station.jpg)
(CC BY 4.0) informed the broad form and finish. Source images are not
distributed, projected onto the model or used as textures. Finish, sash
dimensions, exact compass orientation and current surface appearance are
not surveyed. No interior, lower access structures, beacon, or operating
light is included.

The 2,824-triangle exterior uses original geometry for recessed sash,
gallery rails, backed glazing and the lantern. The lantern revision
exchanges 36 local triangles without altering the other 2,788 triangles
or changing the silhouette.

## Placement and contact evidence

The relocated stock building is row 447 of tile q1100. The independent
provincial footprint corroborates location, not present appearance. The
dated [2020 CanElevation survey](https://datacube.services.geo.ca/pgstac/api/collections/hrdem-lidar/items/PEI-Prince_Edward_Island_2020-1m)
supplies 1 m bare-earth and surface elevations under the
[Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
The relative terrain file describes a four-by-four near-tile cell envelope
in 25–20, each cell split into 16 intervals. It holds a 65×65 signed
little-endian centimetre plane, then the original byte support plane.
It does not set land or water classification. The separate contact file
contains 241 sorted little-endian index and byte-weight pairs for a
193×193 aligned lattice. Its nominal contact formula preserves the stock
collider outside the supported correction, rather than deriving collision
from narrow raster-triangle overlaps.

Across 675 held-back ground points in the qualified core, the proposed
mesh cut 90th-percentile absolute error from 1.967 m to 0.077 m. In the
175.60 m² museum apron, the separately checked physical surface differed
from submitted terrain by at most 6.17 µm. Its extra gradient was bounded
above by 0.177612 m/m; old wet, runway and protected contact controls
remained unchanged. Exact draw/contact equality is not claimed outside
that apron. The actual rendered-ground-delta collision approach remains
rejected: it exceeded the 0.18 m/m limit in seven thin triangle overlaps.

## Why this has not shipped

At one locked native Chase pose, seating the terrain, 82 existing canopy
roots and 111 shadow casters did not conceal or relocate any unrelated
trees. The independent shadow pass changed no pixel outside its marked
scope and restored the old frame exactly. Adding the lighthouse changed
only 76 strong RGB pixels in that pose. A different prelocked stock
approach from offshore saw 113, 225 and 386 subject pixels in its three
primary frames; only one met the 250-pixel floor, rather than the required
two. Neither lens qualifies the feature for the live map. Woodland shapes,
camera and scope thresholds remain unchanged.

Run the [archive integrity and geometry test](../../../test/cape-bear-study.test.mjs)
with `node --experimental-strip-types --test test/cape-bear-study.test.mjs`.
It checks the retained payloads, the bounded lantern change and closed
model sections; the ground, contact and native render results above are
recorded study evidence, not claims reproduced by that unit test.
