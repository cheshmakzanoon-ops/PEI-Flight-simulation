# Former Summerside Railway Station

The railway station at 192 Water Street replaces one generic flat-roof
building with an original Three.js exterior. The
[Canadian Register of Historic Places](https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=10102&pid=0)
documents the 1927 building and its railway-era hipped roof, broad eaves
and brackets. The model also includes the offset gable volumes, joined
dormers, recessed windows and the measured east roof step.

Choose **Summerside waterfront · low pass** to see the modeled station in
Standard scenery. Use `?departure=spinnakers-low&stockStationExterior`
to compare it with the original flat box. A separate
`?departure=spinnakers-low&buildingShadows&summersideStationReview`
comparison shows the same exterior with the experimental building
shadows. The station is the former railway-era exterior, not an
interior or a photographic survey of current finishes.

## Survey and interpretation

- The registered building outline and existing stock owner agree over
  97.756% of the stock plan. The modeled foundation is inside both
  outlines; the wider surveyed eaves are roof overhangs, not an expansion
  of the occupied ground plan.
- The [Canadian high-resolution elevation product](https://open.canada.ca/data/en/dataset/0fe65119-e96e-4a57-8bfe-9d9245fba06b)
  and [2020 Summerside point-cloud source](https://canelevation-lidar-point-clouds.s3.ca-central-1.amazonaws.com/pointclouds_nuagespoints/PEI/Prince_Edward_Island_2020/pei_2020_339000_704000.copc.laz)
  define the registered roof and co-registered ground. Held-out
  native roof rays hit 559 of 559 tested surfaces. On the two main
  slopes, p90 absolute error drops from 4.43 and 4.25 m in the stock
  flat roof to 0.085 and 0.072 m in the exterior. These are from the
  same dated survey, not an independent current building survey.
- The main exterior was authored from the heritage description and
  survey-derived structural shapes. Cladding, joints, frames and other
  finish are modeling decisions, not measured present-day material.
  No heritage photograph, mural, sign or storefront image is shipped.
  No interior or alternative access route is represented.
- Elevation data use the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
  The original building, roads and terrain continue to use the
  attribution in the main project.

## One-owner activation and fallbacks

The runtime checks the immutable atlas and original building record,
then verifies the exact stock geometry layout as generated with the
active Water Street materials. Only the station's 16 triangles are
replaced; all neighboring building attributes remain byte-identical.
The authored scene submits 5,299 station triangles in ten material
groups. The replacement also supplies the single station caster to
the existing optional building-shadow system. Its softened wall
shadow reads from the same real caster, not a hand-painted shadow.

Standard requests the 325,977-byte art only when within 2.25 km
and when the signed roads, decoded ground and verified 112-subdivision
terrain are present. It restores the stock render beyond 2.7 km or if
the terrain lease is lost. If the art or building record is late or
damaged, the stock model remains present. For Standard the model adds
5,283 net triangles and ten draw calls only when submitted; it adds no
shadow caster to Standard. Roads, sidewalks, parking, ground height,
collision and the nearby survey-fitted roofs remain unchanged. Both
capture pairs kept all four watched fitted roofs and the same open-ground
tree exception active.

[Standard stock/active comparison](summerside-station-standard.webp):
stock at left, active at right, from two matched 600×400 views. The
remaining 200,880 street-view pixels and 222,131 harbour-view pixels
match exactly outside the two conservative station masks.
[Standard scope receipt](summerside-station-standard-scope.json) and
[compiled Standard flight check](../../tools/qa/summerside-station-standard-flight.py).
The flight test also verifies a corrupted download leaves stock in place
and a distant Cavendish departure makes no request for this artwork.

The [separate shadow-mode comparison](summerside-railway-station-comparison.webp)
and its [scope receipt](summerside-railway-station-scope.json)
document the optional direct shadow rendering. See its
[actual matched scene report](summerside-railway-station-frames.json)
and [compiled departure check](summerside-railway-station-flight.json).
These are scene checks, not device performance benchmarks.

## Rebuild the artwork

The project retains the editable Three.js geometry and original material
recipes under `tools/art/summerside-station`. Regenerate the calibrated
binary without downloading any reference photography:

```sh
export RAIL_EXPORT=$(mktemp -d)
node --experimental-strip-types tools/art/summerside-station/qa/export-native-review.ts
python tools/art/summerside-station/pack.py --export "$RAIL_EXPORT" \
  --out "$RAIL_EXPORT/asset.bin.gz" --index "$RAIL_EXPORT/art.generated.ts"
cmp "$RAIL_EXPORT/asset.bin.gz" public/art/summerside-station-C-v1.bin.gz
cmp "$RAIL_EXPORT/art.generated.ts" src/render/summerside-station/art.generated.ts
```

The actual-view tests use the same Chromium and Python dependencies as
the fixed-scenery QA:

```sh
python tools/qa/summerside-station-frames.py --checkout . --deps node_modules \
  --out /tmp/pei-station-frames --chromium /path/to/chromium
python tools/qa/summerside-station-frames.py --standard --checkout . --deps node_modules \
  --out /tmp/pei-station-standard-frames --chromium /path/to/chromium
python tools/qa/summerside-station-standard-flight.py --dist dist \
  --out /tmp/pei-station-standard-flight --chromium /path/to/chromium
python tools/qa/summerside-station-flight.py --dist dist \
  --out /tmp/pei-station-flight --chromium /path/to/chromium
```

### Optional roof material study

The [detached lapped roof finish](../../tools/art/summerside-station/roof-finish/) keeps
the existing roof geometry and texture ownership. View the matched studio plates
and archived-lens comparisons there. Neither constitutes a change to the playable
Standard station.
