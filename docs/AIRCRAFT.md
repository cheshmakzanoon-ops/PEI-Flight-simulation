# Aircraft development and validation

The current survey aircraft is fictional. Its panel, exterior and handling are
development assets, not a replica or a training aid. Changes to art and changes
to handling are reviewed independently.

## Reference airframe

Use one documented high-wing single-engine aircraft as a reference, rather than
mixing dimensions and performance numbers from different variants. The
[Textron Cessna Skylane](https://cessna.txtav.com/en/piston/cessna-skylane) is
the candidate performance reference. Select the exact variant and flight-manual
revision before calibration. Do not introduce manufacturer branding or use
unlicensed manuals, artwork, textures, or geometry as shipping content.

| Area | Review evidence required |
| --- | --- |
| Exterior | Front, side, three-quarter and underside comparisons at matching focal length. Measure span, length, incidence, gear clearance and tail geometry against dimensions for the specific variant. |
| Cockpit | Seated eye-point and field of view, readable instrument states, correct needle response and working input. Review daylight and low-light captures. |
| Dynamics | Record mass, configuration, CG, density, wind, control schedule and step size for each scripted case. Target reference stall, climb, cruise, glide, takeoff, touchdown and braking values only under matching conditions. |
| Handling | Validate accelerated stall, recovery, coordinated bank, sideslip and crosswind touchdown as separate cases. Compare entertainment assists on and off when implemented. |

## Current validation

The covered flight regressions are both PEI runway departures, an accelerated
stall and recovery, a continuous 182 km island crossing, and a Charlottetown
flare and stop. Unit tests also check standard-atmosphere density and the
relationship between true and equivalent airspeed. Passing these checks is
not evidence that the model matches the reference aircraft.

Read the [FAA handbook](https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak)
for definitions and the difference between flight principles, instrument
indications and published aircraft performance.
