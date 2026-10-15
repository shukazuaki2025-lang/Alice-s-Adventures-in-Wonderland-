"""
Alice's animation set, authored procedurally as real FK keyframes (no flat/dummy curves).

* Locomotion (Idle / Walk / Run) is generated from a planted-foot gait: each leg is solved with analytic 2-bone IK so the
  stance foot travels backwards at exactly the nominal ground speed (feet do not skate), with pelvis bob/sway/roll,
  counter-rotating torso, opposite arm swing, head stabilisation and follow-through on hair, skirt and sash.
* Story clips (curtsey, kneel-peek, drink, slip, sit-cry, eat ...) are hand-authored key poses blended with ease curves.

Rotation convention (rigkit.Poser): armature-axis deltas, degrees. Positive Rx on an UP-pointing bone (spine, neck, head)
leans forward; on a HANGING bone (arm, leg) it swings BACKWARD. Left = +X; for a hanging limb +Ry moves it toward -X.
"""
import math
import os
import json

import bpy

from lib import rigkit
from lib.meshkit import clamp, lerp, smoothstep
from . import spec

FPS = 30
L1 = (spec.HIP_Z - spec.KNEE_Z) * spec.SCALE          # thigh ≈ 0.252 m after the final 1.03 scale
L2 = (spec.KNEE_Z - spec.ANKLE_Z) * spec.SCALE        # shin ≈ 0.206 m
HIP_Z = spec.HIP_Z * spec.SCALE
ANKLE_Z = spec.ANKLE_Z * spec.SCALE

# nominal ground speeds the clips are authored for (the engine plays them at speed / nominal)
WALK_SPEED = 1.2
RUN_SPEED = 2.6
WALK_DUR = 0.80
RUN_DUR = 0.56


# ---------------------------------------------------------------------------------------------------------------
# pose container
# ---------------------------------------------------------------------------------------------------------------
class Pose:
    def __init__(self):
        self.rot = {}
        self.loc = {}

    def r(self, bone, rx=0.0, ry=0.0, rz=0.0, add=True):
        o = self.rot.get(bone, (0.0, 0.0, 0.0)) if add else (0.0, 0.0, 0.0)
        self.rot[bone] = (o[0] + rx, o[1] + ry, o[2] + rz)
        return self

    def t(self, bone, dx=0.0, dy=0.0, dz=0.0):
        o = self.loc.get(bone, (0.0, 0.0, 0.0))
        self.loc[bone] = (o[0] + dx, o[1] + dy, o[2] + dz)
        return self

    def copy(self):
        p = Pose()
        p.rot = dict(self.rot)
        p.loc = dict(self.loc)
        return p


def lerp_pose(a, b, t):
    out = Pose()
    for k in set(a.rot) | set(b.rot):
        ra = a.rot.get(k, (0, 0, 0))
        rb = b.rot.get(k, (0, 0, 0))
        out.rot[k] = tuple(lerp(x, y, t) for x, y in zip(ra, rb))
    for k in set(a.loc) | set(b.loc):
        la = a.loc.get(k, (0, 0, 0))
        lb = b.loc.get(k, (0, 0, 0))
        out.loc[k] = tuple(lerp(x, y, t) for x, y in zip(la, lb))
    return out


def ease(t, kind='smooth'):
    t = clamp(t)
    if kind == 'linear':
        return t
    if kind == 'in':
        return t * t
    if kind == 'out':
        return 1 - (1 - t) ** 2
    if kind == 'back':          # slight overshoot
        c1 = 1.70158
        c3 = c1 + 1
        return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
    return t * t * (3 - 2 * t)


def sample_keys(keys, t):
    """keys: [(time, Pose, ease_kind_into_this_key)] sorted by time -> interpolated Pose at time t."""
    if t <= keys[0][0]:
        return keys[0][1].copy()
    for (t0, p0, _e0), (t1, p1, e1) in zip(keys, keys[1:]):
        if t0 <= t <= t1:
            u = (t - t0) / max(1e-6, (t1 - t0))
            return lerp_pose(p0, p1, ease(u, e1))
    return keys[-1][1].copy()


# ---------------------------------------------------------------------------------------------------------------
# leg IK (sagittal plane)
# ---------------------------------------------------------------------------------------------------------------
def leg_ik(foot_f, foot_z, hip_f=0.0, hip_z=HIP_Z, hips_rx=0.0, toe_down=0.0):
    """
    foot_f / hip_f: forward coordinate (metres, +forward); foot_z / hip_z heights above the floor.
    Returns (thigh_rx, calf_rx, foot_rx) in degrees.
    """
    df = foot_f - hip_f
    dz = foot_z - hip_z
    dist = clamp(math.hypot(df, dz), 0.08, L1 + L2 - 1e-4)
    cos_k = (L1 * L1 + L2 * L2 - dist * dist) / (2 * L1 * L2)
    gamma = math.acos(clamp(cos_k, -1, 1))
    beta = math.pi - gamma                                  # knee flexion
    alpha = math.atan2(df, -dz)                             # direction to the foot, forward positive
    cos_d = (L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist)
    delta = math.acos(clamp(cos_d, -1, 1))
    th1 = alpha + delta                                     # thigh forward angle (knee bends forward)
    th2 = th1 - beta                                        # shank forward angle
    thigh_rx = -math.degrees(th1) - hips_rx
    calf_rx = math.degrees(beta)
    foot_rx = toe_down + math.degrees(th2)
    return thigh_rx, calf_rx, foot_rx


