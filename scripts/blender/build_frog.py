"""在 Blender 中程序化重建布艺青蛙挂件，并导出 GLB / .blend。

运行方式：
    blender --background --python scripts/blender/build_frog.py

产物：
    assets/source/Frog.blend       可编辑源文件
    assets/source/frog-v1.glb      未优化导出（再由 npm run assets:model 压缩）

坐标约定（与计划书一致）：
    Blender 为 Z 向上，娃娃正面朝 -Y；导出 glTF 时转换为 Y 向上、正面朝 +Z。
    单位：约 1000 像素 = 1 单位，娃娃本体高约 1.25 单位。
"""

import math
import os

import bmesh
import bpy
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
TEX_DIR = os.path.join(ROOT, "assets", "textures-source")
OUT_DIR = os.path.join(ROOT, "assets", "source")
GLB_PATH = os.path.join(OUT_DIR, "frog-v1.glb")
BLEND_PATH = os.path.join(OUT_DIR, "Frog.blend")

sys_path = os.path.join(HERE)
if sys_path not in os.sys.path:
    os.sys.path.insert(0, sys_path)

import texture_gen  # noqa: E402  (需与本脚本同目录)


# --------------------------------------------------------------------------
# 场景与基础工具
# --------------------------------------------------------------------------

def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.curves):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def _finish(name, verts, faces, smooth=True):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()

    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    if smooth:
        for polygon in mesh.polygons:
            polygon.use_smooth = True
    return obj


def add_subsurf(obj, viewport=1, render=2):
    modifier = obj.modifiers.new("Subdivision", "SUBSURF")
    modifier.levels = viewport
    modifier.render_levels = render
    modifier.use_limit_surface = True
    return modifier


def smart_uv(obj, repeat=1.0, angle=66.0, margin=0.02):
    """智能展开并整体缩放 UV，使贴图按物理尺度平铺。"""
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(angle), island_margin=margin)
    bpy.ops.object.mode_set(mode="OBJECT")

    uv_layer = obj.data.uv_layers.active
    if uv_layer is None:
        return
    for loop in obj.data.loops:
        uv_layer.data[loop.index].uv *= repeat


# --------------------------------------------------------------------------
# 几何构造
# --------------------------------------------------------------------------

def pillow(name, nu, nv, front_fn, back_fn):
    """由正反两张参数曲面缝合出的软垫状封闭体。"""

    def point(fn, u, v):
        return tuple(fn(u, v))

    verts = []
    for i in range(nu + 1):
        for j in range(nv + 1):
            verts.append(point(front_fn, i / nu, j / nv))
    back_offset = len(verts)
    for i in range(nu + 1):
        for j in range(nv + 1):
            verts.append(point(back_fn, i / nu, j / nv))

    def idx(i, j, back=False):
        return (back_offset if back else 0) + i * (nv + 1) + j

    faces = []
    for i in range(nu):
        for j in range(nv):
            faces.append((idx(i, j), idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1)))
            faces.append((idx(i, j + 1, True), idx(i + 1, j + 1, True), idx(i + 1, j, True), idx(i, j, True)))

    for i in range(nu):
        faces.append((idx(i, 0), idx(i, 0, True), idx(i + 1, 0, True), idx(i + 1, 0)))
        faces.append((idx(i, nv), idx(i + 1, nv), idx(i + 1, nv, True), idx(i, nv, True)))
    for j in range(nv):
        faces.append((idx(0, j), idx(0, j + 1), idx(0, j + 1, True), idx(0, j, True)))
        faces.append((idx(nu, j), idx(nu, j, True), idx(nu, j + 1, True), idx(nu, j + 1)))

    return _finish(name, verts, faces)


def lathe(name, profile_fn, depth_fn, nz=26, nrad=28):
    """沿 Z 轴的旋转体：profile_fn(t) -> (cx, cz, rx, rz)，depth_fn(t) -> ry。"""

    verts = []
    faces = []

    bottom_center = len(verts)
    verts.append((profile_fn(0.0)[0], 0.0, profile_fn(0.0)[1]))
    ring_start = []
    for index in range(nz + 1):
        t = index / nz
        cx, cz, rx, rz = profile_fn(t)
        ry = depth_fn(t)
        ring_start.append(len(verts))
        for k in range(nrad):
            angle = 2 * math.pi * k / nrad
            verts.append((cx + rx * math.cos(angle), ry * math.sin(angle), cz))

    top_center = len(verts)
    verts.append((profile_fn(1.0)[0], 0.0, profile_fn(1.0)[1]))

    for k in range(nrad):
        k2 = (k + 1) % nrad
        faces.append((bottom_center, ring_start[0] + k2, ring_start[0] + k))
        faces.append((top_center, ring_start[-1] + k, ring_start[-1] + k2))

    for index in range(nz):
        lower = ring_start[index]
        upper = ring_start[index + 1]
        for k in range(nrad):
            k2 = (k + 1) % nrad
            faces.append((lower + k, lower + k2, upper + k2, upper + k))

    return _finish(name, verts, faces)


