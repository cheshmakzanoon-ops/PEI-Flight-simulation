# Georgetown: St. David’s United Church exterior study

Select **Georgetown harbour · low pass** in the departure menu to see
the modeled church in Standard scenery. The simulated start is over
the harbour, 61 m above the starting surface, facing the village.
`?stockStDavidsExterior` keeps the original flat massing. The separate
`?stDavidsChurchReview&buildingShadows` mode adds the original local
shadow test. This one modeled exterior depicts the measured 2020 roof
and interpreted finish. It is not a current building survey, an
accessibility guide, or a flight plan.

## Measured geometry and authored exterior

The recognizable gable, attached square entrance tower, open ornamental crown, opaque louvres, recessed Gothic sash and painted shingle/trim volumes replace one flat 2020 cover shell in Georgetown, Kings County. The two sanctuary roof slopes and shallow tower cap are fitted against native classified points. 117 spatially held same-survey Three.js roof rays return p90 absolute height error **5.9473 m prior / 0.0457 m study**, worst 0.108 m. This is a role-qualified interior roof check, not a statistical claim about every exterior section. Two high unclassified returns 21.055 m and 21.111 m give a scale check near one finial. All four detailed wood finials and the small sash elements are deliberately authored. Apparent colors, paint and roof finish reflect historical descriptions/archival context, not a coating measurement.

The roof includes shallow nominal fascia and eaves rather than shearing them off at a simplified atlas footprint. 11,329 samples outside its simple 2D plan stay ≤0.7985 m beyond that plan; matching native roof support is ≤0.8673 m away (p95 0.4956 m; only 26 above 0.75 m near a sparse corner). The higher cap extends up to 0.261 m, nearest qualified returns within 0.542 m. Main wall/shingle planes never expand the footprint. The stock parcel’s 3,322 actual near ground probes stayed dry and all modeled foundations are below the original visible terrain, leaving siding visible. The historically documented but separately placed rear porch is **not included**. Neither grounds, roads, paths, thresholds on the ground, ramps, landscape nor control/flight-surface physics are changed.

## Runtime lease and fallback

Only source AEB `q11220` ordinal 203/FID 32980 is eligible. The compressed 24,504-byte original range, exact ordered record, original emitter transform and all six actual artwork-independent draw attributes are pinned. The intact batch ships first. A locally streamed 374,243-byte compressed `SDAV` pack (1,792,460 bytes decoded) is requested only once the exact sampled original N112 ground context returns a matching lease. A late, missing or wrong digest cannot evict the prior visual or caster. On valid admission only its 66 indices are omitted; the other source triangle order and buffer objects do not change. On N56/N8, loss of the regular near lease or eviction, the entire previously visible stock row comes back. The shaded preview material and translation-only shadow caster share the same 5,364 original triangles. The existing cast cache is invalidated at the atomic owner switch; no change to general terrain, road or other building receiver equations.

Projected actual emitted vertices have no area overlap with 256 nearby stock building triangles (closest 10.149 m) or 32 road triangles (closest 10.777 m). No mapped sidewalk or parking mesh occurs in the checked local window. Natural vegetation is untouched; these are geometry-scope checks, not claims about exact real plant or vehicle positions. CSS/WebGL and current lighting performance depend on the viewer’s settings. The detached visual study is design evidence. The following app views exercise the real ground lease and cast path.

Standard requests the authored exterior only within 2.25 km and after
the checked ground lease is available. It restores the stock owner
beyond 2.7 km, or earlier if the exact ground lease expires. The ordinary
model renders 5,342 net additional triangles in thirteen extra draws
when visible. It does not allocate or submit the experimental caster.
`scenery=detail` and alternative ground or cast modes retain their
own guards; no new world surfaces or flight physics ship with this change.

## Sources and reproducible art

