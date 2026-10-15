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

    pal = dict(skin=SKIN, skin_shadow='#CF9176', blush='#E89580', hair='#5E3A24', hair_dark='#24150D', hair_light='#B88050',
               lip='#BE645C', dress='#62834E', collar='#F4EAD2')
    with textures.palette(**pal):
        mk('Sister_Skin', textures.skin())
        mk('Sister_Face', textures.head(freckles=False, blush_amt=0.45))
        mk('Sister_Lid', textures.lid())
        mk('Sister_Eye', textures.eye(), rough=0.25)
        mk('Sister_HairCap', textures.hair_cap(), rough=0.6)
        mk('Sister_Hair', textures.hair_clump(), rough=0.6)

    # green linen dress: fine weave, vertical pintuck pleats, dark seam piping, and cream lace cuffs
    S_d = 1024
    img = paint.wash('#5C7E48', S_d, S_d, seed=811, tint_var=0.06, blotch=0.08, facets=28, facet_var=0.05, edge=0.06, grain=0.022)
    u, v = _grid(S_d, S_d)
    weave = 0.5 + 0.5 * np.sin(u * S_d * math.pi * 0.5) * np.sin(v * S_d * math.pi * 0.5)
    tuck = 0.5 + 0.5 * np.cos(u * 36 * math.pi)
    img = img * (0.78 + 0.28 * tuck ** 0.7)[..., None] * (0.93 + 0.07 * weave)[..., None]
    # Cream floral sprigs and dark walnut ink cross-hatch in fold valleys
    hatch_d = ((np.sin((u + v) * 240 * math.pi) > 0.3) | (np.sin((u - v) * 240 * math.pi) > 0.3)) & (tuck < 0.38)
    img = _blend(img, hatch_d.astype(np.float32), _rgb('#283820'), 0.55)
    cuff_band = (v < 0.10) | (v > 0.90)
    img = _blend(img, cuff_band.astype(np.float32), _rgb('#F5ECD6'), 0.88)
    mk('Sister_Dress', np.clip(img, 0, 1))

    # pleated skirt: u runs once around per pleat (11 per revolution), v rises from the hem — deep gouache fold shading,
    # Tenniel woodcut hatching, woven linen, three cream-lace flounce bands, and botanical wildflower embroidery
    S = 1024
    img = paint.wash('#648850', S, S, seed=861, tint_var=0.06, blotch=0.08, facets=24, facet_var=0.04, edge=0.05, grain=0.03)
    u, v = _grid(S, S)
    pleat = 0.5 + 0.5 * np.cos(2 * math.pi * (u + 0.5))
    sub_pleat = 0.5 + 0.5 * np.cos(6 * math.pi * (u + 0.25))
    # Strong light-to-shadow fold contrast: deep forest-indigo shadow in valleys, warm sunlit sage-gold on crests
    img = _blend(img, (1.0 - pleat) ** 1.3, _rgb('#23361F'), 0.72)
    img = _blend(img, (pleat ** 1.6) * (0.6 + 0.4 * sub_pleat), _rgb('#C6DC9A'), 0.58)
    # Tenniel woodcut engraving cross-hatching inside fold troughs
    hatch1 = np.sin((u * 8.0 + v * 28.0) * 2 * math.pi) > 0.45
    hatch2 = np.sin((u * 8.0 - v * 28.0) * 2 * math.pi) > 0.55
    in_valley = (pleat < 0.45).astype(np.float32) * (1.0 - pleat)
    img = _blend(img, hatch1.astype(np.float32) * in_valley, _rgb('#1F2B1B'), 0.65)
    img = _blend(img, hatch2.astype(np.float32) * in_valley, _rgb('#1A2416'), 0.55)
    # Linen cross-weave
    img = img * (0.90 + 0.12 * (0.5 + 0.5 * np.sin(u * S * 0.75 * math.pi) * np.sin(v * S * 0.75 * math.pi)))[..., None]
    from world.painters import _dabs, _splat
    img = _splat(img, _dabs(S, S, 260, 4.2, 77, 1.0), _rgb('#FBF3DC'), 0.92)
    img = _splat(img, _dabs(S, S, 220, 3.2, 78, 1.0), _rgb('#D96B62'), 0.85)
    img = _splat(img, _dabs(S, S, 180, 3.0, 80, 1.0), _rgb('#F2C94C'), 0.85)
    img = _splat(img, np.clip((paint.fbm(S, S, 6, 4, 79) - 0.54) * 4, 0, 1), _rgb('#2F4B26'), 0.65)
    # Three horizontal Victorian cream-lace flounce bands with scalloped edges and dark under-shadow
    for v_tier in (0.10, 0.36, 0.62):
        scallop = 0.016 * np.abs(np.sin(u * 12 * math.pi))
        band_top = v_tier + 0.055 + scallop
        band_bot = v_tier + scallop * 0.6
        in_band = (v >= band_bot) & (v <= band_top)
        under_shadow = (v >= band_bot - 0.018) & (v < band_bot)
        top_stitch = (v > band_top - 0.008) & (v <= band_top + 0.005)
        eyelet = in_band & (((np.floor(u * 24) + np.floor((v - v_tier) * 60)) % 2) == 0) & (v < band_top - 0.014)
        img = _blend(img, under_shadow.astype(np.float32), _rgb('#1E2D1A'), 0.85)
        img = _blend(img, in_band.astype(np.float32), _rgb('#F9F1DC'), 0.92)
        img = _blend(img, eyelet.astype(np.float32), _rgb('#3A5230'), 0.72)
        img = _blend(img, top_stitch.astype(np.float32), _rgb('#2B2420'), 0.80)
    hem = np.clip((0.065 - v) / 0.02, 0, 1)
    img = _blend(img, hem, _rgb('#24381E'), 0.92)
    mk('Sister_Skirt', np.clip(img, 0, 1))

    # cream crochet shawl & lap apron: high-relief openwork rosettes + dark walnut shadow recesses + bright ivory threads
    S_sh = 1024
    img = paint.wash('#F7EED8', S_sh, S_sh, seed=821, tint_var=0.03, blotch=0.05, facets=16, facet_var=0.03, grain=0.025)
    u, v = _grid(S_sh, S_sh)
    cell = 1 / 16.0
    fx = (u / cell) % 1.0 - 0.5
    fy = (v / cell) % 1.0 - 0.5
    d = np.sqrt(fx * fx + fy * fy)
    ang = np.arctan2(fy, fx)
    holes = np.clip((0.26 - d) / 0.045, 0, 1) * (np.abs(np.sin(ang * 4.0)) ** 1.6)
    ring_thread = np.exp(-((d - 0.28) / 0.04) ** 2) + np.exp(-((d - 0.12) / 0.03) ** 2)
    lattice = (np.abs(np.sin((u + v) * 16 * math.pi)) < 0.14) | (np.abs(np.sin((u - v) * 16 * math.pi)) < 0.14)
    img = _blend(img, holes, _rgb('#362A1F'), 0.82)
    img = _blend(img, lattice.astype(np.float32) * (1.0 - holes), _rgb('#6E5B46'), 0.48)
    img = _blend(img, np.clip(ring_thread, 0, 1), _rgb('#FFFDF7'), 0.75)
    border = (v < 0.09) | (v > 0.91)
    img = _blend(img, border.astype(np.float32), _rgb('#D4AF5A'), 0.45)
    mk('Sister_Shawl', np.clip(img, 0, 1))

    # maroon cloth book cover with ornate gold filigree frame, cream pages with crisp printed lines and woodcut vignette
    cov = paint.wash('#6E222A', 512, 512, seed=831, tint_var=0.05, blotch=0.06, facets=12, grain=0.025)
    u, v = _grid(512, 512)
    frame1 = ((np.abs(u - 0.5) > 0.39) | (np.abs(v - 0.5) > 0.41)) & (np.abs(u - 0.5) < 0.43) & (np.abs(v - 0.5) < 0.45)
    frame2 = ((np.abs(u - 0.5) > 0.31) | (np.abs(v - 0.5) > 0.33)) & (np.abs(u - 0.5) < 0.33) & (np.abs(v - 0.5) < 0.35)
    medallion = np.sqrt((u - 0.5) ** 2 + (v - 0.5) ** 2) < 0.11
    cov = _blend(cov, (frame1 | frame2 | medallion).astype(np.float32), _rgb('#E6BD5A'), 0.92)
    mk('Sister_BookCover', cov)

    pg = paint.wash('#F7EFE0', 512, 512, seed=841, tint_var=0.02, blotch=0.03, facets=0, grain=0.025)
    u, v = _grid(512, 512)
    gutter = np.exp(-((u - 0.5) / 0.035) ** 2)
    pg = _blend(pg, gutter, _rgb('#5C4B3B'), 0.65)
    lines = ((np.floor(v * 52) % 2) == 0) & (((u > 0.08) & (u < 0.44)) | ((u > 0.56) & (u < 0.92))) & (v > 0.10) & (v < 0.90)
    pg = _blend(pg, lines.astype(np.float32), _rgb('#332920'), 0.72)
    mk('Sister_Pages', pg)

    flat('Sister_Boot', '#2E1F16', 0.45)
    flat('Sister_Brow', '#3A2518')
    flat('Sister_Lips', '#BE645C', 0.5)
    flat('Sister_Mouth', '#4A1A1A', 0.6)
    flat('Sister_Ribbon', '#8A2830', 0.45)
    return mats

