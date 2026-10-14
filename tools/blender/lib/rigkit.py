"""
rigkit — armature construction, position-based skin weights and FK pose helpers.

Pose convention (important for animation scripts): every bone's local rotation is authored as an *armature-axis delta
relative to its parent* — i.e. `rot(bone, rx, ry, rz)` rotates about the character's X (side), Y (depth) and Z (up)
axes as if the parent were still. Internally q_local = R_rest^-1 · q · R_rest, which is exactly what makes a hanging
arm "swing forward" with a plain Rx. (Characters face -Y, their left is +X, so a *negative* Rx swings a hanging limb
forward.)
"""
import math

import bmesh
import bpy
from mathutils import Euler, Matrix, Quaternion, Vector

MAX_INFLUENCES = 4


class Bone:
    __slots__ = ('name', 'head', 'tail', 'parent', 'roll', 'deform')

    def __init__(self, name, head, tail, parent=None, roll=0.0, deform=True):
        self.name = name
        self.head = Vector(head)
        self.tail = Vector(tail)
        self.parent = parent
        self.roll = roll
        self.deform = deform


def build_armature(name, bones):
    arm = bpy.data.armatures.new(name)
    rig = bpy.data.objects.new(name, arm)
    bpy.context.scene.collection.objects.link(rig)
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.edit_bones
    made = {}
    for b in bones:
        e = eb.new(b.name)
        e.head = b.head
        e.tail = b.tail
        e.roll = b.roll
        e.use_deform = b.deform
        made[b.name] = e
    for b in bones:
        if b.parent:
            made[b.name].parent = made[b.parent]
            # keep chains visually connected only when they truly touch
            if (made[b.parent].tail - made[b.name].head).length < 1e-5:
                made[b.name].use_connect = True
    bpy.ops.object.mode_set(mode='OBJECT')
    arm.display_type = 'STICK'
    return rig


def rest_rotation(rig, bone_name):
    return rig.data.bones[bone_name].matrix_local.to_3x3()


def bone_segments(bones):
    return {b.name: (b.head.copy(), b.tail.copy()) for b in bones}


def point_segment_distance(p, a, b):
    ab = b - a
    l2 = ab.length_squared
    if l2 < 1e-12:
        return (p - a).length
    t = max(0.0, min(1.0, (p - a).dot(ab) / l2))
    return (p - (a + ab * t)).length


# --------------------------------------------------------------------------------------------------------------
# weights
# --------------------------------------------------------------------------------------------------------------


def distance_weights(co, segments, names, power=4.0, eps=0.006, radius_scale=None):
    """Inverse-distance blend between the allowed bones (limbs, spine, neck ...)."""
    ws = {}
    for n in names:
        a, b = segments[n]
        d = point_segment_distance(co, a, b)
        if radius_scale and n in radius_scale:
            d = d / radius_scale[n]
        ws[n] = 1.0 / ((d + eps) ** power)
    return ws


def normalise(ws):
    items = sorted(((n, w) for n, w in ws.items() if w > 1e-5), key=lambda kv: -kv[1])[:MAX_INFLUENCES]
    tot = sum(w for _n, w in items)
    if tot <= 0:
        return {}
    return {n: w / tot for n, w in items}


def apply_weights(obj, fn):
    """Write vertex-group weights computed by fn(co: Vector) -> {bone: weight} onto a mesh object."""
    me = obj.data
    groups = {}
    for v in me.vertices:
        ws = normalise(fn(v.co.copy()))
        for n, w in ws.items():
            vg = groups.get(n)
            if vg is None:
                vg = obj.vertex_groups.get(n) or obj.vertex_groups.new(name=n)
                groups[n] = vg
            vg.add([v.index], w, 'REPLACE')


def bind(obj, rig):
    obj.parent = rig
    obj.parent_type = 'OBJECT'
    mod = obj.modifiers.new('Armature', 'ARMATURE')
    mod.object = rig
    mod.use_vertex_groups = True
    mod.use_bone_envelopes = False


# --------------------------------------------------------------------------------------------------------------
# pose helpers
# --------------------------------------------------------------------------------------------------------------


class Poser:
    """Keyframe helper bound to a rig; rotations are armature-axis deltas (degrees)."""

    def __init__(self, rig, fps=30):
        self.rig = rig
        self.fps = fps
        self.R = {b.name: b.matrix_local.to_3x3() for b in rig.data.bones}
        self.Rinv = {k: v.inverted() for k, v in self.R.items()}
        for pb in rig.pose.bones:
            pb.rotation_mode = 'QUATERNION'

    def q_local(self, bone, rx=0.0, ry=0.0, rz=0.0):
        q = Euler((math.radians(rx), math.radians(ry), math.radians(rz)), 'XYZ').to_matrix()
        loc = self.Rinv[bone] @ q @ self.R[bone]
        return loc.to_quaternion()

    def rot(self, bone, rx=0.0, ry=0.0, rz=0.0, frame=None):
        pb = self.rig.pose.bones[bone]
        pb.rotation_quaternion = self.q_local(bone, rx, ry, rz)
        if frame is not None:
            pb.keyframe_insert('rotation_quaternion', frame=frame)

    def loc(self, bone, dx=0.0, dy=0.0, dz=0.0, frame=None):
        """Translate a bone by an armature-axis offset (metres)."""
        pb = self.rig.pose.bones[bone]
        pb.location = self.Rinv[bone] @ Vector((dx, dy, dz))
        if frame is not None:
            pb.keyframe_insert('location', frame=frame)

    def reset(self):
        for pb in self.rig.pose.bones:
            pb.rotation_quaternion = (1, 0, 0, 0)
            pb.location = (0, 0, 0)


def new_action(rig, name):
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    if rig.animation_data is None:
        rig.animation_data_create()
    rig.animation_data.action = act
    return act


def push_to_nla(rig, action, start=1):
    ad = rig.animation_data
    track = ad.nla_tracks.new()
    track.name = action.name
    strip = track.strips.new(action.name, int(start), action)
    strip.name = action.name
    ad.action = None
    return strip


def iter_fcurves(action):
    """Yield every F-curve of an action on both the legacy (<=4.x) and layered (>=4.4 / 5.x) action APIs."""
    legacy = getattr(action, 'fcurves', None)
    if legacy is not None:
        try:
            for fc in legacy:
                yield fc
            return
        except Exception:
            pass
    for layer in getattr(action, 'layers', []):
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    yield fc
