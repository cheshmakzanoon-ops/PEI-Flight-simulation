# Eastern Kings Phase II skyline

Choose **Eastern Kings · turbine skyline** in Standard. The offshore departure
points northwest toward the older Vestas line and the seven larger Phase II rotors.
This is a virtual sightseeing route, not an aviation obstacle inventory.

## Real-world references

- [PEI Energy Corporation, March 2026 regulatory filing, §14a](https://irac.pe.ca/wp-content/uploads/Exhibit-EC-11-PEIEC-Response-to-IRAC-Interrogatories-March-13-2026.pdf)
  confirms the installed seven ENERCON E-138 EP3 E2s, 108 m hubs, nominal 138 m
  rotors and full output starting December 21, 2025. The
  [April 2025 municipal update, slide 4](https://www.peiec.ca/uploads/6/6/6/4/66648535/rmek_peiec_23-apr-25_final.pdf)
  identifies E1–E7 after the operator reported completing the foundations.
- The [October 2019 public IRAC layout](https://irac.pe.ca/infocentre/documents/Planning-LA20014Phase2_Layout_ProjectProperties-Participating_landowners.pdf)
  gives seven design symbols in an embedded georeferenced PEI stereographic
  map. We transformed the vector symbol centers to WGS84 and cross-checked
  the resulting pattern against all seven built pads in October 2026
  Sentinel-2 L2A true-color imagery. Across usable dates, median optical
  signatures are within 2.1–15.2 m of the respective design positions. Weak,
  view-dependent returns on individual dates can wander farther; a bright
  return may come from the elevated rotor rather than the surveyed foundation.
  These are **approximate scene positions**, not certified as-built coordinates.
- The maker's [E-138 EP3 E2 dimension sheet, D0749798-1](https://uvp.niedersachsen.de/documents-ige-ng/igc_ni/567F3731-41E6-4E72-8F80-9D6F187ABB9B/03.7_Maschinenzeichnungen_rev02_inkl.%20Berechnung%20Versatz%20der%20Achsen.pdf#page=4)
  supplies the unloaded 138.25 m sweep, yaw-axis-to-hub offset and shaft
  inclination. The independent mesh uses those dimensions with original
  shell lofts, paint, tower taper and blade sections. No source drawings or
  images ship in the app. Contains modified Copernicus Sentinel data 2026
  (derived geospatial verification only).

## What ships

Separate model geometry represents the direct-drive drum, low rear bonnet,
tapered tower and three twisted blades. The full rotor sweep is the same at
all three detail levels. A farm uses at most six instanced draws, and the
representative 10.5 RPM drives only the shader clock while the observer is
stationary; this is not live telemetry or a device frame-rate guarantee.

The seven centres and their 56 surrounding collar probes are dry and finite
on the signed, existing game terrain. The highest 4 m collar grade span was
about 0.38 m. The towers follow the active terrain mesh rather than pinning a
single base elevation. The scenery does not redraw the modern pads, utility
infrastructure, vegetation, or terrain. Phase II does not receive the Phase I
custom tower or rotor ground-shadow pass. Existing flight physics and objects
are unchanged.

Use `?stockEastPointPhaseII` to remove only the seven additions, or
`?stockRegionalWind` to remove regional turbine scenery. These controls leave
the independent North Cape scenery alone.

The focused test is `node --experimental-strip-types --test test/east-point-phase-ii.test.ts`.

The historical control uses two more native post-build dates (May 16 and
September 24, 2026) and a pre-build date (October 2, 2023). All seven
source-centred 32 m windows show the compact pad brightness signs in both
post-build acquisitions and none before construction. This is corroboration
of the layout, not a measurement of the bolt circles.
