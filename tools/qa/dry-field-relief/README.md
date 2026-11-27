# Detached 17-15 render bracket

Production code does not import this tool. It is a QA probe for the particular signed 2020 terrain inset in the [measured field study](../../../docs/qa/measured-field-relief.md). The shipped simulator does not read this packet, change a terrain receiver, or expose a departure for it.

In an isolated testing copy, import `prepareDryInset2Probe` from `tools/qa/dry-field-relief/probe.ts` into the existing Three.js scene. Pass that scene's `World`, current terrain digest, camera, and an `ArrayBuffer` with the exact bytes of `dated-grade-cm.bin`. Admit only the documented stock render path while the `17-14 / 17-15` image seam is actually resident at gain 1. Neither the probe nor the packet makes a fetch or uses historical photograph pixels.

Render an otherwise identical frame synchronously in each mode. Keep the camera, default render target, lighting, time and scenery unchanged across all four callbacks:

```ts
const rig = await prepareDryInset2Probe(world, terrainSha, camera, payload);
if (!rig) throw Error('The exact stock owner or render path was not present');
const snap = () => {
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL();
};
const old = rig.withDraw(false, snap);
const grade = rig.withDraw(true, snap);
const zero = rig.withDraw('tessellation', snap);
const restored = rig.withDraw(false, snap);
if (!grade.shown || !zero.shown || old.result !== restored.result)
  throw Error('The probe did not complete and restore the expected comparison');
rig.dispose();
```

The zero-relief control uses exactly the same indices and UVs as the measured surface. Use the same control before attributing subtle changes to measured shape. A source mismatch, wrong owner, unsupported context or changed scene must show the original mesh. The returned values are not a physics lease. See the [receipt](../../../docs/qa/measured-field-relief-receipt.json) for the validated poses and limits.
