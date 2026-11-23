# Victoria Row: the paved central carriageway

The Richmond Street section between Queen and Great George is a public
pedestrian corridor in summer. Its mapped wearing course now reads as
muted gray-brown interlocking pavers instead of generic asphalt. This
pass paints only the source-guarded core of one existing road mesh. It does
not move the road or curb, replace sidewalks, add traffic markings, change
flight contact, or claim to survey the shape of individual blocks.

## Evidence and extent

- [Charlottetown Area Development Corporation](https://cadcpei.com/projects/victoria-row/)
  documents its pedestrian project and its paved blocks. Two dated
  [Robert Cutts views from 2015](https://commons.wikimedia.org/wiki/File:Victoria_Row,_Charlottetown,_PEI_(19434790228).jpg)
  show the [gray central course](https://commons.wikimedia.org/wiki/File:Victoria_Row,_Charlottetown,_PEI_(19615795472).jpg)
  and separate materials beside it. They are visual references only.
  No image pixels or photographic material scans are packaged.
- The exact original [Statistics Canada National Road Network](https://open.canada.ca/data/en/dataset/3d282116-e556-400c-9306-ca1a3cada77f)
  record is `945ad7de4e214df08799f22a1a997a48`, local paved Richmond St,
  `PAVSURF=Blocks`, revision December 2022. The existing 5.6 m ribbon is
  retained; its width is an older visual approximation, not a pavement survey.
- [NRCan CanElevation point cloud](https://open.canada.ca/data/en/dataset/7069387e-9986-4297-9f55-0288e9676947)
  [PEI 2020 tile 390000 / 687000](https://canelevation-lidar-point-clouds.s3.ca-central-1.amazonaws.com/pointclouds_nuagespoints/PEI/Prince_Edward_Island_2020/pei_2020_390000_687000.copc.laz)
  contains 11,940 unwithheld ground returns in the clipped witness.
  Its 29 overlapping cross-sections independently support the lower central
  course. The two weak southern sections are still clear of the existing
  road edge. The painted guard is only 112 m long and stops more than 21 m
  and 22 m short of the corresponding road-center intersection controls.
  No added curb at guessed widths is inferred. The [pinned source receipt](../../data/victoria-pavers/public-geometry-witness.json)
  uses the same previously attributed [Richmond Street axis](../../data/odbl/victoria-row).

The paver pattern, chips, tone, roughness and bevel lighting are original
design. Pavers re-use the existing standard Three.js material pipeline
and road mesh. Other road colors, road normals, plane positions, contact
and seat offsets remain exact. The guarded tile's added branch runs only
for the matching original geometry and requires no texture request,
triangles or additional draw calls.

```sh
# Python QA: NumPy, laspy with lazrs, GDAL's gdaltransform.
python tools/geodata/check-victoria-pavement.py
node --experimental-strip-types --test test/victoria-pavers.test.ts
```

## Matched render and contact checks

[Before and after, two views](victoria-pavers-comparison.webp) ·
[Shader, native support and contact gates](victoria-pavers-render-gate.json).
At the locked 2.18 m and 39 m views the final, desaturated medium brings
159,582 and 52,264 scoped changes above four RGB levels.
All 935,037 pixels outside the actual visible mask
plus its one-pixel antialiasing guard are exact; the newer and older
renders have equal draw and triangle counts.

The predecessor with identical geometry, shader coverage and different
albedo tones also passes the actual 7.5 m view, a fully engaged `seatedRoads`
variant, and all 576,000 pixels in an independent East Point control.
Its unmodified production build flew 231.88 m in the public Charlottetown
harbour low-pass with all local building and ground detail tiles loaded,
without renderer or layer errors. The public source verification re-read 14
ranges (3,778,697 bytes) and reproduced 29 cross-sections exactly. The 144
automated checks cover normal, seated and budgeted geometry paths. Software
WebGL for these figures is not a device benchmark.
