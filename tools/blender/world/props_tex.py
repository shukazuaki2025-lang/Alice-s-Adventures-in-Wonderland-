"""Painted textures for the hand props (labels with lettering, cake icing, cork, watch dial). Lettering is set in Liberation Serif
Bold (SIL OFL 1.1) via Pillow; everything else is procedural gouache like the rest of the project."""
import math

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from lib import paint
from world.painters import _dabs, _rgb, _splat

FONT_BOLD = 'LiberationSerif-Bold.ttf'
FONT_ITALIC = 'LiberationSerif-BoldItalic.ttf'
FALLBACK = 'DejaVuSerif-Bold.ttf'


def _font(size, italic=False):
    for name in ((FONT_ITALIC if italic else FONT_BOLD), FALLBACK):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _spaced(draw, text, font, cx, cy, fill, tracking=0):
    widths = [draw.textlength(ch, font=font) for ch in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x = cx - total / 2
    for ch, w in zip(text, widths):
        draw.text((x, cy), ch, font=font, fill=fill, anchor='lm')
        x += w + tracking


def paper_label(w, h, lines, base='#EBDDB6', ink='#2E2218', border='#7A2F34', seed=1):
    """Aged paper tag with a double rule and centred lettering. lines: [(text, size, tracking, italic)]."""
    img = paint.wash(base, h, w, seed=seed, tint_var=0.05, blotch=0.10, facets=0, grain=0.05)
    img = (img * 255).astype(np.uint8)
    im = Image.fromarray(img)
    d = ImageDraw.Draw(im)
    m = int(min(w, h) * 0.06)
    bc = tuple(int(c * 255) for c in _rgb(border))
    d.rectangle([m, m, w - m, h - m], outline=bc, width=max(2, w // 128))
    d.rectangle([m * 2, m * 2, w - m * 2, h - m * 2], outline=bc, width=max(1, w // 256))
    total_h = sum(s for _t, s, _tr, _i in lines) * 1.25
    y = h / 2 - total_h / 2
    inkc = tuple(int(c * 255) for c in _rgb(ink))
    for text, size, tracking, italic in lines:
        y += size * 0.62
        _spaced(d, text, _font(size, italic), w / 2, y, inkc, tracking)
        y += size * 0.63
    arr = np.asarray(im, np.float32) / 255.0
    arr *= (0.93 + 0.10 * paint.fbm(h, w, 6, 4, seed + 3))[..., None]
    return np.clip(arr, 0, 1)


def cake_top(size=512, seed=3):
    """Top of the little EAT ME cake: glazed sponge disc with currants spelling EAT ME and a scalloped edge."""
    img = paint.wash('#D9A862', size, size, seed=seed, tint_var=0.06, blotch=0.12, facets=0, grain=0.05)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32) / size
    r = np.sqrt((xx - 0.5) ** 2 + (yy - 0.5) ** 2)
    icing = np.clip((0.44 - r) * 40, 0, 1)
    icing_col = paint.wash('#F6ECD5', size, size, seed=seed + 5, tint_var=0.03, blotch=0.05, facets=0, grain=0.03)
    img = img * (1 - icing[..., None]) + icing_col * icing[..., None]
    im = Image.fromarray((img * 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    f = _font(int(size * 0.20))
    for text, cy in (('EAT', 0.40), ('ME', 0.60)):
        _spaced(d, text, f, size / 2, size * cy, (92, 44, 40), tracking=int(size * 0.03))
    arr = np.asarray(im, np.float32) / 255.0
    arr = _splat(arr, _dabs(size, size, 90, 3.0, seed + 9, 1.0) * icing * (r < 0.40), _rgb('#3A1F28'), 0.85)           # currants
    arr = _splat(arr, np.clip((r - 0.40) * 22, 0, 1) * np.clip((0.50 - r) * 30, 0, 1), _rgb('#B07A3E'), 0.5)          # browned rim
    return np.clip(arr, 0, 1)


def sponge(size=256, seed=4):
    """Cake side: crumb with currant flecks."""
    img = paint.wash('#C98F4E', size, size, seed=seed, tint_var=0.07, blotch=0.14, facets=20, facet_var=0.05, grain=0.06)
    img = _splat(img, _dabs(size, size, 120, 3.0, seed + 2, 1.2), _rgb('#3A1F28'), 0.8)
    img = _splat(img, _dabs(size, size, 160, 4.0, seed + 3, 1.0), _rgb('#E5BC78'), 0.45)
    return np.clip(img, 0, 1)


def cork(size=128, seed=5):
    img = paint.wash('#B98A55', size, size, seed=seed, tint_var=0.08, blotch=0.12, facets=0, grain=0.08)
    img = _splat(img, _dabs(size, size, 160, 2.5, seed + 1, 1.0), _rgb('#7A5230'), 0.6)
    img = _splat(img, _dabs(size, size, 120, 2.5, seed + 2, 1.0), _rgb('#D9B07A'), 0.5)
    return np.clip(img, 0, 1)


def watch_dial(size=512, seed=6):
    """Enamel pocket-watch dial: roman numerals, minute track, small seconds dial, blued hands, hairline crazing."""
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32) / size
    cx, cy = xx - 0.5, yy - 0.5
    r = np.sqrt(cx * cx + cy * cy)
    img = np.ones((size, size, 3), np.float32) * _rgb('#B08A3A')
    face = paint.wash('#F4EBD3', size, size, seed=seed, tint_var=0.02, blotch=0.03, facets=0, grain=0.02)
    m = (r < 0.47).astype(np.float32)[..., None]
    img = img * (1 - m) + face * m
    im = Image.fromarray((img * 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    ink = (34, 28, 24)
    numerals = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']
    f = _font(int(size * 0.075))
    for k, n in enumerate(numerals):
        a = k * math.pi / 6 - math.pi / 2
        d.text((size / 2 + math.cos(a) * size * 0.36, size / 2 + math.sin(a) * size * 0.36), n, font=f, fill=ink, anchor='mm')
    for k in range(60):
        a = k * math.pi / 30
        r0, r1 = size * (0.44 if k % 5 else 0.425), size * 0.455
        d.line([(size / 2 + math.cos(a) * r0, size / 2 + math.sin(a) * r0), (size / 2 + math.cos(a) * r1, size / 2 + math.sin(a) * r1)], fill=ink, width=max(1, size // 256))
    d.ellipse([size / 2 - size * 0.10, size * 0.66 - size * 0.10, size / 2 + size * 0.10, size * 0.66 + size * 0.10], outline=ink, width=2)
    blue = (34, 52, 90)
    for ln, hh, wd in ((0.26, 0.6, 7), (0.36, 0.0, 5)):
        a = hh * 2 * math.pi - math.pi / 2
        d.line([(size / 2, size / 2), (size / 2 + math.cos(a) * size * ln, size / 2 + math.sin(a) * size * ln)], fill=blue, width=wd)
    d.ellipse([size / 2 - 9, size / 2 - 9, size / 2 + 9, size / 2 + 9], fill=blue)
    arr = np.asarray(im, np.float32) / 255.0
    cr = np.clip(1.0 - paint.voronoi(size, size, 22, seed + 2)[1] * 14, 0, 1) ** 5
    arr *= (1.0 - 0.10 * cr)[..., None]
    return np.clip(arr, 0, 1)


def jar_label(w=512, h=256, seed=7):
    return paper_label(w, h, [('ORANGE', int(h * 0.22), int(h * 0.02), False), ('MARMALADE', int(h * 0.22), int(h * 0.012), False)], seed=seed)


def drink_label(w=384, h=256, seed=8):
    return paper_label(w, h, [('DRINK', int(h * 0.30), int(h * 0.03), False), ('ME', int(h * 0.30), int(h * 0.03), False)], seed=seed, border='#2F5A45')


def back_label(w=384, h=256, seed=9):
    return paper_label(w, h, [('Not marked', int(h * 0.20), 2, True), ('“poison”', int(h * 0.24), 2, True)], seed=seed, border='#2F5A45')