def tube(name, path_fn, radius_fn, nseg=30, nrad=14):
    """沿任意路径扫掠的圆管（用于手臂、皮绳）。"""

    points = [Vector(path_fn(i / nseg)) for i in range(nseg + 1)]
    tangents = []
    for index in range(nseg + 1):
        if index == 0:
            tangent = points[1] - points[0]
        elif index == nseg:
            tangent = points[-1] - points[-2]
        else:
            tangent = points[index + 1] - points[index - 1]
        tangents.append(tangent.normalized())

    # 平行移动标架，避免扫掠时扭转
    reference = Vector((0.0, 0.0, 1.0))
    if abs(tangents[0].dot(reference)) > 0.95:
        reference = Vector((0.0, 1.0, 0.0))
    normal = (reference - tangents[0] * reference.dot(tangents[0])).normalized()

    frames = []
    current_normal = normal
    for index, tangent in enumerate(tangents):
        if index > 0:
            current_normal = (current_normal - tangent * current_normal.dot(tangent)).normalized()
        binormal = tangent.cross(current_normal)
        frames.append((current_normal.copy(), binormal.copy()))

    verts = []
    for index, point in enumerate(points):
        radius = radius_fn(index / nseg)
        normal_axis, binormal_axis = frames[index]
        for k in range(nrad):
            angle = 2 * math.pi * k / nrad
            offset = normal_axis * math.cos(angle) + binormal_axis * math.sin(angle)
            verts.append(tuple(point + offset * radius))

    faces = []
    for index in range(nseg):
        lower = index * nrad
        upper = (index + 1) * nrad
        for k in range(nrad):
            k2 = (k + 1) % nrad
            faces.append((lower + k, lower + k2, upper + k2, upper + k))

    faces.append(tuple(range(nrad - 1, -1, -1)))
    faces.append(tuple(range(nseg * nrad, (nseg + 1) * nrad)))

    return _finish(name, verts, faces)


def ruffle_ring(name, major, minor, folds=16, fold_depth=0.16, nring=112, nrad=16, axial=0.0,
                irregular=0.0):
    """抽褶布环：做青蛙眼眶那种一圈褶皱包边。

    褶皱沿环向粗细变化，并沿轴向（axial）聚拢，形成布料被抽紧的效果；
    irregular 叠加一个低频扰动，让褶皱深浅不均，像手工抽褶。
    """

    verts = []
    faces = []
    for i in range(nring):
        theta = 2 * math.pi * i / nring
        wave = math.sin(theta * folds)
        if irregular:
            wave += irregular * math.sin(theta * 3 + 0.8) * math.sin(theta * folds * 0.5)
        tube_radius = minor * (1.0 + fold_depth * wave)
        center = Vector((major * math.cos(theta), axial * wave, major * math.sin(theta)))
        radial = Vector((math.cos(theta), 0.0, math.sin(theta)))
        normal = Vector((0.0, 1.0, 0.0))
        for j in range(nrad):
            phi = 2 * math.pi * j / nrad
            point = center + radial * (math.cos(phi) * tube_radius) + normal * (math.sin(phi) * tube_radius)
            verts.append(tuple(point))

    for i in range(nring):
        i2 = (i + 1) % nring
        for j in range(nrad):
            j2 = (j + 1) % nrad
            faces.append((i * nrad + j, i2 * nrad + j, i2 * nrad + j2, i * nrad + j2))

    return _finish(name, verts, faces)


def rounded_box(name, center, size, segments=2):
    """圆角小方块（缝线、蝴蝶结中心结等）。"""
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (size[0], size[1], size[2])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.shade_smooth()
    return obj


# --------------------------------------------------------------------------
# 材质
# --------------------------------------------------------------------------

def _set_input(node, name, value):
    if name in node.inputs:
        node.inputs[name].default_value = value


