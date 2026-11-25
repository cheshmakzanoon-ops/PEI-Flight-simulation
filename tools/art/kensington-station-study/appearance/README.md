# Kensington station appearance study

This standalone Three.js workbench models the recognizable forms of Kensington's
historic passenger station: a projecting pale-braced gable, a low fieldstone core
and two open lower hipped shelters. It is an artist's approximate local assembly,
not a measurement of the walls, the current building, or any placement in the
flight simulator. It has no live building-owner, terrain, flight or collision
integration.

The [Parks Canada designation](https://www.pc.gc.ca/apps/dfhd/page_nhs_eng.aspx?id=583)
and [provincial heritage record](https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=19248)
identify the architectural roles. A separately checked October 10, 2025
[oblique aerial by Quintin Soloviev](https://commons.wikimedia.org/wiki/File:Kensington,_Prince_Edward_Island.jpg)
([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)) confirms a broadly
gray roof and pale gable in context, independently of the lower foreground
building. That photograph is an appearance reference only. No image, crop,
modified photograph or photo-derived texture is included.

The arch is existing original studio geometry, moved and scaled for this
illustration. The larger angular stone texture and restrained graphite roof
variation are original appearance studies. The roof covering itself is not
identified. Read the [separate measured-roof evidence](../README.md) for its
trained versus independently checked areas and the [registered outline](../plan-registration.json)
for the older aerial envelope. None of those files are replaced by this model.

## View the study

From the repository root, with installed project dependencies:

```sh
npm exec -- vite tools/art/kensington-station-study/appearance --host 127.0.0.1 --strictPort
```

Open Vite's local URL, select a fixed viewpoint or use the orbit controls.
The interface lists the unresolved roof forms and support placements.
Ground, lighting, pose and the dimensions of the open shelter supports are
artistic placeholders. The blank rear does not assert a blank real elevation.

**Do not mount in the simulator.** Resolve the main bay dimensions, the
southwest crown and northeast tip, rear openings, actual supports and foot
heights independently. Compare front and rear from a real close flight before
replacing even the one original building row. This viewer is not a world
download, a new flight, an as-built reconstruction or a photo-matched view.
