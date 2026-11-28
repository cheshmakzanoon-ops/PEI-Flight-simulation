# East Point: join the measured roof to the original walls

The two [detached roof caps](../) lie **below** the old flat caps. Placing
them on top of the existing tile would not show a new roof. Removing
the old cap alone would leave the old wall tops extending up to about
2.67 m and 1.98 m above the new profiles. This study makes the roof
and upper-wall cut one fitted geometry operation.

The [old signed owner replay](stock-owner.mjs) reconstructs the exact
non-indexed q1333 streams from signed building bytes and the original
terrain response. It derives the same original positions as the
live optional wall preview. The new plan snaps the survey-model
perimeter to the exact original Float32 plan vertices, cuts existing walls
at the candidate roof surface, and reuses literal shared rim positions
including the old wall diagonal intersections. The lower rim remains
on the original wall-bottom geometry and is not capped or moved.

| q1333 row | Old complete wall + roof triangles | Proposed wall / roof triangles |
| --- | ---: | ---: |
| 48 | 22 | 32 / 34 |
| 49 | 16 | 26 / 24 |

There is no uncovered roof-to-wall edge. The only unmatched edges
are subdivisions of each building's old bottom perimeter. Newly
clipped wall vertices retain the original face normal, color and
wall-fit words, with UVs interpolated on each original wall triangle.
Original roof color, ordinary roof UV convention and roof role
are retained; new roof normals come from the sloped triangles.
The numerical wall snap tolerance is under 0.00027 m, not real-world
survey precision. The surrounding tile contents before, between and
after the two slots match byte-for-byte across **all seven streams**.
Every other building is left unchanged.

[The offline buffer proof](seven-lane-proof.json) gives **234 additional
vertices / 78 triangles** in the one existing proposed draw; this
does not measure native frame rate or prove actual color/camera scope.
The current East façade option deliberately refuses a tile whose full
geometry and tags no longer match its old source. A combined option
must re-authenticate the new update; do not patch the preview's
hash check to accept all roofs. A true native same-frame test must
cover the coupled rim and roof, the surrounding structures and the
original window/trim appearance. No in-game roof, wall, landing,
contact, source data, material definition or route is changed by
the detached prototype.

From the repository root with Node 24 and the pinned dependencies:

```sh
study=tools/art/east-point-measured-roofs/rim
node --experimental-strip-types --test "$study/verify-rim.test.mjs"
node --experimental-strip-types "$study/replacement.mjs" /tmp/east-point-rim.json
cmp /tmp/east-point-rim.json "$study/seven-lane-proof.json"
```

The [normal Chase comparisons](ordinary-chase/) now show both rebuilt roofs in a private flight test, including an unchanged out-of-view frame. The public simulator still uses its original roof geometry.
