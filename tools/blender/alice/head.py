"""
Alice's head: sculpted cranium/face, ears, big expressive eyes (separate mesh), eyelids, brows, lips and an open-able
mouth — all in ONE skinned mesh ('Alice_Head') with shape keys (Blink, Smile, Surprised, Crying, MouthOpen, Neutral).
"""
import math

import bmesh
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

from lib.meshkit import V, clamp, gauss, lerp, loft, smoothstep, tube
from . import spec

# material slot order inside the head mesh
MAT_SKIN, MAT_LID, MAT_MOUTH, MAT_LIP, MAT_BROW = range(5)

HC = spec.HEAD_C
HR = spec.HEAD_R


def _face_dir(ux, uz):
    """Unit-sphere direction on the FRONT of the head for a given (ux, uz)."""
    uy = -math.sqrt(max(0.0, 1.0 - ux * ux - uz * uz))
    return ux, uy, uz


# (ux, uz, sigma, amplitude[m], sx, sz): gaussian bumps on the face, mirrored in x when ux != 0
FACE_FEATURES = [
    (0.370, -0.140, 0.185, -0.0115, 1.0, 1.0),   # eye socket (the eyeball sits in it)
    (0.370, 0.180, 0.170, 0.0028, 1.0, 0.7),     # brow ridge
    (0.520, -0.430, 0.260, 0.0075, 1.0, 1.0),    # cheek
    (0.110, -0.420, 0.070, 0.0035, 1.0, 1.0),    # alar wing
    (0.0, -0.400, 0.085, 0.0090, 1.0, 1.0),      # nose tip
    (0.0, -0.200, 0.070, 0.0045, 1.0, 0.45),     # nose bridge
    (0.0, -0.600, 0.130, 0.0030, 1.0, 1.0),      # upper lip pad
    (0.0, -0.680, 0.300, -0.0028, 1.0, 4.0),     # mouth groove
    (0.0, -0.760, 0.130, 0.0034, 1.0, 1.0),      # lower lip pad
    (0.0, -0.920, 0.170, 0.0070, 1.0, 1.0),      # chin
]


def head_point(u):
    """Unit-sphere direction -> displaced head-surface point (metres)."""
    ux, uy, uz = u
    lower = smoothstep(0.05, -1.0, uz)
    w = 1.0 - 0.17 * lower ** 1.7
    # rounded jaw: widen the lower-mid face a little, then let the chin close up
    w *= 1.0 + 0.06 * smoothstep(0.2, -0.45, uz) * (1.0 - smoothstep(-0.55, -1.0, uz))
    d = 1.0 - 0.05 * lower ** 1.5
    if uz < 0:
        uz = uz * 0.94   # shorter chin
    front = smoothstep(0.0, -0.7, uy)   # 1 on the face, 0 on the back of the head
    cheek = gauss((uz + 0.45) ** 2, 0.30) * front
    w *= 1.0 + 0.05 * cheek

    disp = 0.0
    for (fx, fz, sig, amp, sx, sz) in FACE_FEATURES:
        for sgn in ((1.0, -1.0) if fx != 0.0 else (1.0,)):
            cx, cy, cz = _face_dir(fx * sgn, fz)
            d2 = ((ux - cx) * sx) ** 2 + (uy - cy) ** 2 + ((uz - cz) * sz) ** 2
            disp += amp * gauss(d2, sig)
    # temples: shallow concavity
    for sgn in (1.0, -1.0):
        d2 = (ux - 0.92 * sgn) ** 2 + (uy + 0.40) ** 2 + (uz - 0.15) ** 2
        disp += -0.0030 * gauss(d2, 0.30)

    p = Vector((HR.x * ux * w, HR.y * uy * d, HR.z * uz))
    n = Vector((ux / HR.x, uy / HR.y, uz / HR.z)).normalized()   # outward normal of the base ellipsoid
    return Vector((HC.x, HC.y, HC.z)) + p + n * disp


def hairline_boundary(phi):
    """uz above which the scalp is covered by hair, as a function of azimuth phi (rad; 0 = front centre)."""
    a = math.degrees(phi)
    if a < 30:
        return 0.44 + 0.04 * (a / 30.0)
    if a < 68:
        t = (a - 30) / 38.0
        return lerp(0.48, 0.04, smoothstep(0, 1, t))
    if a < 100:
        t = (a - 68) / 32.0
        return lerp(0.06, -0.38, smoothstep(0, 1, t))
    return -0.52


def _snapshot(bm):
    """Identity snapshot of current vertices. BMesh pools reuse freed slots, so *never* assume new verts are last."""
    return set(bm.verts)


def _fresh(bm, before):
    return [v for v in bm.verts if v not in before]


def _sync(bm):
    bm.verts.index_update()
    bm.verts.ensure_lookup_table()
    bm.faces.index_update()
    bm.faces.ensure_lookup_table()


