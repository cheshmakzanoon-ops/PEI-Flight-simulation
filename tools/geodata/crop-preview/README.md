# Rebuild the bounded field optics

Requires NumPy, SciPy, Matplotlib, Pillow and Python GDAL/OGR. Use the
exact AAFC source versions and the checked game assets. Keep all fetched
source files in a scratch directory, not in the repository.

1. Download the [2023 PEI detections](https://agriculture.canada.ca/atlas/data_donnees/fieldBoundaries/data_donnees/gpkg/pe_oneSoil_field_boundaries_2023.gpkg)
   as `pe-fields-2023.gpkg`, and the [2025 PEI classification ZIP](https://agriculture.canada.ca/atlas/data_donnees/annualCropInventory/data_donnees/tif/2025/aci_2025_pe_v1.zip)
   as `pe-crop-2025.zip`. Extract both GeoTIFFs. The exact input digests
   are in the [release receipt](../../../docs/qa/crop-preview-review.json).
2. Get the [Poly Haven Farm Furrows file manifest](https://api.polyhaven.com/files/farm_furrows)
   as `source-farm-furrows.json`. Download the manifest’s 1K JPG
   `Diffuse` and `nor_gl` assets as `ph-farm-Diffuse.jpg` and
   `ph-farm-nor_gl.jpg`. Their original SHA‑256 digests are in the
   same receipt. The packer checks each input against the supplier's pin.
3. From the repository root:

```sh
python tools/geodata/crop-preview/screen-fields.py --source /path/to/scratch
python tools/geodata/crop-preview/bake-pilot.py --source /path/to/scratch
python tools/geodata/crop-preview/pack-furrow-micro.py --source /path/to/scratch
cmp /path/to/scratch/fields-pilot.rgba.gz public/world/fields-pilot.rgba.gz
cmp /path/to/scratch/furrow-relief.webp public/world/furrow-relief.webp
```

The scripts emit only to the scratch directory. The renderer verifies the
checked-in terrain, dry cover, packed and unpacked mask, and material image.
Its footprint and effect can be checked using the two browser tools:

```sh
python tools/qa/crop-preview-frames.py --chromium /path/to/chromium --out /tmp/crop-frames
python tools/qa/crop-preview-motion.py --chromium /path/to/chromium --out /tmp/crop-motion
```

For the separate province area diagnostic, download the [Statistics Canada
2021 cartographic province boundaries](https://www150.statcan.gc.ca/n1/pub/92-160-g/92-160-g2021001-eng.htm)
as `statcan-province-2021.zip` and run `island-crop-area.py` with the same
scratch path. The classification and the seeded-acreage survey do not
measure the same thing; the diagnostic is not an accuracy claim.
