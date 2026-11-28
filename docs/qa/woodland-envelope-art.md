# Woodland branch envelope study

This detached Three.js study develops two believable canopy forms: a fuller
lower broadleaf crown and a more open lower needle crown. It interprets
already published stand-scale height and crown-base data from PEI's [Enhanced
Forest Inventory 2020](https://data-princeedwardisland-peigov.hub.arcgis.com/datasets/8a7638bdc09648358e0b6fd14be6117a).
The [source and data limits](woodland-crown-base.md) still apply. The result
does not identify individual species, trees, current forest conditions or
exact canopy clearance.

| Archive | Published tile | Styled branch instances |
| --- | --- | ---: |
| Prince County, near view | 7-12 | 28 |
| Queens County, two views | 13-13 | 15 and 9 |
| Kings County, near view | 28-12 | 32 |

The original stock branch surfaces provide the baseline. The original
positions, plant heights and widths, upper crown, textures and triangle
counts are retained. A smooth lower-crown adjustment uses the stand scale
to reshape the original 3D surfaces, with corrected normals and no new
texture. The independent style data supplies three floats for each existing
instance. The detached adapter adds no draws and refuses an input above
82,000 original branch triangles. The baseline branch batch itself uses
up to four draws. The extra-draw claim is relative to that existing
branch batch, not Standard. Those are construction limits, not frame rates.

The study verifies the original height and crown ratio tiles against the
published packs before using them. It never fetches extra data. The
comparison can only run on fresh, already owned branch meshes; it borrows
no live stock or ground shadow materials. Starting before the source
is verified or losing ownership leaves the comparison off.

Run the signed-data and Three.js ownership checks offline:

```sh
node --experimental-strip-types --test test/woodland-envelope-art.test.ts
```

The source and the tests are outside the game bundle. The four archived
views were rendered only as authored branch geometry in an isolated 4×
Mesa comparison, without world terrain or cast shadows. The 24 Queens
style records match the exact frozen original intact-branch roster.
Prince and Kings use signed-data reconstructions, not proven live branch
rosters. These results do not establish full-world optics, true shadow
changes, frame rate, or a playable province-wide tree update. Each county still
needs an ordinary flight comparison against its unmodified world. The
Queens regional canopy must remain unchanged in both the data and
scene; neither a screenshot nor an approximate shadow suffices.

## Leaf lighting study

The separate [leaf radiance draft](../../tools/art/woodland-envelope/leaf-radiance-study.ts)
uses the original branch height to give the upper crown a softer light.
It filters the existing random leaf tint and leaves wood, silhouettes,
alpha, shadows and all geometry unchanged in the source. The draft
only accepts the exact original shader and supplies an off-by-default
comparison value. It is not installed by the simulator.

At two recorded Queens cameras, an isolated four-sample branch comparison
kept the original triangles and changed only branch color. The selected
version lifted the height-weighted highlights while reducing adjacent-pixel
variation relative to the unadjusted branches. A simpler brighter
version increased grain and was set aside. These were isolated draws
with the original camera and branch data, not gameplay screenshots
or a hardware performance benchmark. The same-frame full-world test
must still preserve wood, aircraft, sky, land, and rollback before
this can be considered for Standard.