def apply_leg(pose, side, foot_f, foot_z, hip_f=0.0, hip_z=HIP_Z, hips_rx=0.0, toe_down=0.0, abduct=0.0):
    th, ca, fo = leg_ik(foot_f, foot_z, hip_f, hip_z, hips_rx, toe_down)
    pose.r(f'Thigh_{side}', th, abduct * (1 if side == 'L' else -1), 0.0)
    pose.r(f'Calf_{side}', ca)
    pose.r(f'Foot_{side}', fo)
    # toes bend as the heel rises
    pose.r(f'Toe_{side}', clamp(toe_down, 0, 35) * -0.0)
    return th, ca, fo


# ---------------------------------------------------------------------------------------------------------------
# base posture, hands, secondary motion
# ---------------------------------------------------------------------------------------------------------------
def base_pose():
    """Neutral standing pose: arms lowered a little from the sculpting A-pose, relaxed fingers."""
    p = Pose()
    p.r('UpperArm_L', 0, +9, 0).r('UpperArm_R', 0, -9, 0)
    p.r('LowerArm_L', -4, +3, 0).r('LowerArm_R', -4, -3, 0)
    p.r('Hand_L', 0, 0, 0).r('Hand_R', 0, 0, 0)
    return p


def finger_curl(pose, side, amount, thumb_in=0.0):
    """amount 0..1 (0 = relaxed rest, 1 = tight fist). Positive Rz/Rx curl depends on the finger direction; fingers
    point down so curling swings the fingertips toward the palm (-X for the left hand)."""
    s = 1.0 if side == 'L' else -1.0
    for f in spec.FINGER_NAMES:
        k = 1.0 if f != 'Pinky' else 1.1
        pose.r(f'{f}_{side}_1', 0, 55 * amount * s * k, 0)
        pose.r(f'{f}_{side}_2', 0, 70 * amount * s * k, 0)
    pose.r(f'Thumb_{side}_1', -10 * amount, 25 * amount * s * thumb_in, 0)
    pose.r(f'Thumb_{side}_2', 0, 30 * amount * s, 0)


def secondary(pose, t, dur, drive_pitch=0.0, drive_sway=0.0, speed=1.0, amp=1.0):
    """Hair / skirt / sash / bow follow-through. drive_* are the body's vertical-bounce and sway in -1..1."""
    w = 2 * math.pi * t / dur
    for chain, nseg, lag, a in (('HairB_C', 3, 0.10, 3.5), ('HairB_L', 3, 0.14, 4.0), ('HairB_R', 3, 0.14, 4.0),
                                 ('HairS_L', 2, 0.18, 3.0), ('HairS_R', 2, 0.18, 3.0)):
        for k in range(nseg):
            ph = w * speed - (k + 1) * lag * 2 * math.pi * 0.5
            pose.r(f'{chain}_{k + 1}', amp * a * (0.5 * drive_pitch + 0.6 * math.sin(ph)), 0, amp * a * 0.7 * math.sin(ph * 0.5 + k + (1 if chain.endswith('L') else 2)))
    for nm, sgn in (('SashTail_L', 1.0), ('SashTail_R', -1.0)):
        for k in range(2):
            ph = w * speed - 0.6 * (k + 1)
            pose.r(f'{nm}_{k + 1}', amp * 5 * (0.4 * drive_pitch + math.sin(ph)), 0, amp * 4 * sgn * math.sin(ph * 0.5 + 1))
    pose.r('Bow', amp * 3 * math.sin(w * speed - 0.5), 0, amp * 3 * math.sin(w * speed * 0.5))


def skirt_from_legs(pose, thigh_l, thigh_r, hips_roll=0.0, amp=1.0):
    """The skirt hem is lifted by whichever leg swings forward and pushed out by the one that goes back."""
    fwd = max(-thigh_l, -thigh_r, 0.0)       # degrees, forward positive (thigh_rx is negative when forward)
    back = max(thigh_l, thigh_r, 0.0)
    pose.r('Skirt_F_1', -amp * 0.22 * fwd, 0, 0).r('Skirt_F_2', -amp * 0.35 * fwd, 0, 0)
    pose.r('Skirt_B_1', amp * 0.20 * back, 0, 0).r('Skirt_B_2', amp * 0.34 * back, 0, 0)
    pose.r('Skirt_L_1', 0, 0, amp * -0.5 * hips_roll).r('Skirt_L_2', 0, 0, amp * -0.8 * hips_roll)
    pose.r('Skirt_R_1', 0, 0, amp * 0.5 * hips_roll).r('Skirt_R_2', 0, 0, amp * 0.8 * hips_roll)