def image_material(name, base_color_image=None, normal_image=None, roughness_image=None,
                   metallic=0.0, roughness=0.8, base_color=(1.0, 1.0, 1.0, 1.0)):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    principled = nodes.get("Principled BSDF")
    if principled is None:
        principled = nodes.new("ShaderNodeBsdfPrincipled")
        output = nodes.get("Material Output")
        links.new(principled.outputs["BSDF"], output.inputs["Surface"])

    _set_input(principled, "Base Color", base_color)
    _set_input(principled, "Metallic", metallic)
    _set_input(principled, "Roughness", roughness)

    if base_color_image:
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(os.path.join(TEX_DIR, base_color_image), check_existing=True)
        tex.location = (-600, 300)
        links.new(tex.outputs["Color"], principled.inputs["Base Color"])

    if normal_image:
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(os.path.join(TEX_DIR, normal_image), check_existing=True)
        tex.location = (-600, -100)
        tex.extension = "REPEAT"
        normal_node = nodes.new("ShaderNodeNormalMap")
        normal_node.location = (-300, -100)
        normal_node.inputs["Strength"].default_value = 1.35
        links.new(tex.outputs["Color"], normal_node.inputs["Color"])
        links.new(normal_node.outputs["Normal"], principled.inputs["Normal"])

    if roughness_image:
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(os.path.join(TEX_DIR, roughness_image), check_existing=True)
        tex.location = (-600, -400)
        links.new(tex.outputs["Color"], principled.inputs["Roughness"])

    return material


def build_materials():
    materials = {}
    materials["fabric"] = image_material(
        "FabricGreen", "fabric_green_basecolor.png", "fabric_green_normal.png",
        "fabric_green_roughness.png", roughness=0.9,
    )
    materials["white"] = image_material(
        "FabricWhite", "fabric_white_basecolor.png", "fabric_white_normal.png",
        roughness=0.86,
    )
    materials["fabric_dark"] = image_material(
        "FabricGreenDark", "fabric_green_dark_basecolor.png", "fabric_green_normal.png",
        "fabric_green_roughness.png", roughness=0.92,
    )
    materials["denim"] = image_material(
        "DenimBlue", "denim_basecolor.png", "denim_normal.png",
        "denim_roughness.png", roughness=0.82,
    )
    materials["leather"] = image_material(
        "LeatherTan", "leather_basecolor.png", "leather_normal.png",
        "leather_roughness.png", roughness=0.6,
    )
    materials["tag"] = image_material(
        "LeatherTag", "leather_tag_basecolor.png", "leather_normal.png",
        "leather_roughness.png", roughness=0.6,
    )
    materials["gingham"] = image_material(
        "GinghamRed", "gingham_basecolor.png", roughness=0.85,
    )
    materials["brass"] = image_material(
        "Brass", metallic=1.0, roughness=0.3, base_color=(0.76, 0.62, 0.28, 1.0),
    )
    materials["pupil"] = image_material(
        "PupilBlack", metallic=0.0, roughness=0.14, base_color=(0.045, 0.045, 0.05, 1.0),
    )
    materials["stitch"] = image_material(
        "StitchWhite", roughness=0.7, base_color=(0.92, 0.9, 0.85, 1.0),
    )
    materials["wrap"] = image_material(
        "BowTieWrap", roughness=0.78, base_color=(0.55, 0.13, 0.11, 1.0),
    )
    return materials


def assign(obj, material, repeat=1.0):
    obj.data.materials.clear()
    obj.data.materials.append(material)
    smart_uv(obj, repeat=repeat)


def assign_keep(obj, materials_list, repeat=1.0):
    """保留已有材质槽，只做 UV 展开。

    合并网格时若直接清空材质，眼珠的黑色会被眼白材质覆盖。
    """
    for material in materials_list:
        if material.name not in [m.name for m in obj.data.materials if m]:
            obj.data.materials.append(material)
    smart_uv(obj, repeat=repeat)


# --------------------------------------------------------------------------
# 娃娃各部件
# --------------------------------------------------------------------------

# 头部结构（对照原图量测）：
#   1) 上唇片 —— 横跨整个宽度的扁布片，顶端鼓起一个小圆丘，两眼长在两角
#   2) 缝合线 —— 一条左高右低的弧线
#   3) 下颚 —— 只挂在中右段的一片厚布，最低处约在 z = 0.79
# 之前把整张嘴做成一整块，才导致"没有嘴"。

HEAD_HALF_WIDTH = 0.415
JAW_LEFT = -0.300
JAW_RIGHT = 0.415

# 上唇片上沿：两端收尖，中间在两眼之间鼓起圆丘
_TOP_X = [-0.415, -0.370, -0.330, -0.290, -0.250, -0.190, -0.120, -0.060, 0.0,
          0.060, 0.140, 0.200, 0.250, 0.290, 0.330, 0.375, 0.415]
_TOP_Z = [0.945, 0.985, 1.030, 1.055, 1.075, 1.112, 1.140, 1.165, 1.180,
          1.178, 1.170, 1.132, 1.090, 1.048, 1.005, 0.945, 0.872]

