"""
Single source of truth for Alice's proportions, palette and skeleton.

Units: metres. Blender axes: X east (character's LEFT), Y north (character faces -Y), Z up.
Canonical height 1.20 m (ribbon tip), head-to-body ≈ 1 : 4.5 (head ≈ 0.265 m), hands / feet ~15 % oversize for
legibility at third-person distance. See CLAUDE.md §3–§4.
"""
import math

from mathutils import Vector

from lib.rigkit import Bone

# Uniform scale applied to the finished mesh + rig so the character (ribbon tip included) is exactly 1.20 m tall.
SCALE = 1.03

# ---------------------------------------------------------------------------------------------------------------
# palette (CLAUDE.md §3) — all sRGB hex
# ---------------------------------------------------------------------------------------------------------------
PALETTE = {
    'skin': '#F6CBAE',
    'skin_shadow': '#E7A98E',
    'blush': '#EE9C8B',
    'hair': '#E6C98F',
    'hair_dark': '#B88C4A',
    'hair_light': '#F6E3B0',
    'ribbon': '#2E3F6E',
    'dress': '#E9C46A',
    'collar': '#F7F3EA',
    'apron': '#F7F3EA',
    'stocking': '#F5F2EB',
    'shoe': '#2A211C',
    'brass': '#C9A24A',
    'iris': '#7A5232',
    'lip': '#D8837A',
    'ink': '#2B2420',
}

# ---------------------------------------------------------------------------------------------------------------
# key heights
# ---------------------------------------------------------------------------------------------------------------
ANKLE_Z = 0.085
KNEE_Z = 0.285
HIP_Z = 0.53
PELVIS_Z = 0.55
WAIST_Z = 0.70
SHOULDER_Z = 0.835
NECK_BASE_Z = 0.855
CHIN_Z = 0.885
HEAD_C = Vector((0.0, 0.012, 1.015))  # cranium centre
HEAD_R = Vector((0.108, 0.108, 0.127))  # ellipsoid semi-axes (x, y(depth), z)
LEG_X = 0.058
SHOULDER_X = 0.100
HEM_Z = 0.31

# eyes
EYE_X = 0.040
EYE_C_Z = 0.998
EYE_Y = -0.0565
EYE_R = 0.0275

# arm chain (A-pose, left side = +X). angles from vertical, degrees
UPPER_ARM_LEN = 0.155
FOREARM_LEN = 0.140
HAND_LEN = 0.078
ARM_ANGLES = (31.0, 24.0, 17.0)


def arm_points(side=1.0):
    """Shoulder, elbow, wrist, hand-tip positions of the (left) arm for side=+1, mirrored for -1."""
    s = Vector((SHOULDER_X * side, 0.0, SHOULDER_Z))
    pts = [s]
    for ln, ang in zip((UPPER_ARM_LEN, FOREARM_LEN, HAND_LEN), ARM_ANGLES):
        a = math.radians(ang)
        pts.append(pts[-1] + Vector((math.sin(a) * ln * side, 0.0, -math.cos(a) * ln)))
    return pts


FINGER_NAMES = ('Index', 'Middle', 'Ring', 'Pinky')
FINGER_Y = (-0.0185, -0.0065, 0.0055, 0.0165)       # across the palm (front = -Y)
FINGER_LEN = (0.052, 0.058, 0.052, 0.042)
FINGER_RAD = 0.0068


def finger_chain(side, i):
    """3 points (root, knuckle, tip) of finger i, slightly curled inwards (toward the body)."""
    pts = arm_points(side)
    root = pts[3] + Vector((0.0, FINGER_Y[i], 0.0))
    ln = FINGER_LEN[i]
    a0 = math.radians(ARM_ANGLES[2] - 8.0 * side * 0 + 0.0)
    # fingers continue the hand direction, curling inwards (-x for the left hand)
    c1 = math.radians(ARM_ANGLES[2] - 14.0)
    c2 = math.radians(ARM_ANGLES[2] - 38.0)
    k = root + Vector((math.sin(c1) * ln * 0.55 * side, 0.0, -math.cos(c1) * ln * 0.55))
    t = k + Vector((math.sin(c2) * ln * 0.45 * side, 0.0, -math.cos(c2) * ln * 0.45))
    del a0
    return [root, k, t]


def thumb_chain(side):
    pts = arm_points(side)
    root = pts[3] + Vector((0.0, -0.022, 0.012))
    d1 = Vector((0.012 * side, -0.026, -0.018)).normalized()
    d2 = Vector((0.004 * side, -0.02, -0.03)).normalized()
    k = root + d1 * 0.030
    t = k + d2 * 0.026
    return [root, k, t]


