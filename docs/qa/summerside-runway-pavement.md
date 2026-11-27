# Summerside runway 05/23: close-range pavement

![Matched real chase-camera frames during the runway roll: flat stock surface at left and filtered pavement at right](summerside-runway-comparison.webp)

Choose **Summerside · runway 05**, begin the flight in Standard, and advance
the throttle. The close pavement now shows restrained surface variation
instead of a single flat colour. Add `stockSummersideRunwayPavement` to that
departure's URL to see the previous material.

The [Slemon Park airport overview](https://slemonpark.com/airport/) describes
the 8,000-by-200-foot paved runway. The
[dated aerodrome entry](https://imageserver.fltplan.com/afd/Canada/03NOV2022/CYSU-2491.PDF)
identifies 05/23 and references asphalt and concrete. The new finish is
original, not a survey of slab extents, seams, wear, or reflectance. No
imagery or airport markings were copied. The existing placement, dimensions,
markings, contact logic, and performance model are untouched.

Only terrain materials intersecting this runway can use the finish. It
checks the original opaque atlas swatch on the CPU, then compares each GPU
sample with the same unmarked reference. A different or mixed paint sample
keeps its original colour. Derivative-filtered grain fades out as the
projected footprint or distance grows. There is no new texture, geometry,
network request, or draw call. Other runways and explicit historical review
scenes use their existing finish.

## Matched browser evidence

The moving replay takes the normal keyboard ground roll, then compares
stock and live at identical simulation timestamps and positions with a two-colour support mask. At 65 m
and 160 m from spawn, it found **67,750** and **60,423** pavement pixels
changed by more than two RGB levels. Respectively **40,638** and **54,201**
fully resolved marking pixels stayed exact. No change occurred outside the
measured pavement support, including alpha. Restoring the live uniform
reproduced the frame byte for byte; draw and triangle counts were unchanged
at each checkpoint. The frozen fine-step close view had a four-code P99
colour difference after a 1.9 cm translation, within the six-code gate. In a separate Charlottetown ground-roll check, the complete PNG and both ownership controls were identical. The explicit stock selection and a corrupt source swatch never compiled or drew the Summerside shader.

The browser used WebGL2 with SwiftShader. This is evidence of scoped
appearance and repeatability, not of device FPS, navigation accuracy, or
pilot-training suitability. See the [native ground-roll replay and controls](summerside-runway-replay.json).

To repeat the ground-roll check, build and serve the compiled player, install
the browser dependencies used by the hosted replay, and run:

```sh
PREVIEW_URL=http://127.0.0.1:4173/ node tools/cysu05-pavement-smoke.mjs
```

The far fixed camera at 1,280 m saw 37,287 marked runway-support
pixels and no RGB change. To reproduce the separate close translation and
distant checks with a local Chromium and the Python QA dependencies:

```sh
python tools/qa/cysu-pavement-fixed.py --checkout . --deps ./node_modules \
  --chromium /path/to/chromium --views near05 --out /tmp/pei-cysu-near
python tools/qa/cysu-pavement-fixed.py --checkout . --deps ./node_modules \
  --chromium /path/to/chromium --views high --out /tmp/pei-cysu-high
```