# ---------------------------------------------------------------------------------------------------------------
# locomotion generators (return a function t -> Pose)
# ---------------------------------------------------------------------------------------------------------------
def gait(dur, speed, duty, lift, bob, lean, arm_swing, elbow, run=False):
    A = speed * dur * duty * 0.5                  # half travel of the planted foot relative to the pelvis
    heel_lift = 0.030 if not run else 0.050

    def foot_traj(u):
        if u < duty:                              # stance: foot slides backwards under the body at ground speed
            s = u / duty
            f = A * (1.0 - 2.0 * s)
            z = ANKLE_Z + heel_lift * smoothstep(0.72, 1.0, s)
            td = lerp(-12.0, 0.0, smoothstep(0.0, 0.18, s)) + 30.0 * smoothstep(0.70, 1.0, s)
            return f, z, td
        w = (u - duty) / (1.0 - duty)             # swing
        f = lerp(-A, A, ease(w, 'smooth'))
        z = ANKLE_Z + heel_lift * (1.0 - smoothstep(0.0, 0.25, w)) + lift * math.sin(math.pi * clamp(w * 1.04)) ** 1.15
        td = lerp(30.0, -12.0, smoothstep(0.0, 0.55, w))
        return f, z, td

    def pose_at(t):
        p = base_pose()
        uL = (t / dur) % 1.0
        uR = (uL + 0.5) % 1.0
        c = math.cos(2 * math.pi * uL)
        sL = math.sin(2 * math.pi * uL)
        # pelvis: bob (two dips per cycle), forward lean, sway, roll, yaw
        dz = -bob * (0.9 + math.cos(4 * math.pi * uL))
        hips_rx = lean
        p.t('Hips', 0.0, 0.0, dz)
        p.t('Hips', 0.010 * (1.0 if not run else 0.6) * sL, 0.0, 0.0)
        hips_roll = -(2.6 if not run else 2.0) * sL
        p.r('Hips', hips_rx, hips_roll, -(4.5 if not run else 7.0) * c)
        p.r('Spine', lean * 0.35, -hips_roll * 0.5, (3.0 if not run else 5.0) * c)
        p.r('Chest', lean * 0.35, -hips_roll * 0.3, (2.2 if not run else 4.0) * c)
        p.r('Neck', -lean * 0.4, 0, -(1.6 if not run else 3.0) * c)
        p.r('Head', -lean * 0.45 + 1.2 * math.cos(4 * math.pi * uL + 0.6), 0, -(1.2 if not run else 2.0) * c)
        hip_z = HIP_Z + dz
        thL = thR = 0.0
        for side, u in (('L', uL), ('R', uR)):
            f, z, td = foot_traj(u)
            th, ca, fo = apply_leg(p, side, f, z, 0.0, hip_z, hips_rx, td)
            if side == 'L':
                thL = th
            else:
                thR = th
        # arms swing opposite to the same-side leg
        for side, u_leg in (('L', uL), ('R', uR)):
            fwd = -arm_swing * math.cos(2 * math.pi * (u_leg + 0.04))     # arm forward when this side's leg is back
            bend = elbow + (elbow * 0.6) * max(0.0, fwd) / arm_swing
            p.r(f'UpperArm_{side}', -fwd - hips_rx * 0.3)
            p.r(f'LowerArm_{side}', -bend)
            p.r(f'Hand_{side}', -6)
            if run:
                finger_curl(p, side, 0.25)
        skirt_from_legs(p, thL, thR, hips_roll, 1.0 if not run else 1.3)
        secondary(p, t, dur, drive_pitch=math.cos(4 * math.pi * uL), drive_sway=sL, speed=2.0, amp=1.0 if not run else 1.6)
        return p

    return pose_at


def idle_pose(t, dur=3.2):
    p = base_pose()
    w = 2 * math.pi * t / dur
    breathe = math.sin(w)
    p.t('Hips', 0.004 * math.sin(w * 0.5), 0, -0.002 + 0.002 * breathe)
    p.r('Hips', 0.6, 1.4 * math.sin(w * 0.5), 1.2 * math.sin(w * 0.5 + 0.7))
    p.r('Spine', 0.5 + 0.7 * breathe, 0, -1.2 * math.sin(w * 0.5 + 0.7))
    p.r('Chest', 0.8 * breathe, 0, 0.8 * math.sin(w * 0.5 + 1.3))
    p.r('Shoulder_L', 0, 0, 0).r('Shoulder_R', 0, 0, 0)
    p.r('Neck', -0.8 * breathe, 0, 1.0 * math.sin(w * 0.5 - 0.4))
    p.r('Head', 1.4 * math.sin(w * 0.5 + 0.2) * 0.8, 1.2 * math.sin(w * 0.5 + 2.2), 2.0 * math.sin(w * 0.5 + 0.9))
    sway = 0.9 * math.sin(w * 0.5)
    p.r('UpperArm_L', 1.5 * math.sin(w * 0.5 + 0.5) - 1.0 * breathe, 0, 0)
    p.r('UpperArm_R', 1.5 * math.sin(w * 0.5 + 1.2) - 1.0 * breathe, 0, 0)
    p.r('LowerArm_L', -2.0 + 1.5 * math.sin(w + 0.3)).r('LowerArm_R', -2.0 + 1.5 * math.sin(w + 1.0))
    finger_curl(p, 'L', 0.06 + 0.04 * math.sin(w)), finger_curl(p, 'R', 0.06 + 0.04 * math.sin(w + 1))
    # weight rests mostly on one leg, shifting slowly
    shift = math.sin(w * 0.5)
    hip_z = HIP_Z - 0.002 + 0.002 * breathe
    apply_leg(p, 'L', 0.0 + 0.012 * shift, ANKLE_Z, 0.0, hip_z, 0.6, 0.0, abduct=0.8)
    apply_leg(p, 'R', -0.010 - 0.012 * shift, ANKLE_Z, 0.0, hip_z, 0.6, 0.0, abduct=0.8)
    secondary(p, t, dur, drive_pitch=0.4 * breathe, speed=1.0, amp=0.55)
    skirt_from_legs(p, 0.0, 0.0, 0.5 * math.sin(w * 0.5), 0.6)
    return p


