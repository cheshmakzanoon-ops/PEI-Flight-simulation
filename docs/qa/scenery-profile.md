# Scenery selection in Dispatch

**Standard atlas** is the existing view, with the same map, flight controls
and individual URL flags. Choose **Use detailed preview** in Dispatch for
the matching in-progress local enhancements. This reloads the same
application and preserves the currently selected departure.

Detailed preview combines the independently scoped North Cape, North
Baywalk, Basin Head, Montague River, selected shoreline and woodland
improvements. All use the same world and aircraft. Features with missing
or incompatible optional data fall back through their usual gates. Not
every area has those same detailed layers. Standard atlas is available
using **Use standard**.

Use `?scenery=detail` to start in this profile from a bookmark. Individual
preview flags and exclusion switches in an existing link stay in place;
switching back to Standard removes only the combined profile. No account,
stored setting, weather claim or different flight model is added.

## Rehearse the control

```sh
npm run check
python tools/qa/scenery-profile.py --dist dist --chromium /path/to/chromium \
  --out /tmp/pei-profile
```

The check selects a real departure, switches the profile using the visible
button, flies at Summerside and North Cape, pauses, then returns to
Standard with the current departure still selected.

The [recorded checks](scenery-profile-gate.json) also show that at 390 × 760 and
844 × 390 the touch control is at least 44 CSS pixels high, accepts keyboard
focus, and both controls remain reachable when the panel scrolls.

## Standalone scenery studies

In Dispatch, open **Optional scenery studies** to toggle **Beaconsfield
exterior** or **Field surface relief**, then choose **Apply studies**.
This reloads the project while keeping the departure and unrelated URL
options. Opening the panel alone does not load new assets. The two
studies are separate from the Detailed preview preset.

Three low passes are available in both profiles: choose the **fields
low pass** for Prince, Queens or Kings County, then compare the same
route with Field surface relief off and on. The studies are localized
and do not indicate current farming or replace the standard map.

[Actual desktop, mobile and three-flight checks](scenery-study-controls.json)
used the production build. The field routes use the ordinary dispatch
and in-flight atlas, with no camera or physics override.
