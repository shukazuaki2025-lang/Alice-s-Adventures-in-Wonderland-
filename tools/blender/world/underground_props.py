"""
Painted prop atlases for the underground sets (S3 well shelving, S4 passage fittings).

Each atlas packs many small painted surfaces into one image so a whole shaft of shelves costs a handful of draw calls:
  * `wood_atlas`      - walnut / oak / enamel-painted cupboard boards (sage, teal, cream, oxblood, mustard) + a dark interior cell
  * `books_atlas`     - ~40 distinct Victorian book spines (leather, cloth, marbled boards, yellowbacks, gilt tooling)
  * `preserves_atlas` - jam jars of many colours with hand-lettered labels, china, tins, bottles, candles (wrap-around cells)
  * `art_atlas`       - framed maps and pictures (county map, sea chart, star chart, portraits, ship, orchard, still life ...)
  * `metal_atlas`     - brass, copper, verdigris bronze, pewter/iron
  * `stone_ledge`     - warm limestone corbel/ledge stone
All return float32 (h, w, 3) sRGB, row 0 = TOP, deterministic.
"""
import math

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from lib import paint
from world import interior as I
from world.painters import _dabs, _rgb, _splat
from world.underground_paint import Canvas, mix, over, rfbm, rfield, sstep, to_u8, from_u8, TAU

FONT_BOLD = 'LiberationSerif-Bold.ttf'
FONT_ITALIC = 'LiberationSerif-BoldItalic.ttf'
FALLBACK = 'DejaVuSerif-Bold.ttf'


def font(size, italic=False):
    for name in ((FONT_ITALIC if italic else FONT_BOLD), FALLBACK):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _soft(arr, r):
    return from_u8(np.asarray(Image.fromarray(to_u8(arr), 'RGB').filter(ImageFilter.GaussianBlur(r))))


def _grid(h, w):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    return yy / h, xx / w


def _paste_cell(atlas, cell, col, row, cw, ch):
    atlas[row * ch:(row + 1) * ch, col * cw:(col + 1) * cw] = cell


# ------------------------------------------------------------------------------------------------ wood
def _wood_cell(size, base, seed, paint_hex=None, boards=8, dark=False):
    img = I.planks(size, size, n=boards, base=base, seed=seed, seams=0.006)
    yy, xx = _grid(size, size)
    if dark:
        img = img * np.array([0.50, 0.46, 0.50], np.float32)
        img *= (0.75 + 0.5 * rfbm(size, size, 4, 4, 3, seed + 4))[..., None]
        return np.clip(img, 0, 1)
    if paint_hex:
        coat = np.ones_like(img) * _rgb(paint_hex)
        streak = rfield(size, size, 3, 90, seed + 9)                                  # horizontal brush strokes
        coat = coat * (0.95 + 0.10 * streak)[..., None] * (0.94 + 0.12 * rfbm(size, size, 5, 5, 3, seed + 11))[..., None]
        # raised panel rails: lighter bevel on top edges, darker underneath, repeating each board
        row = np.floor(yy * boards)
        fy = yy * boards - row
        coat = coat * (1.0 + 0.10 * np.exp(-fy / 0.10) - 0.20 * np.exp(-(1 - fy) / 0.10))[..., None]
        # worn through to the wood along edges and in chips
        wear = sstep(0.66, 0.84, rfbm(size, size, 7, 7, 4, seed + 13)) * (0.10 + 0.90 * (np.abs(fy - 0.5) * 2) ** 3)
        wear = np.maximum(wear, sstep(0.90, 0.96, rfield(size, size, 36, 36, seed + 14)) * 0.5)
        img = mix(coat, img, np.clip(wear, 0, 1) * 0.85)
        img = img * (1.0 - 0.28 * sstep(0.55, 0.85, rfbm(size, size, 7, 12, 3, seed + 15)) * (yy ** 0.8))[..., None]       # grime drips
    return np.clip(img, 0, 1)


