# Georgetown Marine Terminal scenery study

A versioned Three.js/TypeScript asset study for Georgetown’s working waterfront. The current flight simulator does **not** load these assets. They are ready for further art and integration work, not approved replacements for the live waterfront.

## Assets

| Asset | Function | Scope |
| --- | --- | --- |
| Historical outer wharf | `createDetachedGeorgetownOuterPier(sun)` | 116 triangles. Restores the main outer deck under the transit shed at the measured historic height. Open at the landward end. |
| Shore-connection trial | `createDetachedGeorgetownPierV2(sun)` | 658 triangles, one draw. Keeps all four original outer geometry buffers as exact prefixes. Adds the measured approach and a narrow, supported east-side tie; not a surveyed full apron. |
| East-facing finish | `createDetachedGeorgetownPierV3EastFascia(sun)` | Same V2 geometry and vertex program. Adds original matte coping and antialiased dark vertical interruptions only on the documented east side. |
| Transit Shed A envelope | `createDetachedTransitShedA(sun)` | 14 triangles. Replaces the low generic model in a detached test with a pale envelope on the signed footprint and two measured historical roof planes. |

Every factory returns a hidden, unmounted mesh. No factory changes the terrain, coastline classifier, sea, other buildings, flight physics, camera, or collision. Pass the existing normalized daylight vector. A test host owns scene attachment and disposal.

## Evidence and native checks

- **Original ownership.** The outer building is Transit Shed A (`q11220/338`), distinct from the shoreward industrial plant (`q11220/106`). The operator and Transport Canada list a shed about 50 × 12 m. The model preserves the signed outline and uses historical LiDAR for the roof; the historical fit puts the ridge at about 8.96–8.99 m CGVD2013, used as scene height. The earlier simulated ridge was 7.03 m; this is not a present-day survey comparison.
- **Matched flights.** Detached tests use the normal Georgetown Chase view, the original 90 Hz physics, and the same steering input through tick 270. At ticks 810 and 900, the V3-only finish changed 1,237 and 1,507 native RGB pixels, all in the independently marked east-face footprint. The shed swap changed 2,357 and 3,442 pixels inside the original/new shed support. No alpha changes or changes at late control ticks 1350 and 1440.
- **Unresolved approach.** The model reaches original land, but the sampled approach is too narrow to read as a continuous working apron. Its apparent natural depth overlap also obscures 528 and 844 existing 4× raster samples of the plant on those passes. The study leaves both plant geometry and the standard player untouched. A live integration needs a clearer approach, agreed wall/ground treatment, and new native acceptance.
- **Recheck the source.** Run `node --experimental-strip-types --test test/georgetown-marine-terminal-study.test.ts` from the project root. This checks exact packed geometry, material isolation, hidden scene ownership and the shed’s welded roof and wall seams. It does not rerun the matched flight or qualify visual quality.

## Sources

- Natural Resources Canada [CanElevation LiDAR Point Clouds](https://open.canada.ca/data/en/dataset/7069387e-9986-4297-9f55-0288e9676947), Prince Edward Island 2020. Scoped point classifications and aggregates in the original metre-based projection, with CGVD2013 vertical control, support the historical deck, roof and landward trials. Contains information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada). This is not a current survey or a navigation product.
- [Georgetown Port facilities](https://www.georgetownport.ca/facilities.php) and [Transport Canada’s transfer notice](https://www.canada.ca/en/news/archive/2012/06/harper-government-transfers-port-georgetown-benefit-local-economy.html) confirm the separate shed and terminal facility. Their published dimensions are identity and scale references, not placed geometry.
- Hayden Soloviev, [*Georgetown, Prince Edward Island, Canada*](https://commons.wikimedia.org/wiki/File:Georgetown,_Prince_Edward_Island,_Canada.jpg), July 1, 2025, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), verifies the qualitative pale shed and dark interruptions along the photographed outer wharf face. The asset uses original procedural materials, not transferred photo pixels, exact post intervals, or assumed details for unseen faces.
