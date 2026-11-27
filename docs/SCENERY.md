# Scenery and departure guide

[Back to PEI Flight Sim](../README.md) · [Pilot controls](FLIGHT.md) · [World source data](WORLD.md)

## Fly the province

| System | What is in this build |
| --- | --- |
| **World** | LiDAR-derived terrain, a 2025 satellite-colour mosaic, a refined coastline and water, 245 near-detail imagery tiles, 19,465 road segments and 85,866 LiDAR-derived building footprints. Woodland follows land cover with [streamed provincial stand heights](qa/forest-height-stream.md); [roof-centred tree stems are excluded](vegetation-clearance.md). Confederation Bridge, St. Dunstan’s Basilica and both [point light stations](landmarks/lighthouses.md) have custom models. The [Matthew and McLean Heritage Building](qa/souris-mclean.md) in Souris has a measured roof and a reconstructed storefront. The [former railway station in Summerside](qa/summerside-railway-station.md) replaces the old flat massing with a survey-informed exterior. Surveyed roof planes refine 108 existing outlines across [Kings](qa/kings-neutral-roofs.md), [Prince](qa/prince-neutral-roofs.md) and [Queens](qa/queens-neutral-roofs.md) counties, including a [Charlottetown gable checked against raw LiDAR](qa/queens-survey-roof.md). [Fifty-nine large roofs](qa/large-roof-tone.md) use colour from the verified 2025 satellite mosaic. [Hangar 4 at Slemon Park](qa/hangar-4.md) has a measured roof silhouette and lower annexes. Both lighthouse approaches use [higher-resolution measured coastal relief](coastal-relief.md). [South Lake](qa/south-lake.md) uses sheltered water shading without changing the shoreline. |
| **Aircraft** | An original single-engine high-wing survey plane, with an animated propeller, [moving ailerons and elevators](qa/control-surfaces.md), a modeled cockpit, graduated flight instruments and synthesized engine audio. |
| **Flight** | Fixed-step civilian flight model, density-adjusted airspeed, angle-of-attack stall behavior, ground roll and runway landings. Runway departure presets and scenic starts across all three counties. |
| **Navigation** | Atlas with position and heading, true-heading and airspeed displays, plus chase, cockpit and wide-chase views. |
| **Inputs** | Keyboard, touch controls and browser-standard gamepads. |

**A first route:** Begin at Cavendish, hold a shallow bank to follow the shore, and switch to cockpit view with **V**. Open the atlas with **M** and reposition to East Point for a contrasting coast. For a ground departure, select Charlottetown or Summerside and follow the [pilot guide](FLIGHT.md).

**Cavendish scenery in one step:** Select **Cavendish Dunelands · coastal pass**, then **Enable Cavendish detail**. This selects six compatible local studies without changing the other scenery settings. [What the pack enables](qa/cavendish-package.md).

**Waterfront approaches:** Choose **Basin Head · low pass**, **Summerside waterfront · low pass**, or **Georgetown harbour · low pass** in the departure menu to start offshore facing the local scenery. [Basin Head and Summerside flight checks](qa/waterfront-departures.md) · [Georgetown exterior and flight check](qa/st-davids-church-study.md). The [Georgetown school wall finish](qa/georgetown-school-walls.md) removes a misleading upper window band on three reference-checked faces.

The [Panmure Head lighthouse study](qa/panmure-detached-exterior.md) is a standalone artist preview, not a replacement for the current scenery. The live [Panmure coastal pass](qa/panmure-pasture.md) includes a separately source-checked 2020 pasture interior, not the studio tower.

**Dalvay Lake · coastal pass** starts over the Gulf in Queens County. The optional [lake reflection preview](qa/dalvay-lake-optics.md) adds wind ripples and sky reflections without changing flight contact or the shoreline. The separate [manor exterior preview](qa/dalvay-exterior.md) adds its gables, covered veranda and rounded dining room.

