# Mapped gravel-lane canopy preview

Use `?mappedLaneCanopyStudy` with the **Standard** scenery profile. This removes four original synthetic tree instances that the coarse tree-placement raster placed directly on demonstrably open, surveyed lane centres: Canadian Road, Breadalbane Road, Dromore Road and Old Lake Road. The matching shadow instance is removed with each canopy. Road geometry, ground, scenery footprint, remaining trees and hedges, and aircraft contact are unchanged. This is not an assertion about the roads or trees present today, a foliage-density reduction, or a navigation dataset.

The [exact source records](mapped-lane-canopy-source.json) specify four original generator seeds and their projected positions, fallback height and width, licensed raw source window hashes, and existing road positions. The witnesses combine [National Road Network PE 22_1](https://open.canada.ca/data/en/dataset/3d282116-e556-400c-9306-ca1a3cada77f), explicitly mapped unpaved gravel excluding bridges, and [NRCan CanElevation HRDEM](https://open.canada.ca/data/en/dataset/957782bf-847c-4644-a757-e383c0057995), project PEI-Prince_Edward_Island_2020-1m. The latter is a 1 m surface / bare-earth pair ([DSM](https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-lidar/PEI-Prince_Edward_Island_2020-1m-dsm.tif), [DTM](https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-lidar/PEI-Prince_Edward_Island_2020-1m-dtm.tif)) in EPSG:3979, CGVD2013, nominal project date September 15, 2020, not the date of a particular archived photograph or a guarantee of current conditions. Contains information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada). No image pixels or full native files are shipped. Only the exact four compiled records are eligible, not neighbouring roads or plausible objects.

All four positions are within 22 mm of the original road centreline. The independent 7×7 native metre windows above bare earth reach at most approximately 0.026 m, 0.034 m, 0.121 m, and 0.099 m respectively. Canadian Road is nearly 2 m from a shape vertex, not a junction: the authenticated preceding span belongs to the same road and has a 1.740° continuation. The program checks that local continuation rather than treating an arbitrary nearby chord end as a crossing. New Harmony is excluded: its exact measured centre had a smaller open window, but its full 7×7 exceeded the defined upper guard, and a separate change to its grade remains unjustified.

The ordinary road bytes, decoded elevation and decoded cover must authenticate. No extra asset request, geometry rebuild, per-frame search, or crop replacement is made. If road authority arrives late, a bounded in-place compaction changes canopy and shadow together without refitting the active forest tile. A later shape with altered measured height or width at the same seed is kept. Pending, missing, changed, or corrupt sources retain the stock vegetation; the underlying atlas loads normally. Detail and incompatible woodland/adaptive-terrain/road-seating experiments also keep the stock vegetation. `islandAirDiagnostics.mappedLaneCanopy` is optional development telemetry: absence means the study is not armed; `eligible` is the total exact table length and `removed` the currently rejected original instances in the existing vegetation roster.

The project remains authoritative for its own simulation appearance only. Individual trees, roadsides and terrain grade outside these four exact source witnesses remain as before.

## Matched views in the game

[Four matched scenes](mapped-lane-comparison.webp) show the scope under
the existing Three.js renderer. At Breadalbane, the actual installer
acts after the ordinary road source becomes available. The same-frame
test goes from 8,053 existing tree-and-shadow slots to 8,052; every
unaffected position, shape and shadow value is identical. Visible and
physical ground heights are exact, the total draw count is unchanged,
and the scene submits four fewer triangles. The option-off scene is
byte-identical to the view before admission.

The other three pictures are fixed-camera renderer controls, not
full departure replays. The synthetic instances were isolated to show
their contribution in otherwise unchanged scenes. The largest visible
improvements are at Breadalbane and Canadian Road; Dromore and Old Lake
remain partly screened by the preserved stands. The
[frame receipt](mapped-lane-frame-provenance.json) records 758,711
pixels outside the projected stock crown and shadow with a two-pixel
reserve; none changed.

The [runtime receipt](mapped-lane-runtime.json) also records two ordinary
virtual flights through the Breadalbane scene, with the option off and
on. Both used Begin Flight, travelled more than 500 m, selected Cockpit
and paused. Each used one existing road download, and only the opt-in
flight showed the removal. The Old Lake camera crossed the existing
terrain owner seam and returned on both settings: the exact stock
canopy stayed present when off and absent when on. Ground heights
were exact on both sides and each original view was restored
byte-for-byte on return.