# ---------------------------------------------------------------------------------------------------------------
# story clips (key-pose based)
# ---------------------------------------------------------------------------------------------------------------
def P(**kw):
    """Shorthand: P(Hips=(rx,ry,rz), ...) -> Pose; location via keys ending in _t."""
    p = Pose()
    for k, v in kw.items():
        if k.endswith('_t'):
            p.t(k[:-2], *v)
        else:
            p.r(k, *v)
    return p


def stand_legs(p, hip_drop=0.0, hips_rx=0.0, foot_f_l=0.0, foot_f_r=0.0, toe_l=0.0, toe_r=0.0, hip_f=0.0, spread=0.0):
    hip_z = HIP_Z - hip_drop
    thL = apply_leg(p, 'L', foot_f_l + hip_f, ANKLE_Z, hip_f, hip_z, hips_rx, toe_l, abduct=spread)[0]
    thR = apply_leg(p, 'R', foot_f_r + hip_f, ANKLE_Z, hip_f, hip_z, hips_rx, toe_r, abduct=spread)[0]
    p.t('Hips', 0, 0, -hip_drop)
    return thL, thR


def curtsey_keys():
    def pose(drop, lean_s, head, arm_out, bend, foot_back):
        p = base_pose()
        thL, thR = stand_legs(p, hip_drop=drop, hips_rx=lean_s * 0.3, foot_f_l=0.02, foot_f_r=-foot_back, toe_r=14.0 * (foot_back / 0.18), hip_f=-0.02 * drop / 0.1)
        p.r('Hips', lean_s * 0.3, 0, 0).r('Spine', lean_s * 0.4).r('Chest', lean_s * 0.4)
        p.r('Neck', head * 0.4).r('Head', head * 0.6)
        for side, s in (('L', 1.0), ('R', -1.0)):
            p.r(f'UpperArm_{side}', -22 * arm_out, -s * 30 * arm_out, 0)       # out to the sides, forward a touch
            p.r(f'LowerArm_{side}', -bend * 40 * arm_out)
            p.r(f'Hand_{side}', -10 * arm_out)
            finger_curl(p, side, 0.45 * arm_out)
        skirt_from_legs(p, thL, thR, 0, 0.8)
        p.r('Skirt_F_1', -8 * arm_out).r('Skirt_L_1', 0, 0, -6 * arm_out).r('Skirt_R_1', 0, 0, 6 * arm_out)
        return p
    return [
        (0.00, pose(0.0, 0, 0, 0.0, 0, 0.0), 'smooth'),
        (0.35, pose(0.0, 0, 2, 1.0, 0.6, 0.0), 'smooth'),
        (0.90, pose(0.09, 12, 10, 1.0, 1.0, 0.18), 'smooth'),
        (1.25, pose(0.09, 14, 12, 1.0, 1.0, 0.18), 'linear'),
        (1.80, pose(0.0, 0, 0, 0.6, 0.4, 0.0), 'smooth'),
        (2.04, pose(0.0, 0, 0, 0.0, 0, 0.0), 'smooth'),
    ]


def drink_keys():
    def pose(arm, head, jaw, lean, sip):
        p = base_pose()
        stand_legs(p, 0.0, 0.4)
        p.r('Spine', lean).r('Chest', lean * 0.5)
        p.r('Neck', head * 0.4).r('Head', head, 0, 0)
        p.r('Jaw', jaw)
        p.r('UpperArm_R', -62 * arm, -14 * arm, -20 * arm)
        p.r('LowerArm_R', -118 * arm, 0, 0)
        p.r('Hand_R', -30 * arm, 0, 10 * arm)
        p.r('UpperArm_L', -18 * arm, 0, 0).r('LowerArm_L', -30 * arm)       # off-hand steadies the bottle
        finger_curl(p, 'R', 0.55 * arm, 1.0)
        finger_curl(p, 'L', 0.2 * arm)
        p.r('Shoulder_R', 0, 0, -3 * arm)
        p.r('Neck', -sip * 4)
        return p
    return [
        (0.00, pose(0, 0, 0, 0, 0), 'smooth'),
        (0.55, pose(1.0, 2, 0, 2, 0), 'smooth'),
        (0.85, pose(1.0, -14, 7, -2, 0), 'smooth'),
        (1.45, pose(1.0, -16, 9, -3, 1), 'smooth'),
        (1.75, pose(0.7, -4, 3, 1, 0), 'smooth'),
        (2.04, pose(0.0, 0, 0, 0, 0), 'smooth'),
    ]