# 缝合线：左侧略高，在 x ≈ -0.1 处达到最高，然后向右下沉
_SEAM_X = [-0.415, -0.370, -0.330, -0.290, -0.250, -0.190, -0.120, -0.060, 0.0,
           0.060, 0.140, 0.200, 0.250, 0.290, 0.330, 0.375, 0.415]
_SEAM_Z = [0.900, 0.897, 0.893, 0.886, 0.880, 0.918, 0.940, 0.944, 0.945,
           0.938, 0.918, 0.896, 0.872, 0.860, 0.850, 0.842, 0.836]

# 下颚下沿：中间最低，两端与缝合线合并成尖角
_JAW_X = [-0.300, -0.260, -0.220, -0.160, -0.100, -0.050, 0.0, 0.070, 0.140,
          0.195, 0.250, 0.290, 0.330, 0.375, 0.415]
_JAW_Z = [0.878, 0.862, 0.846, 0.822, 0.798, 0.786, 0.778, 0.780, 0.788,
          0.796, 0.804, 0.812, 0.822, 0.830, 0.838]


def head_top(x):
    """上唇片上沿高度。"""
    return float(np.interp(x, _TOP_X, _TOP_Z))


def seam_z(x):
    """嘴部缝合线高度。"""
    return float(np.interp(x, _SEAM_X, _SEAM_Z))


def jaw_bottom(x):
    """下颚下沿高度。"""
    return float(np.interp(x, _JAW_X, _JAW_Z))


def seam_y(x):
    """缝合线所在深度（模型正面朝 -Y）。"""
    return -0.066 + 0.016 * math.cos(x * 2.1)


def _upper_front(u, v):
    """上唇片正面：整体是一张扁布片，中间隆起一个圆丘。"""
    x = -HEAD_HALF_WIDTH + 2 * HEAD_HALF_WIDTH * u
    z = seam_z(x) + (head_top(x) - seam_z(x)) * v

    across = max(0.0, 1 - (2 * u - 1) ** 2) ** 0.5
    flat = 0.30 + 0.70 * across
    dome = across ** 0.6 * math.exp(-(((v - 0.72) / 0.40) ** 2))
    bulge = flat * (math.sin(math.pi * v) ** 0.85) * 0.085 + dome * 0.076

    y = seam_y(x) + (0.040 - seam_y(x)) * v - bulge
    return (x, y, z, dome)


def _upper_back(u, v):
    """上唇片背面：厚度跟随正面，边缘收薄，圆丘处更厚实。"""
    x, y, z, dome = _upper_front(u, v)
    thickness = 0.016 + 0.115 * dome + 0.026 * math.sin(math.pi * v)
    return (x, y + thickness, z)


def _jaw_across(u):
    """下颚横向轮廓系数：两端收尖，中间饱满。"""
    return max(0.0, 1 - (2 * u - 1) ** 2) ** 0.55


def _jaw_front(u, v):
    """下颚正面：一片蓬松的厚布，缝合线处与下沿处厚度收敛。"""
    x = JAW_LEFT + (JAW_RIGHT - JAW_LEFT) * u
    z = jaw_bottom(x) + (seam_z(x) - jaw_bottom(x)) * v

    across = _jaw_across(u)
    bulge = across * (math.sin(math.pi * v) ** 0.62) * 0.094

    y = (-0.092) + (seam_y(x) + 0.092) * v - bulge
    return (x, y, z)


def _jaw_back(u, v):
    """下颚背面：厚度跟随正面，边缘收薄，形成鼓鼓的布片而不是平板。"""
    x, y, z = _jaw_front(u, v)
    thickness = 0.012 + 0.105 * _jaw_across(u) * math.sin(math.pi * v) ** 0.7
    return (x, y + thickness, z)


def build_head(materials):
    """上唇片：宽扁的布片，中间鼓起圆丘，两眼长在两角。"""
    head = pillow("Head", 52, 26, lambda u, v: _upper_front(u, v)[:3], _upper_back)
    assign(head, materials["fabric"], repeat=1.35)
    add_subsurf(head, 1, 2)
    return head


def build_mouth_lip(materials):
    """下颚：缝合线下方那片厚布，最低处垂到 z ≈ 0.79。"""
    jaw = pillow("MouthJaw", 34, 16, _jaw_front, _jaw_back)
    assign(jaw, materials["fabric"], repeat=1.5)
    add_subsurf(jaw, 1, 2)
    return jaw


