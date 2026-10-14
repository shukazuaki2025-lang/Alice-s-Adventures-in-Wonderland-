"""
paint — numpy texture synthesis with a hand-painted *watercolour picture-book* feel, plus Blender material helpers.

The look target is a gouache / watercolour wash: soft pigment pooling, faint paper grain, and visible "brush facets"
(voronoi tiles whose tint drifts a few percent) — the same painterly mosaic you see in modern storybook games, but
tinted for a Victorian palette. All maths is tileable and seeded, so textures regenerate identically.
"""
import math
import os

import bpy
import numpy as np


def _smooth(t):
    return t * t * (3 - 2 * t)


def value_noise(h, w, gy, gx, seed=0):
    """Tileable value noise in [0,1] with gy x gx lattice cells."""
    rng = np.random.default_rng(seed)
    grid = rng.random((gy, gx)).astype(np.float32)
    ys = np.arange(h, dtype=np.float32) * (gy / h)
    xs = np.arange(w, dtype=np.float32) * (gx / w)
    y0 = np.floor(ys).astype(int)
    x0 = np.floor(xs).astype(int)
    fy = _smooth(ys - y0)[:, None]
    fx = _smooth(xs - x0)[None, :]
    y1 = (y0 + 1) % gy
    x1 = (x0 + 1) % gx
    y0 %= gy
    x0 %= gx
    a = grid[y0][:, x0]
    b = grid[y0][:, x1]
    c = grid[y1][:, x0]
    d = grid[y1][:, x1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def fbm(h, w, base=4, octaves=5, seed=0, gain=0.5):
    total = np.zeros((h, w), np.float32)
    amp = 1.0
    norm = 0.0
    for o in range(octaves):
        cells = base * (2 ** o)
        total += amp * value_noise(h, w, cells, cells, seed + o * 17)
        norm += amp
        amp *= gain
    return total / norm


def voronoi(h, w, cells=16, seed=0, jitter=0.9):
    """Tileable jittered-grid worley noise. Returns (F1, F2-F1, cell_hash) with F in cell units."""
    rng = np.random.default_rng(seed)
    pts = rng.random((cells, cells, 2)).astype(np.float32)
    pts = 0.5 + (pts - 0.5) * jitter
    hashes = rng.random((cells, cells)).astype(np.float32)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    uy = yy * (cells / h)
    ux = xx * (cells / w)
    cy = np.floor(uy).astype(int)
    cx = np.floor(ux).astype(int)
    f1 = np.full((h, w), 9.0, np.float32)
    f2 = np.full((h, w), 9.0, np.float32)
    idx = np.zeros((h, w), np.float32)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            gy = (cy + dy) % cells
            gx = (cx + dx) % cells
            py = cy + dy + pts[gy, gx, 0]
            px = cx + dx + pts[gy, gx, 1]
            d = np.sqrt((uy - py) ** 2 + (ux - px) ** 2)
            closer = d < f1
            f2 = np.where(closer, f1, np.minimum(f2, d))
            idx = np.where(closer, hashes[gy, gx], idx)
            f1 = np.where(closer, d, f1)
    return f1, f2 - f1, idx


def blur(a, passes=2):
    """Cheap separable box blur (tileable)."""
    out = a
    for _ in range(passes):
        out = (np.roll(out, 1, 0) + out + np.roll(out, -1, 0)) / 3.0
        out = (np.roll(out, 1, 1) + out + np.roll(out, -1, 1)) / 3.0
    return out


def hex_rgb(hexstr):
    s = hexstr.lstrip('#')
    return np.array([int(s[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], np.float32)


def srgb_to_linear(c):
    c = np.asarray(c, np.float32)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def wash(base_hex, h, w, seed=0, tint_var=0.05, blotch=0.07, facets=12, facet_var=0.035, edge=0.05, grain=0.018):
    """
    Watercolour-style flat wash with brush facets. Returns float32 (h,w,3) in sRGB 0..1.
    tint_var   – overall hue/value drift (large soft blotches)
    blotch     – amplitude of pooled-pigment blotches
    facets     – number of voronoi brush tiles per texture width (0 disables)
    """
    base = hex_rgb(base_hex)
    img = np.ones((h, w, 3), np.float32) * base
    big = fbm(h, w, 2, 4, seed + 1)
    img *= (1.0 + (big - 0.5)[..., None] * tint_var * 2.0)
    mid = fbm(h, w, 6, 4, seed + 5)
    img *= (1.0 + (mid - 0.5)[..., None] * blotch * 2.0)
    if facets:
        f1, edgew, cid = voronoi(h, w, facets, seed + 11)
        img *= (1.0 + (cid - 0.5)[..., None] * facet_var * 2.0)
        # pigment dries darker at the tile boundary, with a faint light inner rim (granulation)
        e = np.clip(1.0 - edgew * 3.2, 0, 1) ** 3
        img *= (1.0 - e[..., None] * edge)
    gr = value_noise(h, w, h // 2, w // 2, seed + 23)
    img *= (1.0 + (gr - 0.5)[..., None] * grain * 2.0)
    return np.clip(img, 0, 1)


def to_image(name, arr, path_dir=None, colorspace='sRGB', alpha=False):
    """float (h,w,3|4) sRGB array -> bpy image (optionally saved as PNG so the glTF exporter embeds it)."""
    h, w = arr.shape[:2]
    if arr.shape[2] == 3:
        a = np.ones((h, w, 4), np.float32)
        a[..., :3] = arr
    else:
        a = arr.astype(np.float32)
    img = bpy.data.images.new(name, w, h, alpha=alpha)
    img.colorspace_settings.name = colorspace
    img.pixels.foreach_set(a[::-1].ravel())  # Blender's origin is bottom-left
    img.pack()
    img.update()
    if path_dir:
        os.makedirs(path_dir, exist_ok=True)
        img.filepath_raw = os.path.join(path_dir, name + '.png')
        img.file_format = 'PNG'
        img.save()
    return img


def make_material(name, image=None, color=(0.8, 0.8, 0.8, 1.0), roughness=0.9, metallic=0.0, emissive=None, double_sided=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = 0.15
    if emissive is not None:
        bsdf.inputs['Emission Color'].default_value = (*emissive, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.6
    if image is not None:
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = image
        tex.interpolation = 'Linear'
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    mat.use_backface_culling = not double_sided
    return mat