def eat_keys():
    def pose(arm, head, jaw, lean):
        p = base_pose()
        stand_legs(p, 0.0, 0.4)
        p.r('Spine', lean).r('Chest', lean * 0.4)
        p.r('Neck', head * 0.4).r('Head', head)
        p.r('Jaw', jaw)
        p.r('UpperArm_R', -54 * arm, -12 * arm, -14 * arm)
        p.r('LowerArm_R', -112 * arm)
        p.r('Hand_R', -36 * arm, 0, 8 * arm)
        finger_curl(p, 'R', 0.35 * arm, 1.0)
        p.r('UpperArm_L', -8 * arm).r('LowerArm_L', -14 * arm)
        return p
    return [
        (0.00, pose(0, 0, 0, 0), 'smooth'),
        (0.45, pose(1.0, 4, 0, 3), 'smooth'),
        (0.70, pose(1.0, 2, 11, 2), 'smooth'),
        (0.88, pose(1.0, 4, 2, 3), 'smooth'),
        (1.05, pose(1.0, 2, 10, 2), 'smooth'),
        (1.22, pose(1.0, 4, 1, 3), 'smooth'),
        (1.40, pose(1.0, 3, 8, 2), 'smooth'),
        (1.60, pose(1.0, 4, 1, 3), 'smooth'),
        (2.04, pose(0.0, 0, 0, 0), 'smooth'),
    ]


def look_down_keys():
    """Alice (suddenly very tall) examines her hands, then peers down a long way at her feet."""
    def pose(hands, feet, sway):
        p = base_pose()
        k = max(hands, feet)
        stand_legs(p, 0.035 * feet, 0.4 + 3 * feet)
        p.r('Hips', 0, 0, 2.5 * sway)
        p.r('Spine', 5 * hands + 9 * feet).r('Chest', 4 * hands + 7 * feet)
        p.r('Neck', 8 * hands + 14 * feet).r('Head', 20 * hands + 30 * feet, 0, 4 * sway)
        for side, s_ in (('L', 1.0), ('R', -1.0)):
            p.r(f'UpperArm_{side}', -34 * hands + 22 * feet, -s_ * (6 * hands), 0)
            p.r(f'LowerArm_{side}', -62 * hands + 40 * feet)
            p.r(f'Hand_{side}', -18 * hands, 0, s_ * 10 * hands)
            finger_curl(p, side, 0.1 + 0.3 * hands)
        p.r('Shoulder_L', 0, 0, -5 * k).r('Shoulder_R', 0, 0, 5 * k)
        p.r('Skirt_F_1', -8 * feet).r('HairB_C_1', 6 * feet).r('HairB_C_2', 10 * feet)
        return p
    return [
        (0.00, pose(0, 0, 0), 'smooth'),
        (0.60, pose(1.0, 0, 0), 'smooth'),
        (1.20, pose(0.7, 0.7, 1.0), 'smooth'),
        (1.70, pose(0.2, 1.0, -1.0), 'smooth'),
        (2.04, pose(0.0, 1.0, 0.0), 'smooth'),
    ]


def shrink_react_keys():
    def pose(k, spread, crouch, wob):
        p = base_pose()
        stand_legs(p, 0.03 * crouch, 2 * crouch)
        p.r('Hips', 0, 0, 3 * wob).r('Spine', 4 * k + 3 * crouch, 0, -2 * wob).r('Chest', 3 * k)
        p.r('Neck', 10 * k).r('Head', 22 * k, 0, 4 * wob)
        for side, s in (('L', 1.0), ('R', -1.0)):
            p.r(f'UpperArm_{side}', -34 * k, -s * (14 + 30 * spread), 0)
            p.r(f'LowerArm_{side}', -50 * k + 8 * spread)
            p.r(f'Hand_{side}', -14 * k, 0, 0)
            finger_curl(p, side, 0.1 + 0.2 * k)
        p.r('Shoulder_L', 0, 0, -6 * crouch).r('Shoulder_R', 0, 0, 6 * crouch)
        p.r('Skirt_F_1', -6 * wob).r('Skirt_B_1', 6 * wob)
        return p
    return [
        (0.00, pose(0, 0, 0, 0), 'smooth'),
        (0.35, pose(1.0, 0.0, 0.5, 0), 'back'),
        (0.85, pose(1.0, 1.0, 0.8, 0.8), 'smooth'),
        (1.15, pose(0.8, 1.0, 0.5, -0.9), 'smooth'),
        (1.50, pose(0.5, 0.5, 0.2, 0.5), 'smooth'),
        (1.875, pose(0.0, 0.0, 0.0, 0.0), 'smooth'),
    ]


