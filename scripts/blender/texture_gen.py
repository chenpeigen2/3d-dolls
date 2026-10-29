"""程序化生成布艺材质贴图（BaseColor / Normal / Roughness）。

在 Blender 的 Python 环境中运行，依赖 Blender 自带的 numpy。
所有贴图都是可平铺的，生成后保存到 assets/textures-source/ 供 Blender 使用。

行索引约定：第 0 行代表图像底部，与 Blender 像素缓冲一致。
"""

import math
import os

import numpy as np

TEX_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "assets", "textures-source")


def _value_noise(res, cells, rng):
    """可平铺的值噪声。"""
    grid = rng.random((cells + 1, cells + 1)).astype(np.float64)
    grid[-1, :] = grid[0, :]
    grid[:, -1] = grid[:, 0]

    coords = np.linspace(0.0, cells, res, endpoint=False)
    grid_y, grid_x = np.meshgrid(coords, coords, indexing="ij")

    x0 = np.floor(grid_x).astype(np.int64)
    y0 = np.floor(grid_y).astype(np.int64)
    x1 = (x0 + 1) % cells
    y1 = (y0 + 1) % cells
    fx = grid_x - np.floor(grid_x)
    fy = grid_y - np.floor(grid_y)
    fx = fx * fx * (3 - 2 * fx)
    fy = fy * fy * (3 - 2 * fy)

    g00 = grid[y0, x0]
    g01 = grid[y0, x1]
    g10 = grid[y1, x0]
    g11 = grid[y1, x1]

    top = g00 + (g01 - g00) * fx
    bottom = g10 + (g11 - g10) * fx
    return top + (bottom - top) * fy


def _fbm(res, base_cells, octaves, rng):
    """分形噪声叠加。"""
    total = np.zeros((res, res), dtype=np.float64)
    amplitude = 1.0
    norm = 0.0
    for octave in range(octaves):
        total += amplitude * _value_noise(res, base_cells * (2**octave), rng)
        norm += amplitude
        amplitude *= 0.5
    return total / norm


def _threads(res, count, axis="y"):
    """纱线高度场：经纬纱线的圆弧截面 + 每根纱线的粗细差异。"""
    rng = np.random.default_rng(11)
    coords = np.linspace(0.0, count, res, endpoint=False)
    index = np.floor(coords).astype(np.int64) % count
    frac = coords - np.floor(coords)

    # 每根纱线粗细不同，避免机械感
    thickness = 0.34 + 0.16 * rng.random(count)
    profile = np.sin(np.pi * frac) ** 0.6
    profile = profile * thickness[index][:, None] if axis == "y" else profile * thickness[index][None, :]

    weave = profile if axis == "y" else profile.T
    return weave


def _linen_height(res=1024):
    """粗织棉麻：清晰的经纬纱线、上下交织与少量竹节。"""
    rng = np.random.default_rng(2024)
    count = 64
    coords = np.linspace(0.0, count, res, endpoint=False)
    grid_y, grid_x = np.meshgrid(coords, coords, indexing="ij")
    ix = np.floor(grid_x).astype(np.int64)
    iy = np.floor(grid_y).astype(np.int64)
    fx = grid_x - ix
    fy = grid_y - iy

    warp = np.sin(np.pi * fx) ** 0.42
    weft = np.sin(np.pi * fy) ** 0.42
    over_under = (ix + iy) % 2 == 0
    woven = np.where(over_under, warp, weft)

    # 纱线之间保留细缝，让 BaseColor 也能直接读出织纹。
    yarn_variation = 0.92 + 0.16 * rng.random((count, count))
    woven *= yarn_variation[iy % count, ix % count]
    slub = _fbm(res, 12, 2, rng)
    fiber = _fbm(res, 128, 2, rng)
    height = woven * 0.88 + slub * 0.08 + (fiber - 0.5) * 0.04
    return height - height.mean()


