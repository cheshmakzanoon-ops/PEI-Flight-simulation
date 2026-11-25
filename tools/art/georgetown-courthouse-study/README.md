# Kings County Courthouse · held studio archive

This code is not imported by the simulator. See the [evidence and limitations](../../../docs/qa/georgetown-courthouse-hold.md) and the [matched scene-only plate](../../../docs/qa/georgetown-courthouse-held.webp). The 2008 independent check supported the west main roof only; the reconstruction remains held.

With the repository dependencies already installed, run:

```sh
node --experimental-strip-types tools/art/georgetown-courthouse-study/reproduce.mjs /tmp/pei-courthouse-study
```

The replay is offline and requires the pinned projection in `src/sim/geo.ts`. It stages the original four model files in a temporary directory so their bytes and imports stay unchanged. It checks the model and buffer SHA-256 hashes, verifies roof coverage against the retained outline, and generates `geometry.json`, `report.json`, and west and southwest silhouette SVGs. Omit the output directory to check the receipt without exporting. Replay hashes were produced on Node 24 with the repository’s locked Three.js.

The model stores only original render geometry, procedure and derived roof coefficients. No raw LiDAR, original photo pixels, historic drawings or actual survey exports are in this archive. The SVGs show mesh silhouettes, not the original world’s lighting, terrain or streaming state.
