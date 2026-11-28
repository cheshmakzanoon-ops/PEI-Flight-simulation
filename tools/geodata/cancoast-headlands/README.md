# Historical CanCoast material study

A reference check only. The source is Natural Resources Canada's
[CanCoast Coastal Materials 2.0](https://open.canada.ca/data/en/dataset/73714ed4-a795-a7ae-7e93-36100ce7c242),
released in 2019 with catalogue temporal coverage 2010–2011. The exact
layer metadata identifies the Open Government Licence – Canada. Contains
information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
This study is an adaptation, not an NRCan product or endorsement.

The [three WGS84 windows](../../../data/cancoast-headland-study/)
contain clipped horizontal segments with their original textual class.
The extraction verified the whole CRC of just the **materials SHP**
component and checked all 168,326 record offsets and lengths against
the companion index and attribute count. It did not fetch the whole
2.4 GB archive. Sums of clipped approximate segments are not surveyed
unique shoreline lengths.

| Prospect | Use the historical layer can support |
| --- | --- |
| Prince, North Cape | The regional class is sand and gravel. It does not label every exposed rock face or supply a local palette. |
| Queens, Cavendish | Thick and continuous till. No separate dune, beach or red cliff mask. |
| Kings, East Point | Sedimentary rocks and a separate mixed sediment reach; useful candidates, not precise current contacts. |

The stock overlap checks the approximate signed wet/dry field and land
atlas across the historical trace. It does not blend the sources, assign
historical tides or an elevation datum, set present boundaries or change
the game. Before adding an art treatment, independently verify where that
surface is **currently exposed** and capture actual matched controls.

The [PEI-commissioned shoreline classification](https://chrisnewversion.peiclimate.ca/reports/PEI_Geomorphic_Shoreline_Classification.pdf)
describes separate zones. The inspected [public erosion-risk layer](https://services9.arcgis.com/zow9Ot3ujGSyJI3C/ArcGIS/rest/services/Coastal_Change_2024_04_02/FeatureServer/0)
exposes risk, not those material fields. It was not substituted for the
federal material layer.

## Repeat

From the repository root with Node 24:

    node tools/geodata/cancoast-headlands/compare-stock-coast.mjs . data/cancoast-headland-study/segments.json /tmp/pei-headland-overlap-new.json
    cmp data/cancoast-headland-study/stock-overlap.json /tmp/pei-headland-overlap-new.json

Optional upstream replay with curl, Bash and Python 3, in a fresh
directory. It streams about 185 MB from the official archive member
but keeps only the small metadata and local extracts:

    bash tools/geodata/cancoast-headlands/prepare-source.sh /tmp/pei-cancoast-new
    cmp data/cancoast-headland-study/segments.json /tmp/pei-cancoast-new/private-three-headland-segments.json

The [source custody record](../../../data/cancoast-headland-study/source-custody.json)
pins the exact XML, projection, attribute and index files. In the
Cavendish test, parts of the historical line differed from the coarse
stock signed trace by more than 170 m in either direction. In the other
two test boxes the stock distance extrema were within 12 m. Neither
agreement nor discrepancy is a new shoreline or a measure of erosion.