def _denim_height(res=1024):
    """牛仔斜纹：45 度斜向纹路 + 白色纬纱点。"""
    rng = np.random.default_rng(77)

    coords = np.linspace(0.0, res, res, endpoint=False)
    diag = (coords[:, None] + coords[None, :]) / res
    ribs = np.sin(diag * 2 * np.pi * 96) ** 2

    warp = _threads(res, 96, axis="y")
    weft = _threads(res, 96, axis="x")

    # 白色纬纱在靛蓝经纱之间露出，形成牛仔的斑点质感
    white_weft = (np.sin(coords[None, :] * 2 * np.pi / res * 96) > 0.55).astype(np.float64)

    height = ribs * 0.35 + warp * 0.28 + weft * white_weft * 0.30
    height += (_fbm(res, 32, 2, rng) - 0.5) * 0.16
    return height - height.mean()


def _leather_height(res=512):
    """皮革粒面：细胞状凸起 + 细裂纹。"""
    rng = np.random.default_rng(404)

    cells = _value_noise(res, 26, rng)
    grain = np.abs(cells - 0.5) * 2.0
    fine = _fbm(res, 64, 3, rng)
    cracks = 1.0 - np.abs(_value_noise(res, 14, rng) - 0.5) * 2.4

    height = grain * 0.45 + fine * 0.35 + np.clip(cracks, 0, 1) * 0.25
    return height - height.mean()


def _height_to_normal(height, strength=2.4):
    """高度场转切线空间法线贴图（OpenGL 约定，绿色朝上）。"""
    grad_y, grad_x = np.gradient(height)
    nx = -grad_x * strength
    ny = -grad_y * strength
    nz = np.ones_like(height)

    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    return np.stack([nx / length, ny / length, nz / length], axis=-1) * 0.5 + 0.5


def _save_image(name, rgb):
    """把 RGB 数组写进 Blender 图像并保存为 PNG。"""
    import bpy

    res = rgb.shape[0]
    height, width = rgb.shape[:2]
    rgba = np.concatenate([rgb, np.ones((height, width, 1), dtype=np.float64)], axis=2)

    image = bpy.data.images.new(name, width=height, height=width, alpha=False, float_buffer=False)
    image.colorspace_settings.name = "Non-Color" if "normal" in name else "sRGB"
    image.pixels.foreach_set(rgba.astype(np.float32).ravel())
    image.filepath_raw = os.path.join(TEX_DIR, f"{name}.png")
    image.file_format = "PNG"
    image.save()
    bpy.data.images.remove(image)


def _shade(base_rgb, height, amount):
    """按高度场对底色做明暗调制，模拟织物的自阴影。"""
    height = height - height.min()
    if height.max() > 0:
        height = height / height.max()
    shade = 1.0 - amount * (1.0 - height)
    return np.clip(np.array(base_rgb)[None, None, :] * shade[:, :, None], 0.0, 1.0)


def _roughness_from_height(height, base, spread):
    height = height - height.min()
    if height.max() > 0:
        height = height / height.max()
    rough = np.clip(base + (1.0 - height) * spread, 0.0, 1.0)
    return np.repeat(rough[:, :, None], 3, axis=2)


