#!/usr/bin/env python3
"""Compare paired normal/diagnostic-sky captures against the same stock camera.

Run bowley-frames.py --aperture-motion twice, with and without bowleySurveyPreview.
Both inputs must use the same viewport, DPR, camera translations and settled maps.
The only difference within each pair is the color of the real background sky.
Any resolved color change (including a single MSAA subpixel) reveals background.
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image


def png(path):
    with Image.open(path) as image:
        return np.asarray(image.convert('RGB'))


def inspect(root, view, index):
    art = png(root / f'{view}-{index}-art.png')
    sky = png(root / f'{view}-{index}-void.png')
    if art.shape != sky.shape:
        raise ValueError((root, view, index, art.shape, sky.shape))
    delta = np.max(np.abs(art.astype(np.int16) - sky.astype(np.int16)), axis=2)
    return delta, np.all(sky == (255, 0, 255), axis=2)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('stock', type=Path)
    parser.add_argument('preview', type=Path)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    motion = sorted(args.preview.glob('*-motion.json'))
    if not motion:
        raise ValueError('No paired camera data in preview')
    report = []
    for preview in motion:
        view = preview.name.removesuffix('-motion.json')
        stable = json.loads((args.stock / preview.name).read_text())
        active = json.loads(preview.read_text())
        if len(stable) != 5 or len(active) != 5:
            raise ValueError((view, 'not the expected five held camera offsets'))
        for index, (a, b) in enumerate(zip(stable, active, strict=True)):
            for key in ('offsetXZ', 'orthoIds', 'raster'):
                if a[key] != b[key]:
                    raise ValueError((view, index, key, a[key], b[key]))
            for key in ('x', 'z', 'baseH', 'eyeY', 'bottomY', 'topY'):
                if a['pose'][key] != b['pose'][key]:
                    raise ValueError((view, index, key, a['pose'][key], b['pose'][key]))
            d0, _ = inspect(args.stock, view, index)
            d1, pure = inspect(args.preview, view, index)
            new = (d0 == 0) & (d1 > 0)
            report.append(dict(view=view, offsetXZ=a['offsetXZ'], raster=a['raster'],
                               stockSky=int((d0 > 0).sum()), previewSky=int((d1 > 0).sum()),
                               newExposedPixels=int(new.sum()),
                               newFullyExposedPixels=int((new & pure).sum()),
                               largestChannelDifference=int(d1[new].max()) if new.any() else 0))
    args.out.write_text(json.dumps(report, indent=2) + '\n')
    if any(q['newExposedPixels'] for q in report):
        raise SystemExit('Regression: preview exposed background in covered stock pixels')
    print(f'{len(report)} exact camera/raster pairs: no new full or partial sky exposure')


if __name__ == '__main__':
    main()
