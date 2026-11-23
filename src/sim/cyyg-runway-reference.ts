/**
 * Separate map observations for CYYG 10/28. OpenStreetMap way 28328903 v10
 * (2026-07-09), © OpenStreetMap contributors, ODbL 1.0:
 * https://www.openstreetmap.org/copyright
 * These are mapped centerline ends, not an airport threshold survey.
 */
export const CYYG_10_MAP_LINE = {
  way:28328903, version:10,
  west:[-63.1287619,46.2939305],
  east:[-63.1018945,46.2975541],
} as const;
/** Canada Flight Supplement, 14 May 2026: 7,000 × 150 ft asphalt. */
export const CYYG_10_SIZE = {length:7000*.3048,width:150*.3048} as const;
