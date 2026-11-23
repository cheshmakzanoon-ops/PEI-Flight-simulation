# Pilot guide

Use **Begin flight** to take over an airborne survey aircraft, or pick a
runway departure from the selector. The travel map lets you reposition
to the western, central or eastern part of the province without driving
a menu out of the flight scene.

| Control | Keyboard | Standard gamepad |
| --- | --- | --- |
| Pitch and bank | Arrows or WASD; Down/S pulls back | Left stick |
| Rudder | Q / E | Right stick horizontally |
| Throttle | Hold + / − or ] / [ | Right / left trigger |
| Ground brakes | Hold B | South face button |
| Camera | V | Keyboard/UI |
| Pause | P | Start |
| Atlas / help | M / H | Keyboard/UI |

Press a gamepad button after the browser gains focus. A device without a
standard mapping may require OS or browser remapping. Touch controls
provide a stick and change the current power setting.

For a runway departure, set full power, stay near the centreline, and
pull back gently near 65 kt. In flight, begin turns with bank and level
the wings as you reach the new heading. A stall warning means lower the
nose and recover airspeed before resuming the climb. This handbook applies
to the fictional aircraft in this simulator, not to real aircraft.

## Optional engine-out practice

While airborne, open **Pause**, choose **Simulate engine failure**, then
**Resume flight**. The engine no longer provides thrust, but the moving air
keeps the propeller turning and the plane glides more steeply. **ENGINE OUT**
stays on the HUD even when you move the throttle. To end the exercise, use
**Pause → Restore engine power**, then resume; power returns at the current
throttle. Choosing another departure always resets the engine. The
[engineering comparison](qa/ENGINE-OUT.md) documents this game scenario.

## Flight model in development

The HUD and cockpit speed needle follow equivalent airspeed, an approximation
of indicated airspeed for this low-speed aircraft. The simulation uses true
airspeed for motion through the airmass. It computes density from the standard
troposphere and blends lift and drag through separation as angle of attack
increases. The stall cue follows separation instead of an arbitrary speed floor.

This is still an assist-stabilized point-mass model for a fictional aircraft.
It does not yet simulate rigid-body moments, independent control-surface
deflections, flap schedules, propeller slipstream or validated crosswind
handling. See [aircraft development and validation](AIRCRAFT.md).

Engine power now falls as you climb into thinner air. Moving the lever to
the same position does not guarantee the same climb rate at every altitude.
See the [measured flight envelope](qa/POWERED-CLIMB.md) for what has and
has not been matched to the reference.