def build_mouth_seam(materials):
    """嘴部缝合线：一道深色滚边，标示上下两片的拼接。"""

    def seam_path(t):
        x = JAW_LEFT + (JAW_RIGHT - JAW_LEFT) * t
        return Vector((x, seam_y(x) - 0.005, seam_z(x)))

    seam = tube("MouthSeam", seam_path, lambda t: 0.0085, nseg=56, nrad=10)
    assign(seam, materials["fabric_dark"], repeat=2.2)
    add_subsurf(seam, 1, 1)
    return seam


def build_body(materials):
    """躯干：细长，肩部被宽大的头部遮住，下面接背带裤。"""

    def front(u, v):
        x = -0.110 + 0.220 * u
        z = 0.600 + 0.270 * v
        bulge = ((1 - (2 * u - 1) ** 2) * (1 - (2 * v - 1) ** 2)) ** 0.35
        y = -0.112 * bulge - 0.004
        return (x, y, z)

    def back(u, v):
        x = -0.110 + 0.220 * u
        z = 0.600 + 0.270 * v
        bulge = ((1 - (2 * u - 1) ** 2) * (1 - (2 * v - 1) ** 2)) ** 0.35
        y = 0.060 * bulge + 0.010
        return (x, y, z)

    body = pillow("Body", 26, 24, front, back)
    assign(body, materials["fabric"], repeat=1.7)
    add_subsurf(body, 1, 2)
    return body


def build_arm(side, materials):
    """细长下垂的手臂：肩膀在头部下方，向外斜垂。"""
    sign = -1.0 if side == "L" else 1.0

    def path(t):
        x = sign * (0.118 + 0.205 * t ** 1.35)
        z = 0.780 - 0.400 * t
        y = -0.058 - 0.046 * math.sin(math.pi * t * 0.9)
        return Vector((x, y, z))

    def radius(t):
        return 0.060 - 0.030 * t ** 0.8

    arm = tube(f"Arm.{side}", path, radius, nseg=28, nrad=16)
    assign(arm, materials["fabric"], repeat=1.9)
    add_subsurf(arm, 1, 2)
    return arm


def build_leg(side, materials):
    """裤腿下面露出的绿色脚掌。"""
    sign = -1.0 if side == "L" else 1.0

    def profile(t):
        z = 0.000 + 0.125 * t
        cx = sign * (0.098 + 0.020 * t)
        rx = 0.056 * (0.25 + 0.75 * math.sin(math.pi * min(t * 0.92 + 0.08, 1.0)) ** 0.5)
        return (cx, z, rx, 0.054)

    def depth(t):
        return 0.064 * (0.30 + 0.70 * math.sin(math.pi * min(t * 0.92 + 0.08, 1.0)) ** 0.5)

    leg = lathe(f"Foot.{side}", profile, depth, nz=20, nrad=24)
    assign(leg, materials["fabric"], repeat=1.5)
    add_subsurf(leg, 1, 2)
    return leg


# 裤腿轮廓控制点：(高度比例, 宽度系数)——上窄下胖，接近灯笼造型
_PANT_SHAPE_T = [0.00, 0.06, 0.16, 0.32, 0.50, 0.68, 0.84, 1.00]
_PANT_SHAPE_V = [0.58, 0.86, 0.98, 1.00, 0.98, 0.93, 0.85, 0.74]

PANT_Z0, PANT_Z1 = 0.095, 0.630


def pant_shape(t):
    return float(np.interp(t, _PANT_SHAPE_T, _PANT_SHAPE_V))


def pant_center(side, t):
    sign = -1.0 if side == "L" else 1.0
    return sign * (0.046 + 0.086 * (1.0 - t) ** 1.15)


def build_pant_leg(side, materials):
    """牛仔灯笼裤的一条裤腿：上窄下胖，接近圆球。"""
    sign = -1.0 if side == "L" else 1.0

    def profile(t):
        z = PANT_Z0 + (PANT_Z1 - PANT_Z0) * t
        cx = pant_center(side, t)
        rx = 0.150 * pant_shape(t)
        return (cx, z, rx, 0.052)

    def depth(t):
        return 0.126 * pant_shape(t)

    leg = lathe(f"PantLeg.{side}", profile, depth, nz=30, nrad=32)
    assign(leg, materials["denim"], repeat=1.7)
    add_subsurf(leg, 1, 2)
    return leg


