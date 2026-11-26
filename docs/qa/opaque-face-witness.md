# Verifying one opaque scenery face in a full flight frame

A building's projected box includes the roof, neighbouring walls, and
sometimes several objects behind or in front of it. A box-only RGB test can
miss a misplaced material change. Use exact stock-face witnesses before
promoting an edit that is supposed to change a particular wall.

1. Authenticate the source mesh, material and exact face spans independently
   of the proposed art. Keep any ambiguous or unmapped faces protected.
2. Freeze the native camera, simulation, sky, scene and quality settings. In a
   single synchronous renderer sequence capture stock, two contrasting stock
   face markers for each role, candidate, repeat, and stock restored. Keep
   the same stock transforms, backface state, depth, antialiasing and full
   scene occlusion in the marker passes. The marker should change only RGB on
   the independent stock face. Do not infer the mask from the new shading or
   trust a crop that omits nearby objects. Register each face's projected
   stock hull independently of witness colours, with a stated raster margin;
   the optional `projectedHull` input counts any escaped witness pixels.
   `outsideHull: null` means no independent hull was checked.
3. Give `auditOpaqueFaceWitness` the complete decoded straight RGBA8 frames.
   Compare exact RGB changes with the union of the two-marker differences for
   the allowed roles. Use `outside`, `protectedOnly`, per-role coverage,
   `sharedChanged`, exclusive-role counts, `alpha` and `rollback`
   separately. Shared edge pixels do not count toward a face's exclusive
   positive quorum. Any candidate or marker alpha drift
   invalidates an opaque material-only result. Require a useful visible
   positive on the real route, not merely a nonzero change.
4. Also require exact repeat, no GL errors, and appropriate draw/triangle
   budgets. A reciprocal or disarmed control should show an independently
   marked protective face while the edit is known to have been offered. An
   invisible wall, empty witness or refused asset alone is not a positive
   photo or rendering check.

Run the unit fixtures with `node --test tools/qa/opaque-face-witness.test.mjs`.
The helper makes no network requests and does not ship with the simulator.

## Limits

The witnesses measure resolved image pixels, not individual MSAA samples.
At the edge between two faces a single pixel can contain both. The utility
reports this via per-role overlap without claiming that the protected
samples in that pixel changed. Prefer a separate reciprocal view that
isolates the protected face. Keep coverage and the signed owner range next
to the artifact, along with separate source, modelling and visual approval.
This pixel check cannot certify survey accuracy, absolute colour, runtime
performance or that the source photographs represent the current building.

The Brass Shop motivated the stricter scope: the first geometric recess
changed one resolved alpha pixel on a close edge even though two normal
flyby frames were in the expected area. This check is not an exception to
that failure, and it does not enable the experimental facade in flight.
