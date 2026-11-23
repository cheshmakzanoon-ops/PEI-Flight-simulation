# Close texture on mapped open ground

Add `?meadowTexture` to compare the same atlas with fine variation on
eligible terrain labelled grassland in ESA WorldCover. The surface keeps
its existing satellite colour. Brown ground stays brown; this does not
substitute green fields, draw rows, infer crop orientation or place
individual plants.

The material uses original fine terrain shading and small normal changes.
It fades before the grain can alias at flight altitude and at the interior
of category, slope and coastal limits. The actual runway paint inputs are
protected by the known graded strips and an extra margin. Surveyed shores
and special local patches keep their old materials. Eligible terrain
fades over a 42 m collar next to those protected tiles; the normal used
for building shadow comparison stays unchanged. There are no added
images, draw calls or triangles. Flight contact, tree locations, buildings
and the shoreline do not change.

These are optional visual materials on an approximately 47 m land cover
atlas, not a vegetation survey or claim of what is growing now.

[Matched actual render pairs](meadow-comparison.webp) · [Three-county cover gate](meadow-render-gate.json) · [Runway pixel gate](meadow-runway-gate.json)

## Checks

The paired, fixed Three.js frames compare eligible low-altitude terrain in
Prince, Queens and Kings and one inactive high viewpoint. A separate
graphics mask compares the actual painted runway fragments on CYYG 03,
CYYG 10 and CYSU 05. No marked runway pixel changed at those three cameras.
See the machine checks for exact coverage and unchanged statistics.

The three low scenes changed 147,878 to 180,720 pixels above two RGB
levels, all inside allowed ground with a one-pixel edge margin. The high
scene retained all 461,100 pixels. All 278,660 marked runway pixels from
the three camera checks were exact. These are matching renderer tests,
not a device frame-rate estimate.

```sh
python tools/qa/meadow-local.py --checkout . --out /tmp/meadow --chromium /path/to/chromium
python tools/qa/meadow-runway.py --checkout . --out /tmp/meadow-runways --chromium /path/to/chromium
```

The [ordinary runway roll](meadow-runway-flight.json) also kept the same
ground height with and without the combined preview. A [four-view motion
check](meadow-motion-gate.json) kept the same scope through small camera
translations.

The [live Bowley edge](meadow-edge-gate.json) kept the surveyed water shader
on its own tile while the adjacent grassland blended in with identical draw
and triangle counts. The [edge distance audit](meadow-edge-math.json)
checks all 256 neighbor masks. The [building shadow probe](meadow-shadow-gate.json)
kept every shadow-evaluation pixel exact in a frame where disabling the
shadow demonstrably changes the result.

```sh
python tools/qa/meadow-edge.py --checkout . --out /tmp/meadow-edge --chromium /path/to/chromium
python tools/qa/meadow-shadow.py --checkout . --out /tmp/meadow-shadow --chromium /path/to/chromium
```
