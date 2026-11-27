# Port Borden rear range: detached art workbench

An original Three.js model of the relocated 1917 rear range light at Marine Rail Park, Prince Edward Island. V1 is the original simple silhouette. V2 adds an inset shaft sash, a small brow, pale framed lantern optics and understated local shingles. It models **only** the tower, not the park, adjoining low structures, terrain, external stairs or live navigation.

The 12.8 m overall height comes from the [PEI Lighthouse Society's account](https://peilighthousesociety.ca/index.php/lighthouses/range-lights/80-port-borden-back-range-light) and [LighthouseFriends' base-to-vane description](https://www.lighthousefriends.com/light.asp?ID=974). The fine dimensions and local face directions are illustrative, not survey claims. Observation references include [Dennis G. Jarvis's 2015 park photo](https://commons.wikimedia.org/wiki/File:Marine_Rail_Park_(22097625090).jpg), [DanBhentschel's 2017 close view](https://commons.wikimedia.org/wiki/File:PEI_Port_Borden_Back_Range_Lighthouse.jpg), and [the credited 2023 exterior view in the UNC iBiblio directory](https://www.ibiblio.org/lighthouse/peiw.htm). No photo, copied pixel, geodata, terrain, shader texture or outside asset is included. The live stock owner and its lower residual structure remain unmodified and are outside this workbench.

## View or build it locally

Node.js 22.12+ and npm. Playwright and pngjs are optional unless you want native QA.

```sh
npm ci
npm run verify:cpu
npm run build
npm run studio
```

Open the local URL printed by Vite. The server binds only to loopback. In the model module, `buildBordenRearTower('close')` or `buildBordenRearTower('medium')` returns a detached, opaque mesh and contiguous role spans. It deliberately has no World, geography, lights, site/shadow or owner API.

## Optional actual WebGL proof

```sh
npm exec -- playwright install chromium --only-shell
npm run build
npm run verify:native -- proof-local
```

Use a new empty destination name. You can set `BORDEN_CHROMIUM_EXECUTABLE` to an absolute path to a trusted local Chromium executable. The proof starts its own one-use server on an ephemeral loopback port. No fixed port, donor images, external requests or private project artifacts are needed. It closes the browser and server when done.

The native proof replays immutable V1 and V2 in the same exact cameras, reports per-panel depth-registered scope, alpha, draw cost and rollback, and checks the old image's decoded RGBA8 against the pinned reference manifest. A different Chromium/GPU/driver may render different pixels. That run reports **HOLD** and retains its receipts rather than quietly changing thresholds. Reference was SwiftShader with ANGLE, 4× coverage, Three r187. The one internal DFG lookup used by vanilla MeshStandardMaterial is unchanged; the authored art adds no textures. A pass concerns this detached fixture only, not placement, game release or device performance.

`BORDEN-REAR-DETACHED-V2-PRELOCK.md` is the original frozen visual/technical scope. `AUTHOR.sha256` provides exact source and manifest custody.
