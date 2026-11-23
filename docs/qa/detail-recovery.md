# Recovering high-detail imagery in flight

The base atlas remains visible while optional near detail is downloading.
A temporary failure previously left a tile permanently at base resolution,
and a failure of the shared detail index prevented every tile from loading.
The loader now coalesces concurrent index requests, uses a bounded response
timeout and returns transient failures to the queue after a delay. It uses the
existing three-request tile budget, at most two retries per tile, and never
accepts a wrong byte range or bad checksum. A missing index entry is recorded
as no optional coverage, separate from a failed tile download.

The player still falls back for permanent errors and beyond optional coverage.
No imagery, shoreline, terrain geometry or flight state derives from this
retry logic. The published coverage is measured on the detail raster grid:
a tiny coastal sliver can still appear in the base atlas without a tile.

## Production fault check

Build with `npm run check` and run
`python tools/qa/detail-recovery.py --dist dist --chromium CHROMIUM`.
The Chromium test injects one 503 into the detail index and one into the
first exact tile byte range. Both recover on their next request while
the unmodified production player stays in flight; 12 detail tiles were
ready, with none loading, retrying or failed when the check settled.
