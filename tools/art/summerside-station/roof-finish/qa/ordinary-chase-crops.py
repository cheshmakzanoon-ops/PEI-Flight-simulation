"""Package exact player-frame crops; verify them without the original full-frame archive."""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image

RECEIPT = "5db0ddb98c73c1d840f4e86c964743bb924caca5b780b724c73cf439e7e240da"
PASS_NAMES = (
    "original", "neutral", "finish", "originalRestore", "finishRestore",
    "neutralRestore", "roleNeutral", "roleBlack", "roleWhite",
)
PHASES = ("toward", "close")


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path, size=None):
    with Image.open(path) as image:
        assert image.mode == "RGBA" and (size is None or image.size == size)
        return image.copy()


def pixels(image):
    assert image.mode == "RGBA"
    data = iter(image.tobytes())
    return zip(data, data, data, data, strict=True)


def compare(before, after, scope):
    assert before.size == after.size == scope.size
    changed = strong = marked = exterior = alpha = 0
    for a, b, m in zip(pixels(before), pixels(after), pixels(scope), strict=True):
        assert m[0] in (0, 255) and m[1] == m[2] == m[0] and m[3] == 255
        d = max(abs(a[i] - b[i]) for i in range(3))
        changed += d > 0
        strong += d > 3
        marked += m[0] > 0
        exterior += d > 0 and m[0] == 0
        alpha += a[3] != b[3]
    return dict(marked=marked, strong=strong, changed=changed, exterior=exterior, alpha=alpha)


def emit(raw, dest, rec):
    crops = {}
    for phase in PHASES:
        p = rec["phases"][phase]
        wh = tuple(p["viewport"])
        images = {}
        for label in PASS_NAMES:
            path = raw / f"{phase}-{label}.png"
            assert sha(path) == p["hashes"][label], path
            images[label] = read(path, wh)
        a, b = images["original"], images["finish"]
        for label in ("neutral", "neutralRestore", "originalRestore", "roleNeutral"):
            assert images[label].tobytes() == a.tobytes(), label
        assert images["finishRestore"].tobytes() == b.tobytes()
        assert all(v.getchannel("A").tobytes() == a.getchannel("A").tobytes() for v in images.values())
        mask = Image.new("L", wh)
        mask.putdata([255 if l[:3] != r[:3] else 0 for l, r in
                      zip(pixels(images["roleBlack"]), pixels(images["roleWhite"]), strict=True)])
        scope = mask.convert("RGBA")
        assert compare(a, b, scope) == p["scores"]
        x0, y0, x1, y1 = mask.getbbox()
        crop = (max(0, x0 - 16), max(0, y0 - 16), min(wh[0], x1 + 16), min(wh[1], y1 + 16))
        a, b, scope = (image.crop(crop) for image in (a, b, scope))
        assert compare(a, b, scope) == p["scores"]
        pair = Image.new("RGBA", (2 * a.width + 6, a.height), (23, 27, 30, 255))
        pair.paste(a, (0, 0))
        pair.paste(b, (a.width + 6, 0))
        files = {"pair": f"{phase}-paired.png", "scope": f"{phase}-scope.png"}
        for code, image in (("pair", pair), ("scope", scope)):
            path = dest / files[code]
            with path.open("xb") as f:
                image.save(f, format="PNG", optimize=True)
        crops[phase] = dict(box=list(crop), files=files,
                            sha256={code: sha(dest / name) for code, name in files.items()})
    with (dest / "crops.json").open("x") as f:
        json.dump(dict(receipt=RECEIPT, padding=16, divider=6, photoscale=1, phases=crops), f, indent=2)
        f.write("\n")


def verify(dest, rec):
    crops = json.loads((dest / "crops.json").read_bytes())
    assert crops["receipt"] == RECEIPT and crops["photoscale"] == 1 and crops["divider"] == 6
    for phase in PHASES:
        row = crops["phases"][phase]
        x0, y0, x1, y1 = row["box"]
        w, h = x1-x0, y1-y0
        vw, vh = rec["phases"][phase]["viewport"]
        assert 0 <= x0 < x1 <= vw and 0 <= y0 < y1 <= vh
        pair = read(dest / row["files"]["pair"], (w*2+6, h))
        scope = read(dest / row["files"]["scope"], (w, h))
        for code, path in row["files"].items():
            assert sha(dest / path) == row["sha256"][code]
        assert pair.crop((w, 0, w+6, h)).getextrema() == ((23,23),(27,27),(30,30),(255,255))
        expected = rec["phases"][phase]["scores"]
        assert compare(pair.crop((0, 0, w, h)), pair.crop((w+6, 0, 2*w+6, h)), scope) == expected
        print(phase, expected)


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("evidence", type=Path)
    cli.add_argument("--from-full-frames", type=Path)
    args = cli.parse_args()
    path = args.evidence / "native.json"
    assert sha(path) == RECEIPT
    receipt = json.loads(path.read_bytes())
    assert receipt["status"].startswith("PASS ") and set(receipt["phases"]) == set(PHASES)
    if args.from_full_frames:
        emit(args.from_full_frames, args.evidence, receipt)
    verify(args.evidence, receipt)
