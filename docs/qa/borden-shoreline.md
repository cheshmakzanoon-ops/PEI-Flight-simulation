# Borden-Carleton shoreline continuity

Standard scenery now has a local visual repair for the small sky-coloured gap seen from some low passes near Borden-Carleton. It applies to one signed atlas cell, about 47 m across. It does not change the coastline data, terrain elevations, water level, collisions, departure list, or flight model.

The repair follows the computed bilinear contour of the existing cover grid and seats a narrow mesh against the current rendered terrain and water. It only colours samples that still have the default clear depth after the regular opaque scene. At a few edge pixels, a bounded one-pixel pass checks the independently signed terrain, shoreline, and sea intersections. The original shoreline and scenery always render normally.

The repair is conditional. It uses the default-framebuffer WebGL 2 path with four multisample samples and the recognized Three.js r187 draw state. Unknown material or foreground coverage, an unsupported context, missing current source data, and uncertainty while the vegetation roster uploads all leave the regular scenery in place. The renderer does not wait on an unfinished GPU fence. Add `stockBordenCoast` to a normal Standard URL to compare with the original; it does not turn off other Standard features.

## Verified views

| Frozen view | Old connected gap | Residual | Result |
| --- | ---: | ---: | --- |
| Southwest | 6,523 pixels | 17 pixels (0.26%) | Pass |
| Harbour | 593 pixels | 20 pixels (3.37%) | Pass |

The same build changed 1,875 pixels on the southwest flight sample and 949
and 889 on two harbour samples, all inside the original sky mask. Both
moving routes preserved all alpha and reproduced their stock images exactly
when the translucent overlap was inserted. These are Chromium/SwiftShader
results for the bounded repair, not a device-performance claim or a
province-wide shoreline result.

## Replay

With the repository installed and Python Playwright, Pillow, NumPy, and SciPy available, run the source-preserving native replay with a Chromium executable:

```sh
python tools/qa/borden-fixed-coast.py --checkout . --out /tmp/pei-borden-check --chromium /path/to/chromium
```

The two frozen 980 × 630 views are checked against a 5% residual-sky threshold across the old gap, exact original colour and alpha outside the sky mask, and a separate opaque overlap that must return the entire image and draw count to stock. Repeat with disjoint output directories and `--stock` or `--no-msaa` to check the independent fallback cases. The numeric [centre-ray regression](borden-centre-rays.md) checks the signed geometry separately.

The motion check uses two temporary local departures and ordinary Chase flight. It samples four travel distances on each heading and verifies exact stock fallback for a real translucent overlap at a positive view, stable publication outside the repair, and an unchanged original scene when the patch is out of view:

```sh
python tools/qa/borden-flight-coast.py --checkout . --out /tmp/pei-borden-flight --chromium /path/to/chromium
```

These replay seeds exist only in the disposable test copy; they are not player departures or real-world flight guidance.
