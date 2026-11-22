# Clean, zero-power glide

This is a repeatable **game physics** benchmark, not an emergency procedure.
No real aircraft, historical flight recording, browser rendering, or pilot
technique is being tested. The 18 runs call the same integrator as the game.

```sh
node --experimental-strip-types tools/qa/glide-trial.ts
```

## Experiment

Start the fictional survey plane at 1,450 m over a flat surface, heading true
north, with zero thrust, default pitch assist, fixed 1,406 kg mass, its sole
clean configuration, standard atmosphere and explicit zero wind. A feedback
controller uses only the normal pitch input to hold a target equivalent
airspeed. Each target from 66 to 100 KEAS in 2 kt increments gets its own
flight, 85 s of settling and then a 45 s measurement at 90 simulation steps/s.
There is no CG or windmilling propeller model in this baseline.

| Measurement at best sampled range | Result |
| --- | ---: |
| Mean equivalent / true / horizontal ground speed | 78.00 / 82.22 / 81.95 kt |
| Distance / altitude lost | 1,897.2 m / 152.8 m |
| Horizontal distance per metre lost | 12.42 |
| Mean descent rate | 3.39 m/s |
| End minus start kinetic energy, as metres of height | −1.37 m |
| Distance / total mechanical energy height lost | 12.31 |

Holding **equivalent** speed as density increases releases a little kinetic
energy. Geometric range divided by altitude lost therefore exceeds the
airframe polar's peak lift/drag. The energy-height ratio, approximately
12.31, is a separate diagnostic rather than a replacement for measured
range. JSON also reports track, start/end height and speed/sink spreads.
Continuous integration checks for unstable samples and repeats the 78-KEAS
trial at 60 and 120 simulation steps/s.

## What this rules out

The game glides substantially farther than the reference aircraft with a
windmilling propeller. In Cessna’s **182T NAV III, GFC 700** handbook,
182TPHBUS-03, revision 3 (22 Nov 2010), [Fig. 3-1, p. 3-26](https://bankstownflying.com.au/wp-content/uploads/2022/08/MJB-C182_G1000-POH.pdf#page=96)
shows roughly 20 nautical miles from 14,000 ft in still air: about 8.7:1.
The chart specifies flaps up, a windmilling prop and 76 **KIAS** at 3,100 lb.
Its number is a chart read, not an exact measured ratio. This benchmark does
not simulate that propeller drag, pitot/static error or CG. It therefore
cannot establish a match by comparing 78 **KEAS** to 76 **KIAS**. The
[normal static calibration, Fig. 5-1](https://bankstownflying.com.au/wp-content/uploads/2022/08/MJB-C182_G1000-POH.pdf#page=163)
is specified for a different power condition. A drag model must preserve
positive-power behavior while improving measured zero-power range.
