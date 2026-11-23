# Terrain-seated road ribbons preview

At very low viewpoints, the legacy road ribbons can hover above the terrain.
The previous mesh uses interpolated centreline heights plus a fixed offset,
then applies the same height across its strip. A province-wide software
comparison found a median gap of 0.439 m for 1,540,371 qualifying paved
samples (0.433 m for 810,534 unpaved samples). This comparison is against
the actual simulator's regular terrain surface, **not a real road survey**.

Add `?seatedRoads` to preview closer-fitting roads, or append
`&seatedRoads` when another query is present. Provisioning begins below
209 m above the simulated ground. The preview eases in after warmup and
tapers from 194 m down to 112 m AGL. The nearest roads retain their plan-view
position, width, alignments and class, but visibly sit closer to the terrain.
This preview is off by default. It needs no new data download.

## Geometry and safety scope

- Each original road triangle is subdivided against the inherited terrain
  facets, preserving its original vertices' plan, diagonal and interpolated
  edge parameter. A bounded, resident 112 lattice matches the stable near
  terrain. The actual wearing surface is 62 mm above the regular terrain
  where the correction is fully applied; this is display separation, not
  an estimate of pavement thickness, grade or road crown.
- A per-vertex blend goes back to the old section at 900 m from the camera.
  The adjacent terrain tiles are still in the regular near LOD here; ordinary
  distant tile LOD changes no longer rebuild or momentarily reset the road.
  Optical normals and optional building-shadow receivers follow the displaced
  triangles, before applying the existing smaller-scale pavement normal detail.
- Water, bridge decks, runway surfaces and isolated existing survey pieces
  keep their previous treatment. Wet/coast and survey exclusion weights taper
  rather than changing a whole road at the boundary. The paved, gravel and
  dirt classes do not change. The preview changes no map geometry or aircraft
  collision: aircraft still use the same independent terrain contact.
- Terrain-conforming roads do not reproduce engineering crossfall; bare-earth
  terrain can slope more steeply across a strip than a real pavement crown.
  Lanes, drainage shoulders, built curbs, and engineering grades remain outside
  this preview.

## Checking the change

[Same-scene comparison](seated-road-comparison.webp) | [Verification receipt](seated-road-gate.json)

Curb and 18 m views compare the same runtime with its displacement strength
set to 0 or 1. The changed area is contained in the union of the original
and fitted road projections. A high, non-admitted view checks that the preview
adds no displacement outside its range. A controlled Chromium test exercises
warmup while high, descent into the preview, relocation across a road tile,
and climb back out; the geometry does not recut on unrelated terrain LOD
events. An independent Three.js ray check found no missed terrain seams and a
maximum 0.011 mm residual from the intended visual separation at 1,888
fully weighted road samples. The old and new near geometry submit the
same draw calls at the fixed poses, but the preview needs more triangles.
The slowest tested cold variant builds were approximately 81–93 ms on
the local Node test host, so the feature remains opt-in while this work
is moved away from the first low pass. No device frame rate is claimed.

```sh
npm run check
node --experimental-strip-types tools/qa/road-contact-baseline.mjs
python tools/qa/seated-road-frames.py --checkout . --deps node_modules \
  --out /tmp/road-seat-views --chromium /path/to/chromium
python tools/qa/seated-road-motion.py --checkout . --deps node_modules \
  --out /tmp/road-seat-motion --chromium /path/to/chromium
```
