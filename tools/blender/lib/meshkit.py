"""
meshkit — small procedural-modelling toolkit on top of bmesh.

Everything is deterministic (no random without an explicit seed) so the GLB can be regenerated bit-for-bit.
Conventions (see CLAUDE.md §5): Blender X = East, Y = North, Z = Up. Characters face -Y; their LEFT is +X.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

# --------------------------------------------------------------------------------------------------------------
# scalar helpers
# --------------------------------------------------------------------------------------------------------------


def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def lerp(a, b, t):
    return a + (b - a) * t


def smoothstep(a, b, x):
    t = clamp((x - a) / (b - a)) if a != b else 0.0
    return t * t * (3 - 2 * t)


def gauss(d2, sigma):
    return math.exp(-d2 / (2.0 * sigma * sigma))


def V(x=0.0, y=0.0, z=0.0):
    return Vector((x, y, z))


class Rng:
    """Tiny deterministic PRNG (so output never depends on Python's global random state)."""

    def __init__(self, seed=1):
        self.s = seed & 0xFFFFFFFF or 1

    def next(self):
        self.s ^= (self.s << 13) & 0xFFFFFFFF
        self.s ^= self.s >> 17
        self.s ^= (self.s << 5) & 0xFFFFFFFF
        return self.s / 0xFFFFFFFF

    def range(self, a, b):
        return a + (b - a) * self.next()


# --------------------------------------------------------------------------------------------------------------
# scene / object helpers
# --------------------------------------------------------------------------------------------------------------


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'
    sc.unit_settings.scale_length = 1.0
    sc.render.fps = 30


def bm_to_object(bm, name, material=None, smooth=True):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    if smooth:
        for p in mesh.polygons:
            p.use_smooth = True
    if material is not None:
        mesh.materials.append(material)
    mesh.update()
    return obj


def object_to_bm(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    return bm


def apply_modifiers(obj):
    """Bake the modifier stack into the mesh (keeps UVs / materials; drops shape keys, so call it first)."""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    new = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
    old = obj.data
    mats = list(old.materials)
    obj.modifiers.clear()
    obj.data = new
    if not new.materials:
        for m in mats:
            new.materials.append(m)
    bpy.data.meshes.remove(old)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def add_subsurf(obj, levels=1):
    m = obj.modifiers.new('Subsurf', 'SUBSURF')
    m.levels = levels
    m.render_levels = levels
    m.quality = 3
    return m


def add_solidify(obj, thickness, offset=-1.0, rim=True):
    m = obj.modifiers.new('Solidify', 'SOLIDIFY')
    m.thickness = thickness
    m.offset = offset
    m.use_rim = rim
    return m


def join_objects(objs, name):
    """Join mesh objects into the first one (materials are merged, slots preserved)."""
    objs = [o for o in objs if o is not None]
    base = objs[0]
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = base
    bpy.ops.object.join()
    base.name = name
    base.data.name = name
    return base


def shade_smooth(obj):
    for p in obj.data.polygons:
        p.use_smooth = True


def recalc_normals(obj):
    bm = object_to_bm(obj)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()


# --------------------------------------------------------------------------------------------------------------
# frames / rings / lofts
# --------------------------------------------------------------------------------------------------------------


def path_frames(points, up_hint=None):
    """Parallel-transport frames (X, Y, T) along a polyline. (X × Y = T, right-handed)."""
    n = len(points)
    tans = []
    for i in range(n):
        a = points[max(0, i - 1)]
        b = points[min(n - 1, i + 1)]
        t = (b - a)
        t = t.normalized() if t.length > 1e-9 else Vector((0, 0, 1))
        tans.append(t)
    up = Vector(up_hint) if up_hint is not None else Vector((0, 1, 0))
    t0 = tans[0]
    y0 = up - t0 * up.dot(t0)
    if y0.length < 1e-6:
        alt = Vector((1, 0, 0)) if abs(t0.x) < 0.9 else Vector((0, 1, 0))
        y0 = alt - t0 * alt.dot(t0)
    y0.normalize()
    x0 = y0.cross(t0)
    frames = [(x0, y0, t0)]
    for i in range(1, n):
        tp, tc = tans[i - 1], tans[i]
        x, y, _ = frames[-1]
        axis = tp.cross(tc)
        if axis.length > 1e-8:
            ang = math.asin(clamp(axis.length, -1, 1))
            if tp.dot(tc) < 0:
                ang = math.pi - ang
            rot = Matrix.Rotation(ang, 3, axis.normalized())
            x = rot @ x
            y = rot @ y
        # re-orthogonalise
        x = (x - tc * x.dot(tc)).normalized()
        y = tc.cross(x)
        frames.append((x, y, tc))
    return frames


def ring_around(center, x_axis, y_axis, rx, ry, n, phase=0.0, shape=None):
    """CCW ring (seen from +T) of n points. `shape(theta)` may return an extra radial multiplier."""
    pts = []
    for i in range(n):
        th = phase + 2 * math.pi * i / n
        k = shape(th) if shape else 1.0
        pts.append(center + x_axis * (math.cos(th) * rx * k) + y_axis * (math.sin(th) * ry * k))
    return pts


def loft(rings, close_u=True, cap_start=False, cap_end=False, uv_u=(0.0, 1.0), uv_v=(0.0, 1.0), bm=None, uv_name='UVMap'):
    """
    Connect consecutive rings (equal point counts) into a quad strip.
    UVs: u runs around the ring (uv_u range), v along the path (uv_v range). Returns the bmesh.
    Face winding gives outward normals for CCW rings travelling along +T.
    """
    own = bm is None
    if own:
        bm = bmesh.new()
    uvl = bm.loops.layers.uv.get(uv_name) or bm.loops.layers.uv.new(uv_name)
    verts = [[bm.verts.new(p) for p in ring] for ring in rings]
    m = len(rings)
    n = len(rings[0])
    nu = n if close_u else n - 1
    for j in range(m - 1):
        v0 = lerp(uv_v[0], uv_v[1], j / (m - 1))
        v1 = lerp(uv_v[0], uv_v[1], (j + 1) / (m - 1))
        for i in range(nu):
            i2 = (i + 1) % n
            try:
                f = bm.faces.new((verts[j][i], verts[j][i2], verts[j + 1][i2], verts[j + 1][i]))
            except ValueError:
                continue
            u0 = lerp(uv_u[0], uv_u[1], i / nu)
            u1 = lerp(uv_u[0], uv_u[1], (i + 1) / nu)
            uvs = [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
            for loop, uv in zip(f.loops, uvs):
                loop[uvl].uv = uv
    if cap_start:
        _cap(bm, verts[0], flip=True, uvl=uvl)
    if cap_end:
        _cap(bm, verts[-1], flip=False, uvl=uvl)
    return bm


def _cap(bm, ring_verts, flip, uvl):
    c = Vector((0, 0, 0))
    for v in ring_verts:
        c += v.co
    c /= len(ring_verts)
    cv = bm.verts.new(c)
    n = len(ring_verts)
    for i in range(n):
        a, b = ring_verts[i], ring_verts[(i + 1) % n]
        try:
            f = bm.faces.new((cv, b, a) if flip else (cv, a, b))
        except ValueError:
            continue
        for loop in f.loops:
            loop[uvl].uv = (0.5, 0.5)


def tube(points, rx, ry=None, n=12, up_hint=None, twist=None, cap_start=True, cap_end=True, bm=None, uv_u=(0, 1), uv_v=(0, 1), shape=None):
    """
    Variable-radius tube along `points`. rx / ry are floats, lists (per point) or callables f(t). `twist(t)` rotates
    the cross-section (radians). `shape(theta, t)` returns an extra radial multiplier.
    """
    m = len(points)
    frames = path_frames(points, up_hint)

    def val(r, i):
        t = i / (m - 1)
        if callable(r):
            return r(t)
        if isinstance(r, (list, tuple)):
            return r[i]
        return r

    rings = []
    for i, p in enumerate(points):
        x, y, _ = frames[i]
        ph = twist(i / (m - 1)) if twist else 0.0
        rxi = val(rx, i)
        ryi = val(ry if ry is not None else rx, i)
        sh = (lambda th, _i=i: shape(th, _i / (m - 1))) if shape else None
        rings.append(ring_around(p, x, y, rxi, ryi, n, ph, sh))
    return loft(rings, True, cap_start, cap_end, uv_u, uv_v, bm)


def sheet(grid, flip=False, bm=None, uv_name='UVMap', uv_rect=(0, 0, 1, 1)):
    """Open quad sheet from a [rows][cols] grid of points; u along columns, v along rows."""
    own = bm is None
    if own:
        bm = bmesh.new()
    uvl = bm.loops.layers.uv.get(uv_name) or bm.loops.layers.uv.new(uv_name)
    rows, cols = len(grid), len(grid[0])
    verts = [[bm.verts.new(p) for p in row] for row in grid]
    u0, v0, u1, v1 = uv_rect
    for j in range(rows - 1):
        for i in range(cols - 1):
            quad = (verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i])
            if flip:
                quad = quad[::-1]
            try:
                f = bm.faces.new(quad)
            except ValueError:
                continue
            uvs = [
                (lerp(u0, u1, i / (cols - 1)), lerp(v0, v1, j / (rows - 1))),
                (lerp(u0, u1, (i + 1) / (cols - 1)), lerp(v0, v1, j / (rows - 1))),
                (lerp(u0, u1, (i + 1) / (cols - 1)), lerp(v0, v1, (j + 1) / (rows - 1))),
                (lerp(u0, u1, i / (cols - 1)), lerp(v0, v1, (j + 1) / (rows - 1))),
            ]
            if flip:
                uvs = uvs[::-1]
            for loop, uv in zip(f.loops, uvs):
                loop[uvl].uv = uv
    return bm


def ellipsoid(center, radii, seg=24, rings=14, bm=None, uv_name='UVMap'):
    """Latitude/longitude ellipsoid with the pole axis along +Z, UV = equirectangular."""
    own = bm is None
    if own:
        bm = bmesh.new()
    cx, cy, cz = center
    rx, ry, rz = radii
    ring_pts = []
    for j in range(rings + 1):
        phi = math.pi * j / rings  # 0 = top pole
        r = math.sin(phi)
        z = math.cos(phi)
        ring = []
        for i in range(seg):
            th = 2 * math.pi * i / seg
            ring.append(Vector((cx + rx * r * math.cos(th), cy + ry * r * math.sin(th), cz + rz * z)))
        ring_pts.append(ring)
    # rings run top->bottom; use loft with reversed order so normals point outward
    ring_pts = ring_pts[::-1]
    # collapse the poles to single points by tiny radius (loft needs equal counts; pole rings degenerate -> merge)
    loft(ring_pts, True, False, False, bm=bm, uv_name=uv_name)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    return bm


# --------------------------------------------------------------------------------------------------------------
# uv helpers (operate on objects)
# --------------------------------------------------------------------------------------------------------------


def uv_planar(obj, axes=('x', 'z'), scale=(1.0, 1.0), offset=(0.5, 0.5), uv_name='UVMap'):
    """Project every loop with a planar mapping on the given world axes."""
    me = obj.data
    uvl = me.uv_layers.get(uv_name) or me.uv_layers.new(name=uv_name)
    idx = {'x': 0, 'y': 1, 'z': 2}
    a, b = idx[axes[0]], idx[axes[1]]
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uvl.data[li].uv = (co[a] * scale[0] + offset[0], co[b] * scale[1] + offset[1])


def uv_triplanar(obj, scale=3.0, uv_name='UVMap'):
    """Box projection chosen per face by dominant normal axis (good for noise-like painted textures)."""
    me = obj.data
    uvl = me.uv_layers.get(uv_name) or me.uv_layers.new(name=uv_name)
    for poly in me.polygons:
        n = poly.normal
        ax = max(range(3), key=lambda k: abs(n[k]))
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            if ax == 0:
                uv = (co.y, co.z)
            elif ax == 1:
                uv = (co.x, co.z)
            else:
                uv = (co.x, co.y)
            uvl.data[li].uv = (uv[0] * scale + 0.5, uv[1] * scale + 0.5)


def uv_cylindrical(obj, axis_xy=(0.0, 0.0), v_range=(0.0, 1.0), uv_name='UVMap', u_repeat=1.0):
    """u = azimuth around a vertical axis, v = height remapped to v_range (seam handled per polygon)."""
    me = obj.data
    uvl = me.uv_layers.get(uv_name) or me.uv_layers.new(name=uv_name)
    cx, cy = axis_xy
    for poly in me.polygons:
        us = []
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            us.append(math.atan2(co.x - cx, -(co.y - cy)) / (2 * math.pi) + 0.5)
        # unwrap seam inside a polygon
        base = us[0]
        fixed = [base]
        for u in us[1:]:
            while u - base > 0.5:
                u -= 1.0
            while u - base < -0.5:
                u += 1.0
            fixed.append(u)
        for li, u in zip(poly.loop_indices, fixed):
            co = me.vertices[me.loops[li].vertex_index].co
            v = (co.z - v_range[0]) / (v_range[1] - v_range[0])
            uvl.data[li].uv = (u * u_repeat, v)


# --------------------------------------------------------------------------------------------------------------
# misc geometry
# --------------------------------------------------------------------------------------------------------------


def ray_cast_object(obj, origin, direction, max_dist=5.0):
    """Cast a world-space ray against a (non-deformed) mesh object; returns the hit location or None."""
    from mathutils.bvhtree import BVHTree

    dg = bpy.context.evaluated_depsgraph_get()
    bvh = BVHTree.FromObject(obj, dg)
    loc, _n, _i, _d = bvh.ray_cast(origin, direction, max_dist)
    return loc


def make_bvh(obj):
    from mathutils.bvhtree import BVHTree

    dg = bpy.context.evaluated_depsgraph_get()
    return BVHTree.FromObject(obj, dg)


def bm_transform(bm, matrix):
    bmesh.ops.transform(bm, matrix=matrix, verts=bm.verts)


def bm_translate(bm, v):
    bmesh.ops.translate(bm, vec=v, verts=bm.verts)


def triangle_count(obj):
    me = obj.data
    me.calc_loop_triangles()
    return len(me.loop_triangles)
