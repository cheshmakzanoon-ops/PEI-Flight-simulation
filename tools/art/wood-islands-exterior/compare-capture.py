"""Strict comparison against the bundled PNG/WebP pixels, independent of encoder output."""
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image

if len(sys.argv) != 2:
    raise SystemExit(f"usage: {sys.argv[0]} NEW_CAPTURE_DIRECTORY")
source = Path(__file__).resolve().parent / "evidence"
new = Path(sys.argv[1])
r0, r1 = (json.loads((p / "receipt.json").read_text()) for p in [source, new])
for k in ("r187", "frame", "sampleCount", "modelTriangles", "sceneDraws", "modelDraws",
          "artTextureCount", "shaderSHA", "planSHA", "actualSubmissionDigests"):
    if r0[k] != r1[k]:
        raise SystemExit(f"mismatched capture custody: {k}")
if len(r0["views"]) != len(r1["views"]):
    raise SystemExit("missing an original camera")
for a, b in zip(r0["views"], r1["views"]):
    for k in ("view", "actualModelSilhouettePixels", "actualBoundsFromRole", "exactColorRepeat"):
        if a[k] != b[k]:
            raise SystemExit(f"mismatched role or view: {a['view']['id']} {k}")
report = {}
for p in sorted(source.iterdir()):
    if p.suffix not in (".png", ".webp"):
        continue
    mode = "L" if p.suffix == ".png" else "RGB"
    with Image.open(p) as a, Image.open(new / p.name) as b:
        raw = a.convert(mode).tobytes()
        if a.size != b.size or raw != b.convert(mode).tobytes():
            raise SystemExit(f"mismatched decoded framebuffer: {p.name}")
        report[p.name] = {"size": a.size, "decodedSHA256": hashlib.sha256(raw).hexdigest()}
print(json.dumps({"exactDecodedPixels": report}, indent=2))
