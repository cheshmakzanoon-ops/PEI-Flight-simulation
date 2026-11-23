# Moving ailerons and elevators

![Neutral above, commanded right roll and pull below, photographed from the same Three.js fixture](control-surfaces-comparison.webp)

The fictional survey aircraft's ailerons and elevators were previously part
of the fixed wing and tail geometry. They now have separate original skins
which turn about local hinge axes. Right roll raises the starboard aileron
while lowering the port side; the elevators move together when pulling or
pushing. Deflections ease into the commanded pose and back to neutral. Motion
stays still while paused. This is visual feedback, not a change to flight
forces, a replica of a particular aircraft or an animation of the rudder.

## Checks

Run `npm run check`; check neutral, right-pull and left-push in the Three.js
fixture using `tools/qa/control-surfaces.py` against the dev server. The
full-command checks reached the prescribed ±16–21° aileron and ±19° elevator
ranges, within 0.01°. Exact cockpit eye point and dials did not change.

Run `python tools/qa/control-player.py --dist dist --chromium CHROMIUM`
to verify that the normal build's keyboard input moves these surfaces and
that release brings them back to neutral.
