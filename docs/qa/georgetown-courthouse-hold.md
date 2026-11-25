# Kings County Courthouse exterior study · held

**The ordinary simulator is unchanged.** This compares the existing Georgetown
Courthouse proxy with an original reconstruction staged only for QA. It does
not evidence precise survey of façade openings, public access or present-day
conditions.

## Registration and evidence

The [Canadian Register entry](https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=7442)
and its map anchor identify the AEB feature `q11220/67`, an 11-point outline with
about 410 m² projected area. St. David’s Church is a separate feature (`/203`)
in the same atlas tile; its geometry and runtime authentication remain separate.
The existing app depicts the courthouse as a four-storey generic box.

A bounded read from the official
[2020 point-cloud collection](https://open.canada.ca/data/en/dataset/7069387e-9986-4297-9f55-0288e9676947)
provided 2,004 usable Class 6 roof returns at least 0.8 m inside this outline.
An aligned 1 m DTM/DSM chip supported the datum and roof-versus-ground separation.
The fitted planes distinguish the main gable, transverse gable and low rear
roof. The p95 training residual was 0.104 m; the p99 residual was 0.774 m,
including some much larger errors at the annex step. This is not an independent
roof validation. The emitted terrain-height datum and registered extent were
left unchanged. No LiDAR point data or source-image pixels ship with the study.

The [province’s 1999 photograph and Harris drawing](https://www.historicplaces.ca/en/rep-reg/image-image.aspx?id=7442)
document the built mirror reversal and west-front character. The north cross
gable is on the observer’s left and the separate doorway is on the south side
of that view. A [documented August 2008 southwest view](https://commons.wikimedia.org/wiki/File:GeorgetownPE_KingsCountyCourtHouse_Angle.jpg)
shows the three arched south windows and attic group. Fascia edges, rock-faced
red/grey sandstone, quoins and red joinery here are original interpretations.
The unavailable porch projection and chimney, newer fittings and unverified
rear fenestration are not inferred.

## Why it is held

An independent reviewer reserved a separate 2008 elevation product. It supported
the west main roof, but the east slope exceeded its predeclared residual limit
and the cross-roof strata were not independently isolated. The low rear roof
and clipped tip were not independently cleared. The archival evidence confirms
the building’s structural character, not all of its numeric roof assembly. A [2022–23 provincial report](https://www.princeedwardisland.ca/sites/default/files/publications/ti_2022-2023_annual_report.pdf)
lists a roof-replacement project after the 2020 scene date; modern photos are not
used to certify the earlier roof finish or dimensions.
The reconstruction is consequently not installed in the ordinary simulator.
Revisit with
another adequate exterior source or a narrower verified component rather than
modifying the model to fit the previously withheld observations.

## Staged renderer checks

The detached Three.js study uses 2,971 triangles and eight draws while visible.
All 6,487 interior roof rays agree with its design equation to floating-point
precision, without changing the 410.190 m² registered footprint. This checks the
implementation, not its independent geographic validity. It retains the existing
church variant in the matching tile, and no yard, road or terrain moves.
The paired 760 × 505 west shot has 131,315 pixels that changed by more than two
RGB codes, with none outside the courthouse ID mask and exact repeated images.

A separate staging run uses the ordinary Georgetown harbour departure and chase
camera, without an injected pose. At about 158 m and 389 m flown, it showed
197 and 482 meaningful changed pixels respectively at approximately 62–64 m
altitude. These were tests of the detached asset, not a release into normal flight.

The [offline studio archive](../../tools/art/georgetown-courthouse-study/) retains
the checked model source without adding it to the game. It can reproduce the
same geometry buffers and two model silhouettes without a network connection.
