# Quartermaster Marina shoreline source data

[© OpenStreetMap contributors](https://www.openstreetmap.org/copyright). This isolated dataset and its derivative raster are licensed under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/).

- `coast.json` contains the selected, ordered positions from [OSM coastline way 251166158, version 30](https://www.openstreetmap.org/way/251166158/history). The source direction distinguishes the land and water sides. The file excludes the unrelated entries and user/uploader metadata in the original extract.
- The separable raster is [quartermaster-coast.rg.gz](../../../public/world/harbour/odbl/v1/quartermaster-coast.rg.gz). Its two channels store a signed visual-mask distance and its local taper. It is not a merged copy of the province atlas, aeronautical or marine navigation data, bathymetry or a dock footprint.
- Rebuild from this record with `/usr/bin/python3 tools/terrain/bake-quartermaster-coast.py` (NumPy). The resulting footprint is deliberately inset and may only add water to the simulator's baseline mask. The [implementation and evidence notes](../../../docs/qa/quartermaster-coast.md) describe the restrictions.
