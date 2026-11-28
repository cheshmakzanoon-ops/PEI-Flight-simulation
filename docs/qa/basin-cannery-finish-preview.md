# Basin Head Cannery finish preview

To try the finish on a local build, append
`?departure=basin-head-low&basinChannel&basinCanneryFinish=1`
to the simulator URL. Wait in Dispatch for **Basin Head Cannery finish
preview ready.**, then select **Begin flight**. Use Chase to see the
harbour-facing side. An early Begin keeps the original look for that
flight. **Pause → Choose departure** lets you retry from the same
selected row. The existing **Open inlet preview** control still opens
the original inlet without this appearance option.

The procedurally authored wood and apron treatment is limited to
14 existing harbour-facing triangles on the Cannery's siding, doors
and apron. It adds no geometry, shoreline, physics, texture asset or
draw call. The old inlet, bank, footbridge and departure are unchanged.
See the [source and detached material checks](../../tools/art/basin-head-cannery-finish/).

On the exact opt-in build, a normal Chase flight submitted all three
material roles at about 321 m and 393 m from the launch. At about 521 m
the subject was no longer in the camera's aperture and the finish
submitted nothing. A fresh trusted Begin from the same selected row
submitted all three again. A separate live matched-framing test checked
the authored material effect on the same stock geometry. Most clear
changes are on the apron and siding, not tiny door details. The signed
launch proof is not a current site survey or a hardware performance claim.

The ordinary URL (without debugging enabled) also submitted all three
linked role programs after a real Begin. A separate launch with native
antialiasing disabled did not load the optional module; a healthy
module arriving after an early Begin did not change that flight.
