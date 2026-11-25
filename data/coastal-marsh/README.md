# Pinned coastal marsh polygon source subsets

Contains information licensed under the [Open Government Licence – Prince
Edward Island](https://www.princeedwardisland.ca/en/information/finance/open-government-licence-prince-edward-island).
Source: Resource Inventory and Modelling Section, Forests, Fish and Wildlife
Division, Department of Land and Environment, Prince Edward Island. Dataset:
[Wetland and Sand Dune Inventory 2020](https://gis.princeedwardisland.ca/server/rest/services/Hosted/Wetland_and_Sand_Dune_Inventory_2020/FeatureServer/0).
The files contain bounded public map polygons and category fields, not photographs.
See [receipt and exact checksums](sources.json).

For a deterministic rebuild, copy and decompress the three `*.json.gz` files
to a scratch directory, preserving their underlying `.json` names. Run the
simulator's coastal marsh qualification and packing scripts on that directory.
The browser does not request these reproducibility inputs. It only reads the
locally packaged, source-pinned area mask on a qualified nearby view.
