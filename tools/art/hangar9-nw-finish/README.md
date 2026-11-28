# Hangar 9 northwest apron face

This is an original Three.js material study shown in [matched simulator
captures](../../../docs/qa/hangar9.md#northwest-apron-wall-study). It is not
enabled in the game. It replaces the generic colour treatment on two
existing triangles, without moving their wall or changing any other face.

The [operator's listing](https://slemonpark.com/available-properties/900-aerospace-blvd/),
[brochure](https://slemonpark.com/wp-content/uploads/2021/04/900_Aerospace.pdf)
and [2018 site directory](https://slemonpark.com/wp-content/uploads/2018/04/Slemon-Park-Tenant-Map-2018-1.pdf)
place Hangar 9 at 900 Aerospace Boulevard and show a broad opaque apron
entrance. The repeated aircraft and the adjacent Hangar 10 identify its
northwest-facing side. This establishes the face and its general opaque
character, not a surveyed colour, wall height, door layout or material.
No source photography or plans are included.

The signed AEB owner is q0322/64, edge 17, and the original non-indexed
draw submits its two northwest triangles at vertices 4935–4940. The
study uses an original muted grey-green paint approximation with
pixel-filtered tonal variations, keeping the stock lighting, distance
haze and depth output. The stock roof, southwest face and nearby
surveyed roof remain unchanged. The finish cannot supply unsupported
architectural details, and the unchanged faces still look generic.

From the repository root, after installing the normal project dependencies:

```sh
node --experimental-strip-types --test tools/art/hangar9-nw-finish/source.test.mjs
```

The focused tests cover original source/draw scope, the exact stock shader,
borrowed uniform identity and refusal of incompatible prior state.
They are not a player launch or operating-system performance test.
