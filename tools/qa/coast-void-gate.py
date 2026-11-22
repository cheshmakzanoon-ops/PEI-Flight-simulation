#!/usr/bin/env python3
"""Check the ground/water-only ROI of a matched East Point magenta-sky capture."""
import argparse
from pathlib import Path
from PIL import Image

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("image", type=Path)
path = parser.parse_args().image

def is_sentinel(pixel):
    r, g, b = pixel
    return r >= 248 and g < 12 and b >= 248

with Image.open(path) as source:
    image = source.convert("RGB")
    w, h = image.size
    horizon = image.crop((0, 0, w, round(h*.15)))
    ratio = sum(map(is_sentinel, horizon.getdata())) / (horizon.width*horizon.height)
    if ratio <= .95:
        raise SystemExit("Expected a magenta-sky diagnostic, not an ordinary capture")
    roi = image.crop((0, round(h*380/640), round(w*450/1024), round(h*620/640)))
    count = sum(map(is_sentinel, roi.getdata()))
    area = roi.width*roi.height
    print(f"{count}/{area} sky pixels beneath coast ({count/area:.3%}); gate <0.1%")
    if count/area >= .001:
        raise SystemExit(1)
