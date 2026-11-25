# Dalvay glazing: independent review

**Visual judgment:** a narrowly scoped, restrained optional finish. At the dry lawn view, the low curving ribbon of windows is a little brighter, especially around parts of the return. The trim, stone and exterior silhouette do not move, and the effect does not read as a bright mirror. The windows can still look like opaque dark glass; there are no rooms or object reflections behind them. This modest pane finish does not make the building or its surroundings photorealistic.

## Four locked appearance views

The [preregistered gate](registered-g2.json) binds 504 pane triangles, including 54 in the curved wing, to the existing RC2 model and four original game cameras. All comparisons render the same native frame with original panes → optional finish → original panes → repeated finish. Reference material, geometry, depth, atmosphere, water, sky source and clock stay fixed. The disabled, restored, no-op and rejected-certificate frames equal the authentic RC2 baselines byte for byte.

| Registered camera | Changed by >2 RGB codes | Strict visible wing subset | Exactly unchanged exterior pixels |
| --- | ---: | ---: | ---: |
| 71 m, dry lawn | 7,534 | 3,294 | 519,466 |
| 105 m, northwest | 479 | 7 | 530,814 |
| 280 m, over the named lake | 268 | 57 | 537,996 |
| 487 m, opposite bank | 0 | 0 | 539,216 |

The [scope replay](fixed-camera-scope.json) measures the continuous pane footprint against every full pixel plus a conservative two-pixel margin. In the primary wing, a changed pixel also has four quarter-pixel samples on the actual wing after mesh self-occlusion and differs from the matched subject-withdrawn capture. Peak primary change was 14 codes; the wing has no newly near-clipped values. The [negative controls](negative-controls.json) confirm that one out-of-scope RGB-code error or a single different fallback pixel fails even with freshly matching frame hashes.

## What “sky” means in this test

The [ray replay](sky-direction-replay.json) uses the signed glazing normals and the exact camera lenses. The near lawn, northwest and 280 m views point down in mirror space for the unmixed pane samples, so these captures predominantly demonstrate the **neutral below-horizon tint**, not cloud images in glass. The across-lake pose has a small upward source weight before distance and pixel-footprint attenuation, but its finished image exactly matches RC2. Do not label those views as showing reflected clouds.

The sampler reuses the existing authenticated in-game sky only when the camera, render target, ownership and material are eligible. This is a simulated visual treatment, not measured glass roughness or index of refraction, and it cannot verify current conditions at the real inn.

The separate [technical witness](technical-sky-registration.json) lowered only the eye at the same 71 m point to **1.65 m above original game terrain**. Its [evidence](technical-sky-evidence.json) isolates, in a native same-tick render, the contribution of the authentic above-horizon sky on the glass. Of 3,580 strict visible dining-wing pixels, 2,127 changed by one code and eight by two; none met the predeclared bar of 50 pixels with changes above two. This was not an occlusion failure. The second, detached WebGL test compiled the exact G2 function and observed a four-code change in a deliberately upward ray when only the authentic sampled texture was replaced by an empty test texture; the downward and too-near controls stayed identical and the original result returned exactly. That proves the source is actually sampled; it does **not** upgrade the appearance verdict.

## Renderer checks

The [material control receipt](material-controls.json) ties all 32 registered states to the exact G2 source and compiled build. The original material and signed mesh remain opaque, with the same texture, draw and indexed-triangle counts. The rejected V1 produced actual WebGL `INVALID_OPERATION` on a cached program switch. G2 invalidates the renderer cache for the existing glass material only at a deliberate mode transition; eight steady repeat renders at each view show no further invalidation, extra passes or GL errors. Zero added passes and transfers is not a claim of zero fragment-shader time or device FPS.

The [compiled-control receipt](compiled-admission.json) covers unmodified production flight with the option enabled or vetoed. The authored manor stayed mounted; verified source and art arrived exactly once in each healthy flight; lake optics stayed off. The ordinary Begin flight, Cockpit, Wide chase and Pause controls worked with no GL error. In a separately matched fixed view, the absent option and the explicit veto render the exact authentic stock baseline. A wrong-digest verification response with the same legacy sky still available initializes no glazing hook and exactly matches the equivalent vetoed frame. This checks rejection of untrusted optical input, not that the application can fly without any sky available.
