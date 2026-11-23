# Distant coastal detail: matched-frame gate

The full local triangle grid stays byte-identical on close approaches.
At the two distant detail levels the decoded, welded substitute follows it
within 0.09 m everywhere inside the measured insert, including between vertices.
This is a bound relative to the close mesh, not LiDAR accuracy. The seam and
contact probes still pass, contact does not depend on camera history, and
returning to near restores the original surface. Both Coast packs and their
fallbacks are unchanged. The precomputed layout adds about 4 kB of compressed
application code and no extra fetch.

A distance test uses the actual scene and locks camera, viewport, water phase,
required aerial texture IDs, and completion of building requests. Across these
four 960 × 540 views, draw-call counts were unchanged. Total scene triangles
were measured with Chromium and SwiftShader; these are **not** hardware FPS
measurements.

| Fixed view | Submitted triangles, before → after | Fewer | Pixels differing by more than 8/255 in any channel |
| --- | ---: | ---: | ---: |
| East Point, 8.5 km | 240,676 → 188,594 | 21.6% | 12 / 518,400 |
| East Point, 22 km | 231,634 → 179,552 | 22.5% | 1 / 518,400 |
| West Point, 8.5 km | 231,386 → 205,280 | 11.3% | 7 / 518,400 |
| West Point, 22 km | 314,487 → 288,381 | 8.3% | 2 / 518,400 |

No tested pixel differs by more than 32/255. The projected height difference
at the native land cells stays below 0.012 px at 1080p in the tested views.
Different times of day, display pipelines or untested poses can differ.
A failure to load matching imagery invalidates the comparison.

[Numeric geometry audit](coastal-lod-geometry.json) · [Matched-frame results](coastal-lod-frames.json)

Reproduce on a checkout of `055b43c` (original complete coastal grid at all
distances) and the current checkout. Use the **current** QA scripts for both.

```sh
python3 tools/qa/coast-lod-poses.py --checkout /path/to/055b43c --out /tmp/pei-lod-before
python3 tools/qa/coast-lod-poses.py --checkout . --out /tmp/pei-lod-after
python3 tools/qa/coast-lod-frame-gate.py --before /tmp/pei-lod-before \
  --after /tmp/pei-lod-after --out /tmp/pei-lod-frames.json
```
