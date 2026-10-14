"""Hard-surface helpers for architecture and props (Blender coordinates, +Z up): boxes, extruded mouldings, lathe solids.

All faces get world-space planar UVs (metres × tile) so wallpaper / brick / grain keeps one consistent scale across
differently sized parts. Boxes use their own vertices per face (crisp edges); lathes and mouldings are smooth/crisp as drawn.
"""
import math

import bmesh
from mathutils import Vector

from lib.meshkit import loft, ring_around

_AXES = ((0, 1), (1, 0), (0, 2), (2, 0), (1, 2), (2, 1))


def _uv(layer, face, pts, ua, va, tile, off=(0.0, 0.0)):
    for loop, p in zip(face.loops, pts):
        loop[layer].uv = (p[ua] * tile[0] + off[0], p[va] * tile[1] + off[1])


def quad(bm, a, b, c, d, uvs=None, uv_name='UVMap'):
    """One quad (a,b,c,d CCW seen from the outside) with explicit UVs ((u,v) x4) — for pictures, labels, planes."""
    uvl = bm.loops.layers.uv.get(uv_name) or bm.loops.layers.uv.new(uv_name)
    f = bm.faces.new((bm.verts.new(a), bm.verts.new(b), bm.verts.new(c), bm.verts.new(d)))
    uvs = uvs or ((0, 0), (1, 0), (1, 1), (0, 1))
    for loop, uv in zip(f.loops, uvs):
        loop[uvl].uv = uv
    return f


def box(bm, lo, hi, tile=(1.0, 1.0), skip=(), uv_name='UVMap', off=(0.0, 0.0), tile_top=None, face_uv=None):
    """
    Axis-aligned box from `lo` to `hi`. UV = world metres × tile, projected along each face's dominant axis.
    `skip` may list face names: 'px','nx','py','ny','pz','nz' (e.g. hide the back face against a wall).
    `tile_top` overrides the tile for the +Z/-Z faces (e.g. wood end-grain vs. top).
    `face_uv` maps a side face name to an (u0, v0, u1, v1) texture rectangle (book spines, labels).
    """
    uvl = bm.loops.layers.uv.get(uv_name) or bm.loops.layers.uv.new(uv_name)
    x0, y0, z0 = lo
    x1, y1, z1 = hi
    P = lambda x, y, z: Vector((x, y, z))
    faces = {
        'nx': ((P(x0, y1, z0), P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1)), 1, 2),
        'px': ((P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)), 1, 2),
        'ny': ((P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)), 0, 2),
        'py': ((P(x1, y1, z0), P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1)), 0, 2),
        'nz': ((P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0), P(x0, y0, z0)), 0, 1),
        'pz': ((P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)), 0, 1),
    }
    for name, (pts, ua, va) in faces.items():
        if name in skip:
            continue
        try:
            f = bm.faces.new([bm.verts.new(p) for p in pts])
        except ValueError:
            continue
        t = tile_top if (tile_top and name in ('pz', 'nz')) else tile
        if face_uv and name in face_uv and name not in ('pz', 'nz'):
            u0, v0, u1, v1 = face_uv[name]
            for loop, uv in zip(f.loops, ((u0, v0), (u1, v0), (u1, v1), (u0, v1))):
                loop[uvl].uv = uv
        else:
            _uv(uvl, f, pts, ua, va, t, off)
    return bm


