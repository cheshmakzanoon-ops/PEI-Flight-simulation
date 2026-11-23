# Dynamic clean stall and recovery

The scripted run measures the fictional survey plane, not real-world stall
recognition, pilot technique or required recovery altitude. No real aircraft was flown.

```sh
node --experimental-strip-types tools/qa/stall-trial.ts
```

Start in [the same calm, clean, 1,406 kg glide](GLIDE-BASELINE.md) at zero
thrust. With the normal pitch assist enabled, a test controller stabilizes at
78 KEAS for 85 s, then reduces the target by 0.75 kt/s with zero commanded
bank and yaw. The speed target is a pitch-control input objective, not an
edit to the airplane's state. At the highest measured lift **coefficient**,
actual deceleration over the preceding second is 0.72 kt/s.

| Recorded event at 90 Hz | Equivalent speed | True speed | Angle of attack | Lift / weight |
| --- | ---: | ---: | ---: | ---: |
| Maximum lift coefficient during entry | 58.44 kt | 61.68 kt | 14.94° | 0.988 |
| First separation flag, 1.06 s later | 57.69 kt | 60.88 kt | 16.59° | 0.700 |

The flag is **not** the lift peak. After the first flag, the QA pilot unloads
with a normalized pitch input of −0.35 until clear and back to 76 KEAS, then
engages the 78-KEAS test controller. The flag clears on the next simulation
step, well before the aircraft returns to its established glide. The trial
requires five continuous seconds within 0.5 kt of the target and a 2.5–4.3
m/s descent rate. It reaches that criterion after 20.64 s and 108.7 m of
altitude loss from the flag; that loss includes the return to a **descending**
glide. It is not a level-flight recovery distance. The JSON includes each
event's altitude, flight-path angle, true/equivalent speed, and the minimum
equivalent speed in the recovery. Tests repeat at 60 and 120 physics steps/s.

Cessna's 182T NAV III GFC 700 handbook (182TPHBUS-03, revision 3), [Fig. 5-4,
p. 5-14](https://bankstownflying.com.au/wp-content/uploads/2022/08/MJB-C182_G1000-POH.pdf#page=167),
lists 54 KCAS aft CG and 56 KCAS forward CG in the clean, power-off, unbanked
3,100 lb cases. Our point mass has no CG, pitched moment, windmilling propeller
or IAS instrument-error model. Its approximately 58.4 KEAS at peak coefficient
is not a measured 182T stall speed. Do not move the separation threshold to
make these numbers superficially match.
