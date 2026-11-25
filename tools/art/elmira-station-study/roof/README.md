# Elmira station · upper roof witness

A standalone roof study of the **1912 passenger station only**. It is not a complete building. No live stock surface, terrain, deck, or fixture is changed.

## What's measured

The four-vertex external Building Footprints/AEB ring identifies a roof envelope, **not a wall line**. Its registered area is **206.828 m²**. The eight upper faces form a hipped body with two ends and a raised central track-side dormer. The mesh uses 36 upward-facing triangles. Numerical points are stored relative to the owner’s local origin: the Three.js group restores absolute scene X and Z and orthometric Y in metres (CGVD2013).

The geometric recipe fits four central/hip planes, then clips and takes the upper envelope of a small four-part hood. It models only the visible top surfaces. The wall at the dormer cutoff is deliberately absent; the resulting opening is visible from low angles in the study. Fascia, chimney, precise flare beyond the sampled band, unseen architectural details and measured ground attachment are not included. The studio’s shingle size, colour, weathering and normal map are **artistic interpretation**, not survey evidence. They do not displace any metric vertex.

## Independent result and the boundary that matters

The author received a frozen 12-role train-only subset of the 2020 acquisition (264 authorized positions: 181 roof, 83 dry-ground observations). The ground observations were not used to fit the roof. No withheld heights were shared. The independent read used spatial separation, point-pulse group safeguards and the highest actual Three.js intersection, rather than scoring the analytical equation that produced the mesh.

- **169/169** independent roof rays intersected. All ten roof regions passed. The largest per-region 90th-percentile absolute error was **0.069373 m**, for the tested eastern crown. This does **not** mean every point was within 6.94 cm.
- **Eastern dry turf failed**: the existing rendered ground was **0.216921 m too low at the median** (23 independent observations; 90th-percentile absolute error 0.267089 m). A separate physical-terrain comparison was 0.300 m too low at its median.
- **Far yard passed**: the rendered ground median error was −0.073724 m (39 observations; P90 absolute 0.144376 m).
- Western crown, eastern track eave, western ground contact and open northeast yard remained untested. Simulated surfaces there are predictions, not measured validation. The model was not refitted after the result.

The complete [independent aggregate](./independent-aggregate.json) is unmodified. Published records are aggregate comparisons, not the original height return stream. The [training-ray aggregate](./training-ray-aggregate.json) is separately labelled. CanElevation and the extracted footprint relate to the same acquisition; this is not independent chronological confirmation.

## Repeat the geometry check

Using the project’s Node environment and installed dependencies:

```sh
node --experimental-strip-types tools/art/elmira-station-study/verify-study.mjs
node --experimental-strip-types tools/art/elmira-station-study/roof/emit.mjs
node --experimental-strip-types tools/art/elmira-station-study/roof/emit.mjs --output /tmp/elmira-roof-xyz.json
```

The emission contains named, ordered absolute scene XYZ triples. Adjacent upper facets share edges or vertices only; interiors do not overlap. Roof extent takes the registered quadrilateral seriously, rather than replacing it with an expanded bounding box. The exact emitted geometry SHA-256 is `ad6b913a201e61acbf480b7a2716c9d63aed0bb3f258c30fcb15756f25f2d759`.

To inspect the appearance, run `npm run dev` and open `/tools/art/elmira-station-study/roof/`. Track side, end caps, dormer and plan use the same vertex positions. Four button views rendered identically on immediate repeat; see [studio gate](./studio-gate.json). The sealed emitter is independent of this optional finish and does not fetch anything.

**Source/attribution:** Contains information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada), Natural Resources Canada, [CanElevation LiDAR Point Clouds](https://open.canada.ca/data/en/dataset/7069387e-9986-4297-9f55-0288e9676947). Architectural identity and visible characteristics come from the [Canadian Register](https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=4604), [2004 record photographs](https://www.historicplaces.ca/en/rep-reg/image-image.aspx?id=4604), and [the provincial anniversary publication](https://www.princeedwardisland.ca/en/news/elmira-railway-museums-50th-anniversary-celebration). No exterior photograph, orthophoto, or Google pixels are embedded.
