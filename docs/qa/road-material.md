# Low-altitude road materials

The road network keeps its existing geometry, widths, terrain registration,
bridge flags and pavement classes. At close range, the road shader adds
fine aggregate and broader wear to existing surfaces. Two side-distance
tracks and soft shoulder tint are surface details, not painted lane
markings. Grain, track contrast and edge detail fade continuously as they
become subpixel. No external imagery, new request or extra draw is used.
No claim is made about actual potholes, materials, paint, road condition,
or highway engineering.

The extra packed road attribute is two bytes per vertex. A fixed Chromium
East Point comparison held the lens, lighting, clock, seven complete
ortho tile IDs and geometry equal. 270 pixels changed by more than
8/255 in an RGB channel; none of those were outside the visible road
mask and its two-pixel antialiasing allowance. Both renders had
262 draw calls and 287,603 triangles. See the [matched report](road-material-frame.json).
This is appearance attribution, not a physical GPU timing or an
island-wide road-photo comparison.

Reproduce with [the fixed surface harness](shore-foam.md#check-at-the-same-camera-and-clock).
Use the same starting source and geometry in both copies (the reported
comparison was from `9247190` with only the two road-source-file changes).
Use `--mask road` on the baseline mask capture and `--kind road`
in the comparison.
