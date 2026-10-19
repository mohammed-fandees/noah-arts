"""Turns a phone photo of a notebook page into a clean, white page.

Until the dashboard does this in the browser, use it to prepare new drawings:
    python3 scripts/clean_photo.py photo.jpg seed/media/my-drawing.jpg [left top right bottom]

The optional box crops the page first (pixels). Needs Pillow and NumPy.
"""
import sys

import numpy as np
from PIL import Image, ImageFilter


def clean(img: Image.Image) -> Image.Image:
    gray = img.convert('L')
    # Estimate the paper (strokes removed, lighting smoothed) and divide it out:
    # shadows, uneven light and the phone's yellow tint disappear, the paper turns white.
    paper = gray.filter(ImageFilter.MaxFilter(15)).filter(ImageFilter.GaussianBlur(18))
    a = np.asarray(gray, dtype=np.float32)
    b = np.maximum(np.asarray(paper, dtype=np.float32), 1)
    n = np.clip(a / b, 0, 1)
    # Levels: deepen the graphite a little so light sketches still read.
    lo, hi = min(0.55, float(np.percentile(n, 0.7))), 0.93
    n = np.clip((n - lo) / (hi - lo), 0, 1) ** 1.25
    return Image.fromarray((n * 255).astype(np.uint8))


if __name__ == '__main__':
    src, dst, *box = sys.argv[1:]
    image = Image.open(src).convert('RGB')
    if len(box) == 4:
        image = image.crop(tuple(int(v) for v in box))
    out = clean(image)
    out.save(dst, quality=88)
    print(dst, out.size)
