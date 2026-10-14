"""Painted textures for Alice's elder sister (chestnut hair, green linen, cream crochet shawl, maroon book)."""
import math

import numpy as np

from lib import paint
from . import textures
from .textures import _blend, _grid, _rgb

SKIN = '#F2C9AB'


def make_all(out_dir=None):
    mats = {}

    def mk(name, arr, rough=0.9):
        img = paint.to_image('T_' + name, np.ascontiguousarray(arr), out_dir)
        mats[name] = paint.make_material('M_' + name, img, roughness=rough)

    def flat(name, hexc, rough=0.8, metal=0.0):
        c = paint.srgb_to_linear(_rgb(hexc))
        mats[name] = paint.make_material('M_' + name, None, (float(c[0]), float(c[1]), float(c[2]), 1.0), rough, metal)

    pal = dict(skin=SKIN, skin_shadow='#DCA58B', blush='#E9A08C', hair='#6A4630', hair_dark='#3E2A1E', hair_light='#9A7352',
               lip='#C26E66', dress='#7E9B68', collar='#E8DCC0')
    with textures.palette(**pal):
        mk('Sister_Skin', textures.skin())
        mk('Sister_Face', textures.head(freckles=False, blush_amt=0.38))
        mk('Sister_Lid', textures.lid())
        mk('Sister_Eye', textures.eye(), rough=0.25)
        mk('Sister_HairCap', textures.hair_cap(), rough=0.6)
        mk('Sister_Hair', textures.hair_clump(), rough=0.6)

    # green linen dress: fine weave, soft darker folds
    img = paint.wash('#7C9B66', 1024, 1024, seed=811, tint_var=0.04, blotch=0.06, facets=18, facet_var=0.03, edge=0.04, grain=0.016)
    u, v = _grid(1024, 1024)
    weave = 0.5 + 0.5 * np.sin(u * 1024 * math.pi * 0.5) * np.sin(v * 1024 * math.pi * 0.5)
    img = img * (0.96 + 0.04 * weave)[..., None]
    mk('Sister_Dress', np.clip(img, 0, 1))

    # pleated skirt: u runs once around per pleat (11 per revolution), v rises from the hem — fold shading, linen weave, tiny sprigs, lace hem
    S = 1024
    img = paint.wash('#86A66E', S, S, seed=861, tint_var=0.035, blotch=0.05, facets=0, grain=0.03)
    u, v = _grid(S, S)
    pleat = 0.5 + 0.5 * np.cos(2 * math.pi * (u + 0.5))
    img = img * (0.70 + 0.32 * pleat ** 0.8)[..., None]
    img = img * (0.93 + 0.07 * (0.5 + 0.5 * np.sin(u * S * math.pi) * np.sin(v * S * math.pi)))[..., None]
    from world.painters import _dabs, _splat
    img = _splat(img, _dabs(S, S, 160, 3.4, 77, 1.0), _rgb('#F1E6C6'), 0.8)
    img = _splat(img, _dabs(S, S, 160, 2.2, 78, 1.0), _rgb('#C98A82'), 0.7)
    img = _splat(img, np.clip((paint.fbm(S, S, 6, 4, 79) - 0.58) * 4, 0, 1), _rgb('#5E7F4C'), 0.5)
    hem = np.clip((0.07 - v) / 0.02, 0, 1)
    img = _blend(img, hem, _rgb('#4F6F40'), 0.9)
    lace = ((np.floor(u * 22) % 2) == 0) & (v > 0.07) & (v < 0.11)
    img = _blend(img, lace.astype(np.float32), _rgb('#EFE4C4'), 0.9)
    mk('Sister_Skirt', np.clip(img, 0, 1))

    # cream crochet shawl: openwork rosettes
    img = paint.wash('#EADFC3', 512, 512, seed=821, tint_var=0.02, blotch=0.04, facets=0, grain=0.02)
    u, v = _grid(512, 512)
    cell = 1 / 12.0
    fx = (u / cell) % 1.0 - 0.5
    fy = (v / cell) % 1.0 - 0.5
    d = np.sqrt(fx * fx + fy * fy)
    holes = np.clip((0.20 - d) / 0.05, 0, 1) * (np.abs(np.sin(np.arctan2(fy, fx) * 3.0)) ** 2)
    img = _blend(img, holes, _rgb('#B9AA86'), 0.55)
    mk('Sister_Shawl', np.clip(img, 0, 1))

    # maroon cloth book cover with a gold frame, cream pages with printed lines
    cov = paint.wash('#7C2F35', 256, 256, seed=831, tint_var=0.04, blotch=0.05, facets=0, grain=0.02)
    u, v = _grid(256, 256)
    frame = ((np.abs(u - 0.5) > 0.40) | (np.abs(v - 0.5) > 0.42)) & (np.abs(u - 0.5) < 0.43) & (np.abs(v - 0.5) < 0.45)
    cov = _blend(cov, frame.astype(np.float32), _rgb('#C9A24A'), 0.9)
    mk('Sister_BookCover', cov)
    pg = paint.wash('#F1E8D2', 256, 256, seed=841, tint_var=0.02, blotch=0.03, facets=0, grain=0.02)
    lines = ((np.floor(v * 40) % 2) == 0) & (u > 0.12) & (u < 0.88) & (v > 0.1) & (v < 0.9)
    pg = _blend(pg, lines.astype(np.float32), _rgb('#6F624C'), 0.45)
    mk('Sister_Pages', pg)

    flat('Sister_Boot', '#4A3426', 0.5)
    flat('Sister_Brow', '#4B3424')
    flat('Sister_Lips', '#C26E66', 0.5)
    flat('Sister_Mouth', '#5A2323', 0.6)
    flat('Sister_Ribbon', '#8A3B3B', 0.5)
    return mats
