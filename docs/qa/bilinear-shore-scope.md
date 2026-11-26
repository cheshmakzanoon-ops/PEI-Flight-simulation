# Prove the continuous scope of overlapping shoreline masks

An image comparison or a dense coordinate scan can miss a small change
between sampled positions. Use this audit before approving a new local
land-to-water mask over the packaged province coast field. It is a source
and render-scope check, not a current tide, coastline, or collision survey.

`certifyWetScope` partitions the region at both bilinear texture-centre
grids and at the edges of an independent grid of allowed cells. Within
one resulting rectangle, each field is bilinear and attains its maximum
on a corner. The allowed-cell classification is constant on the open
rectangle; the test includes its closed corners conservatively. It finds
rectangles where old dry ground and proposed water **could** overlap
outside allowed cells. Independent maxima need not occur at the same
point, so the unresolved area is an upper bound, not a claim of leakage.

Inputs are world-space metres and explicit scalar thresholds; the
origin of each rectangular field is its outside edge, half a texel
before the first centre. Only run on the full bounds in which the
new mask may take effect. Do not treat an audit of a hand-picked crop
as a global guarantee. The old field and candidate may have different
origins, spacing or dimensions. A caller supplies any known numerical
margin using the relevant scalar units.

## Cape Tryon example

An independently derived Cape Tryon trial field was checked against the
decoded stock atlas and the sealed trial cell enclosure. Across
**422,730** closed rectangles, exact CPU inputs gave no unresolved
overlap. The nearest old value outside allowed cells was about
**0.057 raw Cover codes below dry**. That is not enough to authorize
native rendering: a conservative half-code allowance exposed **1,822**
potential rectangles (up to **283.28 m²**), a result a finely sampled
nominal pass alone could miss. These are possible overlaps, not
observed visual leaks. The candidate remains private and is not
enabled in the simulator.

[Compact Cape Tryon receipt](bilinear-shore-scope/cape-private-field-receipt.json).
Run the six self-contained fixtures:

```sh
node --test tools/qa/bilinear-shore-scope.test.mjs
```

A release also needs native land/water/cliff depth, verified seam
closure, exact control areas and coherent simulator contact. Those
checks cannot be inferred from a CPU scalar certificate.
