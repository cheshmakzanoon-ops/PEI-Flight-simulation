# Woodland scenery view

Enable **Woodland scenery view** in Standard Dispatch (or add
`?woodlandView`). This combines the previously qualified
[near conifer shape](woodland-crown-base.md),
[photographic bark](woodland-bark.md) and
[forest-floor material](forest-floor-preview.md). It adds a fourth
camera, **Scenery**. During a flight use **V** or the camera button to
cycle from Chase through Cockpit and Wide chase to Scenery.

The camera looks down by roughly 32.5° in a regular landscape window,
with its roll stabilized against world up. The orientation changes the view,
not the aircraft's controls, motion or collision. The new viewpoint
does not require a downward aircraft pitch. With the preview off, the
old three-camera sequence and asset requests are unchanged.

Each material retains its own camera range, geometry fence,
authenticity check and fallback. The preview doesn't add or move
trees, change terrain or manufacture individual surveyed trees.
Use the ordinary Standard scenery preset (not the separate Detail or
conflicting terrain studies). This is a virtual sightseeing camera,
not flight training or guidance for an actual aircraft.


## Virtual departures and checks

Choose **Prince County · woodland view pass**, **Queens County · woodland
view pass**, or **Kings County · woodland view pass** in the departure
list. The standard views also work at these starts. Short-range details
can be brief as you fly past, particularly on a portrait screen.

The three starts were replayed for 13 seconds with the real game
aircraft's default 1,450 kg mass and neutral controls, in seven model
wind setups each. The checks use the stock terrain contact surface,
mapped roof bounds and stock canopy geometry. They establish scope
for the tested virtual starts, not a guarantee about other flight
controls, routes, weather or clearance in the real world.

See the [stock route replay](woodland-scenery-route.json) and the
[compiled browser flights](woodland-scenery-flight.json). Across the
matched screenshots, Chase is at left and Scenery at right; the pause
UI is hidden only for the picture, so the aircraft remains held in place.

[Actual game views in the three counties](woodland-scenery-comparison.webp)

The camera and asset setup can be checked with:

```sh
# Node 24 and a full checkout containing the stock baseline commit.
node --experimental-transform-types tools/qa/woodland-scenery-route.mjs /tmp/pei-woodland-routes.json

# After npm run build, exercise ordinary dispatch, V and pause.
python tools/qa/woodland-scenery-flight.py --dist dist \
  --out /tmp/pei-woodland-flights --counties prince,queens,kings \
  --chromium /path/to/chromium
```
