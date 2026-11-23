# Powered climb envelope

The old thrust curve could deliver 188 kW of useful propulsive power without
losing power with altitude. That exceeded the reference engine's **shaft**
rating before accounting for propeller losses. In the revised flight model,
the same full throttle gives less shaft power in thinner air. The propeller
disc accelerates the air instead of supplying a fixed thrust independent of
the power available.

## Measured through the game integrator

```sh
node --experimental-strip-types tools/qa/climb-trial.ts
```

Five independent clean, calm flights at 1,406 kg and full throttle. The
pitch-only pilot holds the specified equivalent speed from 500 m below each
standard-atmosphere pressure-altitude gate. Rate is the time to climb a 50 m
altitude band, with interpolated gate crossings. The 90 Hz game loop is
unchanged; the middle gate also runs at 60 and 120 physics steps/s in CI.
The published speeds are **KIAS**. For the simulation we approximate KEAS from
the charted airspeed calibration; we do not simply equate indicated and
equivalent speed. The calibration chart does not include a full-power climb.

| Pressure altitude | POH target KIAS / trial KEAS | Previous game ft/min | Revised game ft/min | Reference ft/min |
| ---: | ---: | ---: | ---: | ---: |
| 2,000 ft | 79 / 81.1 | 1,515 | 846 | 835 |
| 4,000 ft | 78 / 80.2 | 1,544 | 743 | 750 |
| 6,000 ft | 77 / 79.3 | 1,574 | 644 | 660 |
| 8,000 ft | 75 / 77.5 | 1,586 | 550 | 565 |
| 10,000 ft | 74 / 76.6 | 1,617 | 456 | 470 |

These reference points guided the choice of propeller loss. The improving
trend does **not** demonstrate 3% accuracy elsewhere or establish the
fictional plane’s actual optimal climb speeds. A separate, **unfitted**
90-KIAS normal-climb check exposes a substantial gap: at 2,000 ft the game
climbs **811 vs 625 ft/min** (~30% high); at 8,000 ft, **499 vs 455 ft/min**
(~10% high). Keep these points visible for follow-up on propeller and airframe
drag across speed, rather than changing the speed labels. The game does not
model an actual governor, mixture/flow control, cowl flaps, CG or instrument
error in a climb.

**Sources.** Cessna 182T NAV III / GFC 700 handbook, 182TPHBUS-03 rev. 3:
[non-turbo IO-540 engine and 230 brake hp rating](https://bankstownflying.com.au/wp-content/uploads/2022/08/MJB-C182_G1000-POH.pdf#page=22),
[normal static-source calibration, Fig. 5-1](https://bankstownflying.com.au/wp-content/uploads/2022/08/MJB-C182_G1000-POH.pdf#page=163),
and [standard-temperature climb data, Fig. 5-8, sheets 1 and 2](https://bankstownflying.com.au/wp-content/uploads/2022/08/MJB-C182_G1000-POH.pdf#page=173).
The book’s configuration includes 2,400 RPM, specified full-power mixture
and open cowl flaps. Only mass, ISA, clean configuration, full throttle and
approximately calibrated speed can be matched here.

## Force and energy limits

Our implementation follows [NASA Glenn's actuator-disc momentum relation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/propeller-thrust/).
If the freestream is `V` and the induced speed at the disk is `vi`, the disk
power is `2 ρ A vi (V+vi)²` and the thrust is disk power divided by
`V+vi`. Four Newton steps solve the positive branch. This avoids dividing by
zero at standstill and spends real power accelerating the slipstream even
when the plane itself is not moving.

The 79-inch disk is shared with the renderer and windmilling model. The
171.5 kW shaft ceiling is from the reference aircraft; the normalized density
lapse with 12% fixed friction, the 78–88% shaft-to-disk power allowance and
3,600 N sea-level static blade-load limit are game assumptions. At 80 m/s
full-throttle sea-level flight, useful thrust power is **145.8 kW**,
not 188 kW. CI independently reconstructs the ideal induced work from the
returned thrust and checks the shaft-power bound across speed, density and
throttle. Cutting the engine still removes all powered thrust.

## Player regressions

Both PEI keyboard runway departures, neutral scenic starts, the Charlottetown
flare and braking, and engine-out glide still pass. The 182 km scripted
crossing completes in about **56.4 minutes** at the preset 56% throttle, or
**47.3 minutes** at a specified 75% cruise lever. The lever is a fraction of
available shaft power, not a guaranteed percentage of sea-level rated power.
These are gameplay routes, not real flight-planning figures.