def try_door_keys():
    def pose(reach, jig, shrug, lean):
        p = base_pose()
        stand_legs(p, 0.0, 0.4 + 5 * lean, foot_f_l=0.03 * lean, foot_f_r=-0.01 * lean)
        p.r('Spine', 5 * lean).r('Chest', 4 * lean)
        p.r('Neck', 6 * lean - 4 * shrug).r('Head', 8 * lean - 6 * shrug, 0, 10 * shrug)
        p.r('UpperArm_R', -78 * reach, -10 * reach, -8 * reach)
        p.r('LowerArm_R', -34 * reach)
        p.r('Hand_R', -8 * reach + 0, 0, 14 * jig)
        finger_curl(p, 'R', 0.55 * reach, 1.0)
        p.r('UpperArm_L', -10 * reach).r('LowerArm_L', -12 * reach)
        p.r('Shoulder_L', 0, 0, -10 * shrug).r('Shoulder_R', 0, 0, 10 * shrug)
        return p
    return [
        (0.00, pose(0, 0, 0, 0), 'smooth'),
        (0.35, pose(1.0, 0, 0, 1.0), 'smooth'),
        (0.50, pose(1.0, 1.0, 0, 1.0), 'smooth'),
        (0.62, pose(1.0, -1.0, 0, 1.0), 'smooth'),
        (0.74, pose(1.0, 1.0, 0, 1.0), 'smooth'),
        (0.86, pose(1.0, -1.0, 0, 1.0), 'smooth'),
        (1.05, pose(0.9, 0, 0, 0.5), 'smooth'),
        (1.35, pose(0.2, 0, 1.0, 0.0), 'smooth'),
        (1.708, pose(0.0, 0, 0.0, 0.0), 'smooth'),
    ]


def land_keys():
    def pose(drop, arms_up, lean, spread, head, skirt):
        p = base_pose()
        stand_legs(p, drop, 2 + 14 * drop / 0.12, foot_f_l=0.0 + 0.04 * spread, foot_f_r=0.0 - 0.04 * spread, spread=3 + 10 * spread)
        p.t('Hips', 0, 0, 0)
        p.r('Spine', lean).r('Chest', lean * 0.6)
        p.r('Neck', head * 0.4).r('Head', head)
        for side, s in (('L', 1.0), ('R', -1.0)):
            p.r(f'UpperArm_{side}', -50 * arms_up + 26 * (1 - arms_up) * 0, -s * (30 * arms_up + 6), 0)
            p.r(f'LowerArm_{side}', -20 * arms_up)
        p.r('Skirt_F_1', -30 * skirt).r('Skirt_F_2', -45 * skirt).r('Skirt_B_1', -26 * skirt).r('Skirt_B_2', -40 * skirt)
        p.r('Skirt_L_1', 0, 0, -22 * skirt).r('Skirt_R_1', 0, 0, 22 * skirt)
        p.r('HairB_C_1', 14 * skirt).r('HairB_C_2', 22 * skirt).r('HairB_C_3', 28 * skirt)
        return p
    return [
        (0.00, pose(0.0, 1.0, -4, 1.0, -6, 1.0), 'smooth'),
        (0.22, pose(0.14, 0.2, 18, 0.5, 14, -0.8), 'in'),
        (0.45, pose(0.17, 0.4, 24, 0.7, 20, -0.4), 'out'),
        (0.95, pose(0.05, 0.1, 6, 0.2, 4, 0.3), 'smooth'),
        (1.54, pose(0.0, 0.0, 0, 0.0, 0, 0.0), 'smooth'),
    ]


def kneel_poses():
    def pose(k, look):
        """k: 0 standing -> 1 kneeling and peeking down at the floor-level door."""
        p = base_pose()
        hip_drop = 0.0 + 0.27 * k
        hip_z = HIP_Z - hip_drop
        # knees go down: thigh slightly forward, shank folded back
        th = -6 * k - 8 * k
        p.r('Thigh_L', th, 3 * k).r('Thigh_R', th, -3 * k)
        p.r('Calf_L', 150 * k).r('Calf_R', 150 * k)
        p.r('Foot_L', -(150 - 14) * k + 70 * k).r('Foot_R', -(150 - 14) * k + 70 * k)
        p.t('Hips', 0, -0.05 * k, -hip_drop - 0.0)
        p.r('Hips', 12 * k)
        p.r('Spine', 26 * k * (0.6 + 0.4 * look)).r('Chest', 14 * k * (0.6 + 0.4 * look))
        p.r('Neck', 12 * k * look).r('Head', 26 * k * look)
        # hands on the floor, one steadying
        p.r('UpperArm_L', -62 * k, -6 * k).r('UpperArm_R', -52 * k, 6 * k)
        p.r('LowerArm_L', -10 * k).r('LowerArm_R', -50 * k)
        p.r('Hand_L', -20 * k).r('Hand_R', -10 * k)
        p.r('Skirt_F_1', 22 * k).r('Skirt_F_2', 30 * k).r('Skirt_B_1', 8 * k)
        return p
    return pose


def kneel_in_keys():
    pose = kneel_poses()
    return [
        (0.00, pose(0.0, 0.0), 'smooth'),
        (0.60, pose(0.7, 0.2), 'smooth'),
        (1.10, pose(1.0, 0.8), 'smooth'),
        (1.50, pose(1.0, 1.0), 'smooth'),
    ]


def kneel_out_keys():
    pose = kneel_poses()
    return [
        (0.00, pose(1.0, 1.0), 'smooth'),
        (0.35, pose(1.0, 0.7), 'smooth'),
        (0.90, pose(0.55, 0.2), 'smooth'),
        (1.50, pose(0.0, 0.0), 'smooth'),
    ]