- [NRCan 2020 Automatically Extracted Buildings](https://open.canada.ca/data/en/dataset/7a5cda52-c7df-427f-9ced-26f19a8a64d6), [HRDEM 1 m surface/ground](https://open.canada.ca/data/en/dataset/0fe65119-e96e-4a57-8bfe-9d9245fba06b) and [Canadian HRDEM LiDAR point clouds](https://open.canada.ca/data/en/dataset/7069387e-9986-4297-9f55-0288e9676947), [Open Government Licence—Canada](https://open.canada.ca/en/open-government-licence-canada). 2020 survey horizontal EPSG:2961 and vertical CGVD2013 (1 m mosaic in horizontal EPSG:3979). Local affine projection error ≤0.000018 m against those submitted vertices. See `data/st-davids/source-receipt.json` for immutable sources and witnesses.
- [Canadian Register of Historic Places #11965](https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=11965) supports visible heritage form, sash and crown design. Historical review sources/images were viewed as factual references only. No photos, tracings, Google imagery, signs, or third-party artwork are included. Paint/trim/window materials are original, deterministic textures or shader values.
- `node --experimental-strip-types tools/art/st-davids/pack.ts` checks the numerical pack against authored sources without writes; `--write` explicitly regenerates it. `node --experimental-strip-types --test test/st-davids-preview.test.ts` tests transport, bounds, exact opaque-caster transform and preview gating.

## Actual game views

[Matched Standard imagery](st-davids-standard.webp) shows the ordinary
exterior, without experimental shadows. The two views switch the actual
stock and authored owner in a single rendered scene; restoring the authored
owner reproduces the same pixels. [Pixel-scope receipt](st-davids-standard-scope.json).
[Compiled departure, no-download and corrupt-art checks](../../tools/qa/georgetown-standard-flight.py).

The separate shadow preview also has [matched street and air images](st-davids-church-comparison.webp)

with stock at left and the church at right. The comparison switches the
actual owner and caster in one settled scene, with identical terrain
imagery, water phase and camera between the frames. Restoring the candidate reproduces
its original image exactly. The [protected-pixel audit](st-davids-church-scope.json)
checks 144,895 street pixels and 190,508 air pixels outside the church and
its bounded shadow. All were byte-identical; the surrounding Georgetown
blockout remains the earlier rendering.

The final shingle plane was retessellated to remove a thin tone seam on the
tower. Exact same-frame A/B shows the median streak contrast fell from
7.5 to 0.5 RGB levels across the preselected 27 pixels; the 23 pixels
that exceeded six levels before did not do so after. The
[localized comparison](st-davids-church-seam.json) scores the correction
separately from the stock comparison. Roof fit, wall plane, two openings,
texture bytes and all other material parts were preserved.

Reproduce with the project's Playwright and Chromium dependencies:

```sh
python tools/qa/st-davids-browser.py --checkout . --edition paired \
  --views street,air --out /tmp/st-davids-paired --width 530 --height 375 \
  --chromium /path/to/chromium
python tools/qa/st-davids-browser.py --checkout . --views street,medium,coarse \
  --out /tmp/st-davids-fallbacks --width 500 --height 354 \
  --chromium /path/to/chromium
python tools/qa/st-davids-browser.py --checkout . --edition flight --skip-faults \
  --out /tmp/st-davids-flight --width 500 --height 354 \
  --chromium /path/to/chromium
```

The normal-flight test adds a dated verification-only start to a temporary
checkout. It is not a route change in the shipped simulator.

The [runtime receipt](st-davids-church-runtime.json) shows that corrupt,
missing and timed-out responses retain all six original draw buffers
byte for byte. At N56 the same source owner draws and the art is not
requested; N8 retains its ordinary absent local building owner. Both
regular virtual flights moved at least 500 m after Dispatch, cycled
to Scenery and paused. The selected exterior stayed active only in
the preview run.

## Standard ground shadow

St. David’s casts a local shadow on the grass, calculated from the same
5,364 triangles visible on the ordinary route and the scene's fixed sun.
Seven directions sample the exact nearby terrain. The 262-byte compressed
mask has 2,389 dry samples; it remains more than 10.5 m from the tested
road mesh and 9.9 m from other packed buildings after allowing for
filtering. It changes only the direct daylight on one existing terrain
tile. It is not time-of-day weather, a site survey, or a replacement for
the separate shadow preview.

The mask downloads only after the signed exterior is visible. It switches
off when the model or its terrain ownership is lost. Corrupt or late
data cannot remove the church or change the ground surface. Use
`?departure=georgetown-low&stockStDavidsGroundSun` to keep the model
but compare the original light.

[Same-camera comparison](st-davids-ground-sun.webp) ·
[Mask and RGB scope receipt](st-davids-ground-sun-scope.json) ·
[Compiled flight check](../../tools/qa/georgetown-ground-normal-flight.py).
An independent replay matched all 4,802 Three.js shadow rays with the
baked mask. The locked frames keep their draw and triangle counts; no photo texture,
geometry, collision, roads, or neighboring building material changed.

Reproduce the exact mask and its road/building clearance audit with
`node --experimental-transform-types tools/art/st-davids/bake-ground-sun.mjs --verify`.

## Safely sharing the Georgetown tile

The unchanged signed stock geometry now remains available for verification
while a row is hidden. A small coordinator can reserve two non-overlapping
triangle spans in that one mesh, preserving the order and object identity of
all original attributes. An unrecognized replacement mesh takes precedence;
the local artwork hides rather than taking ownership back. Removing one lease
restores its stock span without restoring the other. The masks are created on
changes, not per-frame. Retiring a mask releases its owned index but
leaves the stock vertex buffers attached to the surviving mesh.

St. David’s is still the only live participant. No courthouse geometry or
download is added by this change. A temporary browser fixture exercised the
actual q11220 draw with an empty test group associated with the separate
courthouse span. With neither lease, all 31,179 unindexed vertices remain.
With only the church, 31,113 indices remain; with only the mock courthouse,
31,086; with both, 31,020. The next nearby structure keeps all 42 of its
indices in every altered view. The original six attributes and the original
church mask are preserved. With both altered index buffers uploaded in
Chromium, retiring the mock leaves a byte-identical church frame and no
WebGL error. A future authored neighbor would still need its own casting
and ground-contact validation.

In the matched Standard street captures, the church’s pixel contribution was
identical before and after. Eighteen pixels elsewhere differed by one RGB
level in both the stock and church frame, with no difference to the church
or its change mask. The Standard scene kept 60 draws and 264,170 triangles
with the church present, or 47 draws and 258,828 triangles in stock. The optional
shadow view retained the same caster counts and church contribution.
In the [compiled and matched-render results](georgetown-owner-cohort-gate.json),
all four flights paused normally. Ordinary art fetched once; corrupt art
kept the stock row, and stock and distant routes made no request.

```sh
node --experimental-strip-types --test test/authenticated-owner-cohort.test.ts
python tools/qa/georgetown-owner-cohort.py --checkout . --out /tmp/pei-tile-proof --chromium /path/to/chromium
```
