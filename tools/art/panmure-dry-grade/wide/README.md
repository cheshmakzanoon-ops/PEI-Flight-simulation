# Panmure Head: a wider, gentler terrain candidate

The [first dry-pasture variant](../README.md) showed a genuine local
elevation difference but produced an artificial hump with its 3 m
transition. This **detached 20 m transition** is a separate attempt
to show the surveyed contour gradually. No version changes the
playable terrain or its collision surface.

The broad numerical screen starts with the same archived NRCan 1 m
bare-earth and surface samples as the first study. Whole-cell road,
building, lighthouse, vegetation and distance exclusions leave one
6,495-cell dry component (about 6,301 m²). Positive margins are against
existing buffers, not distances to the actual features. The
[guard receipt](data/peer-guard.json) gives the signed road and
woodland checks. It uses exact numerical source data for the
measured interior and an authored transition back to the stock plane.
Contains information licensed under the
[Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).

## Improve the contour without changing the source vertices

The first detached broad cut kept its original 12 stock-facet planes,
but the browser shader's Float32 model translation collapsed ten
synthetic split triangles and reversed two. The [repaired packet](data/repair.json)
changes only derived interior connectivity. It preserves the original
position bytes, 6,798 native lattice vertices and 666 full-source
vertices or split points. All 632 directed perimeter edges are
unchanged. The 14,754 triangles have no collapsed or reversed faces
after that same Float32 translation. The largest new slope is about
**10.73%** in those coordinates, compared with **38.9%** in the narrow
study. The exact measured region was not shortened to pass this
check.

Five synthesized clip references share their native neighbour's
projected point; none is an independent measured sample. The continuous
changed-star audit found up to 0.0472 mm in the active
surface and 0.00743 mm in neutral interpolation compared with the prior
cut. This is **not** an exact-neutral pass for the earlier experiment.
The minimum translated triangle height is under 2 mm. The original
terrain collision remains as much as about 0.91 m below or 0.51 m
above the candidate surface.

### Earlier isolated optical check

The [approach](earlier-optics/approach-matched.webp) and
[near](earlier-optics/near-matched.webp) detached plates use the broader
pre-repair cut and neutral workbench lighting. They are not images of the
repaired packet and are not from the running simulator. They show a
subtle change in contour, not a new grass texture.

**Installation remains on hold.** The packet represents an open cut,
not a complete replacement for the original terrain triangles. It still
needs a verified surrounding stock complement, native matched views,
and a separate contact decision. The repaired packet does not
automatically replace a terrain tile and has no game import.

Run the detached custody, original rim and Float32 slope check from the
repository root with the existing installed dependencies:

```sh
node --experimental-strip-types --test tools/art/panmure-dry-grade/wide/topology.test.mjs
```

The [separate compact carrier](../compact/README.md) replaces one intact
regular-mesh cell instead of trying to sew this open perimeter. It does
not make this larger cut attachable and is not installed either.
