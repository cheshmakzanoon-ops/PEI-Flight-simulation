# North Cape commercial wind farm

Add `?northCapeWind` and choose **North Cape**. The same Western PEI map
now shows the commercial array's 16 V47-660 turbines, not repeating props
scattered on the landscape. The inland and coastal groups follow their
attributed source positions. No map boundaries or aircraft handling change.

[Before and after: actual fixed-camera frames](north-cape-comparison.webp) · [Graphics gate](north-cape-render-gate.json)

## What follows the records

- [Natural Resources Canada's Canadian Wind Turbine Database](https://open.canada.ca/data/en/dataset/79fdad93-9025-49ad-ba16-c26d718cc070)
  records NCW1–NCW16, 50 m hubs and 47 m rotors. The
  [scope and exact workbook receipt](../../data/north-cape/locations.json)
  includes the two eight-unit commissioning phases. The
  [PEI Energy Corporation 2025–26 report](https://www.princeedwardisland.ca/sites/default/files/f755/PEIEC%20ANNUAL%20REPORT%202025-26.pdf)
  independently confirms the operating commercial group at publication.
  This pass excludes nearby Aeolus and research equipment.
- [Independent checks on native 2020 CanElevation returns](../../data/north-cape/registered-returns.json)
  find structure heights above local grade within 2 m horizontally of all 16 source
  points. For 14 points there are returns within that radius and 46–56 m
  above grade. That does not identify the shaft centre, foundation extent,
  or current blade state. Coordinates are not snapped to the vegetation,
  access roads, or an independent map; the latter differs by up to about 12 m.
- The tower, fairing, blades, hardware and weathering are original
  external models; no manufacturer geometry or photos are redistributed.
  Published [Vestas technical specifications](https://ledsjovind.se/ventosum/Vestas_V47.pdf#page=20) reference the tapered tower proportions and nominal 28.5 RPM clockwise (front view). [Larry’s July 2016 photo](https://commons.wikimedia.org/wiki/File:North_Cape_Wind_Farm,_PEI_(27736815083).jpg) ([CC BY 2.0](https://creativecommons.org/licenses/by/2.0/)) served as a historical visual check only.
  The wind heading is scenic and fixed, the rated-clock rotor view is
  illustrative, and this is not a live wind or obstacle-avoidance feed.

## Render and contact

Each mast follows the actual submitted ground facet when terrain detail
changes, rather than floating at the old mesh height. The
[seat audit](north-cape-ground-gate.json) records the base positions and
ground samples at three levels, not a survey of foundation heights.
Instanced mast and rotor meshes are batched at two distances. The same
47 m swept area is retained at both. Independent [runtime alignment checks](north-cape-contact-gate.json) found all 16 mast and 16 rotor instances at the checked native, intermediate and far world levels. RGB changes on the road are from the same live shadow phase as the ground. The [normal compiled departure](north-cape-flight-gate.json) enters flight and pauses with all 16 registrations, with no JavaScript or renderer errors. The original satellite image, roads,
terrain triangles, foliage, collisions and flight model stay in place.
Shadows are local optical projections on existing ground and road material.
They fade at distance and do not create a physics surface.

This is a preview of the measured array, not a finished North Cape
landscape. Forest, roads, low-resolution surrounding ground and smaller
structures retain their previous scenery and fidelity.

## Rebuild and compare

```sh
python tools/geodata/extract-north-cape.py /path/to/Wind_Turbine_Database_en.xlsx
npm run check
python tools/qa/north-cape-frames.py --checkout . --out /tmp/north-cape-frames \
  --chromium /path/to/chromium
```

Contains information licensed under the
[Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
Sources: Natural Resources Canada Canadian Wind Turbine Database and local
CanElevation verification. See the in-repository receipts.
