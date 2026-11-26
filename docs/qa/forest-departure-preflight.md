# Use mapped woodland heights at a bookmarked departure

Opening a known `?departure=` link now points the existing woodland
warm-up at that departure rather than Cavendish. The initial map can
therefore use the [already shipped EFI2020 stand heights](forest-height-stream.md)
instead of first creating fallback trees and then keeping those cached
trees even after the local map arrives.

This does not add trees or identify individual real trees. It changes
neither their roots, the terrain, the flight model, the source files,
the first-frame wait ceiling for woodland, nor the two-request stream
limit. The existing protected Crown, Miscouche, and regional starting
choices keep precedence. Missing and unknown departure links retain
the prior Cavendish path. This work addresses bookmarked starts;
it does not preload every choice in the in-game Dispatch list or rebuild
already visible foliage during flight.

## Measured Standard-route comparison

On the ordinary **Kings County · inland meadow pass**, the compiled
player retained 1,424 old crown slots in the audited region. The same
native position, width, height and variant roster hash in both unmodified
reference frames was the exact fallback hash, even when the nearby
height tile reported ready. In both direct preflight frames, the hash
was the exact previously authenticated stand-height version. Selecting
the departure changed the *dimensions* of the same slots, not the
coordinates, available foliage variants, aircraft, or collision.

At approximately 6 and 8 seconds into the ordinary Chase route, a damaged
source chunk, an absent optional directory, and a deliberately stalled
chunk each preserved the exact old fallback roster and kept flight working. The [native receipt](forest-departure-preflight/native-roster.json)
records the actual streamed tile states and selected pack ranges. Delay
measurements in the managed software-rendered browser are not published
as a promised loading time or hardware benchmark.

[Woodland provenance and normal fallback semantics](forest-height-stream.md).
