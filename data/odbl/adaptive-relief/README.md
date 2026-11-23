# Adaptive relief mesh-selection data

The bit mask included at the beginning of each range member does **not**
contain original elevation data or source feature shapes. It says which
inland mesh cells can change without touching the published road, building,
vegetation, or protected coast. The bit masks are available under the
[Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/)
as a precaution for the selection derived in part from building exclusions
and planted belts. © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)
for the OpenStreetMap inputs identified in our
[building](../../../public/world/buildings/index.json) and
[hedge attribution](../../../docs/WORLD.md).
The independent bare-earth height samples after the mask are from Natural
Resources Canada under the
[Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
Other source-layer licences are unaffected.

The complete compiled selection and height data
[are available here](../../../public/world/terrain-adaptive/v1/), without an
API key. The [bake](../../../tools/terrain/select-adaptive-relief.py) and
[pack](../../../tools/terrain/pack-adaptive-relief.py) scripts reproduce the
selection. Each member starts with 1,568 bytes: bit 0 is the first of the
112 × 112 parent cells, in north-first row order, least significant bit
first in each byte. Heights follow as 385 × 385 little-endian signed int16
decimetre samples, row-delta encoded modulo 65,536, with -32,768 meaning no
observation. These independent components remain distinct in each gzip
member. See the [QA document](../../../docs/qa/adaptive-relief.md) for
coverage and caveats.