**Seacow Head · coastal pass** starts offshore facing the Bedeque Bay lighthouse. Standard now shows the [authored white octagonal tower, red gallery and glazed lantern](qa/seacow-standard/) on this route. Use `?stockSeacowExterior` to compare the old generic building. The shore and nearby building are unchanged.

The [Cape Egmont lighthouse studio](qa/cape-egmont-detached.md) is a separate Prince County model with unverified placement; it does not alter the live island.

**Tracadie Bay · marsh pass** starts over one of [three mapped coastal marsh patches](qa/coastal-marsh.md). Get close to see wind-laid grasses; the patch layer is also available at Cascumpec and Morell in Standard.

**Cape Tryon · cliff pass** starts offshore in Queens County. It passes the [repaired headland shoreline](qa/cape-tryon-coast.md), while keeping the original tower and flight surfaces. Standard includes the [original sandstone finish](qa/cape-tryon-stone.md) on the same signed coastal surfaces; choose **Turn off Cape Tryon sandstone** or use `stockCapeTryonRock` to compare. A separate [opt-in cliff-seat preview](qa/cape-tryon-sky-seat.md) reduces specified north, grazing and east openings without changing Standard or the flight surfaces.

Three additional [close-flight field-image joins](qa/inland-close-field-joins.md) remove straight raster tile lines without changing the landform, field boundaries or flight model.

### Scenery previews

In Dispatch, choose **Use detailed preview** to enable the [curated profile](qa/scenery-profile.md). Use **Use standard** to return without losing your departure. For individual comparisons, these flags also work on their own:

