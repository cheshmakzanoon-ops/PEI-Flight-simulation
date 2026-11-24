# Former Summerside Railway Station

The railway station at 192 Water Street replaces one generic flat-roof
building with an original Three.js exterior. The
[Canadian Register of Historic Places](https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=10102&pid=0)
documents the 1927 building and its railway-era hipped roof, broad eaves
and brackets. The model also includes the offset gable volumes, joined
dormers, recessed windows and the measured east roof step.

For the optional exterior, add
`?departure=spinnakers-low&buildingShadows&summersideStationReview`
to the simulator URL. For the stock comparison, remove only
`summersideStationReview`. Do not add the separate Spinnakers, baywalk,
seated-road, or alternate terrain studies to this comparison. This is
one exterior treatment; the surrounding downtown, ground and transport
network are unchanged.

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

The verified 112-subdivision terrain mesh is a required condition.
If the optional art or building record is late or damaged, if the
terrain is coarser, or if the preview is not enabled, the stock model
and caster remain present. Roads, sidewalks, parking, ground height and
flight collision are not changed. There is no default request for the
optional 325,977-byte asset.

[Actual Three.js comparison](summerside-railway-station-comparison.webp):
stock at left, replacement at right; street view above and harbour air view
below. The conservative station-and-shadow masks leave 152,609 and
185,803 protected pixels, respectively. Every protected RGB pixel was
identical in the matched scenes. [Scope receipt](summerside-railway-station-scope.json).

See the [actual matched scene report](summerside-railway-station-frames.json)
and [compiled departure check](summerside-railway-station-flight.json).
The experience is ordinary Three.js rendering, not a device
performance benchmark.

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
python tools/qa/summerside-station-flight.py --dist dist \
  --out /tmp/pei-station-flight --chromium /path/to/chromium
```