def moulding(bm, p0, p1, profile, side, up=(0, 0, 1), tile=(1.0, 1.0), uv_name='UVMap'):
    """
    Extrude a 2D `profile` [(depth, height), …] (closed polygon, CCW seen along the run) along the segment p0→p1.
    `side` is the unit vector pointing out of the wall (depth axis); height runs along `up`.
    """
    side = Vector(side).normalized()
    up = Vector(up).normalized()
    run = (Vector(p1) - Vector(p0))
    length = run.length
    uvl = bm.loops.layers.uv.get(uv_name) or bm.loops.layers.uv.new(uv_name)
    n = len(profile)
    a = [Vector(p0) + side * d + up * h for d, h in profile]
    b = [Vector(p1) + side * d + up * h for d, h in profile]
    for i in range(n):                                   # unique verts per face -> crisp profile edges
        j = (i + 1) % n
        try:
            f = bm.faces.new((bm.verts.new(a[i]), bm.verts.new(b[i]), bm.verts.new(b[j]), bm.verts.new(a[j])))
        except ValueError:
            continue
        d0 = profile[i][1] * tile[1]
        d1 = profile[j][1] * tile[1]
        uvs = [(0, d0), (length * tile[0], d0), (length * tile[0], d1), (0, d1)]
        for loop, uv in zip(f.loops, uvs):
            loop[uvl].uv = uv
    for ring, flip in ((a, False), (b, True)):         # end caps (start: -run, end: +run)
        try:
            f = bm.faces.new([bm.verts.new(p) for p in (ring[::-1] if flip else ring)])
        except ValueError:
            continue
        for loop in f.loops:
            loop[uvl].uv = (0.5, 0.5)
    return bm


def lathe(bm, profile, center=(0, 0, 0), seg=24, uv_u=(0.0, 1.0), cap_bottom=True, cap_top=True, scale=(1.0, 1.0), axis=(0, 0, 1), uv_name='UVMap'):
    """
    Revolve a [(radius, height), …] profile (bottom → top) around `axis` through `center` (height runs along the axis).
    `scale` stretches the ring (x, y) for oval vases / lamp shades.
    """
    c = Vector(center)
    t = Vector(axis).normalized()
    helper = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
    ax = (helper - t * helper.dot(t)).normalized()
    bx = t.cross(ax)                       # ax × bx = t  -> CCW seen from +t, outward normals
    rings = []
    for r, h in profile:
        rr = max(r, 1e-4)
        rings.append(ring_around(c + t * h, ax, bx, rr * scale[0], rr * scale[1], seg))
    loft(rings, True, cap_bottom and profile[0][0] > 1e-3, cap_top and profile[-1][0] > 1e-3, uv_u, (0.0, 1.0), bm, uv_name)
    return bm


def disc_xy(bm, center, radius, z_offset=0.0, seg=32, uv_name='UVMap', facing_up=True):
    """Flat disc in the XY plane with planar UVs mapped 0..1 across the diameter (clock faces, pictures, plates)."""
    uvl = bm.loops.layers.uv.get(uv_name) or bm.loops.layers.uv.new(uv_name)
    c = Vector(center) + Vector((0, 0, z_offset))
    cv = bm.verts.new(c)
    ring = [bm.verts.new(c + Vector((math.cos(2 * math.pi * i / seg) * radius, math.sin(2 * math.pi * i / seg) * radius, 0))) for i in range(seg)]
    for i in range(seg):
        a, b = ring[i], ring[(i + 1) % seg]
        f = bm.faces.new((cv, a, b) if facing_up else (cv, b, a))
        for loop in f.loops:
            p = loop.vert.co
            loop[uvl].uv = (0.5 + (p.x - c.x) / (2 * radius), 0.5 + (p.y - c.y) / (2 * radius))
    return bm


def append_bm(dst, src, matrix=None, uv_name='UVMap'):
    """Copy `src` into `dst` (shared vertices stay shared, UVs preserved), optionally transformed by a 4×4 matrix."""
    src.verts.index_update()
    uv_s = src.loops.layers.uv.get(uv_name)
    uv_d = dst.loops.layers.uv.get(uv_name) or dst.loops.layers.uv.new(uv_name)
    vmap = {}
    for f in src.faces:
        vs = []
        for v in f.verts:
            nv = vmap.get(v.index)
            if nv is None:
                nv = dst.verts.new(matrix @ v.co if matrix is not None else v.co.copy())
                vmap[v.index] = nv
            vs.append(nv)
        try:
            nf = dst.faces.new(vs)
        except ValueError:
            continue
        if uv_s is not None:
            for ls, ld in zip(f.loops, nf.loops):
                ld[uv_d].uv = ls[uv_s].uv
    return dst
