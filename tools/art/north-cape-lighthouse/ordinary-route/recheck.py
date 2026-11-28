"""Offline verifier of the exact private route capture, plus optional 1:1 PNG crops.

Use an unsigned working output directory for crop generation. No game assets or
launch flags are installed by this utility. Pillow and NumPy are offline tools.
"""
from hashlib import sha256
from pathlib import Path
import argparse
import json
import numpy as np
from PIL import Image

NAMES = ("stock", "game", "solidBlack", "solidWhite", "paneBlack", "paneWhite",
         "stockRestore", "gameRestore")
WINDOWS = {"approach": (276, 299), "near": (397, 418), "exit": (599, 629)}

def digest(path):
    return sha256(path.read_bytes()).hexdigest()

def require(ok, label):
    if not ok:
        raise ValueError(label)

def recheck(raw, evidence, crops=None):
    receipt = json.loads((evidence / "private-pair-receipt.json").read_bytes())
    require(receipt["begin"] == {"site": "northcape-light-low", "mode": "dispatch", "phase": "ready"}
            and not receipt["errors"] and not receipt["outside"], "route launch or external error")
    output = {}
    for stage, (lo, hi) in WINDOWS.items():
        info = evidence / f"{stage}.json"
        meta = json.loads(info.read_bytes())
        expected = receipt["phases"][stage]
        require(digest(info) == expected["actualSceneMetaSHA256"], stage + ": metadata bytes")
        require(meta["d"] == expected["travel"] and lo <= meta["d"] <= hi, stage + ": traversed range")
        require(set(meta["sha"]) == set(meta["reports"]) == set(NAMES), stage + ": 8 lanes")
        phases = meta["reports"]
        stock_census = phases["stock"]["stats"]
        delta = [2, 3924, 0, 0] if stage != "exit" else [0, 0, 0, 0]
        for key, lane in phases.items():
            wanted = [a + d for a, d in zip(stock_census, delta, strict=True)] if not key.startswith("stock") else stock_census
            require(lane["ground"] == 1 and lane["stats"] == wanted, stage + ": draw census / real ground")
            roles = [11730, 42] if key[0:5] != "stock" and stage != "exit" else []
            require([v["n"] for v in lane["visible"]] == roles, stage + ": authored actor sizes")
            for actor in lane["visible"]:
                for glsl in actor["glslSHA"]:
                    require(len(glsl) == 64 and all(c in "0123456789abcdef" for c in glsl)
                            and digest(raw / (glsl + ".glsl")) == glsl, stage + ": linked GLSL")
        pixels = {}
        for key in NAMES:
            filename = raw / f"{stage}-{key}.png"
            require(digest(filename) == meta["sha"][key], stage + ": raw PNG bytes " + key)
            with Image.open(filename) as im:
                require(im.mode == "RGBA" and im.size == (1080, 700), stage + ": raw PNG RGBA bounds")
                pixels[key] = np.asarray(im, dtype=np.int16)
        base, art = pixels["stock"], pixels["game"]
        require(np.array_equal(base, pixels["stockRestore"]) and np.array_equal(art, pixels["gameRestore"]),
                stage + ": either rollback")
        require(all(np.array_equal(base[:, :, 3], p[:, :, 3]) for p in pixels.values()), stage + ": alpha parity")
        rgb = np.max(abs(base[:, :, :3] - art[:, :, :3]), axis=2)
        solid = np.max(pixels["solidWhite"][:, :, :3] - pixels["solidBlack"][:, :, :3], axis=2) > 0
        glass = np.max(pixels["paneWhite"][:, :, :3] - pixels["paneBlack"][:, :, :3], axis=2) > 0
        exterior = (rgb > 0) & ~(solid | glass)
        scores = {"changed": int((rgb > 0).sum()), "strong": int((rgb > 2).sum()),
                  "solid": int(solid.sum()), "glass": int(glass.sum()), "exterior": int(exterior.sum()), "alpha": 0}
        require(scores == meta["scores"] and all(scores[k] == expected[k] for k in scores), stage + ": independent RGB replay")
        require(not scores["exterior"] and (scores["strong"] >= 250 if stage != "exit" else not any(scores.values())),
                stage + ": scoped visibility")
        result = {"travel": meta["d"], **scores}
        if crops is not None and stage != "exit":
            y, x = np.nonzero(solid | glass)
            box = (max(0, int(x.min()) - 38), max(0, int(y.min()) - 32),
                   min(1080, int(x.max()) + 39), min(700, int(y.max()) + 33))
            result["crop"] = box
            for name, image in (("stock", base), ("preview", art)):
                out = crops / (stage + "-" + name + ".png")
                Image.fromarray(image.astype("uint8")).crop(box).save(out)
        output[stage] = result
    return output

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("capture", type=Path, help="original PNG and linked GLSL receipt folder")
    parser.add_argument("--evidence", type=Path, default=Path(__file__).parent)
    parser.add_argument("--crops", type=Path, help="new directory for exact unscaled positive crops")
    a = parser.parse_args()
    if a.crops:
        a.crops.mkdir(parents=True, exist_ok=False)
    print(json.dumps(recheck(a.capture, a.evidence, a.crops), indent=2))