| Area | Preview flag | What to look for |
| --- | --- | --- |
| West Cape, Eastern Kings and Hermanville | `?stockRegionalWind` | Standard includes [74 earlier turbines](qa/regional-wind.md) and [seven Eastern Kings Phase II turbines](qa/east-point-phase-ii.md). Select **Eastern Kings · turbine skyline** to see both local arrays. Use `?stockEastPointPhaseII` to compare without the new turbines. The earlier arrays retain their [moving blade shadows](qa/regional-wind-rotor-light.md). |
| North Cape | `?stockNorthCapeWind` | Standard streams [all 16 commercial turbines](qa/north-cape-turbines.md) near the [wind farm low pass](qa/north-cape-departure.md). The flag hides them; `?northCapeWind` retains the older shadow study. |
| North Cape woodland | `?departure=northcape-wind-low&northCapeStandReview` | [Dated spruce-and-fir appearance comparison](qa/north-cape-stand/). It only shows during the low-pass Chase view. Standard is unchanged unless you opt in. |
| Summerside | `?spinnakersPreview&northBaywalkPreview&baywalkConcrete` | [Historical Spinnakers’ Landing integration](qa/spinnakers-landing.md), the [surveyed court and ramp](qa/baywalk-court.md), and the [mapped concrete approach](qa/baywalk-concrete.md). |
| Inland grassland | `?stockMeadow` | Compare [the close open-ground material](qa/meadow-texture.md) on an **inland meadow pass** in Prince, Queens or Kings. |
| Basin Head beach | `?stockBasinSand` | Compare [Standard’s pale Singing Sands material](qa/basin-head-sand.md) with the original sand on the low pass. |
| Basin Head | **Open inlet preview** in Dispatch, or `?departure=basin-head-low&basinChannel` | The [measured inlet, footbridge and Cannery](qa/basin-head-cannery.md) are a separate water-and-ground view. **Close inlet preview** returns to the original view. The [outer wharf](qa/basin-head-outer-wharf.md) still needs its separate flag. |
| Great George Street, Charlottetown | `?departure=harbour-low&basilicaExteriorStudy` | See [St. Dunstan’s Great George Street frontage study](qa/basilica-exterior.md): three recessed entrances, twin steeples, original sandstone and roof finishes. Optional frontage only, not a surveyed replica. Add `&basilicaYardSun` for its [shadow across the court, street and sidewalks](qa/basilica-yard-sun.md). |
| Charlottetown | `?beaconsfieldReview` | The [Beaconsfield Historic House exterior](qa/beaconsfield-review.md), an aerial art preview near the waterfront, with [measured ground contact](qa/beaconsfield-contact.md) in low local views. Add `&stockBeaconsfieldGrade` to compare the same house over the original ground. |
| Montague | `?montagueFoundationPreview&departure=montague-bridge-low` | Fly the [curved Main Street bridge](montague-bridge-preview.md) from a low river approach with the bridge to your left. Landscape view recommended. |
| Charlottetown · runway 03 | `?stockRunway03Pavement` | Compare Standard’s [filtered asphalt finish](qa/charlottetown-runway-03.md) with the older flat surface. Runway marks, position and controls are unchanged. |
| Dalvay-by-the-Sea | `?departure=dalvay-lake-coastal-pass&dalvayExteriorStudy` | [Documentary manor exterior](qa/dalvay-exterior.md). The historic footprint and existing surroundings stay in place. |
| Dalvay Lake | `?departure=dalvay-lake-coastal-pass&dalvayWaterOptics` | [Wind ripples and sky reflections](qa/dalvay-lake-optics.md) on the verified interior. `&stockDalvayWaterOptics` keeps the original lake appearance. |
| Souris · Knight Point | `?departure=souris-waterfront-pass&sourisKnightExterior` | [Souris East lighthouse](qa/souris-knight-exterior.md), with a tapered white body, red bracketed gallery and domed glazed lantern. The shore and ground are unchanged. |
| Georgetown | `?stDavidsChurchReview&buildingShadows` | [St. David’s United Church](qa/st-davids-church-study.md): survey-fitted gables and tower, original Gothic sash and a matching shadow caster. Use Standard. |
| North Rustico Harbour | `?stockRusticoLighthouse` | Compare Standard’s [survey-fitted lighthouse and local seat](landmarks/north-rustico.md) on **North Rustico Harbour · coastal pass**. The explicit `?northRusticoLighthouseStudy` retains the older bundled view. |
| Indian River | `?indianRiverReview` | [St. Mary’s exterior and local grade](landmarks/st-marys-indian-river.md). Choose **Indian River · country pass**. |
| Point Prim | `?stockPointPrim` | Standard shows the [surveyed-era lighthouse and measured dry ground](point-prim-study.md). Choose **Point Prim · lighthouse pass** for a virtual 72 m offshore approach. |
| Hog Island | `?hogIslandPhotoStudy` | [Dated aerial surface detail](qa/hog-island-photo-study.md). Choose a west or east **Hog Island · dune pass**. |
| Mapped Prince County grassland | **Open landscape preview** in Dispatch | Select **Prince County · grassland pass** for [measured contours across a continuous 6.55-hectare field](qa/prince-field-contours/). Local terrain and ground contact change; the rest of Standard stays selected. |
| Measured dry ridge, Kings County | **Open ridge preview** in Dispatch | On **Kings County · coastal ridge pass**, the [2020 source-backed ridge](qa/kings-ridge-ground-preview/) changes the terrain shape and local ground contact without changing the other Standard settings. |
| St. Mary’s and the ground at Indian River | **Open ground preview** in Dispatch | Select **Indian River · country pass** for the [separate, survey-informed church and ground preview](qa/st-marys-ground-preview/). It changes local ground contact but preserves other Standard settings. |
| Founders’ Food Hall, Charlottetown | `?stockFoundersWestWall` | Compare Standard’s [three rounded railway-end bays](qa/founders-west-standard/) on **Charlottetown waterfront · low pass**. The roof, neighbouring façades and original geometry are unchanged. |
| Green Gables House | `?stockGreenGablesHouse` | Compare Standard’s [survey-fitted house exterior](art/green-gables-house.md) on **Cavendish Dunelands · coastal pass**. The explicit `?greenGablesReview` remains available on the other eligible Cavendish passes. |
| Green Gables grounds | `?stockGreenGablesBarn` | Compare the original massing with Standard’s [survey-fitted Barn and adjoining wing](art/green-gables-barn-review.md). |
| Cavendish Dunelands | `?cavendishWaterReview` | [Lake of Shining Waters, 2020 freshwater core](qa/cavendish-water.md). Choose **Cavendish Dunelands · coastal pass** for an offshore start. |
| Near Green Gables | `?gablesTrailReview` | [Mapped gravel connection](qa/gables-trail.md), with short-scale grain on the existing terrain. |
| Southwest of Green Gables | `?gablesFairwayReview` | [Source-fenced fairway colour](qa/gables-fairway.md) on the verified open ground, without moving the path or golf boundary. |
| Southwest of Green Gables | `?gablesGradeReview` | [Survey-supported dry rise](qa/gables-southwest-grade.md), a close-range correction to terrain and contact in one small area. |
| Greenwich Dunes | `?stockBowleyPond` | Compare Standard’s [surveyed 2020 Bowley Pond water core](qa/bowley-water.md) with the original dry rendering on **Greenwich Dunes · coastal pass**. |
| Prince, Queens and Kings | `?cropRowsReview` | The [field surface preview](qa/crop-preview.md) adds close soil relief at three selected locations. |
| Selected grassland across PEI | `?sourceGrassStudy` | [Source-backed ground vegetation](qa/province-grass.md) in all three counties, with representative **grassland passes**. |
| Kings County mapped farmland pass | Standard, on that departure | Close furrows use the verified field mask and scanned generic relief on one original terrain tile. Other departures and Detail keep their existing appearance. |
| Queens County fields low pass | Standard, on that departure | The mapped fields get the same close furrow finish on their original terrain draw only during this route. |
| Prince County mapped farmland pass | Standard, on that departure | A separate mapped corridor keeps visible field rows across successive close views; the earlier Prince fields low pass still exists as a comparison. |
| Selected fields across PEI | `?provinceFieldsReview` | [Expanded farmland](qa/province-fields.md) adds close-range furrow shading within 76.27 km² of source-qualified field interiors. Select it in Standard Dispatch; it is off by default. |
| Gravel roads across PEI | `?stockGravelSurface` | Compare Standard’s [close gravel material](qa/gravel-surface-study.md) on 2,651 verified non-bridge road records. |
| One surveyed roof west of Summerside | `?stockPrinceSurveyRoof` | Compare the original flat building with its [surveyed cross-ridges and stepped roof](qa/prince-survey-roof.md). Use `?stockPrinceRoofContact` to keep that shape while switching off [local roof-contact shading](qa/prince-roof-contact.md). The façade remains unsurveyed. |
| Four mapped gravel-lane sites | `?mappedLaneCanopyStudy` | [Canopy placement study](qa/mapped-lane-canopy.md): hides the exact game-generated trees and shadows in surveyed open lane centres. Standard only. |
| Distant PEI coast | `?stockAerialPerspective` | Compare [Standard daylight haze and sea horizon](qa/aerial-perspective-study.md) with the original fixed mist. |
| Borden-Carleton | `?stockBordenCoast` | Compare the [local shoreline-gap repair](qa/borden-shoreline.md) in Standard. The original coast stays in place when the render state cannot safely apply the repair. |
| Orby Head | `?stockOrbyCoast` | [Shoreline gap repair](qa/orby-shore-closure.md): Standard closes known mask-cell gaps below the cliffs. The flag restores the inherited coastline wall. |
| Close satellite-image boundaries in all three counties | `?stockCountyOrtho` | Standard softens the [Souris, western PEI and Queens County tile joins](qa/county-aerial-joins.md) using only the neighbouring image pixels. This switch restores those three old seams; `?stockTracadieOrtho` independently restores the [Tracadie Bay seam](qa/tracadie-aerial-join.md). |
| Inland field edges in all three counties | `?stockInlandOrtho` | Standard corrects eight short, source-checked inland windows. See the [original two](qa/inland-aerial-joins.md), [expanded Prince and Kings joins](qa/expanded-inland-aerial-joins.md), [Queens joins](qa/queens-aerial-joins.md), and the [shared-tile edge](qa/dual-edge-aerial-join.md). The switch restores the original tile-clamp sampling at these inland windows only. |
| Kings County coastal ridge | `?kingsDryCrownStudy&departure=kings-coastal-ridge` | [Measured dry ridge](qa/kings-dry-crown.md): 2020 LiDAR terrain with matched contact and a distant fade. Standard only. |
| Ordinary beach and cliff surfaces | `?shoreToneStudy` | [Tint compatibility study](qa/shore-tone.md): smooths visible colour steps only on affected renderers. Standard only. |
| Coastal optics shortcut | `?coastalOptics` | [Coastal optics](qa/coastal-optics-profile.md) in Optional scenery studies applies the separately tested coastal views together. Standard only. |
| Exposed Prince and Kings shores | `?stockOpenCoast` | Compare [local coastline gap repairs](qa/open-coast-closure.md) without disabling the nearshore foam. For Kings County, the [Panmure Head coastal pass](qa/panmure-open-coast.md) also has a repaired headland approach. |
| Exposed Prince and Kings shores | `?stockNearshoreFoam` | Compare [Standard’s small moving breaker groups](qa/nearshore-foam-study.md) on **Prince County · open shore pass** or **Kings County · coastal ridge pass**. The flag retains the previous water look. |
| Four offshore areas | `?stockOpenRipples` | Compare [open-water ripple variation](qa/open-water-ripples.md), independent of the coast mask, wave foam and physical sea surface. |
| Charlottetown, Summerside and Souris | `?townWallStudy` | [Expanded town façades](qa/town-wall-study.md) extends Standard’s existing close-wall treatment to wider areas. |
| Queens and Kings woodlands | `?stockRegionalCanopy` | Compare [measured canopy infill](qa/regional-canopy.md) on the two **woodland passes** in Standard. |
| Miscouche woodlot | `?stockMiscouche` | Compare the [bounded canopy infill](qa/miscouche-canopy.md) on **Miscouche · woodland pass** in Standard. |
| Standard woodland | `?stockCanopyLight` | Compare [directional tree-crown lighting](qa/canopy-light-preview.md) with the original diffuse canopy. |
| Qualified coastal grass | `?stockDuneGrass` | Compare [Standard’s close coastal grass material](qa/coastal-grass-surface.md) with the original diffuse ground. |
| Woodland passes in all three counties | `?woodlandView` | [Woodland scenery view](qa/woodland-scenery-view.md): forest surface, close bark, near conifers and a down-looking camera. Press **V** to cycle to **Scenery**. [How nearby tree draws are reduced without thinning the forest](qa/woodland-volume-cull.md). |
| Across PEI | `?legacyShoreArcs&shoreFoamDetail&canopyLight&forestFloor` | [Coastal seam repair](qa/legacy-shore-arcs.md), [shore break](qa/shore-foam-detail.md), [canopy light](qa/canopy-light-preview.md) and [woodland floor variation](qa/forest-floor-preview.md). Standard uses broken shoreline crests; `?stockShoreFoam` restores the original foam. Compare the [mapped open-ground material](qa/meadow-texture.md) with `?meadowTexture`. |

