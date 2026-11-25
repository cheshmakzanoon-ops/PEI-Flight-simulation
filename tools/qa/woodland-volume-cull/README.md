# Reproduce the optional woodland submission comparison

This is a **same-image rendering optimization**, not new tree art. The normal Standard scene does not turn on the optional branched forest. The measurement is the number of original branch-and-sprig triangles in actual indexed instanced draws, not a claim about FPS, CPU percentage, or every forest on PEI.

## Run

Use a full Git checkout containing both the tested release and original commit `3aae365a36ba8cc71c895199d9c82d935d8bcb31`; the latter is used only as a read-only reference. Install the checkout's JavaScript dependencies, Python Playwright, and a compatible Chromium with WebGL2 and multisample rendering. Pillow is required by the simulator's existing fixed-camera tool. No external mapping service, new landscape labels or keys are required. Work and output directories must be outside the checkout.

```sh
ROOT="$PWD"
BROWSER=/path/to/chrome-headless-shell
OUT=/tmp/pei-woodland-cull-review

python tools/qa/woodland-volume-cull/native.py --checkout "$ROOT" --original "$ROOT" --chromium "$BROWSER" --out "$OUT" --sample primary --select Prince Queens Kings
python tools/qa/woodland-volume-cull/native.py --checkout "$ROOT" --original "$ROOT" --chromium "$BROWSER" --out "$OUT" --sample motion --select Queens
python tools/qa/woodland-volume-cull/native.py --checkout "$ROOT" --original "$ROOT" --chromium "$BROWSER" --out "$OUT" --sample grazing --select Prince Queens Kings
```

Additional modes are `v2-parity` (real scene/material overrides and recovery), `precise-agl` (above the actual engine terrain), `near-plane`, `combo`, `rollback`, `high`, `no-msaa`, `town`, and `standard`. Use one software GL process at a time. The published report lists exactly which checks were observed, not every mode the tool offers. The real playable default, flight, camera changes and failure modes have separate compiled-player controls. No screenshot is read as a source map or proof of individual real-world tree placements.

## What is independently compared

* A temporary copy imports the *original* verified renderer implementation from the Git object above. Its four full near-tree groups, admission mask, and grounded-shadow geometry run beside the candidate using identical original simulator inputs. Only the candidate is visible to the camera during the ordinary render. No edits are made to the checkout. Original topology, packed tree prototypes and grounded-shadow code must match the pre-registered hashes.
* Within one JavaScript task, switch original full group geometry onto the same scene meshes with the same material, position, draw order and camera. Read the whole resolved RGBA8 framebuffer; restore the candidate and read it, then swap back and read the original once more. Raw RGBA hashes, GL call counts, original index count and instance count are recorded. A bare-tree and isolated-tree control ensure a positive is not just a disconnected artwork or hidden source.
* Check the full admission and grounded-shadow masks and receiver attributes, preserved per-variant row order including lift, and all 3D positions of each omitted original crown with nonzero fragment-eligible fade. A rejected nonzero crown must be entirely outside a single true homogeneous clip plane (not merely have an invisible origin); zero-fade crowns are counted separately. Original crown geometry and the actual continuous crown lift are used, not the optimized bounding boxes.
* Pure camera turns/pitch/roll in the motion suite are applied right before rendering in the same task. The camera then returns to the previous pose. Radius and altitude motion drives the real original vegetation update. Stable camera comparisons count actual GL uploads for vertex attributes. Supplementary bark/crown probes can also read the attributes already bound in GL; they never replace the donor material.
* All observed comparisons require **zero** differing channels across the matched image, exact original recovery, unchanged grounded-shadow buffers, no GL errors and no extra frame draws. Three forward probes separately require visibly rendered branched geometry and fewer actual submitted triangles. `independent-registered-cull.json` records the timing, camera and numerical rules before the candidate existed. Same-hardware, timed, ordinary-frame evidence is needed separately before making a speed claim.

The optional full-circle control can still be selected with `?woodland3D&stockWoodlandVolumeCull`. Neither this switch nor the optimization changes the existing woodland admission radius or promotes the preview into the default simulator.
