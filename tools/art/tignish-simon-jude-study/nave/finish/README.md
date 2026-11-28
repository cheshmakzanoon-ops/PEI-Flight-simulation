# Tignish nave weathered finish

This original surface study affects only the four existing detached
nave side meshes. Their exact positions, winding, normals and measured
masks are unchanged. The stylized crown, shoulder planes, gaps and
masonry are not textured by this tool. Nothing is installed in the game.

The [2025 Soloviev aerial view](https://commons.wikimedia.org/wiki/File:St._Simon_%26_St._Jude_Church_(Tignish).jpg)
shows a muted grey field, visible staggered laps and pale weathering
below the ridge. The opposite [2013 Phillips view](https://commons.wikimedia.org/wiki/File:St._Simon_and_St._Jude_Roman_Catholic_Church.jpg)
is a broader color/shape reference. [Parish history, printed page 43](https://regporter.com/pei/wp-content/uploads/2019/03/Cran-Parish-of-Tignish.pdf#page=44)
records a historical switch from slate to shingles after the 1926 spire
work. That is not evidence of the current composition, precise course
spacing, finish age or reflectance. No source photographs are embedded,
sampled as texture, or redistributed.

The authored maps share one roof-plan coordinate system across the four
patches. Albedo is sRGB; a separately linear normal map follows the
sloped laps and a linear roughness map uses a restrained green channel.
Mipmaps reduce the course pattern when it is small. In four real
isolated Three.js renders (including overcast), the marker enclosed
every changed pixel, alpha was unchanged, and the restored original
RGBA matched byte-for-byte. This is not a moving flight anti-shimmer
test or independent attribution of one texture channel.

[Unfinished south](evidence/south-stock.webp) ·
[Weathered south](evidence/south-finished.webp) ·
[Middle distance](evidence/middle-finished.webp) ·
[Scope and image hashes](evidence/studio-bound.json)

## Reproduce

From this directory with installed Three.js and Node 24:

```sh
node --test verify-roof-finish.mjs
# Prepare the detached studio in a new scratch location:
../../../../../node_modules/.bin/vite build . --outDir /tmp/pei-tignish-roof-finish-studio
python3 -m http.server 4715 --bind 127.0.0.1 --directory /tmp/pei-tignish-roof-finish-studio
# In another terminal, with NumPy, Pillow and Playwright installed:
python3 capture-roof.py --binary /path/to/chromium --out /tmp/pei-tignish-roof-finish-new
```

No map, user data, or network source is used by the studio. The stills
use partial roof evidence on a neutral background; they are not the
whole church. The stock in-game roof remains unchanged and would still
obscure these partial measured planes.
