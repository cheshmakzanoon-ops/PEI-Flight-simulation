# Summerside City Hall: original detached exterior study

A Three.js/TypeScript architectural study of the former Summerside Post Office
at Fitzroy and Summer Streets. This is **not installed in the flight atlas**;
the viewer has a neutral studio floor, no collision, no route changes, and no
claim about the exact present façade, approach or historic fabric.

## Source and authorship

- [Canadian Register of Historic Places 2753](https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=2753)
  and [national designation 7418](https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=7418&pid=0)
  establish the building identity, Romanesque Revival brick/sandstone traits,
  the later four-faced clock, and a separate 2003 eastern addition. Register
  exterior photographs were factual reference only.
- [City/ARCHwork 2024 tender sheets A001 and A002](https://cdnsm5-hosted.civiclive.com/UserFiles/Servers/Server_19514871/File/Building%20%26%20Development/Tenders%20%26%20RFP%27s/2025/Summerside%20City%20Hall%20Roof%20Replacement-%20ISSUED%20FOR%20TENDER%20Drawings.pdf)
  distinguish the broad membrane, slate slopes, grouped dormers, gables and
  the four-plane clock stem. The public [2026 municipal tender page](https://www.summerside.ca/cms/One.aspx?pageId=20114963&portalId=19514956)
  supplies a comparative proposal elevation A200. Grouped openings and west
  arch rhythm are an original architectural interpretation of visible traits.
  Proposed windows, accessibility work, railings and stair construction were
  **not** treated as evidence of completed construction.
- [2024 City Council minutes](https://www.summerside.ca/UserFiles/Servers/Server_19514871/File/May%2021%20minutes.pdf)
  document approval for removal of the separately recognized Customs House/annex.
  This is not itself proof of later completion. A dated, separate
  `?annex=survey2020` studio illustration is not in the base scene; neither
  mode claims the annex is present now.
- Near-roof survey evidence is the [NRCan 1m HRDEM family](https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-mosaic-1m/10_3-mosaic-1m)
  and [classified open 2020 PEI COPC](https://canelevation-lidar-point-clouds.s3.ca-central-1.amazonaws.com/pointclouds_nuagespoints/PEI/Prince_Edward_Island_2020/pei_2020_339000_705000.copc.laz)
  (source ETag `f4f6316d077d348e743ca65c3b19c029-7`; nine bounded reads,
  2,309,123 bytes). Relative survey-local reconstruction
  uses method/code below. The source atlas identifies the main shape as
  `q03200300 / ordinal 35`; this old polygon omits the clock tower's high
  survey returns. The authored local model is **not** a replacement for the
  AEB polygon or a new municipal footprint. A wider provincial comparison
  intersected existing mapped protected neighbors and is not used as model
  input or redistributed. No photographs, source floorplans, copyrighted
  diagrams, COPC point exports, mapping tables, or aerial textures are included.

## Measurement and render checks

The ground datum is a detached reference only. Samples were taken from
25cm cell medians, leaving spatial 1m cells out of each fitted panel. Actual
Three.js down rays found:

| Dated region | Samples | Actual mesh absolute p90 |
|---|---:|---:|
| Main membrane, retained class 6 | 377 | 0.068m |
| West measured upper station, retained class 6 | 23 | 0.063m |
| Upper clock, corroborative unclassified samples | 70 | 0.473m |

The clock checks cover one sensor flight line and cannot establish all sides
or absolute as-built geometry. Some modeled chimney/dormer details can
occlude otherwise-above main flat sample rays; the distribution is not a
whole-roof guarantee. No vegetation, footprints, shadowing on nearby roads,
terrain, property access or physical navigation geometry was altered.

Default E2 has 25,917 original triangles in 54 author-review batches.
Finite per-vertex attributes and nondegenerate geometry were
checked on exact Three.js output. Actual browser photos use only generated
geometry, physically modeled relief, original analytic surface variation,
and a neutral procedural studio display. Performance should be measured
with a later bounded in-world mesh before claiming device FPS.

## Reproduce the studio

At the repository's matching Three.js and Vite versions, run
`npm run build` then Vite preview. Presets use `?pose=street`,
`?pose=clock`, `?pose=southBay`, `?pose=westBays`, `?pose=masonry`,
`?pose=roof`, `?pose=northeast` and optional `&overcast`.
`node --experimental-strip-types structural-audit.mjs` checks the original
model. `python3 roof-fits.py <frame.npz>` consumes the independently
registered local native point sample (not bundled). To check actual
mesh intersections, use `python3 make-witness.py <frame.npz>` followed by
`node --experimental-strip-types roof-rays.mjs proof/private-mesh-witness.json`.
The optional Playwright render script uses the installed Chromium when not
given `CHROMIUM_EXECUTABLE`; it writes captures to the relative `proof/`.
The viewer has no CDNs, image fetches or externally hosted runtime assets.