**Optional scenery studies** in Dispatch offers the Beaconsfield and Green Gables exteriors, the Dunelands freshwater core, North Rustico lighthouse, St. Mary’s exterior, Hog Island aerial detail, Ground vegetation, Close grass detail, and both farmland studies without editing the URL. Enable both Cavendish studies and choose **Cavendish Dunelands · coastal pass** to try them on the same route. Use the original Prince, Queens or Kings County **fields low pass** for the three-site field preview, or [fly the mapped Kings County pass with Expanded farmland](qa/province-fields.md#fly-the-mapped-kings-county-pass). The three county **dry dune passes** show [verified near-ground sand detail](qa/dry-dune-surface-detail.md) in Standard. In Standard, [Ground vegetation and Expanded farmland](qa/province-land-surfaces.md) can be enabled together.

[Standard close-wall detail](qa/town-wall-core.md) now fits window spacing and subtle wall finishes in the cores of three towns, without changing their outlines or roofs. Optional scenery previews are regional.

In Prince County, the **Summerside waterfront · low pass** shows a [measured raised boardwalk and seven roof sections at Spinnakers’ Landing](qa/summerside-standard-wharf.md), alongside the railway station and survey-fitted roofs [along Water Street](qa/summerside-measured-roof.md), [north of downtown](qa/summerside-north-roof.md), and [in western downtown](qa/summerside-west-roofs.md) in Standard. Beside Water Street, [one survey-cleared storefront site](qa/summerside-water-open-ground.md) removes an unsupported tree without changing nearby vegetation.

Try the terminal wall study with `?departure=spinnakers-low&summersideTerminalWallPreview`. It replaces the generic office-window pattern with an original industrial finish, informed by a [2005 harbour aerial](https://publications.gc.ca/collections/collection_2024/mpo-dfo/Fs74-50-2024-2-eng.pdf#page=79). No photo pixels are used. The roof, building outline, terrain, shoreline and flight physics are unchanged. Add `&stockSummersideTerminalWalls` for the stock finish on the same route.

In Queens County, the **North Rustico Harbour · coastal pass** includes a [dated roof-colour correction](qa/rustico-harbour-roof.md) on one harbour building. Its existing gable, neighboring lighthouse and terrain are unchanged. The separate [Doiron Fisheries entrance study](../tools/art/north-rustico-doiron-storefront/) documents a modelled historical storefront segment; it is not installed in the flight build.

In western PEI, **O’Leary · railway station pass** is a fictional low sightseeing departure. Standard shows a [source-informed warm-grey roof at Access PEI](qa/oleary-access-roof-tone.md); choosing the separate exterior studies preserves their original shared draw. Add `?departure=oleary-railway-low&olearyExteriorStudy` to see the [original station exterior](qa/oleary-station-exterior.md), with a dated reference ledger and matched close and distant views. The [neighboring industrial building study](qa/oleary-industrial-context.md) separately replaces one oversized stock block with its surveyed shed-and-tower form. A separate [stepped warehouse study](qa/oleary-warehouse.md) restores two low roof bands and a small side mass without replacing either neighboring exterior.

For a low offshore approach in Kings County, choose [Souris · waterfront pass](qa/souris-waterfront-pass.md) in Dispatch. Near Main Street, Standard scenery uses the [survey-backed exterior at 77 Main](qa/souris-east-exterior.md) in place of the old flat block. On the hill, [one verified southwest wall](qa/souris-west-facing.md) replaces generic windows with original red masonry. The [St. Mary’s twin-tower study](../tools/art/souris-st-mary-study/) is separate; its terrain placement is not approved.

## Detached art and material fixtures

The [Charlottetown Flight Service Station exterior study](../tools/art/charlottetown-fss-exterior/) shows the dark canted cab, pale shaft shoulders and stepped lower annex at both close and flight size. It is not a surveyed replacement and is not mounted in the simulator.

Original Three.js exterior studies for [Province House](qa/province-house-study.md),
[Summerside City Hall](../tools/art/summerside-cityhall-study/README.md), and the
[Lefurgey Cultural Centre](../tools/art/lefurgey-study/README.md) remain
separate from the playable atlas. The
[Green Gables gravel fixture](qa/gables-gravel.md) is a material test,
not a courtyard reconstruction.
