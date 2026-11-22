# Flight model and navigation data

This is a civilian free-flight model for entertainment, not a navigation instrument or training device. Scene coordinates use a metre-scaled WGS84 tangent approximation centred on 46.5°N, 63.2°W. Parallel/meridian curvature at this origin is included, but this is not a global geodetic simulation.

The flight integrator advances at 90 Hz. It models thrust, density, drag, angle of attack, a post-stall lift falloff, banked lift, gravity, light steady wind, wheel friction, and ground contact. Stability assistance blends pilot input into target pitch and bank. There is no exact reproduction of a certificated aircraft, instrument procedure, airport, or weather observation.

### Runway geometry
Three surveyed-data runway strips use the open threshold pairs and reported widths for CYYG 03/21 and 10/28 and CYSU 05/23. Sources: [OurAirports open data and public-domain statement](https://ourairports.com/data/) and [runways.csv](https://davidmegginson.github.io/ourairports-data/runways.csv), retrieved 2026-11-22. No closed strips are represented as active. Strips are fitted to atlas terrain, not aviation elevations; markings and structures are representational. Runway length follows the distance between the published coordinates, not the declared pavement length, which can differ. Scenic spawn positions are editorial camera locations, not waypoints for navigation.
