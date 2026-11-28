# Dated grain-corn scenery source scout

The simulator’s existing farmland optics are unchanged. This is a reproducible
screen for where a **2025 grain-corn** appearance might be tested, not a crop
export, field condition map, or additional terrain in the player.

The [2025 Annual Crop Inventory](https://agriculture.canada.ca/imagery-images/rest/services/annual_crop_inventory/2025/ImageServer/info/iteminfo)
from Agriculture and Agri-Food Canada identifies **Corn for grain** as class
147 in its [classification legend](https://agriculture.canada.ca/atlas/data_donnees/annualCropInventory/supportdocument_documentdesupport/aci_crop_classifications_iac_classifications_des_cultures.csv).
The [2025 PEI class and confidence rasters](https://agriculture.canada.ca/atlas/data_donnees/annualCropInventory/data_donnees/tif/2025/aci_2025_pe_v1.zip)
mark the class on a native 30 m grid. The separate
[2023 detected outlines](https://agriculture.canada.ca/atlas/data_donnees/fieldBoundaries/data_donnees/gpkg/pe_oneSoil_field_boundaries_2023.gpkg)
are used as a reserve around field interiors, not as a statement of ownership
or what was planted in 2023. No source imagery or individual geometry is
included. Annual Crop Inventory data are made available by the Government of
Canada under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).

The scout authenticates three exact inputs, holds every centre whose 3 × 3
neighbourhood is not consistently class 147 with confidence at least 80,
and retains only samples at least 35 m inside an accepted outline.
The [receipt](grain-corn-native-scout.json) reproduces 190,045 class/confidence
hits, 84,889 centres surviving the 3 × 3 check, and 56,768 distinct centres
inside at least one outlined reserve. This last count includes 242 centres
with overlapping detected outlines, which must not be treated as uniquely
assigned. There are 1,207 outlines with at least nine four-connected surviving
centres. These figures are not acreage or the number of fields available
to the renderer.

Use the three files named and pinned in the adjacent receipt. With Python 3.11+
and GDAL/OGR, NumPy, SciPy and Matplotlib installed:

```sh
python3 tools/geodata/province-fields/screen-grain-corn-native.py \
  --source /path/to/extracted-source --out /path/to/new-receipt.json
```

Retain the distinction between a 30 m classification and a possible 4 m
runtime support lattice. The source says nothing about row angle, variety,
stalk height, harvest date, site-specific colour, or material. Simulator
terrain/ownership, existing crop and grass overlap, and genuine in-flight pixel
tests are separate gates before any new scene treatment can be offered.

The first [stock Cape Tryon flight check](../../../docs/qa/grain-corn/cape-tryon-stock.md)
identifies the portion of the original near ground that is visible to the
pilot. The [geometry admission helpers](corn-seat/) verify that a future
canopy’s roots and swept leaf tips can stay on its signed receiver.

The [detached maize anatomy model](../../art/grain-corn-anatomy/)
provides original blades, sheaths, stems and tassels for future canopy
work. Its close 4× plates are studio renders; the long-range appearance
is not approved and the model is not placed in the simulator.

A separate [offline canopy atlas bake](../../art/grain-corn-atlas/)
turns two authored stands into verified linear colour, coverage, and
associated depth pages. It is an art source tool, not an enabled
flight-distance renderer or a change to the real field.