def build_head_bm(mats):
    """Return (bm, info). info carries vertex-index groups needed for shape keys, weights and attachments."""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    info = {'skin': [], 'upper_lid': {1: [], -1: []}, 'lower_lid': {1: [], -1: []}, 'upper_lip': [], 'lower_lip': [],
            'mouth_top': [], 'mouth_bot': [], 'brow': {1: [], -1: []}, 'ears': [], 'cap_faces': []}

    # --- cranium -------------------------------------------------------------------------------------------
    bmesh.ops.create_uvsphere(bm, u_segments=104, v_segments=72, radius=1.0)
    sphere_verts = list(bm.verts)
    for v in sphere_verts:
        u = v.co.copy()
        v.co = head_point(u)
    info['skin'] = sphere_verts
    for f in bm.faces:
        f.material_index = MAT_SKIN
        f.smooth = True
    bm.normal_update()

    # UV: planar front projection (texture covers x +-0.125, z 0.87..1.17)
    for f in bm.faces:
        for l in f.loops:
            c = l.vert.co
            l[uvl].uv = (0.5 + (c.x - HC.x) / 0.25, 0.5 + (c.z - HC.z) / 0.30)

    bvh = BVHTree.FromBMesh(bm)

    def surface(x, z, off=0.0):
        hit = bvh.ray_cast(Vector((x, -0.5, z)), Vector((0, 1, 0)), 1.0)[0]
        if hit is None:
            return Vector((x, HC.y - HR.y, z))
        return Vector((hit.x, hit.y - off, hit.z))

    # remember which faces form the hair-cap region (used by the hair builder)
    for f in bm.faces:
        c = f.calc_center_median()
        u = Vector(((c.x - HC.x) / HR.x, (c.y - HC.y) / HR.y, (c.z - HC.z) / HR.z))
        phi = math.atan2(abs(u.x), -u.y)
        if u.z > hairline_boundary(phi):
            info['cap_faces'].append(f.index)

    # --- ears -------------------------------------------------------------------------------------------------
    for s in (1.0, -1.0):
        before = _snapshot(bm)
        bmesh.ops.create_uvsphere(bm, u_segments=18, v_segments=12, radius=1.0)
        new = _fresh(bm, before)
        newset = set(new)
        rot = Matrix.Rotation(math.radians(-8 * s), 3, 'Y') @ Matrix.Rotation(math.radians(-10), 3, 'X')
        for v in new:
            p = Vector((v.co.x * 0.0065, v.co.y * 0.016, v.co.z * 0.025))
            p = rot @ p
            v.co = p + Vector((0.0955 * s, HC.y + 0.012, HC.z - 0.014))
        info['ears'].extend(new)
        for f in bm.faces:
            if all(v in newset for v in f.verts):
                f.material_index = MAT_SKIN
                f.smooth = True
                for l in f.loops:
                    l[uvl].uv = (0.5 + (l.vert.co.x - HC.x) / 0.25, 0.5 + (l.vert.co.z - HC.z) / 0.30)

    # --- eyelids (partial spherical shells around each eyeball) -------------------------------------------------
    R = spec.EYE_R * 1.07
    def lid_shell(s, upper):
        c = Vector((spec.EYE_X * s, spec.EYE_Y, spec.EYE_C_Z))
        e_edge = math.radians(40.0 if upper else -23.0)
        e_far = math.radians(84.0 if upper else -70.0)
        az_n = 18
        el_n = 8
        grid = []
        for j in range(el_n + 1):
            e = lerp(e_edge, e_far, j / el_n)
            row = []
            for i in range(az_n + 1):
                az = lerp(-math.radians(80), math.radians(80), i / az_n)
                d = Vector((math.sin(az) * math.cos(e), -math.cos(az) * math.cos(e), math.sin(e)))
                row.append(c + d * R)
            grid.append(row)
        verts = [[bm.verts.new(p) for p in row] for row in grid]
        for j in range(el_n):
            for i in range(az_n):
                quad = (verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i])
                # outward normals: upper lid grid runs edge->far (upwards), lower lid downwards
                if not upper:
                    quad = quad[::-1]
                try:
                    f = bm.faces.new(quad)
                except ValueError:
                    continue
                f.material_index = MAT_LID
                f.smooth = True
                for l, (vi, vj) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)) if upper else ((i, j + 1), (i + 1, j + 1), (i + 1, j), (i, j))):
                    # upper lid -> v in [0, .5] (edge at 0); lower lid -> v in [.5, 1] (edge at .5)
                    l[uvl].uv = (vi / az_n, 0.5 * (vj / el_n) + (0.0 if upper else 0.5))
        (info['upper_lid'] if upper else info['lower_lid'])[s].extend(v for row in verts for v in row)

    for s in (1.0, -1.0):
        lid_shell(s, True)
        lid_shell(s, False)

    # --- brows -------------------------------------------------------------------------------------------------
    for s in (1.0, -1.0):
        pts = []
        for i in range(9):
            t = i / 8.0
            x = spec.EYE_X * s + (lerp(-0.0255, 0.0285, t)) * s
            z = spec.EYE_C_Z + 0.0440 + 0.0100 * math.sin(math.pi * t * 0.92) - 0.0065 * t
            pts.append(surface(x, z, off=0.0004))
        before = _snapshot(bm)
        tube(pts, rx=lambda t: 0.0011, ry=lambda t: 0.0016 + 0.0020 * math.sin(math.pi * min(1.0, max(0.0, 0.08 + 0.84 * t))) ** 0.8,
             n=6, up_hint=(0, 0, 1), bm=bm, cap_start=True, cap_end=True)
        new = _fresh(bm, before)
        newset = set(new)
        for f in bm.faces:
            if f.verts[0] in newset:
                f.material_index = MAT_BROW
        info['brow'][s].extend(new)

    # --- mouth -------------------------------------------------------------------------------------------------
    mz = HC.z + HR.z * -0.68 + 0.001
    hw = 0.0215

    def mouth_curve(dz, n=11, ends_taper=True):
        pts = []
        for i in range(n):
            t = -1 + 2 * i / (n - 1)
            x = hw * t
            z = mz + dz + 0.0030 * t * t
            pts.append(surface(x, z, off=0.0006))
        return pts

    up_pts = mouth_curve(0.0024)
    lo_pts = mouth_curve(-0.0030)
    before = _snapshot(bm)
    tube(up_pts, rx=lambda t: 0.0021 * (math.sin(math.pi * t) ** 0.5), ry=lambda t: 0.0030 * (math.sin(math.pi * t) ** 0.5) + 0.0002,
         n=7, up_hint=(0, 0, 1), bm=bm, cap_start=True, cap_end=True)
    new = _fresh(bm, before)
    newset = set(new)
    for f in bm.faces:
        if f.verts[0] in newset:
            f.material_index = MAT_LIP
    info['upper_lip'] = new
    before = _snapshot(bm)
    tube(lo_pts, rx=lambda t: 0.0024 * (math.sin(math.pi * t) ** 0.5), ry=lambda t: 0.0036 * (math.sin(math.pi * t) ** 0.5) + 0.0002,
         n=7, up_hint=(0, 0, 1), bm=bm, cap_start=True, cap_end=True)
    new = _fresh(bm, before)
    newset = set(new)
    for f in bm.faces:
        if f.verts[0] in newset:
            f.material_index = MAT_LIP
    info['lower_lip'] = new

    # mouth interior: thin sheet between the lips (opens with MouthOpen / Surprised)
    top = [surface(hw * (-1 + 2 * i / 10) * 0.96, mz + 0.0006 + 0.0030 * (-1 + 2 * i / 10) ** 2, off=0.0004) for i in range(11)]
    bot = [surface(hw * (-1 + 2 * i / 10) * 0.96, mz - 0.0010 + 0.0030 * (-1 + 2 * i / 10) ** 2, off=0.0004) for i in range(11)]
    vt = [bm.verts.new(p) for p in top]
    vb = [bm.verts.new(p) for p in bot]
    for i in range(10):
        try:
            f = bm.faces.new((vt[i], vb[i], vb[i + 1], vt[i + 1]))
        except ValueError:
            continue
        f.material_index = MAT_MOUTH
        f.smooth = True
        for l in f.loops:
            l[uvl].uv = (0.5, 0.5)
    info['mouth_top'] = vt
    info['mouth_bot'] = vb
    info['mouth_z'] = mz
    info['bvh_surface'] = surface
    _sync(bm)

    def idx(lst):
        return [v.index for v in lst]

    for k in ('skin', 'upper_lip', 'lower_lip', 'mouth_top', 'mouth_bot', 'ears'):
        info[k] = idx(info[k])
    for k in ('upper_lid', 'lower_lid', 'brow'):
        info[k] = {sd: idx(vs) for sd, vs in info[k].items()}
    return bm, info


def eye_geometry(side):
    """Eyeball for one side; front hemisphere uses an orthographic planar UV so the painted iris is undistorted."""
    c = Vector((spec.EYE_X * side, spec.EYE_Y, spec.EYE_C_Z))
    R = spec.EYE_R
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=28, radius=R)
    # sphere pole axis is Z; we want the gaze (-Y) pole to be well tessellated too, fine at this density
    for v in bm.verts:
        v.co = v.co + c
    for f in bm.faces:
        f.smooth = True
        for l in f.loops:
            p = l.vert.co - c
            l[uvl].uv = (0.5 + p.x / (2 * R), 0.5 + p.z / (2 * R))
            if p.y > 0:   # back of the globe: park it on the sclera colour
                l[uvl].uv = (0.02, 0.02)
    return bm