def crawl_pose_fn():
    """Hands-and-knees crawl (opposite arm/leg), advancing; k blends from standing into the crawl."""
    def pose(k, phase):
        p = base_pose()
        c = math.sin(phase * 2 * math.pi)
        c2 = math.sin(phase * 2 * math.pi + math.pi)
        hip_drop = 0.29 * k
        p.t('Hips', 0, -0.10 * k, -hip_drop)
        p.r('Hips', 16 * k + 2 * c * k)
        p.r('Spine', 40 * k).r('Chest', 12 * k)
        p.r('Neck', -30 * k).r('Head', -22 * k)
        for side, cc in (('L', c), ('R', c2)):
            p.r(f'UpperArm_{side}', -88 * k + 22 * k * cc, 0, 0)
            p.r(f'LowerArm_{side}', -4 * k - 22 * k * max(0, -cc))
            p.r(f'Hand_{side}', 20 * k)
        for side, cc in (('L', c2), ('R', c)):
            p.r(f'Thigh_{side}', -62 * k + 28 * k * cc)
            p.r(f'Calf_{side}', 104 * k + 36 * k * max(0, cc))
            p.r(f'Foot_{side}', 30 * k)
        p.r('Skirt_B_1', 26 * k).r('Skirt_B_2', 22 * k).r('Skirt_F_1', 34 * k * 0)
        secondary(p, phase * 1.0, 1.0, drive_pitch=0.5, speed=1.0, amp=0.8 * k)
        return p
    return pose


def crawl_in_clip(t):
    k = smoothstep(0.0, 0.55, t)
    phase = max(0.0, (t - 0.45) / 0.70)
    return crawl_pose_fn()(k, phase)


def slip_keys():
    def pose(slip, fall, flail, sit, wob):
        p = base_pose()
        p.t('Hips', 0, 0.20 * sit, -0.43 * sit - 0.06 * fall)
        p.r('Hips', -26 * fall + 8 * sit, 0, 4 * slip)
        p.r('Spine', -10 * fall + 6 * sit).r('Chest', -10 * fall)
        p.r('Neck', -4 * fall).r('Head', -8 * fall + 4 * sit)
        # legs: one foot skids forward, then both sit forward
        p.r('Thigh_L', -(24 * slip + 90 * sit), 0 + 4 * sit).r('Thigh_R', -(46 * slip + 90 * sit), -6 * sit)
        p.r('Calf_L', 20 * slip + 6 * sit).r('Calf_R', 8 * slip + 6 * sit)
        p.r('Foot_L', 18 * slip).r('Foot_R', 10 * slip)
        for side, s in (('L', 1.0), ('R', -1.0)):
            p.r(f'UpperArm_{side}', -70 * flail + 28 * sit * 0 + (-12 * sit), -s * (50 * flail + 16 * sit), 0)
            p.r(f'LowerArm_{side}', -26 * flail - 18 * sit)
            p.r(f'Hand_{side}', 14 * flail)
            finger_curl(p, side, 0.2 * flail)
        p.r('Skirt_F_1', -28 * fall).r('Skirt_F_2', -46 * fall).r('Skirt_B_1', -10 * fall)
        p.r('HairB_C_2', 20 * fall).r('HairB_C_3', 30 * fall)
        p.r('Skirt_F_1', 12 * sit).r('Skirt_F_2', 14 * sit)
        return p
    return [
        (0.00, pose(0, 0, 0, 0, 0), 'smooth'),
        (0.22, pose(1.0, 0.2, 0.6, 0, 0), 'out'),
        (0.55, pose(1.0, 1.0, 1.0, 0.0, 0), 'smooth'),
        (0.95, pose(0.6, 0.4, 0.5, 0.75, 0), 'in'),
        (1.20, pose(0.0, 0.0, 0.1, 1.0, 0), 'smooth'),
        (1.54, pose(0.0, 0.0, 0.0, 1.0, 0), 'smooth'),
    ]


def sit_cry_pose(t, dur=2.54):
    p = base_pose()
    w = 2 * math.pi * t / dur
    sob = max(0.0, math.sin(w * 3.0)) ** 2            # three sobbing bursts per loop
    p.t('Hips', 0, 0.20, -0.43)
    p.r('Hips', 8, 0, 0)
    p.r('Spine', 12 + 3 * sob).r('Chest', 6 + 4 * sob)
    p.r('Neck', 8 + 4 * sob).r('Head', 18 + 6 * sob, 0, 3 * math.sin(w))
    p.r('Jaw', 5 + 8 * sob)
    p.r('Thigh_L', -90, 4).r('Thigh_R', -90, -6)
    p.r('Calf_L', 6).r('Calf_R', 6)
    for side, s in (('L', 1.0), ('R', -1.0)):
        p.r(f'UpperArm_{side}', -66, -s * 6, -s * 0)          # forearms up to the face
        p.r(f'LowerArm_{side}', -128 + 3 * sob)
        p.r(f'Hand_{side}', -24, 0, s * 6)
        finger_curl(p, side, 0.35)
    p.r('Shoulder_L', 0, 0, -3 - 4 * sob).r('Shoulder_R', 0, 0, 3 + 4 * sob)
    p.r('Chest', 2.0 * math.sin(w * 6.0) * sob)
    p.r('Skirt_F_1', 12).r('Skirt_F_2', 14)
    secondary(p, t, dur, drive_pitch=sob, speed=3.0, amp=0.9)
    return p


