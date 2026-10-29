"""渲染模型预览图，用于与原图比对还原度。

运行方式：
    blender --background --python scripts/blender/render_preview.py -- <输出目录>

输出：
    assets/preview/frog-front.png   正面视角
    assets/preview/frog-side.png    侧面视角
"""

import math
import os
import sys

import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT_DIR = os.path.join(ROOT, "assets", "preview")
BLEND_PATH = os.path.join(ROOT, "assets", "source", "Frog.blend")

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []

if args:
    OUT_DIR = os.path.abspath(args[0])


def setup_world():
    world = bpy.data.worlds.new("Studio")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs[0].default_value = (0.90, 0.87, 0.82, 1.0)
    background.inputs[1].default_value = 1.0
    bpy.context.scene.world = world


def setup_lights():
    bpy.ops.object.light_add(type="AREA", location=(2.6, -2.8, 3.4))
    key = bpy.context.object
    key.data.size = 3.2
    key.data.energy = 320.0

    bpy.ops.object.light_add(type="AREA", location=(-3.0, -2.2, 1.6))
    fill = bpy.context.object
    fill.data.size = 4.0
    fill.data.energy = 120.0

    bpy.ops.object.light_add(type="AREA", location=(-1.0, 3.0, 3.0))
    rim = bpy.context.object
    rim.data.size = 3.0
    rim.data.energy = 180.0


def render(name, location, look_at, ortho_scale, resolution):
    camera_data = bpy.data.cameras.new("Camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = ortho_scale
    camera = bpy.data.objects.new("Camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = location

    direction = bpy.data.objects.new("Target", None)
    bpy.context.collection.objects.link(direction)
    direction.location = look_at

    track = camera.constraints.new("TRACK_TO")
    track.target = direction
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"

    scene = bpy.context.scene
    scene.camera = camera
    scene.render.resolution_x = resolution[0]
    scene.render.resolution_y = resolution[1]
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False

    scene.render.filepath = os.path.join(OUT_DIR, f"{name}.png")
    bpy.ops.render.render(write_still=True)

    bpy.data.objects.remove(camera, do_unlink=True)
    bpy.data.objects.remove(direction, do_unlink=True)


def main():
    bpy.ops.wm.open_mainfile(filepath=BLEND_PATH)
    os.makedirs(OUT_DIR, exist_ok=True)

    setup_world()
    setup_lights()

    scene = bpy.context.scene
    # 优先使用 Eevee，渲染更快；不可用时退回 Cycles
    for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    if scene.render.engine == "CYCLES":
        scene.cycles.samples = 32
        scene.cycles.use_denoising = True
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Base Contrast"

    render("frog-front", (0.0, -6.0, 0.92), (0.0, 0.0, 0.92), 2.1, (900, 1300))
    render("frog-side", (6.0, -0.4, 0.92), (0.0, 0.0, 0.92), 2.1, (700, 1300))
    render("frog-back", (0.0, 6.0, 0.92), (0.0, 0.0, 0.92), 2.1, (900, 1300))
    render("frog-three-quarter", (3.8, 4.8, 1.35), (0.0, 0.0, 0.92), 2.1, (900, 1300))
    render("frog-chest", (0.0, -3.0, 0.82), (0.0, -0.02, 0.75), 0.52, (1000, 1000))
    render("frog-chest-angle", (1.4, -3.0, 0.95), (0.0, -0.02, 0.75), 0.62, (1000, 1000))

    print("preview rendered to", OUT_DIR)


main()
