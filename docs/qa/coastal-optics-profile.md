# Coastal optics in Dispatch

In **Standard**, open **Optional scenery studies**, choose **Coastal optics**, and select **Apply studies**. The simulator reloads without changing your departure. Clear the same checkbox and apply again to return to your previous selections. The direct URL flag is `?coastalOptics`.

This is one shortcut for three local coastal studies:

- The [broken surf detail](shore-foam-detail.md), which is ordinary in compatible Standard scenery and explicitly selected by this shortcut.
- [Nearshore tint compatibility](shore-tone.md) for renderers that round the source shoreline texture's interpolated values.
- The [Orby Head aperture repair](orby-shore-closure.md) at five reviewed cells.

The shortcut does **not** add new imagery, change terrain height or aircraft behavior, or model current weather. The tint depends on the graphics renderer, and the Orby repair is local. Unsupported scenery combinations do not turn off an explicitly selected imagery, terrain or shoreline study. Detail keeps its existing preset. [Far-horizon daylight haze](aerial-perspective-study.md) is now part of Standard and does not require the shortcut. If the sky check fails, only the atmosphere falls back; other selected controls still operate.

The bundled flag does not write its component flags into the URL. Removing it does not remove the user’s individually selected compatible flags.

In the original compiled bundle check, we applied and removed the option through Dispatch, preserved the Cavendish low departure, and flew 502.6 m before switching to Cockpit and pausing. The active preset fetched the existing sky once. A bad first response left the foam and Orby controls active and triggered the normal sky fallback. An explicitly selected imagery-join preview prevented the shortcut from overriding that choice. All 327 tests, the production build, and world checks passed.