def wood_atlas(cell=512):
    """4x2 cells: 0 walnut, 1 oak, 2 sage, 3 teal, 4 cream, 5 oxblood, 6 mustard, 7 dark interior."""
    spec = [('#5B3B24', None), ('#9C7040', None), ('#8B6B45', '#7C9A74'), ('#8B6B45', '#4B7F8E'),
            ('#8B6B45', '#E4D9BD'), ('#8B6B45', '#8F3238'), ('#8B6B45', '#C99B3A'), ('#3A261C', None)]
    atlas = np.zeros((2 * cell, 4 * cell, 3), np.float32)
    for k, (base, pc) in enumerate(spec):
        c = _wood_cell(cell, base, 20 + k, pc, 8, dark=(k == 7))
        _paste_cell(atlas, c, k % 4, k // 4, cell, cell)
    return atlas


WOOD_CELLS = {'walnut': 0, 'oak': 1, 'sage': 2, 'teal': 3, 'cream': 4, 'oxblood': 5, 'mustard': 6, 'dark': 7}


def cell_rect(idx, cols, rows):
    """Atlas cell -> (u0, v0, u1, v1) in Blender UV space (v up, so image row 0 = v 1)."""
    c, r = idx % cols, idx // cols
    return (c / cols, 1.0 - (r + 1) / rows, (c + 1) / cols, 1.0 - r / rows)


# ------------------------------------------------------------------------------------------------ books
_BOOK_COLORS = ['#7A2F34', '#2F5A45', '#27405E', '#B58B3A', '#3C6E70', '#59314F', '#8B6A45', '#A24B3B', '#33323F', '#6B7B3A',
                '#8E3B52', '#365E7D', '#C27B3E', '#4D3A28', '#A9854F', '#2B4B3E', '#6B2F2B', '#45507A']
_GILT = '#E2BE6A'


def _spine(w, h, rng, style, color):
    xs = np.linspace(0, 1, w, dtype=np.float32)[None, :]
    yy = np.linspace(0, 1, h, dtype=np.float32)[:, None]
    shade = 0.68 + 0.58 * np.clip(np.sin(xs * math.pi), 0, 1) ** 0.75
    base = np.ones((h, w, 3), np.float32) * _rgb(color) * (0.9 + 0.2 * rng.random())
    img = base * shade[..., None]
    img *= (0.90 + 0.14 * rfield(w, h, 3, 40, int(rng.integers(1e6))))[..., None]
    gilt = _rgb(_GILT)
    cream = _rgb('#EADFBE')
    ink = _rgb('#2E2218')

    def band(y0, y1, col=gilt, a=1.0):
        nonlocal img
        m = ((yy > y0) & (yy < y1))[..., None] * np.ones((1, w, 1), np.float32)
        img = img * (1 - m * a) + col * shade[..., None] * m * a

    if style == 0:                                    # plain leather: gilt bands + cream label with ink rules
        for y0 in (0.06, 0.10, 0.86, 0.90):
            band(y0, y0 + 0.012)
        ly0 = 0.20 + 0.06 * rng.random()
        ly1 = ly0 + 0.22 + 0.1 * rng.random()
        m = ((yy > ly0) & (yy < ly1) & (xs > 0.16) & (xs < 0.84))
        img = np.where(m[..., None], cream * (0.85 + 0.1 * shade[..., None]), img)
        for t in range(int(rng.integers(2, 5))):
            ty = ly0 + (ly1 - ly0) * (0.18 + 0.2 * t)
            tm = (np.abs(yy - ty) < 0.006) & (xs > 0.26) & (xs < 0.74)
            img = np.where(tm[..., None], ink, img)
    elif style == 1:                                  # five tooled compartments
        for y0 in (0.05, 0.22, 0.40, 0.58, 0.76, 0.93):
            band(y0, y0 + 0.012)
        for cy in (0.135, 0.31, 0.49, 0.67, 0.845):
            d = np.sqrt(((xs - 0.5) * 3.2) ** 2 + ((yy - cy) * 6.0) ** 2)
            m = ((d < 0.50) & (d > 0.36))[..., None]
            img = np.where(m, gilt * shade[..., None] * 0.92, img)
        ly0 = 0.24
        m = ((yy > ly0) & (yy < ly0 + 0.13) & (xs > 0.12) & (xs < 0.88))
        img = np.where(m[..., None], _rgb('#7A2F34') * shade[..., None], img)
    elif style == 2:                                  # marbled boards spine: two-tone, speckled
        m = (yy > 0.18) & (yy < 0.82)
        marb = _rgb(color) * 0.6 + _rgb('#C9B589') * 0.4 * (0.5 + rfbm(w, h, 4, 6, 3, int(rng.integers(1e6))))[..., None]
        img = np.where(m[..., None], marb * shade[..., None], img)
        band(0.17, 0.185)
        band(0.815, 0.83)
        lm = ((yy > 0.30) & (yy < 0.55) & (xs > 0.2) & (xs < 0.8))
        img = np.where(lm[..., None], cream * (0.9), img)
        for t in range(3):
            tm = (np.abs(yy - (0.34 + 0.07 * t)) < 0.006) & (xs > 0.3) & (xs < 0.7)
            img = np.where(tm[..., None], ink, img)
    elif style == 3:                                  # yellowback: bright yellow paper wrapper, red lettering, little vignette
        yb = _rgb('#E7C752') * shade[..., None] * (0.92 + 0.1 * rfield(w, h, 4, 20, int(rng.integers(1e6))))[..., None]
        img = yb
        for ty, tw in ((0.12, 0.7), (0.20, 0.5), (0.30, 0.6)):
            tm = (np.abs(yy - ty) < 0.012) & (np.abs(xs - 0.5) < tw / 2)
            img = np.where(tm[..., None], _rgb('#B03A2E'), img)
        vm = (np.sqrt(((xs - 0.5) * 2.0) ** 2 + ((yy - 0.62) * 2.6) ** 2) < 0.5)
        img = np.where(vm[..., None], _rgb('#3C6E70') * shade[..., None], img)
        vm2 = (np.sqrt(((xs - 0.5) * 3.4) ** 2 + ((yy - 0.62) * 3.4) ** 2) < 0.5)
        img = np.where(vm2[..., None], _rgb('#E9D8A0'), img)
    else:                                             # two-tone cloth with a broad gilt panel
        m = (yy > 0.30) & (yy < 0.70)
        img = np.where(m[..., None], _rgb('#DCCFA6') * shade[..., None] * 0.95, img)
        band(0.29, 0.30)
        band(0.70, 0.71)
        for t in range(3):
            tm = (np.abs(yy - (0.42 + 0.08 * t)) < 0.007) & (xs > 0.25) & (xs < 0.75)
            img = np.where(tm[..., None], ink, img)
    # worn head and tail, dust
    img *= (1.0 - 0.22 * np.exp(-yy / 0.03) - 0.22 * np.exp(-(1 - yy) / 0.03))[..., None]
    img = np.clip(img, 0, 1)
    return img


def books_atlas(w=2048, h=512, seed=61):
    """Returns (atlas, spines, paper_u): spines is a list of (u0, u1) in 0..1 (each ~44-70 px wide, so one spine per book); the last 120 px
    hold cream page-block texture (u from paper_u to 1) used for the top edges of the books."""
    rng = np.random.default_rng(seed)
    atlas = np.zeros((h, w, 3), np.float32)
    spines = []
    x = 0
    while x < w - 190:
        sw = int(rng.integers(44, 70))
        style = int(rng.choice([0, 0, 1, 1, 2, 3, 4]))
        color = _BOOK_COLORS[int(rng.integers(len(_BOOK_COLORS)))]
        atlas[:, x:x + sw] = _spine(sw, h, rng, style, color)
        spines.append(((x + 3) / w, (x + sw - 3) / w))
        x += sw
    pw = w - x
    paper = paint.wash('#E6D9B4', h, pw, seed=seed + 5, tint_var=0.05, blotch=0.08, facets=0, grain=0.03)
    ln = 0.5 + 0.5 * np.sin(np.linspace(0, 1, h, dtype=np.float32)[:, None] * TAU * 60)
    atlas[:, x:] = paper * (0.88 + 0.12 * ln)[..., None]
    return np.clip(atlas, 0, 1), spines, (x + 6) / w


# ------------------------------------------------------------------------------------------------ preserves & china (wrap cells 512 x 256)
def _label(canvas_img, x0, y0, x1, y1, lines, ink='#2E2218', paper='#EBDDB6', border='#7A2F34', seed=1):
    im = Image.fromarray(to_u8(canvas_img), 'RGB')
    d = ImageDraw.Draw(im)
    pc = tuple(int(c * 255) for c in _rgb(paper))
    d.rectangle([x0, y0, x1, y1], fill=pc)
    bc = tuple(int(c * 255) for c in _rgb(border))
    d.rectangle([x0 + 3, y0 + 3, x1 - 3, y1 - 3], outline=bc, width=2)
    ic = tuple(int(c * 255) for c in _rgb(ink))
    n = len(lines)
    ch = (y1 - y0 - 10) / n
    for i, (txt, size, italic) in enumerate(lines):
        f = font(size, italic)
        cx = (x0 + x1) / 2
        cy = y0 + 5 + ch * (i + 0.5)
        d.text((cx, cy), txt, font=f, fill=ic, anchor='mm')
    return from_u8(np.asarray(im))


def _jam_cell(cw, ch, fill_hex, label, seed, label_paper='#EBDDB6', border='#7A2F34'):
    """Wrap-around glass jar: coloured preserve, lit highlight streaks, a hand-lettered label centred at u = 0.5, paper cap tied on top."""
    yy, xx = _grid(ch, cw)
    fill = _rgb(fill_hex)
    img = np.ones((ch, cw, 3), np.float32) * fill
    cl = rfbm(cw, ch, 6, 4, 3, seed)
    img *= (0.80 + 0.45 * cl)[..., None]
    # little fruit/peel flecks suspended in the jam
    img = _splat_dabs(img, cw, ch, 90, seed + 1, tuple(np.clip(fill * 1.35, 0, 1)), 0.45)
    img = _splat_dabs(img, cw, ch, 70, seed + 2, tuple(np.clip(fill * 0.55, 0, 1)), 0.5)
    # cylindrical shading: dark edges (at u 0 / 1 = the back, hidden), bright glass streak left of centre
    shade = 0.70 + 0.55 * np.sin(np.clip(xx, 0, 1) * math.pi) ** 0.6
    img *= shade[..., None]
    hl = np.exp(-((xx - 0.30) / 0.018) ** 2) * (0.35 + 0.65 * (np.abs(yy - 0.5) < 0.42))
    gcol = np.stack([1.0 + 0.10 * (0.5 - yy), np.ones_like(yy), 1.0 - 0.12 * (0.5 - yy)], -1)
    img = img * gcol
    img = np.clip(img + hl[..., None] * 0.35, 0, 1)
    hl2 = np.exp(-((xx - 0.70) / 0.010) ** 2) * (np.abs(yy - 0.5) < 0.38)
    img = np.clip(img + hl2[..., None] * 0.18, 0, 1)
    # meniscus + glass rim at top and base
    img *= (1.0 - 0.35 * np.exp(-(yy) / 0.05) - 0.25 * np.exp(-(1 - yy) / 0.04))[..., None]
    lw = int(cw * 0.34)
    cx = cw // 2
    img = _label(img, cx - lw // 2, int(ch * 0.30), cx + lw // 2, int(ch * 0.78), label, paper=label_paper, border=border, seed=seed)
    return np.clip(img, 0, 1)


def _splat_dabs(img, w, h, count, seed, color, alpha):
    return _splat(img, _dabs(h, w, count, 5.0, seed, 0.9), color, alpha)


def _china_cell(cw, ch, kind, seed):
    yy, xx = _grid(ch, cw)
    if kind == 'willow':          # blue-and-white
        img = paint.wash('#F0EBDD', ch, cw, seed=seed, tint_var=0.03, blotch=0.05, facets=0, grain=0.02)
        blue = _rgb('#2B4C8C')
        for y0 in (0.12, 0.88):
            img = mix(img, np.ones_like(img) * blue, (np.abs(yy - y0) < 0.04).astype(np.float32))
        sprig = (0.5 + 0.5 * np.sin(xx * TAU * 7)) * (np.abs(yy - 0.5) < 0.28)
        img = mix(img, np.ones_like(img) * _rgb('#3E65A8'), np.clip(sprig - 0.45, 0, 1) * 1.6)
        for cx in (0.2, 0.5, 0.8):
            r = np.sqrt(((xx - cx) / 0.12) ** 2 + ((yy - 0.5) / 0.28) ** 2)
            img = mix(img, np.ones_like(img) * blue, ((r < 1.0) & (r > 0.78)).astype(np.float32))
    elif kind == 'rose':          # cream with rose sprigs and gilt line
        img = paint.wash('#F3E9D3', ch, cw, seed=seed, tint_var=0.03, blotch=0.05, facets=0, grain=0.02)
        img = mix(img, np.ones_like(img) * _rgb('#CBA24F'), ((np.abs(yy - 0.1) < 0.012) | (np.abs(yy - 0.9) < 0.012)).astype(np.float32))
        for cx in np.linspace(0.1, 0.9, 5):
            r = np.sqrt(((xx - cx) / 0.07) ** 2 + ((yy - 0.5) / 0.16) ** 2)
            img = mix(img, np.ones_like(img) * _rgb('#C95A74'), (r < 1).astype(np.float32))
            r2 = np.sqrt(((xx - cx - 0.05) / 0.06) ** 2 + ((yy - 0.62) / 0.10) ** 2)
            img = mix(img, np.ones_like(img) * _rgb('#5E8A55'), (r2 < 1).astype(np.float32))
    elif kind == 'green':         # celadon glaze
        img = paint.wash('#8DB3A0', ch, cw, seed=seed, tint_var=0.06, blotch=0.10, facets=0, grain=0.02)
        img = mix(img, np.ones_like(img) * _rgb('#CFE3D3'), sstep(0.6, 0.85, rfbm(cw, ch, 6, 4, 3, seed)) * 0.5)
    elif kind == 'terracotta':
        img = paint.wash('#B8643E', ch, cw, seed=seed, tint_var=0.08, blotch=0.12, facets=0, grain=0.03)
        img = mix(img, np.ones_like(img) * _rgb('#E2E0D0'), sstep(0.62, 0.82, rfbm(cw, ch, 10, 6, 3, seed + 3)) * 0.35)    # lime bloom
    elif kind == 'tin_tea':       # red japanned tea tin with gold lettering
        img = paint.wash('#9E2B2B', ch, cw, seed=seed, tint_var=0.05, blotch=0.07, facets=0, grain=0.02)
        im = Image.fromarray(to_u8(img), 'RGB')
        d = ImageDraw.Draw(im)
        d.rectangle([int(cw * 0.30), int(ch * 0.25), int(cw * 0.70), int(ch * 0.75)], fill=(233, 214, 150))
        d.text((cw // 2, int(ch * 0.40)), 'TEA', font=font(int(ch * 0.30)), fill=(60, 30, 20), anchor='mm')
        d.text((cw // 2, int(ch * 0.62)), 'Best Congou', font=font(int(ch * 0.12), True), fill=(110, 40, 30), anchor='mm')
        d.rectangle([0, 0, cw, int(ch * 0.06)], fill=(212, 170, 80))
        d.rectangle([0, int(ch * 0.94), cw, ch], fill=(212, 170, 80))
        img = from_u8(np.asarray(im))
    elif kind == 'medicine':      # brown glass bottle with a paper label
        img = paint.wash('#6B3F1F', ch, cw, seed=seed, tint_var=0.05, blotch=0.08, facets=0, grain=0.02)
        img = _label(img, int(cw * 0.33), int(ch * 0.25), int(cw * 0.67), int(ch * 0.78), [('SYRUP', int(ch * 0.2), False), ('of Figs', int(ch * 0.15), True)],
                     paper='#E9DDBB', border='#2F5A45')
    elif kind == 'wax':           # candle wax
        img = paint.wash('#F0E4C2', ch, cw, seed=seed, tint_var=0.03, blotch=0.06, facets=0, grain=0.02)
        img *= (0.9 + 0.1 * np.sin(xx * TAU * 3))[..., None]
    elif kind == 'pewter':
        img = paint.wash('#8E949B', ch, cw, seed=seed, tint_var=0.05, blotch=0.08, facets=0, grain=0.02)
    else:
        img = np.ones((ch, cw, 3), np.float32) * 0.8
    shade = 0.68 + 0.50 * np.sin(np.clip(xx, 0, 1) * math.pi) ** 0.6
    img = img * shade[..., None]
    hl = np.exp(-((xx - 0.30) / 0.03) ** 2) * 0.20
    img = np.clip(img + hl[..., None], 0, 1)
    return np.clip(img, 0, 1)


PRESERVES = [  # (key, fill colour, label lines (text, size, italic))
    ('strawberry', '#B3243B', [('STRAWBERRY', 22, False), ('1862', 26, True)]),
    ('damson', '#5A2A58', [('DAMSON', 36, False), ('Jam', 28, True)]),
    ('gooseberry', '#B3BF4B', [('GOOSE-', 26, False), ('BERRY', 26, False)]),
    ('marmalade', '#E58A2B', [('ORANGE', 30, False), ('MARMALADE', 20, False)]),
    ('honey', '#E3A82E', [('HONEY', 40, False)]),
    ('blackcurrant', '#2E1A33', [('BLACK', 30, False), ('CURRANT', 26, False)]),
    ('quince', '#EAB454', [('QUINCE', 36, False), ('Jelly', 28, True)]),
    ('greengage', '#8FB84A', [('GREEN', 30, False), ('GAGE', 34, False)]),
]
PRES_CELLS = {}
CHINA = ['willow', 'rose', 'green', 'terracotta', 'tin_tea', 'medicine', 'wax', 'pewter']


def preserves_atlas(cw=512, ch=256):
    """4 cols x 4 rows of 512x256 wrap cells: rows 0-1 jam jars (8), rows 2-3 china / tins / bottles / wax (8). Returns (atlas, index map)."""
    atlas = np.zeros((4 * ch, 4 * cw, 3), np.float32)
    idx = {}
    k = 0
    for key, col, lines in PRESERVES:
        cell = _jam_cell(cw, ch, col, lines, 300 + k)
        _paste_cell(atlas, cell, k % 4, k // 4, cw, ch)
        idx[key] = k
        k += 1
    for j, kind in enumerate(CHINA):
        cell = _china_cell(cw, ch, kind, 400 + j)
        _paste_cell(atlas, cell, k % 4, k // 4, cw, ch)
        idx[kind] = k
        k += 1
    return np.clip(atlas, 0, 1), idx


# ------------------------------------------------------------------------------------------------ metals / stone
def _metal_cell(size, kind, seed):
    if kind == 'brass':
        img = I.brass(size, size, seed=seed)
    elif kind == 'copper':
        img = I.brass(size, size, seed=seed, base='#B8693F')
        v = sstep(0.60, 0.80, rfbm(size, size, 6, 6, 4, seed + 2))
        img = mix(img, np.ones_like(img) * _rgb('#5BA391'), v * 0.75)                    # verdigris creeping in
    elif kind == 'bronze':
        img = paint.wash('#4E6E5F', size, size, seed=seed, tint_var=0.07, blotch=0.12, facets=0, grain=0.03)
        img = mix(img, np.ones_like(img) * _rgb('#7FB8A2'), sstep(0.55, 0.8, rfbm(size, size, 7, 7, 4, seed + 3)) * 0.7)
        img = mix(img, np.ones_like(img) * _rgb('#8B6A3A'), sstep(0.7, 0.9, rfbm(size, size, 9, 9, 3, seed + 4)) * 0.5)
    else:                                                                                    # pewter / blackened iron
        img = paint.wash('#5B6168', size, size, seed=seed, tint_var=0.06, blotch=0.10, facets=0, grain=0.03)
        img = mix(img, np.ones_like(img) * _rgb('#9C5B36'), sstep(0.62, 0.84, rfbm(size, size, 8, 8, 4, seed + 5)) * 0.45)
    return np.clip(img, 0, 1)


def metal_atlas(cell=512):
    """2x2: 0 brass, 1 copper+verdigris, 2 bronze, 3 pewter/iron."""
    atlas = np.zeros((2 * cell, 2 * cell, 3), np.float32)
    for k, kind in enumerate(('brass', 'copper', 'bronze', 'iron')):
        _paste_cell(atlas, _metal_cell(cell, kind, 70 + k), k % 2, k // 2, cell, cell)
    return atlas


def stone_ledge(size=1024, seed=300):
    """Dressed warm limestone for corbels, ledges and arch surrounds: faint bedding lines, lichen and a few moss dabs."""
    img = paint.wash('#BCB09A', size, size, seed=seed, tint_var=0.06, blotch=0.10, facets=10, facet_var=0.04, edge=0.05, grain=0.03)
    yy, xx = _grid(size, size)
    bed = 0.92 + 0.10 * np.sin(yy * TAU * 6 + 2.0 * rfbm(size, size, 4, 4, 2, seed + 1))
    img *= bed[..., None]
    img = mix(img, np.ones_like(img) * _rgb('#A9A28D'), sstep(0.55, 0.8, rfbm(size, size, 6, 6, 4, seed + 2)) * 0.6)
    img = mix(img, np.ones_like(img) * _rgb('#C9B27A'), sstep(0.6, 0.85, rfbm(size, size, 5, 5, 3, seed + 3)) * 0.35)       # ochre iron bloom
    img = mix(img, np.ones_like(img) * _rgb('#7E9650'), sstep(0.66, 0.84, rfbm(size, size, 11, 7, 4, seed + 4)) * 0.6)      # lichen/moss
    img = _splat(img, _dabs(size, size, 220, 5, seed + 5, 1.3), _rgb('#E7DEC8'), 0.4)
    img = _splat(img, _dabs(size, size, 160, 4, seed + 6, 1.3), _rgb('#6C6556'), 0.35)
    return np.clip(img, 0, 1)


# ------------------------------------------------------------------------------------------------ framed maps & pictures (512 x 512 cells)
def _rgbi(hexc, k=1.0):
    return tuple(int(np.clip(c * k, 0, 1) * 255) for c in _rgb(hexc))


def _paper(size, base, seed, tea=0.5):
    img = paint.wash(base, size, size, seed=seed, tint_var=0.06, blotch=0.10, facets=0, grain=0.03)
    img = mix(img, np.ones_like(img) * _rgb('#C9A66B'), sstep(0.55, 0.85, rfbm(size, size, 4, 4, 3, seed + 1)) * tea)
    return img


def _edge_burn(img, amt=0.35):
    h, w = img.shape[:2]
    yy, xx = _grid(h, w)
    e = np.minimum(np.minimum(xx, 1 - xx), np.minimum(yy, 1 - yy))
    return img * (1.0 - np.clip(1.0 - e / 0.10, 0, 1) ** 2 * amt)[..., None]


def _craquelure(img, seed, amt=0.07):
    h, w = img.shape[:2]
    cr = np.clip(1.0 - paint.voronoi(h, w, 16, seed)[1] * 12, 0, 1) ** 4
    return img * (1.0 - amt * cr)[..., None] * np.array([1.04, 1.0, 0.88], np.float32)


def _draw(img):
    im = Image.fromarray(to_u8(img), 'RGB')
    return im, ImageDraw.Draw(im)


def _undraw(im, soften=0.7):
    if soften:
        im = im.filter(ImageFilter.GaussianBlur(soften))
    return from_u8(np.asarray(im))


def _map_county(size, seed):
    img = _paper(size, '#EADFC0', seed, 0.35)
    f1, edge, cid = paint.voronoi(size, size, 9, seed, 0.9)
    cols = [_rgb(c) for c in ('#E9A7A0', '#A9CFA0', '#EBD684', '#9DBFD8', '#D5B3D0', '#F0C490')]
    k = np.minimum((cid * len(cols)).astype(int), len(cols) - 1)
    fill = np.stack([np.stack([c[i] for c in cols])[k] for i in range(3)], -1)
    img = mix(img, fill, 0.72)
    img = mix(img, np.ones_like(img) * _rgb('#4A3626'), np.clip(1.0 - edge * 18, 0, 1) ** 2 * 0.9)
    im, d = _draw(img)
    rng = np.random.default_rng(seed)
    pts = [(int(size * (0.1 + 0.8 * i / 12)), int(size * (0.30 + 0.12 * math.sin(i * 0.9) + 0.4 * i / 12))) for i in range(13)]
    d.line(pts, fill=_rgbi('#3A78A6'), width=6, joint='curve')
    for _ in range(26):
        x, y = rng.integers(30, size - 30, 2)
        d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=_rgbi('#3A2A20'))
    d.rectangle([22, 22, size - 22, size - 22], outline=_rgbi('#4A3626'), width=4)
    d.rectangle([32, 32, size - 32, size - 32], outline=_rgbi('#4A3626'), width=1)
    cx, cy = int(size * 0.82), int(size * 0.84)
    for a in range(8):
        ang = a * math.pi / 4
        L = 46 if a % 2 == 0 else 28
        d.line([(cx, cy), (cx + L * math.cos(ang), cy + L * math.sin(ang))], fill=_rgbi('#7A2F34'), width=3)
    d.rectangle([60, 40, 260, 86], fill=_rgbi('#F1E7C8'), outline=_rgbi('#4A3626'), width=2)
    d.text((160, 63), 'THE COUNTIES', font=font(26), fill=_rgbi('#2E2218'), anchor='mm')
    return _edge_burn(_undraw(im), 0.3)


def _map_sea(size, seed):
    yy, xx = _grid(size, size)
    sea = paint.wash('#6FA6A8', size, size, seed=seed, tint_var=0.08, blotch=0.12, facets=0, grain=0.03)
    land = paint.fbm(size, size, 3, 5, seed + 2)
    mask = np.clip((land - 0.54) * 26, 0, 1)
    coast = np.clip(1.0 - np.abs(land - 0.54) * 40, 0, 1)
    sea = mix(sea, np.ones_like(sea) * _rgb('#4A8393'), np.clip((0.54 - land) * 6, 0, 1) * 0.6)                  # deeper water offshore
    img = mix(sea, _paper(size, '#EAD9A8', seed + 5, 0.4) * np.array([1.0, 0.96, 0.82], np.float32), mask)
    img = mix(img, np.ones_like(img) * _rgb('#A7C68B'), mask * sstep(0.56, 0.62, land) * 0.6)
    img = _splatc(img, coast, '#3E2E22', 0.85)
    im, d = _draw(img)
    cx, cy = int(size * 0.22), int(size * 0.76)
    for a in range(16):                                                      # rhumb lines
        ang = a * math.pi / 8
        d.line([(cx, cy), (cx + 700 * math.cos(ang), cy + 700 * math.sin(ang))], fill=_rgbi('#9A4A3E'), width=1)
    d.ellipse([cx - 52, cy - 52, cx + 52, cy + 52], outline=_rgbi('#2E2218'), width=3)
    d.polygon([(cx, cy - 60), (cx + 12, cy), (cx, cy + 60), (cx - 12, cy)], fill=_rgbi('#B03A2E'))
    d.polygon([(cx - 60, cy), (cx, cy - 12), (cx + 60, cy), (cx, cy + 12)], fill=_rgbi('#F0E4C0'), outline=_rgbi('#2E2218'))
    d.rectangle([20, 20, size - 20, size - 20], outline=_rgbi('#2E2218'), width=5)
    return _edge_burn(_undraw(im), 0.3)


def _splatc(img, mask, hexc, a):
    return over(img, hexc, np.clip(mask, 0, 1) * a)


def _map_star(size, seed):
    yy, xx = _grid(size, size)
    img = paint.wash('#1F2C4F', size, size, seed=seed, tint_var=0.08, blotch=0.14, facets=0, grain=0.03)
    img = mix(img, np.ones_like(img) * _rgb('#3E3A6B'), sstep(0.5, 0.85, rfbm(size, size, 3, 3, 3, seed + 1)) * 0.6)    # nebula wash
    im, d = _draw(img)
    rng = np.random.default_rng(seed)
    gold = _rgbi('#E8C65A')
    c = size // 2
    for r in (110, 190, 238):
        d.ellipse([c - r, c - r, c + r, c + r], outline=gold, width=2)
    d.line([(c, 16), (c, size - 16)], fill=gold, width=1)
    d.line([(16, c), (size - 16, c)], fill=gold, width=1)
    for _ in range(5):
        pts = [(int(rng.integers(50, size - 50)), int(rng.integers(50, size - 50))) for _ in range(int(rng.integers(4, 7)))]
        d.line(pts, fill=_rgbi('#C9B8E8'), width=1)
        for p in pts:
            d.ellipse([p[0] - 4, p[1] - 4, p[0] + 4, p[1] + 4], fill=gold)
    for _ in range(140):
        x, y = rng.integers(10, size - 10, 2)
        r = int(rng.integers(1, 3))
        d.ellipse([x - r, y - r, x + r, y + r], fill=_rgbi('#F4E7B8'))
    d.rectangle([14, 14, size - 14, size - 14], outline=gold, width=4)
    return _undraw(im, 0.6)


def _map_treasure(size, seed):
    img = _paper(size, '#EBD9A5', seed, 0.7)
    land = paint.fbm(size, size, 2, 4, seed + 3)
    yy, xx = _grid(size, size)
    isl = np.clip(1.0 - np.sqrt(((xx - 0.5) / 0.38) ** 2 + ((yy - 0.52) / 0.30) ** 2) + (land - 0.5) * 0.9, 0, 1)
    mask = (isl > 0.12).astype(np.float32)
    mask = from_u8(np.asarray(Image.fromarray(to_u8(mask), 'L').filter(ImageFilter.GaussianBlur(1.2))))[..., None] if False else mask
    img = mix(img, np.ones_like(img) * _rgb('#B5CF8D'), (isl > 0.12).astype(np.float32) * 0.65)
    img = mix(img, np.ones_like(img) * _rgb('#7FB4B8'), (isl <= 0.12).astype(np.float32) * 0.35)
    img = _splatc(img, np.clip(1.0 - np.abs(isl - 0.12) * 40, 0, 1), '#3E2E22', 0.85)
    im, d = _draw(img)
    pts = [(120, 330), (170, 300), (210, 330), (260, 290), (300, 320), (340, 270), (380, 250)]
    for a, b in zip(pts[:-1], pts[1:]):
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        for t in np.linspace(0, 1, int(L / 9)):
            x, y = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
            d.ellipse([x - 2.5, y - 2.5, x + 2.5, y + 2.5], fill=_rgbi('#B03A2E'))
    x, y = pts[-1]
    d.line([(x - 14, y - 14), (x + 14, y + 14)], fill=_rgbi('#B03A2E'), width=6)
    d.line([(x - 14, y + 14), (x + 14, y - 14)], fill=_rgbi('#B03A2E'), width=6)
    for (px, py) in ((180, 200), (240, 170), (310, 210), (200, 260)):
        d.line([(px, py), (px, py - 30)], fill=_rgbi('#6B4A2A'), width=3)
        for a in range(5):
            ang = -math.pi / 2 + (a - 2) * 0.6
            d.line([(px, py - 30), (px + 22 * math.cos(ang), py - 30 + 22 * math.sin(ang) + 6)], fill=_rgbi('#3F7A3A'), width=3)
    d.rectangle([20, 20, size - 20, size - 20], outline=_rgbi('#4A3626'), width=4)
    d.text((256, 54), 'TREASURE ISLAND', font=font(28), fill=_rgbi('#4A2A1E'), anchor='mm')
    return _edge_burn(_undraw(im), 0.4)


def _tree_dabs(cv, x, y, r, cols, n, rng):
    for _ in range(n):
        a = rng.uniform(0, TAU)
        rr = r * math.sqrt(rng.random())
        c = cols[int(rng.integers(len(cols)))]
        cv.dab(x + rr * math.cos(a), y + rr * math.sin(a) * 0.9, r * 0.28, r * 0.2, rng.uniform(0, math.pi), c, 235)


def _picture_canvas(size, top, bottom, seed):
    yy, xx = _grid(size, size)
    t = np.clip(yy * 1.2, 0, 1)
    img = mix(np.ones((size, size, 3), np.float32) * _rgb(top), np.ones((size, size, 3), np.float32) * _rgb(bottom), t)
    img *= (0.95 + 0.10 * rfbm(size, size, 5, 4, 3, seed))[..., None]
    return img


def _seascape(size, seed):
    img = _picture_canvas(size, '#F0B97A', '#F7E3B5', seed)
    yy, xx = _grid(size, size)
    img = mix(img, np.ones_like(img) * _rgb('#FFF1C6'), np.exp(-(((xx - 0.72) / 0.18) ** 2 + ((yy - 0.46) / 0.12) ** 2)) * 0.9)     # low sun
    horizon = 0.52
    sea_t = np.clip((yy - horizon) / (1 - horizon), 0, 1)
    sea = mix(np.ones_like(img) * _rgb('#5A9AA6'), np.ones_like(img) * _rgb('#264E6E'), sea_t[..., None][..., 0] ** 0.8)
    wave = 0.5 + 0.5 * np.sin(yy * 120 + xx * 18 + 3 * rfbm(size, size, 6, 6, 2, seed))
    sea = sea * (0.88 + 0.22 * wave)[..., None]
    img = mix(img, sea, (yy > horizon).astype(np.float32))
    glint = np.exp(-((xx - 0.72) / (0.03 + 0.12 * sea_t)) ** 2) * (yy > horizon) * (0.4 + 0.6 * wave)
    img = np.clip(img + glint[..., None] * np.array([0.9, 0.7, 0.3], np.float32) * 0.8, 0, 1)
    im, d = _draw(img)
    # a brig under sail
    bx, by = 250, 292
    d.polygon([(bx - 110, by), (bx + 120, by), (bx + 90, by + 36), (bx - 80, by + 36)], fill=_rgbi('#3A2418'))
    d.line([(bx - 100, by + 10), (bx + 108, by + 10)], fill=_rgbi('#C9A24A'), width=3)
    for mx, mh in ((bx - 50, 170), (bx + 20, 200), (bx + 85, 150)):
        d.line([(mx, by), (mx, by - mh)], fill=_rgbi('#2E1E14'), width=4)
        d.polygon([(mx - 36, by - mh + 18), (mx + 36, by - mh + 18), (mx + 30, by - 20), (mx - 30, by - 20)], fill=_rgbi('#F5ECD6'))
        d.polygon([(mx - 36, by - mh + 18), (mx + 10, by - mh + 18), (mx - 6, by - 20), (mx - 30, by - 20)], fill=_rgbi('#E1D0AE'))
    d.polygon([(bx + 20, by - 200), (bx + 52, by - 196), (bx + 20, by - 186)], fill=_rgbi('#B03A2E'))
    return _craquelure(_undraw(im, 0.9), seed)


def _orchard(size, seed):
    img = _picture_canvas(size, '#8FC2E0', '#F6E8C0', seed)
    yy, xx = _grid(size, size)
    hill = 0.44 + 0.05 * np.sin(xx * 7)
    img = mix(img, np.ones_like(img) * _rgb('#9DBE6A') * (0.9 + 0.2 * rfbm(size, size, 8, 6, 3, seed + 1))[..., None], (yy > hill).astype(np.float32))
    path = (np.abs(xx - 0.5 - 0.15 * (yy - 0.5)) < 0.03 + 0.20 * np.clip(yy - 0.45, 0, 1)) & (yy > 0.45)
    img = mix(img, np.ones_like(img) * _rgb('#E3C98E'), path.astype(np.float32) * 0.9)
    cv = Canvas(img, 1.0, 1.0)
    rng = np.random.default_rng(seed)
    cv.begin()
    cols_t = [_rgb(c) for c in ('#C9501F', '#E08A2B', '#B63A2A', '#E9B040', '#8C6A2A')]
    for (tx, ty, tr) in ((90, 250, 70), (410, 240, 80), (250, 215, 55), (150, 340, 90), (360, 360, 100)):
        cv.line([(tx, ty + tr * 0.6), (tx + rng.normal(0, 4), ty + tr * 1.5)], 8 + tr / 12, _rgb('#4A3022'), 255)
        _tree_dabs(cv, tx, ty, tr, cols_t, 120, rng)
    cv.flush(blur=0.5)
    img = cv.img
    for _ in range(3):
        pass
    return _craquelure(img, seed)


def _moonlit(size, seed):
    img = _picture_canvas(size, '#1B2150', '#4A4E8E', seed)
    yy, xx = _grid(size, size)
    img = mix(img, np.ones_like(img) * _rgb('#F4EFD0'), np.exp(-(((xx - 0.75) / 0.06) ** 2 + ((yy - 0.2) / 0.06) ** 2) * 1.5) * 0.98)
    img = mix(img, np.ones_like(img) * _rgb('#8A8FD0'), np.exp(-(((xx - 0.75) / 0.2) ** 2 + ((yy - 0.2) / 0.18) ** 2)) * 0.30)
    im, d = _draw(img)
    d.polygon([(0, 380), (90, 340), (180, 365), (300, 330), (420, 360), (512, 335), (512, 512), (0, 512)], fill=_rgbi('#252A52'))
    rng = np.random.default_rng(seed)
    x = 20
    while x < 480:
        w, h = int(rng.integers(50, 90)), int(rng.integers(60, 110))
        d.rectangle([x, 400 - h, x + w, 440], fill=_rgbi('#1A1E3E'))
        d.polygon([(x - 6, 400 - h), (x + w / 2, 400 - h - 36), (x + w + 6, 400 - h)], fill=_rgbi('#2E2A4E'))
        for wx in range(x + 10, x + w - 10, 22):
            for wy in range(410 - h, 430, 26):
                d.rectangle([wx, wy, wx + 10, wy + 14], fill=_rgbi('#F3C45E'))
        x += w + int(rng.integers(8, 26))
    return _craquelure(_undraw(im, 0.9), seed, 0.1)


def _still_life(size, seed):
    img = _picture_canvas(size, '#2C2420', '#4A3A2E', seed)
    yy, xx = _grid(size, size)
    img = mix(img, np.ones_like(img) * _rgb('#6A4C36'), (yy > 0.66).astype(np.float32))
    img = mix(img, np.ones_like(img) * _rgb('#8A6A48'), np.exp(-(((xx - 0.5) / 0.4) ** 2 + ((yy - 0.45) / 0.3) ** 2)) * 0.35)
    im, d = _draw(img)
    d.ellipse([110, 330, 300, 400], fill=_rgbi('#C9B27A'))                              # bowl
    d.ellipse([120, 320, 290, 380], fill=_rgbi('#7A5A2E'))
    for (fx, fy, fr, col) in ((150, 312, 32, '#C8341F'), (205, 298, 36, '#E8A030'), (252, 314, 30, '#7BA03C'), (180, 285, 28, '#9A2A5E'), (230, 282, 26, '#D6552A')):
        d.ellipse([fx - fr, fy - fr, fx + fr, fy + fr], fill=_rgbi(col))
        d.ellipse([fx - fr * 0.5, fy - fr * 0.7, fx - fr * 0.1, fy - fr * 0.3], fill=_rgbi('#FFF2D0'))
    d.rectangle([340, 250, 410, 360], fill=_rgbi('#3F6E8F'))                                # blue jug
    d.ellipse([335, 235, 415, 270], fill=_rgbi('#527FA0'))
    d.ellipse([346, 236, 404, 258], fill=_rgbi('#1C2E3C'))
    d.arc([395, 270, 440, 330], 270, 90, fill=_rgbi('#3F6E8F'), width=8)
    d.rectangle([0, 340 + 60, size, 372 + 60], fill=_rgbi('#5E4630'))
    return _craquelure(_undraw(im, 1.0), seed)


def _portrait_v(size, seed, bg, cloth, hair, collar, skin='#E4B896', cravat=None, whiskers=False, bow=None):
    img = _picture_canvas(size, bg[0], bg[1], seed)
    yy, xx = _grid(size, size)
    img = mix(img, np.ones_like(img) * _rgb('#8A6A48'), np.exp(-(((xx - 0.5) / 0.4) ** 2 + ((yy - 0.38) / 0.35) ** 2)) * 0.5)
    im, d = _draw(img)
    c = size // 2
    d.ellipse([c - 175, 380, c + 175, 640], fill=_rgbi(cloth))                           # shoulders
    d.ellipse([c - 70, 330, c + 70, 420], fill=_rgbi(collar))
    if cravat:
        d.polygon([(c - 24, 360), (c + 24, 360), (c + 12, 440), (c - 12, 440)], fill=_rgbi(cravat))
    d.rectangle([c - 28, 300, c + 28, 372], fill=_rgbi(skin, 0.92))                      # neck
    d.ellipse([c - 74, 130, c + 74, 340], fill=_rgbi(skin))                              # face
    d.pieslice([c - 88, 96, c + 88, 300], 180, 360, fill=_rgbi(hair))                    # hair cap
    d.ellipse([c - 92, 150, c - 60, 280], fill=_rgbi(hair))
    d.ellipse([c + 60, 150, c + 92, 280], fill=_rgbi(hair))
    for ex in (c - 30, c + 30):
        d.ellipse([ex - 11, 218, ex + 11, 232], fill=_rgbi('#F2EAD8'))
        d.ellipse([ex - 5, 219, ex + 5, 231], fill=_rgbi('#3A2A22'))
        d.line([(ex - 14, 208), (ex + 14, 206)], fill=_rgbi(hair, 0.7), width=3)
    d.line([(c, 232), (c - 4, 268)], fill=_rgbi(skin, 0.78), width=3)
    d.chord([c - 24, 282, c + 24, 306], 10, 170, fill=_rgbi('#B5645A'))
    d.ellipse([c - 62, 250, c - 36, 272], fill=_rgbi('#E8A08C'))
    d.ellipse([c + 36, 250, c + 62, 272], fill=_rgbi('#E8A08C'))
    if whiskers:
        d.polygon([(c - 70, 240), (c - 50, 300), (c - 30, 330), (c - 60, 300)], fill=_rgbi(hair, 0.9))
        d.polygon([(c + 70, 240), (c + 50, 300), (c + 30, 330), (c + 60, 300)], fill=_rgbi(hair, 0.9))
    if bow:
        d.polygon([(c - 70, 120), (c - 10, 150), (c - 70, 176)], fill=_rgbi(bow))
        d.polygon([(c + 70, 120), (c + 10, 150), (c + 70, 176)], fill=_rgbi(bow))
    return _craquelure(_undraw(im, 1.0), seed)


def _cat(size, seed):
    img = _picture_canvas(size, '#C9A178', '#E8D3A8', seed)
    yy, xx = _grid(size, size)
    img = mix(img, np.ones_like(img) * _rgb('#8E3B4A'), (yy > 0.62).astype(np.float32) * (0.85 + 0.1 * np.sin(xx * 40)))        # cushion
    im, d = _draw(img)
    fur = '#B98A54'
    d.ellipse([120, 260, 400, 480], fill=_rgbi(fur))
    d.ellipse([170, 140, 350, 320], fill=_rgbi(fur))
    d.polygon([(178, 190), (200, 100), (240, 160)], fill=_rgbi(fur))
    d.polygon([(342, 190), (320, 100), (280, 160)], fill=_rgbi(fur))
    d.polygon([(192, 175), (203, 125), (226, 160)], fill=_rgbi('#E6A9A0'))
    d.polygon([(328, 175), (317, 125), (294, 160)], fill=_rgbi('#E6A9A0'))
    for sx in (-1, 1):
        for k in range(4):
            d.line([(260 + sx * 20, 160 + k * 18), (260 + sx * 70, 175 + k * 22)], fill=_rgbi('#6E4A26'), width=7)
    for ex in (225, 295):
        d.ellipse([ex - 22, 210, ex + 22, 250], fill=_rgbi('#E9D36A'))
        d.ellipse([ex - 5, 212, ex + 5, 248], fill=_rgbi('#201814'))
    d.polygon([(250, 262), (270, 262), (260, 276)], fill=_rgbi('#D98C8C'))
    for k in range(3):
        d.line([(210, 270 + k * 8), (150, 262 + k * 14)], fill=_rgbi('#F4ECD8'), width=2)
        d.line([(310, 270 + k * 8), (370, 262 + k * 14)], fill=_rgbi('#F4ECD8'), width=2)
    d.ellipse([230, 330, 290, 380], fill=_rgbi('#F2E6CE'))
    return _craquelure(_undraw(im, 1.0), seed)


def _botanical(size, seed):
    img = _paper(size, '#F0E8D0', seed, 0.45)
    im, d = _draw(img)
    d.line([(256, 480), (260, 300), (250, 200)], fill=_rgbi('#4A7A3C'), width=8, joint='curve')
    for (lx, ly, ang) in ((256, 420, 0.6), (258, 380, -0.7), (256, 330, 0.5), (252, 280, -0.6)):
        for s in (1, -1):
            pts = [(lx + s * 0, ly), (lx + s * 40, ly - 28), (lx + s * 84, ly - 10), (lx + s * 40, ly + 14)]
            d.polygon(pts, fill=_rgbi('#5E9A4A'), outline=_rgbi('#2F5A32'))
            d.line([(lx, ly), (lx + s * 78, ly - 8)], fill=_rgbi('#2F5A32'), width=2)
    for k in range(6):
        ang = k * TAU / 6
        d.ellipse([250 + 46 * math.cos(ang) - 38, 190 + 46 * math.sin(ang) - 38, 250 + 46 * math.cos(ang) + 38, 190 + 46 * math.sin(ang) + 38],
                  fill=_rgbi('#D9547A'), outline=_rgbi('#8E2E4C'))
    d.ellipse([220, 160, 280, 220], fill=_rgbi('#F29BB0'), outline=_rgbi('#8E2E4C'))
    d.ellipse([240, 180, 262, 202], fill=_rgbi('#E8C24A'))
    d.text((256, 490), 'Rosa gallica', font=font(24, True), fill=_rgbi('#3A2A20'), anchor='mm')
    d.rectangle([18, 18, size - 18, size - 18], outline=_rgbi('#6B5037'), width=3)
    return _edge_burn(_undraw(im, 0.7), 0.3)


def _sampler(size, seed):
    img = _paper(size, '#E9DEC0', seed, 0.25)
    im, d = _draw(img)
    cols = ['#B03A2E', '#2F5A8C', '#3F7A3A', '#C9962E']
    for k in range(0, size - 40, 16):
        for edge in (28, size - 44):
            d.rectangle([k + 20, edge, k + 30, edge + 10], fill=_rgbi(cols[(k // 16) % 4]))
            d.rectangle([edge, k + 20, edge + 10, k + 30], fill=_rgbi(cols[(k // 16 + 1) % 4]))
    rows = ['ABCDEFGHIJKLM', 'NOPQRSTUVWXYZ', 'abcdefghijklm']
    for i, rw in enumerate(rows):
        d.text((256, 110 + i * 50), rw, font=font(30), fill=_rgbi(cols[i % 4]), anchor='mm')
    d.text((256, 280), 'HOME, SWEET HOME', font=font(34), fill=_rgbi('#7A2F34'), anchor='mm')
    d.polygon([(206, 380), (306, 380), (306, 440), (256, 480), (206, 440)], fill=_rgbi('#2F5A8C'))
    d.polygon([(236, 400), (276, 400), (276, 440), (236, 440)], fill=_rgbi('#E9DEC0'))
    d.polygon([(190, 390), (256, 340), (322, 390)], fill=_rgbi('#B03A2E'))
    return _edge_burn(_undraw(im, 0.5), 0.25)


ART_KEYS = ['county', 'sea', 'star', 'treasure', 'world', 'lady', 'gent', 'boy', 'meadow', 'seascape', 'orchard', 'still', 'botanical', 'moon', 'cat', 'sampler']
ART_KIND = {k: ('map' if k in ('county', 'sea', 'star', 'treasure', 'world') else 'picture') for k in ART_KEYS}


def art_atlas(cell=512):
    """4x4 cells of 512x512; ART_KEYS gives the order (row-major). Pictures are painted 'oil'-style with craquelure, maps like hand-coloured engravings."""
    builders = {
        'county': lambda s: _map_county(cell, 11), 'sea': lambda s: _map_sea(cell, 12), 'star': lambda s: _map_star(cell, 13),
        'treasure': lambda s: _map_treasure(cell, 14), 'world': lambda s: I.parchment_map(cell, cell, seed=15),
        'lady': lambda s: _portrait_v(cell, 21, ('#2E3A4F', '#4A3F3A'), '#4C6E96', '#6B4426', '#F0E8D4', bow='#B03A2E'),
        'gent': lambda s: _portrait_v(cell, 22, ('#3A2E2A', '#52382E'), '#2F4A3A', '#6E5A4A', '#EFE6D0', cravat='#A02E3A', whiskers=True),
        'boy': lambda s: _portrait_v(cell, 23, ('#506A7A', '#8AA0A8'), '#27406E', '#C9A04A', '#F4F0E4', skin='#E9C3A0'),
        'meadow': lambda s: I.painting(cell, cell, 'landscape', seed=24),
        'seascape': lambda s: _seascape(cell, 25), 'orchard': lambda s: _orchard(cell, 26), 'still': lambda s: _still_life(cell, 27),
        'botanical': lambda s: _botanical(cell, 28), 'moon': lambda s: _moonlit(cell, 29), 'cat': lambda s: _cat(cell, 30), 'sampler': lambda s: _sampler(cell, 31),
    }
    atlas = np.zeros((4 * cell, 4 * cell, 3), np.float32)
    for k, key in enumerate(ART_KEYS):
        c = builders[key](k)
        if c.shape[0] != cell or c.shape[1] != cell:
            c = np.asarray(Image.fromarray(to_u8(c), 'RGB').resize((cell, cell), Image.LANCZOS), np.float32) / 255.0
        _paste_cell(atlas, np.clip(c, 0, 1), k % 4, k // 4, cell, cell)
    return atlas


# ------------------------------------------------------------------------------------------------ lantern glass + tapestries
def lamp_glass(w=256, h=256, seed=77):
    """Emissive lantern glass painted as a flame seen through frosted panes: hot cream core at mid-height cooling to amber and a smoky
    top, a darker wick-and-flame silhouette at u = 0.25 / 0.75 and thin amber muntin lines at the quarter points. Wraps around a lathe."""
    yy, xx = _grid(h, w)
    v = 1.0 - yy                                           # row 0 = top of the glass
    core = np.exp(-((v - 0.46) / 0.30) ** 2)
    img = np.ones((h, w, 3), np.float32) * _rgb('#E27D34')
    img = mix(img, np.ones_like(img) * _rgb('#FFC764'), np.clip(core * 1.3, 0, 1))
    img = mix(img, np.ones_like(img) * _rgb('#FFF3C2'), np.clip(core ** 2.2 * 1.2, 0, 1))
    img = mix(img, np.ones_like(img) * _rgb('#B8602C'), sstep(0.78, 1.0, v) * 0.55)               # soot at the crown
    for fx in (0.25, 0.75):
        fl = np.exp(-(((xx - fx) / 0.045) ** 2 + ((v - 0.40) / 0.16) ** 2))
        img = mix(img, np.ones_like(img) * _rgb('#FFFBE6'), np.clip(fl * 1.4, 0, 1))
        wick = np.exp(-(((xx - fx) / 0.008) ** 2 + ((v - 0.18) / 0.09) ** 2))
        img = mix(img, np.ones_like(img) * _rgb('#8A4A2A'), np.clip(wick, 0, 1) * 0.8)
    for q in (0.0, 0.25, 0.5, 0.75):
        img = img * (1.0 - 0.14 * np.exp(-((xx - q - 0.125) / 0.006) ** 2))[..., None]
    img *= (0.93 + 0.12 * rfbm(w, h, 6, 6, 3, seed))[..., None]
    return np.clip(img, 0, 1)


def tapestry(w=512, h=768, field='#7B2431', border='#1F3560', accent='#D1A650', motif='#E8D9B0', seed=900):
    """Woven wall hanging: coloured field with a lozenge lattice, a banded border, a central medallion and a knotted fringe; visible weft threads."""
    yy, xx = _grid(h, w)
    img = paint.wash(field, h, w, seed=seed, tint_var=0.07, blotch=0.10, facets=0, grain=0.03)
    one = np.ones_like(img)
    e = np.minimum(np.minimum(xx, 1 - xx), np.minimum(yy, 1 - yy) * (h / w))
    def band(lo, hi):
        return ((e >= lo) & (e < hi)).astype(np.float32)
    img = mix(img, one * _rgb(border), band(0.02, 0.095))
    img = mix(img, one * _rgb(motif), band(0.105, 0.120))
    img = mix(img, one * _rgb(border), band(0.130, 0.170))
    img = mix(img, one * _rgb(accent), band(0.176, 0.188))
    t = np.where(np.minimum(xx, 1 - xx) * w < np.minimum(yy, 1 - yy) * h, yy * h, xx * w)
    img = mix(img, one * _rgb(accent), np.clip((0.5 + 0.5 * np.sin(t / 14.0)) - 0.55, 0, 1) * 1.6 * band(0.030, 0.085))
    cx, cy = xx - 0.5, (yy - 0.5) * (h / w)
    lat = np.abs((cx * 7) % 1.0 - 0.5) + np.abs((cy * 7) % 1.0 - 0.5)
    inner = (e > 0.20)
    img = mix(img, one * _rgb(accent), ((lat > 0.46) | (lat < 0.07)).astype(np.float32) * inner * 0.55)
    dmed = np.abs(cx) / 0.9 + np.abs(cy) / 1.1
    for s_, col, wd in ((0.30, motif, 0.030), (0.21, border, 0.050), (0.12, accent, 0.040), (0.05, field, 0.04)):
        img = mix(img, one * _rgb(col), (np.abs(dmed - s_) < wd).astype(np.float32) * inner)
    weft = 0.90 + 0.10 * np.sin(yy * h * 1.9)
    warp = 0.94 + 0.06 * np.sin(xx * w * 1.9 + 1.0)
    img = img * (weft * warp)[..., None] * (0.92 + 0.14 * rfbm(w, h, 8, 12, 3, seed + 5))[..., None]
    fr = np.clip((yy - 0.94) / 0.06, 0, 1)
    strands = (0.5 + 0.5 * np.sin(xx * w * 0.9)) > 0.45
    img = mix(img, one * _rgb(accent) * (0.85 + 0.2 * np.sin(xx * w * 0.3))[..., None], fr * strands * 0.9)
    return np.clip(img, 0, 1)


def tapestry_atlas(seed=900):
    """Two hangings side by side (1024 x 768): wine / navy / gold and teal / ochre / rose."""
    a = tapestry(512, 768, '#7B2431', '#1F3560', '#D1A650', '#E8D9B0', seed)
    b = tapestry(512, 768, '#2F6A6E', '#6B2740', '#E0B050', '#F0E2B8', seed + 20)
    return np.concatenate([a, b], 1)
