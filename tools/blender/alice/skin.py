"""Position-based skin weighting for every Alice mesh (deterministic, no heat-map solver needed)."""
import math

from mathutils import Vector

from lib.meshkit import clamp, lerp, smoothstep
from lib.rigkit import bone_segments, distance_weights, normalise, point_segment_distance
from . import spec

SEG = bone_segments(spec.BONES)

ARM_BONES = {s: [f'Shoulder_{s}', f'UpperArm_{s}', f'LowerArm_{s}', f'Hand_{s}'] +
             [f'{f}_{s}_{k}' for f in spec.FINGER_NAMES for k in (1, 2)] + [f'Thumb_{s}_1', f'Thumb_{s}_2'] for s in ('L', 'R')}


def _side(x):
    return 'L' if x >= 0 else 'R'


def w_neck(co):
    z = co.z
    if z < 0.86:
        return {'Chest': 1.0 - smoothstep(0.84, 0.86, z) * 0.4, 'Neck': smoothstep(0.84, 0.88, z)}
    t = smoothstep(0.88, 0.935, z)
    return {'Neck': 1.0 - t, 'Head': t}


def w_arms(co):
    s = _side(co.x)
    # shoulder cap belongs mostly to the upper arm / shoulder, the torso edge to the chest
    ws = distance_weights(co, SEG, ARM_BONES[s], power=4.0, eps=0.004)
    d_chest = point_segment_distance(co, Vector((0.0, 0.0, 0.80)), Vector((0.07 if s == 'L' else -0.07, 0.0, 0.84)))
    ws['Chest'] = 1.0 / ((d_chest + 0.02) ** 4) * 0.35
    return ws


def w_leg(co):
    s = _side(co.x)
    return distance_weights(co, SEG, [f'Thigh_{s}', f'Calf_{s}', f'Foot_{s}', f'Toe_{s}'], power=4.0, eps=0.006)


def w_shoe(co):
    s = _side(co.x)
    ws = distance_weights(co, SEG, [f'Calf_{s}', f'Foot_{s}', f'Toe_{s}'], power=5.0, eps=0.004)
    return ws


def w_head(co):
    # head skin: Head, with the jaw / neck blended in at the bottom
    z = co.z
    ws = {'Head': 1.0}
    # chin & lower lip follow the jaw bone (front, below the mouth line)
    front = smoothstep(0.0, -0.06, co.y - spec.HEAD_C.y + 0.02)
    j = smoothstep(0.945, 0.905, z) * front
    ws['Head'] = 1.0 - j
    ws['Jaw'] = j
    return ws


def w_head_mouth_lower(co):
    return {'Jaw': 1.0}


def w_eye(co):
    return {'Eye_L': 1.0} if co.x >= 0 else {'Eye_R': 1.0}


def w_dress_body(co):
    """Dress & apron: the waist block follows hips/spine/chest; the skirt follows 4 sectors x 2 segments."""
    z = co.z
    wc = smoothstep(0.72, 0.80, z)
    wh = 1.0 - smoothstep(0.62, 0.70, z)
    ws_ = max(0.0, 1.0 - wc - wh)
    torso = {'Chest': wc, 'Spine': ws_, 'Hips': wh}
    t = smoothstep(0.69, 0.40, z)
    if t < 0.001:
        return torso
    dx = co.x
    dy = co.y - 0.03
    r = math.hypot(dx, dy) or 1.0
    ux, uy = dx / r, dy / r
    sectors = {
        'Skirt_F': max(0.0, -uy) ** 2,
        'Skirt_B': max(0.0, uy) ** 2,
        'Skirt_L': max(0.0, ux) ** 2,
        'Skirt_R': max(0.0, -ux) ** 2,
    }
    tot = sum(sectors.values()) or 1.0
    seg2 = smoothstep(0.52, 0.40, z)
    out = {k: v * (1.0 - t) for k, v in torso.items()}
    for name, w in sectors.items():
        w = w / tot * t
        out[f'{name}_1'] = w * (1.0 - seg2)
        out[f'{name}_2'] = w * seg2
    return out


def w_sleeve(co):
    s = _side(co.x)
    ws = distance_weights(co, SEG, [f'Shoulder_{s}', f'UpperArm_{s}', f'LowerArm_{s}'], power=3.0, eps=0.01)
    ws['Chest'] = 0.0
    return ws


def w_collar(co):
    return {'Chest': 0.55, 'Neck': 0.45}


def w_hair_clump(pts, kind, side=1.0):
    n = len(pts)

    def fn(co):
        # nearest path parameter
        best, bt = 1e9, 0.0
        for i, p in enumerate(pts):
            d = (co - p).length_squared
            if d < best:
                best, bt = d, i / (n - 1)
        if kind == 'back':
            chain = 'HairB_C' if abs(co.x) < 0.045 else ('HairB_L' if co.x > 0 else 'HairB_R')
        elif kind == 'side':
            chain = 'HairS_L' if side > 0 else 'HairS_R'
        else:
            return {'Head': 1.0}
        nseg = 3 if kind == 'back' else 2
        # bone k owns the t-range [k/nseg, (k+1)/nseg]; blend smoothly across the boundaries
        ws = {'Head': 1.0 - smoothstep(0.02, 0.22, bt)}
        for k in range(nseg):
            c = (k + 0.5) / nseg
            w = max(0.0, 1.0 - abs(bt - c) * nseg * 1.15)
            ws[f'{chain}_{k + 1}'] = w * smoothstep(0.02, 0.22, bt)
        return ws

    return fn


def w_head_only(co):
    return {'Head': 1.0}


def w_bow(co):
    return {'Bow': 0.65, 'Head': 0.35}


def w_sash_tail(co):
    pts = None
    s = 'L' if co.x >= 0 else 'R'
    chain = [f'SashTail_{s}_1', f'SashTail_{s}_2']
    ws = distance_weights(co, SEG, chain, power=3.0, eps=0.01)
    t = smoothstep(0.69, 0.62, co.z)
    ws['Spine'] = (1.0 - t) * 3.0
    return ws


def w_sash_bow(co):
    return {'Spine': 1.0}
