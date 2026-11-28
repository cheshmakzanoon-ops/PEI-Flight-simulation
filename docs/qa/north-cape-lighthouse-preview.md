# North Cape lighthouse low pass

On a local build, append `?departure=northcape-light-low&northCapeLightPreview`
to the simulator URL. Leave scenery on Standard, wait for **North Cape lighthouse
preview ready.** in Dispatch, and choose **Begin flight**. Start in Chase to see
the tower on the approach. Starting before the ready message keeps the ordinary
scenery for that flight. Return to Dispatch to retry; you do not need to reload
the page. The ordinary North Cape wind-farm departure is unchanged.

The preview adds an authored octagonal tower with white painted siding, a red
lantern, a projecting gallery, cross-bracing and separate glazing. It uses the
[baseline model, structure references and stock-grade placement limits](../../tools/art/north-cape-lighthouse/).
It does not replace a turbine, road, visitor-centre building or terrain cell.
The foundation and compass orientation are not surveyed. No photograph or
native LiDAR study raster is loaded for this feature.

On the exact preview build, an ordinary browser launch with diagnostics absent
started with zero lighthouse draws in Dispatch. After the actual Begin click,
the linked Three.js program drew both the solid and glazing position buffers.
A separate ordinary Chase check at about 281 m of travel observed the same
two draw roles, and returning to Dispatch allowed a clean second launch. The
actor remains bounded by the exact local stock-ground owner and falls back if
that owner or the supported render state changes. These checks verify rendering
and fallback, not a province-wide visual quality claim.
