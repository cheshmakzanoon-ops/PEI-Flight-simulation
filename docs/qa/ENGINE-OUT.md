# Engine-out free-flight scenario

In the air, open **Pause → Simulate engine failure → Resume flight**. The
HUD shows **ENGINE OUT**: moving the throttle still moves the lever, but no
thrust reaches the airplane. The prop turns with the moving air and combustion
audio fades out. Use **Pause → Restore engine power** to return power at the
current throttle. This is an instant game-scenario reset, not a real engine
restart. A fresh departure always has a working engine. Ordinary idle
throttle does **not** trigger a failure.

## Measurements

```sh
node --experimental-strip-types tools/qa/glide-trial.ts --engine-out
node --experimental-strip-types tools/qa/glide-trial.ts
```

Same clean 1,406 kg scenario, ISA atmosphere, still air, feedback pilot, 90 Hz,
18 independent stabilized flights spanning 66–100 KEAS, 45 s measurement window:

| At the best sampled speed (78 KEAS in both sweeps) | Normal zero thrust | Failed engine, prop windmilling |
| --- | ---: | ---: |
| Horizontal distance / height lost | 1,897 / 152.8 m | 1,878 / 212.7 m |
| Geometric range per metre lost | 12.42 | 8.83 |
| Range / total energy-height loss | 12.31 | 8.75 |
| Mean sink | 3.39 m/s | 4.73 m/s |

The [reference 182T handbook, Fig. 3-1](https://bankstownflying.com.au/wp-content/uploads/2022/08/MJB-C182_G1000-POH.pdf#page=96)
suggests approximately 8.7:1 with a windmilling propeller at the chart’s
specified weight and indicated airspeed. This chart guided the effective drag
magnitude: it is **calibration data**, not independent validation. The game
measures equivalent airspeed; its 78 KEAS does not demonstrate fidelity to
76 KIAS. Engine-on climb, shaft power, drag away from this configuration,
propeller RPM response and other weights are not validated by this comparison.

## Model boundary

The [reference specification](https://bankstownflying.com.au/wp-content/uploads/2022/08/MJB-C182_G1000-POH.pdf#page=6)
gives a 79-inch propeller and 2,400 RPM rated engine speed. The game chooses
a 0.90 advance ratio (forward speed divided by revolutions/s times diameter)
and an effective backdrive torque of 130 N·m. Angular velocity rises with
true airspeed, with smooth low-speed engagement and a 2,400 RPM cap. The
resistive power is torque times angular velocity, bounded to 42% of the
incident air power passing through the disk. At zero speed there is no
windmilling force or rotation. These are quasi-steady game approximations,
not measured propeller coefficients, governor response, mixture simulation,
cylinder dynamics or feathering. The powered-airplane force curve is unchanged.

Optional player-level test (Python Playwright and an installed Chromium):
```sh
npm run build
python tools/qa/engine-out-ui.py --dist dist --chromium /path/to/chromium
```