# ---------------------------------------------------------------------------------------------------------------
# skeleton
# ---------------------------------------------------------------------------------------------------------------
HAIR_BACK_CHAINS = {
    # name: list of points root -> tip (3 segments)
    'HairB_C': [(0.0, 0.075, 1.06), (0.0, 0.098, 0.93), (0.0, 0.094, 0.80), (0.0, 0.086, 0.66)],
    'HairB_L': [(0.060, 0.070, 1.05), (0.082, 0.092, 0.93), (0.088, 0.088, 0.80), (0.080, 0.080, 0.67)],
    'HairB_R': [(-0.060, 0.070, 1.05), (-0.082, 0.092, 0.93), (-0.088, 0.088, 0.80), (-0.080, 0.080, 0.67)],
}
HAIR_SIDE_CHAINS = {
    'HairS_L': [(0.098, -0.010, 1.00), (0.112, -0.040, 0.90), (0.104, -0.062, 0.79)],
    'HairS_R': [(-0.098, -0.010, 1.00), (-0.112, -0.040, 0.90), (-0.104, -0.062, 0.79)],
}
SKIRT_CHAINS = {
    'Skirt_F': [(0.0, -0.085, 0.67), (0.0, -0.165, 0.50), (0.0, -0.270, 0.33)],
    'Skirt_B': [(0.0, 0.085, 0.67), (0.0, 0.165, 0.50), (0.0, 0.270, 0.33)],
    'Skirt_L': [(0.085, 0.0, 0.67), (0.165, 0.0, 0.50), (0.270, 0.0, 0.33)],
    'Skirt_R': [(-0.085, 0.0, 0.67), (-0.165, 0.0, 0.50), (-0.270, 0.0, 0.33)],
}
# the sash tails hang over the flared skirt, so they follow the dress surface at the back (y = CY + b(z))
SASH_CHAINS = {
    'SashTail_L': [(0.020, 0.094, 0.706), (0.048, 0.152, 0.620), (0.062, 0.205, 0.520)],
    'SashTail_R': [(-0.020, 0.094, 0.706), (-0.048, 0.152, 0.620), (-0.062, 0.205, 0.520)],
}


def _chain(prefix, pts, parent):
    out = []
    p = parent
    for i in range(len(pts) - 1):
        n = f'{prefix}_{i + 1}'
        out.append(Bone(n, pts[i], pts[i + 1], p))
        p = n
    return out


def build_bone_table():
    B = []
    B.append(Bone('Root', (0, 0, 0), (0, 0, 0.10), None, deform=False))
    B.append(Bone('Hips', (0, 0, PELVIS_Z), (0, 0, 0.62), 'Root'))
    B.append(Bone('Spine', (0, 0, 0.62), (0, 0, 0.74), 'Hips'))
    B.append(Bone('Chest', (0, 0, 0.74), (0, 0.0, NECK_BASE_Z), 'Spine'))
    B.append(Bone('Neck', (0, 0.004, NECK_BASE_Z), (0, 0.008, 0.905), 'Chest'))
    B.append(Bone('Head', (0, 0.008, 0.905), (0, 0.012, 1.17), 'Neck'))
    B.append(Bone('Jaw', (0, 0.004, 0.965), (0, -0.078, 0.912), 'Head'))
    B.append(Bone('Bow', (0.0, -0.01, 1.145), (0.0, -0.01, 1.19), 'Head'))
    for s, sn in ((1.0, 'L'), (-1.0, 'R')):
        B.append(Bone(f'Eye_{sn}', (EYE_X * s, EYE_Y, EYE_C_Z), (EYE_X * s, EYE_Y - 0.03, EYE_C_Z), 'Head'))
        a = arm_points(s)
        B.append(Bone(f'Shoulder_{sn}', (0.022 * s, 0.0, 0.845), (SHOULDER_X * s, 0.0, SHOULDER_Z + 0.003), 'Chest'))
        B.append(Bone(f'UpperArm_{sn}', a[0], a[1], f'Shoulder_{sn}'))
        B.append(Bone(f'LowerArm_{sn}', a[1], a[2], f'UpperArm_{sn}'))
        B.append(Bone(f'Hand_{sn}', a[2], a[3], f'LowerArm_{sn}'))
        B.append(Bone(f'SOCKET_Hand{sn}', a[3] + Vector((0, 0, 0.012)), a[3] + Vector((0, -0.03, 0.012)), f'Hand_{sn}', deform=False))
        for i, fn in enumerate(FINGER_NAMES):
            ch = finger_chain(s, i)
            B.append(Bone(f'{fn}_{sn}_1', ch[0], ch[1], f'Hand_{sn}'))
            B.append(Bone(f'{fn}_{sn}_2', ch[1], ch[2], f'{fn}_{sn}_1'))
        tc = thumb_chain(s)
        B.append(Bone(f'Thumb_{sn}_1', tc[0], tc[1], f'Hand_{sn}'))
        B.append(Bone(f'Thumb_{sn}_2', tc[1], tc[2], f'Thumb_{sn}_1'))
        # legs
        lx = LEG_X * s
        B.append(Bone(f'Thigh_{sn}', (lx, 0, HIP_Z), (lx, 0, KNEE_Z), 'Hips'))
        B.append(Bone(f'Calf_{sn}', (lx, 0, KNEE_Z), (lx, 0, ANKLE_Z), f'Thigh_{sn}'))
        B.append(Bone(f'Foot_{sn}', (lx, 0, ANKLE_Z), (lx, -0.095, 0.032), f'Calf_{sn}'))
        B.append(Bone(f'Toe_{sn}', (lx, -0.095, 0.032), (lx, -0.150, 0.018), f'Foot_{sn}'))
    for k, pts in HAIR_BACK_CHAINS.items():
        B += _chain(k, [Vector(p) for p in pts], 'Head')
    for k, pts in HAIR_SIDE_CHAINS.items():
        B += _chain(k, [Vector(p) for p in pts], 'Head')
    for k, pts in SKIRT_CHAINS.items():
        B += _chain(k, [Vector(p) for p in pts], 'Hips')
    for k, pts in SASH_CHAINS.items():
        B += _chain(k, [Vector(p) for p in pts], 'Spine')
    return B


BONES = build_bone_table()
BONE_NAMES = [b.name for b in BONES]