def build_stitching(materials):
    """沿裤腿轮廓走的白色装饰缝线。"""
    objs = []

    for side in ("L", "R"):
        sign = -1.0 if side == "L" else 1.0
        # 外沿（剪影边缘）与内沿各一列虚线
        for edge in (-1.0, 1.0):
            count = 11
            for index in range(count):
                t = 0.10 + 0.82 * (index / (count - 1))
                z = PANT_Z0 + (PANT_Z1 - PANT_Z0) * t
                cx = pant_center(side, t)
                rx = 0.150 * pant_shape(t)
                px = cx + edge * (rx + 0.008)
                dash = rounded_box(f"Stitch.{side}.{edge}.{index}", (px, 0.0, z), (0.011, 0.013, 0.030))
                objs.append(dash)

        # 裤脚一圈
        hem_t = 0.075
        hem_z = PANT_Z0 + (PANT_Z1 - PANT_Z0) * hem_t
        cx = pant_center(side, hem_t)
        rx = 0.150 * pant_shape(hem_t)
        ry = 0.126 * pant_shape(hem_t)
        for index in range(7):
            angle = math.pi * (index / 6.0) + math.pi
            px = cx - rx * math.cos(angle) * 0.96
            py = ry * math.sin(angle) * 0.96
            dash = rounded_box(f"Stitch.{side}.hem.{index}", (px, py, hem_z), (0.018, 0.008, 0.009))
            dash.rotation_euler = (0.0, 0.0, angle)
            objs.append(dash)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in objs:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    joined = bpy.context.object
    joined.name = "Stitching"
    assign(joined, materials["stitch"], repeat=1.0)
    return joined


