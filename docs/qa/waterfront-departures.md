# Basin Head and Summerside waterfront departures

The departure picker and flight atlas now offer **Basin Head · low pass**
and **Summerside waterfront · low pass**. Both start offshore, facing the
modeled site. The scenery remains optional: use `?basinChannel&basinWharf`
for the [Basin Head wharf](basin-head-outer-wharf.md) or
`?spinnakersPreview` for [Spinnakers’ Landing](spinnakers-landing.md).
The existing departure IDs and order are unchanged.

At the default aircraft settings, an 18-second fixed-step test on the
base atlas passes within 3 m laterally of each selected landmark while
staying at least 80 m above the terrain sampled along the flight.
The [compiled browser check](waterfront-departures-run.json) selects both
departures through the real menus, verifies normal motion and optional
scenery, switches to the cockpit for the Summerside run, and pauses
both flights. No camera, clock or position injection is used.
These are simulator convenience starts, not real routes or procedures.

## Replay

```sh
npm run check
python tools/qa/waterfront-departures.py --dist dist --chromium /path/to/chromium \
  --out /tmp/pei-waterfront-departures.json
```
