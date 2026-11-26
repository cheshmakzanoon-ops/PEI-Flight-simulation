# Founders’ Food Hall · Charlottetown

Original Three.js exterior reconstruction of Charlottetown’s former railway car shop and its separate visitor entrance. Do not infer current dimensions, cladding specification, accessibility or safe flying clearances from the recreation. The live flight map includes only a [material treatment on the original Prince Street wall](../qa/founders-west-standard/), not this modeled exterior.

## Source separation

- **Position and footprint.** The simulator’s authenticated built-world index owns the full original shell as q120010 row 313. The [City’s existing-conditions survey, Attachment B, printed p. 57](https://www.charlottetown.ca/common/pages/DisplayFile.aspx?itemId=17314596#page=57) corroborates the long shed, west return and nearby circulation corridor. Attachment C shows proposed landscaping; the 2021 boardwalk tender specifies planned work. Neither is used as an as-built map or texture.
- **Historical roof and ground.** The original 2020 1 m LiDAR hold supports the historical main roof core and the lower east flat core separately. It does not certify the high west seams or the whole building. A separate frozen 70-point ground check compared all four sides to the current stock atlas without an alignment correction: absolute P90 0.220 m pooled. This is not a threshold, sill or present-day utility survey.
- **Post-work silhouette.** [Port Charlottetown’s 2022 annual report](https://portcharlottetown.com/wp-content/uploads/2023/09/POC-2022-Annual-Report.pdf) records replacement after the source survey, so historic values are not asserted as the current roof. [A July 2025 aerial by Dmitry Soloviev](https://commons.wikimedia.org/wiki/File:MS_Zuiderdam_(Holland_America_Line)_in_Charlottetown,_PEI,_Canada.jpg) corroborates the long, lower dark roof and retained higher brick end at broad scale only.
- **Recognisable west side.** [The renovation architect’s project and June 2025 exterior photography](https://sablearc.com/founders-food-hall/) distinguishes three large arched bays from the buff masonry return, red coping, glazed link and shallow curved hood. [The operator](https://foundersfoodhall.com/visit-us/) identifies the main Prince Street west and Stan MacPherson Way east approaches. Historical photographs support the distinction, which was also checked qualitatively on location in September 2024 Street View. Built art is original, not photo textures, digitized panoramas, logos or storefront advertising.

## Route and release guard

The primary terrain check retains both original visible fine terrain patches, the cover and physical flight-contact data. The candidate uses the exact original shell footprint. Same-frame A/B captures on the ordinary Charlottetown harbour route use the original aircraft, camera, renderer, roads, shoreline, and buildings; the old geometry must restore byte-identically. The published live map does not mount work-in-progress art. A change exposing an already-existing partially covered pixel is filed as a diagnosed hold, not an exception to release gates.

## Developer workbench and evidence

From the repository root after `npm ci`, run:

```sh
node --experimental-strip-types --test tools/art/founders-hall-exterior/detached.test.mjs
./node_modules/.bin/tsc -p tools/art/founders-hall-exterior/tsconfig.json
./node_modules/.bin/vite --host 127.0.0.1
```

Open `/tools/art/founders-hall-exterior/` on the local Vite server. Four fixed
views put the curved inset, grey lower visitor front and separate set-back
upper glazing into context. The workbench ships no imagery or remote assets;
its horizontal handedness is illustrative, not geographic registration.
The current source model uses 1,792 triangles in 17 opaque material batches. Tests
pin every position, normal and UV stream and check the enclosed portions
and local inset depth. At flight scale the undeveloped surroundings remain
unchanged.

A separate refinement adds a closed matte middle panel inside each of the
three west arches. The upper and lower glazing remain distinct physical
surfaces. This retains every one of the 1,744 previous triangles and adds
36 closed panel triangles and 12 trim triangles. The two fixed west lenses
showed 16,186 and 4,168 changed pixels with zero outside the new panels’
visible area and no alpha changes; both reciprocal lenses and stock restore
were byte-identical. The fine diagonal variation is intended for close
inspection; mid-distance detail is not verified. The updated art also passed its
private street-level renderer check with unchanged alpha and exact stock
restoration; this is an inspection pose, not a gameplay view.

The preceding 1,744-triangle exterior passed its four fixed studio checks.
In the native game renderer a private at-site
inspection camera had 310,945 changed RGB pixels, none outside the box, no
changed alpha, and exact restore. The two sampled ordinary Harbour Low
Chase frames had 12,879 and 17,654 visibly changed pixels with zero outside
and byte-identical restore. Their strict release checks still failed at
seven and six alpha pixels respectively. All thirteen pixels exactly equal
the exposed original scene captured with both building variants hidden.
The distinction and the unchanged release gate are documented in
[the actual fixed-frame receipt](../../tools/art/founders-hall-exterior/exact-route-scope.json).
Realistic façade treatment and precise modern roof heights are not complete.

## Optional narrow gable comparison

The local workbench's **Compare narrow gable** control overlays the
photographically supported narrower raised brick shape and lower shoulders.
The comparison loads separately. It checks the existing authored face
order and exact Float32 position, normal and UV streams before enabling
a narrowly clipped exchange of the west end. The 1,792 baseline triangles
stay byte-for-byte intact, and the optional view submits 47 additional
triangles in the same 17 draw calls. Turning it off restores the unchanged
baseline. No image or hosted map data is loaded.

The previous geometry-only trial changed 378 pixels outside its strip in
an oblique view and eight in a higher view. Preserving the old draw payload
instead produced 10,930, 3,990 and 10,429 strong changes in three scoped
views and exact equality in the reciprocal view, with zero outside or
alpha changes. The [portable native receipt](../../tools/art/founders-hall-exterior/gable-review-native.json)
also records byte-identical dormant and restored images. This is a
developer inspection of the color draw only; the cap remains an artistic
interpretation, not current surveyed dimensions, a sealed structural
volume, a validated new shadow caster or a gameplay option.