def build_eye(side, materials):
    """凸起的白眼球 + 黑眼珠，外圈一圈抽褶绿布。"""
    sign = -1.0 if side == "L" else 1.0
    center_x = sign * 0.262
    center_z = 1.115

    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=28, radius=0.056,
                                        location=(center_x, -0.034, center_z))
    white = bpy.context.object
    white.name = f"EyeWhite.{side}"
    white.scale = (1.0, 0.72, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.shade_smooth()
    assign(white, materials["white"], repeat=1.6)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=20, radius=0.017,
                                        location=(center_x - sign * 0.005, -0.074, center_z - 0.002))
    pupil = bpy.context.object
    pupil.name = f"Pupil.{side}"
    pupil.scale = (1.0, 0.78, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.shade_smooth()
    assign(pupil, materials["pupil"], repeat=1.0)

    bpy.ops.object.select_all(action="DESELECT")
    white.select_set(True)
    pupil.select_set(True)
    bpy.context.view_layer.objects.active = white
    bpy.ops.object.join()
    eye = bpy.context.object
    eye.name = f"Eye.{side}"
    add_subsurf(eye, 1, 1)

    # 抽褶布环：正面朝向观察者，褶皱沿轴向聚拢，像布料被抽紧的眼眶
    # 抽褶布环：紧紧贴着眼白的一圈密集褶皱
    ruffle = ruffle_ring(f"Eyelid.{side}", 0.082, 0.022, folds=30, fold_depth=0.20,
                          nring=192, nrad=20, axial=0.010, irregular=0.30)
    ruffle.rotation_euler = (math.radians(-10.0), 0.0, math.radians(-sign * 10.0))
    ruffle.location = (center_x, -0.030, center_z)
    assign(ruffle, materials["fabric"], repeat=1.7)
    add_subsurf(ruffle, 1, 1)

    return eye, ruffle


def build_bowtie(materials):
    """红白格纹蝴蝶结。"""
    objs = []

    for side in ("L", "R"):
        sign = -1.0 if side == "L" else 1.0

        def wing(u, v, sign=sign):
            # u: 中心结 → 外端；v: 上 → 下
            x = sign * (0.032 + 0.104 * u)
            half_height = 0.050 * (0.86 + 0.14 * math.sin(math.pi * min(u * 0.85 + 0.18, 1.0)))
            z = 0.752 + (v - 0.5) * 2 * half_height
            bulge = math.sin(math.pi * min(u * 0.88 + 0.12, 1.0)) * (1 - (2 * v - 1) ** 2)
            y = -0.152 - 0.020 * max(bulge, 0.0) ** 0.7
            return (x, y, z)

        def wing_back(u, v, sign=sign):
            front = wing(u, v, sign)
            return (front[0], front[1] + 0.026, front[2])

        mesh = pillow(f"BowWing.{side}", 20, 14, wing, wing_back)
        objs.append(mesh)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in objs:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    bow = bpy.context.object
    bow.name = "BowTie"
    assign(bow, materials["gingham"], repeat=1.0)
    add_subsurf(bow, 1, 2)

    wrap = rounded_box("BowWrap", (0.0, -0.166, 0.752), (0.036, 0.034, 0.034))
    assign(wrap, materials["wrap"], repeat=1.0)
    add_subsurf(wrap, 1, 1)

    return bow, wrap


def build_suspenders(materials):
    """橙棕色皮革背带 + 黄铜方扣。"""
    objs = []

    for side in ("L", "R"):
        sign = -1.0 if side == "L" else 1.0
        top_x = sign * 0.092
        bottom_x = sign * 0.058

        def strap(u, v, top_x=top_x, bottom_x=bottom_x, sign=sign):
            # u: 上 → 下；v: 横向
            x = top_x + (bottom_x - top_x) * u
            z = 0.790 - 0.440 * u
            width = 0.0180
            px = x + (v - 0.5) * 2 * width
            y = -0.152 + 0.020 * math.sin(math.pi * u) + 0.004 * u
            return (px, y, z)

        def strap_back(u, v, **kwargs):
            front = strap(u, v, **kwargs)
            return (front[0], front[1] + 0.013, front[2])

        mesh = pillow(f"Suspender.{side}", 22, 6, strap, strap_back)
        objs.append(mesh)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in objs:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    straps = bpy.context.object
    straps.name = "Suspenders"
    assign(straps, materials["leather"], repeat=2.0)
    add_subsurf(straps, 1, 1)

    buckles = []
    for side in ("L", "R"):
        sign = -1.0 if side == "L" else 1.0
        z = 0.612
        u = (0.790 - z) / 0.440
        x = sign * (0.092 + (0.058 - 0.092) * u)
        y = -0.152 + 0.020 * math.sin(math.pi * u) + 0.004 * u

        def frame_path(t, x=x, y=y, z=z):
            # 方形调节扣
            half = 0.026
            angle = 2 * math.pi * t
            # 超椭圆，接近方形
            n = 6.0
            ct, st = math.cos(angle), math.sin(angle)
            px = half * math.copysign(abs(ct) ** (2 / n), ct)
            pz = half * math.copysign(abs(st) ** (2 / n), st)
            return Vector((x + px, y - 0.010, z + pz))

        frame = tube(f"Buckle.{side}", frame_path, lambda t: 0.0068, nseg=56, nrad=10)
        buckles.append(frame)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in buckles:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = buckles[0]
    bpy.ops.object.join()
    buckle_obj = bpy.context.object
    buckle_obj.name = "Buckles"
    assign(buckle_obj, materials["brass"], repeat=1.0)

    return straps, buckle_obj


def build_hanger(materials):
    """顶部皮绳、缠绕结、金属环与皮质标签。"""
    objs = []

    def cord_path(t):
        # 两股皮绳向上交汇成环
        angle = math.pi * (0.5 + t)
        x = 0.098 * math.cos(angle) * (1 - 0.12 * t)
        z = 1.640 + 0.235 * math.sin(angle)
        y = 0.010 * math.sin(math.pi * t)
        return Vector((x, y, z))

    cord = tube("Rope", cord_path, lambda t: 0.017, nseg=40, nrad=12)
    objs.append(cord)

    def cord_path_b(t):
        angle = math.pi * (0.5 + t)
        x = -0.098 * math.cos(angle) * (1 - 0.12 * t)
        z = 1.640 + 0.235 * math.sin(angle)
        y = 0.010 * math.sin(math.pi * t)
        return Vector((x, y, z))

    cord_b = tube("RopeB", cord_path_b, lambda t: 0.017, nseg=40, nrad=12)
    objs.append(cord_b)

    # 缠绕结：几圈紧密的皮革缠绕，由下往上略微变粗
    for index in range(8):
        t = index / 7
        z = 1.428 + 0.168 * t
        radius = 0.034 + 0.019 * t
        loop = ruffle_ring(f"Knot.{index}", radius, 0.021, folds=14, fold_depth=0.03,
                            nring=96, nrad=16)
        loop.rotation_euler = (math.radians(90.0), 0.0, math.radians(4.0))
        loop.location = (0.0, 0.0, z)
        objs.append(loop)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in objs:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    rope = bpy.context.object
    rope.name = "Rope"
    assign(rope, materials["leather"], repeat=3.0)
    add_subsurf(rope, 1, 1)

    # 金属环
    bpy.ops.mesh.primitive_torus_add(major_radius=0.104, minor_radius=0.016,
                                     major_segments=48, minor_segments=12,
                                     location=(0.0, 0.0, 1.372))
    ring = bpy.context.object
    ring.name = "MetalRing"
    ring.rotation_euler = (math.radians(90.0), 0.0, 0.0)
    bpy.ops.object.shade_smooth()
    assign(ring, materials["brass"], repeat=1.0)

    # 皮质标签
    def tag_front(u, v):
        x = (u - 0.5) * 0.142
        z = 1.170 + v * 0.132
        corner = (1 - (2 * u - 1) ** 4) * (1 - (2 * v - 1) ** 4)
        y = -0.014 - 0.010 * max(corner, 0.0) ** 0.5
        return (x, y, z)

    def tag_back(u, v):
        x = (u - 0.5) * 0.142
        z = 1.170 + v * 0.132
        return (x, 0.010, z)

    tag = pillow("LeatherTag", 16, 18, tag_front, tag_back)
    assign(tag, materials["tag"], repeat=1.0)
    add_subsurf(tag, 1, 1)

    # 标签与金属环的连接环
    bpy.ops.mesh.primitive_torus_add(major_radius=0.020, minor_radius=0.006,
                                     major_segments=24, minor_segments=8,
                                     location=(0.0, 0.0, 1.288))
    connector = bpy.context.object
    connector.name = "TagConnector"
    connector.rotation_euler = (math.radians(90.0), 0.0, 0.0)
    bpy.ops.object.shade_smooth()
    assign(connector, materials["brass"], repeat=1.0)

    return rope, ring, tag, connector


# --------------------------------------------------------------------------
# 组装
# --------------------------------------------------------------------------

def parent_to(child, parent):
    """把 child 挂到 parent 下，并保持世界变换不变。

    注意：Blender 的 parent_set 会把「活动对象」作为父级，
    因此活动对象必须设为 parent，而不是 child。
    """
    bpy.ops.object.select_all(action="DESELECT")
    child.select_set(True)
    parent.select_set(True)
    bpy.context.view_layer.objects.active = parent
    bpy.ops.object.parent_set(type="OBJECT", keep_transform=True)


def make_empty(name, location=(0.0, 0.0, 0.0)):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.08
    obj.location = location
    bpy.context.collection.objects.link(obj)
    return obj


def build():
    clear_scene()
    print("generating textures ...")
    texture_gen.generate_all()

    print("building materials ...")
    materials = build_materials()

    print("building body ...")
    head = build_head(materials)
    mouth_lip = build_mouth_lip(materials)
    mouth_seam = build_mouth_seam(materials)
    body = build_body(materials)
    arm_l = build_arm("L", materials)
    arm_r = build_arm("R", materials)
    foot_l = build_leg("L", materials)
    foot_r = build_leg("R", materials)

    pant_l = build_pant_leg("L", materials)
    pant_r = build_pant_leg("R", materials)
    bpy.ops.object.select_all(action="DESELECT")
    pant_l.select_set(True)
    pant_r.select_set(True)
    bpy.context.view_layer.objects.active = pant_l
    bpy.ops.object.join()
    pants = bpy.context.object
    pants.name = "Pants"
    assign(pants, materials["denim"], repeat=1.7)
    add_subsurf(pants, 1, 2)

    stitching = build_stitching(materials)

    print("building eyes ...")
    eye_l, eyelid_l = build_eye("L", materials)
    eye_r, eyelid_r = build_eye("R", materials)

    print("building accessories ...")
    bow, bow_wrap = build_bowtie(materials)
    straps, buckles = build_suspenders(materials)
    rope, ring, tag, connector = build_hanger(materials)

    print("assembling hierarchy ...")
    root = make_empty("FrogRoot")
    pivot = make_empty("SuspensionPivot", (0.0, 0.0, 1.550))
    assembly = make_empty("FrogAssembly", (0.0, 0.0, 0.0))

    parent_to(pivot, root)
    for obj in (rope, ring, tag, connector):
        parent_to(obj, pivot)
    parent_to(assembly, pivot)

    for obj in (head, mouth_lip, mouth_seam, body, arm_l, arm_r, foot_l, foot_r, pants, stitching,
                eye_l, eye_r, eyelid_l, eyelid_r, bow, bow_wrap, straps, buckles):
        parent_to(obj, assembly)

    # 层级需要从根到叶依次建立，保证父级先存在
    bpy.ops.object.select_all(action="SELECT")
    bpy.context.view_layer.objects.active = root

    print("saving blend ...")
    os.makedirs(OUT_DIR, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)

    print("exporting glb ...")
    export_glb(GLB_PATH)
    print("done")


def export_glb(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    try:
        bpy.ops.export_scene.gltf(
            filepath=path,
            export_format="GLB",
            export_apply=True,
            use_selection=False,
            export_yup=True,
            export_materials="EXPORT",
            export_image_format="AUTO",
            export_texcoords=True,
            export_normals=True,
            export_cameras=False,
            export_lights=False,
            export_extras=True,
        )
    except TypeError:
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_apply=True)


if __name__ == "__main__":
    build()