def generate_all():
    """生成全部贴图文件。"""
    os.makedirs(TEX_DIR, exist_ok=True)

    results = []

    # --- 绿色棉麻 ---
    height = _linen_height(1024)
    green = (0.420, 0.570, 0.190)
    _save_image("fabric_green_basecolor", _shade(green, height, 0.34))
    _save_image("fabric_green_normal", _height_to_normal(height, 3.0))
    _save_image("fabric_green_roughness", _roughness_from_height(height, 0.88, 0.12))
    results.append("fabric_green")

    # --- 深一点的绿：用于嘴部缝线与布料折缝 ---
    dark_green = (0.270, 0.385, 0.105)
    _save_image("fabric_green_dark_basecolor", _shade(dark_green, height, 0.18))
    results.append("fabric_green_dark")

    # --- 白色棉布（眼白）---
    height = _linen_height(512)
    _save_image("fabric_white_basecolor", _shade((0.945, 0.929, 0.878), height, 0.16))
    _save_image("fabric_white_normal", _height_to_normal(height, 2.0))
    results.append("fabric_white")

    # --- 牛仔布 ---
    height = _denim_height(1024)
    denim = (0.235, 0.355, 0.540)
    _save_image("denim_basecolor", _shade(denim, height, 0.34))
    _save_image("denim_normal", _height_to_normal(height, 2.8))
    _save_image("denim_roughness", _roughness_from_height(height, 0.84, 0.14))
    results.append("denim")

    # --- 皮革（背带与皮绳）---
    height = _leather_height(512)
    leather = (0.600, 0.310, 0.125)
    _save_image("leather_basecolor", _shade(leather, height, 0.24))
    _save_image("leather_normal", _height_to_normal(height, 1.6))
    _save_image("leather_roughness", _roughness_from_height(height, 0.58, 0.22))
    results.append("leather")

    # --- 皮革标签（带压印标识）---
    height = _leather_height(512)
    tag = _shade((0.855, 0.706, 0.522), height, 0.20)
    _save_image("leather_tag_basecolor", _emblem(tag))
    results.append("leather_tag")

    # --- 红白格纹（蝴蝶结）---
    _save_image("gingham_basecolor", _gingham(512))
    results.append("gingham")

    return results


def _emblem(base):
    """在皮革标签贴图上压一个水滴状标识。"""
    res = base.shape[0]
    coords = np.linspace(-1.0, 1.0, res)
    grid_y, grid_x = np.meshgrid(coords, coords, indexing="ij")

    drop = (grid_x**2) * 3.4 + (grid_y - 0.18) ** 2 * 1.5
    inside = drop < 0.30
    ring = (drop > 0.19) & (drop < 0.26)

    out = base.copy()
    out[ring] *= 0.58
    out[inside & ~ring] *= 0.72
    return np.clip(out, 0.0, 1.0)


def _gingham(res=512):
    """原图的红棕细格纹，而不是大块红白棋盘格。"""
    checks = 6
    coords = np.linspace(0.0, checks, res, endpoint=False)
    grid_y, grid_x = np.meshgrid(coords, coords, indexing="ij")
    fx = grid_x - np.floor(grid_x)
    fy = grid_y - np.floor(grid_y)

    wine = np.array([0.355, 0.105, 0.085])
    cream = np.array([0.835, 0.765, 0.660])
    brown = np.array([0.185, 0.105, 0.085])
    color = np.broadcast_to(wine, (res, res, 3)).copy()

    broad_x = (fx < 0.060) | (fx > 0.955)
    broad_y = (fy < 0.060) | (fy > 0.955)
    thin_x = np.abs(fx - 0.52) < 0.018
    thin_y = np.abs(fy - 0.52) < 0.018
    dark_x = np.abs(fx - 0.75) < 0.038
    dark_y = np.abs(fy - 0.75) < 0.038

    color[dark_x | dark_y] = brown
    color[broad_x | broad_y] = cream * 0.82 + wine * 0.18
    color[broad_x & broad_y] = cream * 0.58 + brown * 0.42
    color[thin_x | thin_y] = cream
    color[thin_x & thin_y] = cream * 0.70 + wine * 0.30

    rng = np.random.default_rng(9)
    weave = _threads(res, 96, axis="y") * _threads(res, 96, axis="x")
    shade = 1.0 - 0.15 * (1.0 - (weave - weave.min()) / max(weave.max() - weave.min(), 1e-6))
    noise = (_fbm(res, 32, 2, rng) - 0.5) * 0.045
    return np.clip(color * (shade + noise)[:, :, None], 0.0, 1.0)


if __name__ == "__main__":
    for item in generate_all():
        print(f"generated texture set: {item}")
