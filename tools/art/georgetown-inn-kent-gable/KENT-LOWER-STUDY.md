# Georgetown Historic Inn | Kent Street lower frontage

**Detached Three.js interpretation of the 2016 Kent Street elevation. Not installed in the flight simulator.** The new lower frontage joins a copy of the [original upper-gable specimen](README.md). The original standalone entry point and its art are unchanged. The new scene depicts this façade, not a whole building.

| Matching front view | Matching oblique view |
| --- | --- |
| [Before and after, 1× crops](optics-v1/front-matched.webp) | [Before and after, 1× crops](optics-v1/oblique-matched.webp) |

## What the reference supports

The [Canadian Register of Historic Places](https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=1662) identifies the inn. C. Stewart’s **2016 Side elevation** photograph for the Province of Prince Edward Island, [image 80830](https://www.historicplaces.ca/hpimages/Thumbnails/80830_Large.jpg), shows two broad windows with pale surrounds, red hoods and short sill supports, a white glazed door with dark blue above it, and white corner trim. The source JPEG reviewed has SHA-256 `a793201dfce7ded1e1eed93f2e9e7605e557cc6978f527103afe6fccef604f3c`. The register’s [Front elevation, image 80829](https://www.historicplaces.ca/hpimages/Thumbnails/80829_Large.jpg), and a photograph in the [operator’s gallery](https://georgetownhistoricinn.com/the-inn/) instead depict the Richmond Street verandah. Those views were not used to assign Kent Street openings.

These are publicly viewable references, not an assertion of a reusable image licence. No source pixels, textures, signs, interior photographs or scan projection are part of this study. Dimensions, offsets, colors, the pane grid and the opaque blue area over the door are hand-authored interpretations; they are not photogrammetry or a statement of current condition. No stairs, ground, annex, rear or additional roof faces are supplied.

## Geometry and reproduction

`inn-kent-lower.ts` exports `makeKentSide2016()`, with separate copies of the former upper specimen and the lower module. The unchanged upper has 791 triangles in seven meshes. The lower adds 378 triangles in seven meshes, with true window recesses, closed sloped hoods, solid sill supports and opaque analytic glazing. No user texture is introduced. The blue skin joins the existing studio section line at local Y=2.52 m; the back and bottom are display cuts, not a wall survey or real grade.

Tests check that the frozen upper source and packed positions, normals and UVs are unchanged, that the attachment exactly covers the studio section line, and that rays resolve the new openings, trim and opaque infill individually. Both hoods have closed welded face incidence and seat into the frontage. Strict TS type checking also passed.

The [paired-render receipt](optics-v1/receipt.json) records matched 900 × 660 studio cameras. Software EGL linked and ran the Three.js r187 standard material programs, using the actual r187 16 × 16 RG16F DFG integration texture, on 4× RGBA8/D24. Both repeated initial renders and immediate rollback were byte-identical. The front and oblique checks changed 88,179 and 84,159 pixels respectively at more than three RGB codes, all within the visible added-role marker, with unchanged alpha and zero outside changes. These are detached rendering checks, not WebGL browser or in-flight evidence.

From this study's directory, with the repository's installed dependencies and Python 3 plus NumPy, Pillow and Mesa EGL:

```sh
node --experimental-strip-types --test inn-kent-gable-study.test.mjs qa/geometry.test.mjs
out="$(mktemp -d)"
node --experimental-strip-types qa/export.mjs "$out/fixture"
EGL_PLATFORM=surfaceless LIBGL_ALWAYS_SOFTWARE=1 PYTHONDONTWRITEBYTECODE=1 \
  python3 qa/render.py --fixture "$out/fixture" --out "$out/views"
```

## Why the site is still held

The archived survey and footprint review remain in the [original study](README.md). The registered footprint overlaps only about 75% of stock owner `q11220/182`. A reserved 1 m roof flank check returned 0.97 m p90 against a 0.85 m limit, and the corresponding disjoint raw-return study also failed a threshold on each flank. The new façade does not close those roof or party-wall boundaries, prove a threshold height, or connect anything to terrain. Stock buildings, ground, collision and flight routes remain unchanged.