# ---------------------------------------------------------------------------------------------------------------
# keyframe insertion
# ---------------------------------------------------------------------------------------------------------------
def bake(rig, poser, name, dur, fn, loop=False):
    """Sample fn(t) -> Pose every frame and write real keyframes. Loop clips end exactly where they begin."""
    frames = int(round(dur * FPS))
    poses = []
    for i in range(frames + 1):
        t = dur * i / frames
        pose = fn(t) if not loop or i < frames else poses[0]
        poses.append(pose)
    bones_r = set()
    bones_l = set()
    for pz in poses:
        bones_r |= set(pz.rot)
        bones_l |= set(pz.loc)
    act = rigkit.new_action(rig, name)
    for i, pz in enumerate(poses):
        frame = i
        poser.reset()
        for b in bones_r:
            rx, ry, rz = pz.rot.get(b, (0, 0, 0))
            poser.rot(b, rx, ry, rz, frame=frame)
        for b in bones_l:
            dx, dy, dz = pz.loc.get(b, (0, 0, 0))
            poser.loc(b, dx, dy, dz, frame=frame)
    act.use_frame_range = True
    act.frame_start = 0
    act.frame_end = frames
    for fc in rigkit.iter_fcurves(act):
        for kp in fc.keyframe_points:
            kp.interpolation = 'BEZIER'
            kp.handle_left_type = 'AUTO_CLAMPED'
            kp.handle_right_type = 'AUTO_CLAMPED'
    rigkit.push_to_nla(rig, act, 0)
    poser.reset()
    return act


def build_all(rig):
    P_ = rigkit.Poser(rig, FPS)
    walk = gait(WALK_DUR, WALK_SPEED, 0.62, 0.050, 0.010, 3.0, 24.0, 18.0)
    run = gait(RUN_DUR, RUN_SPEED, 0.38, 0.115, 0.030, 10.0, 42.0, 78.0, run=True)
    bake(rig, P_, 'Alice_Idle', 3.2, lambda t: idle_pose(t, 3.2), loop=True)
    bake(rig, P_, 'Alice_Walk', WALK_DUR, walk, loop=True)
    bake(rig, P_, 'Alice_Run', RUN_DUR, run, loop=True)
    bake(rig, P_, 'Alice_TryDoor', 1.708, lambda t: sample_keys(try_door_keys(), t))
    bake(rig, P_, 'Alice_CrawlIn', 1.875, crawl_in_clip)
    bake(rig, P_, 'Alice_Land', 1.5416, lambda t: sample_keys(land_keys(), t))
    bake(rig, P_, 'Alice_CurtseyAir', 2.0416, lambda t: sample_keys(curtsey_keys(), t))
    bake(rig, P_, 'Alice_KneelPeek_In', 1.5, lambda t: sample_keys(kneel_in_keys(), t))
    bake(rig, P_, 'Alice_KneelPeek_Out', 1.5, lambda t: sample_keys(kneel_out_keys(), t))
    bake(rig, P_, 'Alice_Drink', 2.0416, lambda t: sample_keys(drink_keys(), t))
    bake(rig, P_, 'Alice_ShrinkReact', 1.875, lambda t: sample_keys(shrink_react_keys(), t))
    bake(rig, P_, 'Alice_Slip', 1.5416, lambda t: sample_keys(slip_keys(), t))
    bake(rig, P_, 'Alice_SitCry', 2.5416, lambda t: sit_cry_pose(t, 2.5416), loop=True)
    bake(rig, P_, 'Alice_Eat', 2.0416, lambda t: sample_keys(eat_keys(), t))
    bake(rig, P_, 'Alice_LookDown', 2.0416, lambda t: sample_keys(look_down_keys(), t))
    write_events()


def write_events():
    """Footstep / action events (heel strikes at u=0 and u=0.5 of each cycle)."""
    ev = {
        'events': {
            'Alice_Walk': [{'time': 0.0, 'name': 'Footstep'}, {'time': round(WALK_DUR * 0.5, 3), 'name': 'Footstep'}],
            'Alice_Run': [{'time': 0.0, 'name': 'Footstep'}, {'time': round(RUN_DUR * 0.5, 3), 'name': 'Footstep'}],
            'Alice_CurtseyAir': [{'time': 0.9, 'name': 'curtsey'}],
            'Alice_Drink': [{'time': 0.85, 'name': 'drink'}],
            'Alice_ShrinkReact': [{'time': 0.1, 'name': 'shrink'}],
            'Alice_Slip': [{'time': 0.22, 'name': 'slip'}],
            'Alice_Eat': [{'time': 0.7, 'name': 'eat'}],
        }
    }
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
    for rel in ('public/assets/models/chr_alice.events.json',):
        path = os.path.join(root, rel)
        if os.environ.get('ALICE_OUT') and 'dev' in os.environ['ALICE_OUT']:
            return
        with open(path, 'w') as fh:
            json.dump(ev, fh, indent=2)
            fh.write('\n')
