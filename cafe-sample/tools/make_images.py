"""ヨリミチ珈琲 サンプル用のイラスト画像を生成する。

実在店舗の写真ではなく、Pillow と NumPy で描いた架空のイラストです。
本番では店舗の実写写真に差し替えてください（docs/差し替えガイド.md）。

使い方: python3 tools/make_images.py   （cafe-sample/ で実行）
"""
import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "img")
SS = 2  # スーパーサンプリング倍率

# 店のパレット（assets/style.css のトークンと揃える）
INK = (34, 30, 27)
ORIBE = (47, 93, 80)
KAKI = (200, 100, 44)
STONE = (241, 239, 234)
WOOD = (150, 104, 68)
WOOD_D = (112, 74, 46)
CREAM = (238, 224, 200)
COFFEE = (92, 56, 34)
CREMA = (196, 140, 88)
MILK = (247, 238, 222)
CERAMIC = (232, 230, 224)


def rgba(c, a=255):
    return (c[0], c[1], c[2], a)


def mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def vgrad(w, h, top, bottom):
    t = np.linspace(0, 1, h)[:, None, None]
    arr = np.array(top)[None, None, :] * (1 - t) + np.array(bottom)[None, None, :] * t
    arr = np.repeat(arr, w, axis=1)
    return Image.fromarray(arr.astype(np.uint8), "RGB").convert("RGBA")


def radial(w, h, cx, cy, r, color, alpha):
    y, x = np.ogrid[:h, :w]
    d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / r
    a = np.clip(1 - d, 0, 1) ** 2 * alpha
    layer = np.zeros((h, w, 4), np.uint8)
    layer[..., 0], layer[..., 1], layer[..., 2] = color
    layer[..., 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(layer, "RGBA")


def wood_texture(w, h, base, dark, seed=1, horizontal=True):
    rng = np.random.default_rng(seed)
    y = np.arange(h)[:, None] if horizontal else np.arange(w)[None, :]
    x = np.arange(w)[None, :] if horizontal else np.arange(h)[:, None]
    n = np.zeros((h, w))
    for k in range(6):
        f = rng.uniform(0.004, 0.03)
        ph = rng.uniform(0, 6.28)
        amp = rng.uniform(4, 22)
        n += np.sin((y + np.sin(x * 0.002 + ph) * amp) * f * 6.28 + ph)
    n = (n - n.min()) / (n.max() - n.min())
    n = n ** 1.6
    arr = np.array(base)[None, None, :] * (1 - n[..., None] * 0.35) + np.array(dark)[None, None, :] * (n[..., None] * 0.35)
    return Image.fromarray(arr.astype(np.uint8), "RGB").convert("RGBA")


def shadow(size, shape_fn, blur, alpha=110, offset=(0, 0)):
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    shape_fn(d, offset)
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    a = np.array(layer)
    a[..., 3] = (a[..., 3].astype(float) * alpha / 255).astype(np.uint8)
    a[..., :3] = (20, 14, 10)
    return Image.fromarray(a, "RGBA")


def finish(img, name, size, grain=4, vignette=0.18, quality=76):
    img = img.convert("RGB")
    w, h = img.size
    arr = np.array(img).astype(float)
    if vignette:
        y, x = np.ogrid[:h, :w]
        d = np.sqrt(((x - w / 2) / (w / 2)) ** 2 + ((y - h / 2) / (h / 2)) ** 2)
        arr *= (1 - np.clip(d - 0.55, 0, 1) * vignette)[..., None]
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    img = img.resize(size, Image.LANCZOS)
    arr = np.array(img).astype(float)
    rng = np.random.default_rng(len(name))
    arr += rng.normal(0, grain, arr.shape[:2])[..., None]
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    img.save(os.path.join(OUT, name + ".webp"), "WEBP", quality=quality, method=6)
    small = img.resize((size[0] // 2, size[1] // 2), Image.LANCZOS)
    small.save(os.path.join(OUT, name + "-s.webp"), "WEBP", quality=quality, method=6)
    print("wrote", name, size)


def steam(base, x, y, height, width, seed, alpha=70):
    w, h = base.size
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    rng = random.Random(seed)
    for s in range(3):
        ox = x + (s - 1) * width * 0.35
        pts = []
        ph = rng.uniform(0, 6.28)
        for i in range(60):
            t = i / 59
            pts.append((ox + math.sin(t * 7 + ph) * width * 0.18 * (0.4 + t), y - t * height))
        d.line(pts, fill=(255, 255, 255, alpha), width=int(width * 0.16), joint="curve")
    layer = layer.filter(ImageFilter.GaussianBlur(width * 0.12))
    return Image.alpha_composite(base, layer)


def heart_art(d, cx, cy, r, color):
    """ラテアートのハート（チューリップ風に3段）"""
    for i, k in enumerate([1.0, 0.72, 0.48]):
        rr = r * k * 0.55
        yy = cy + r * 0.32 - i * r * 0.36
        d.ellipse([cx - rr * 1.25, yy - rr, cx + rr * 1.25, yy + rr * 0.9], fill=color)
        inner = mix(color, CREMA, 0.55)
        if i < 2:
            d.ellipse([cx - rr * 1.0, yy - rr * 0.95, cx + rr * 1.0, yy + rr * 0.35], fill=rgba(inner))
    d.line([(cx, cy - r * 0.62), (cx, cy + r * 0.62)], fill=rgba(mix(color, CREMA, 0.45)), width=max(2, int(r * 0.035)))


# ---------------------------------------------------------------- hero
def hero():
    W, H = 1600 * SS, 1000 * SS
    img = vgrad(W, H, (226, 222, 212), (204, 198, 186))
    d = ImageDraw.Draw(img)
    # 窓
    wx0, wy0, wx1, wy1 = int(W * 0.08), int(H * 0.06), int(W * 0.62), int(H * 0.58)
    win = vgrad(wx1 - wx0, wy1 - wy0, (246, 240, 226), (228, 232, 222))
    img.paste(win, (wx0, wy0))
    # 窓の外の木（ぼかし）
    leaves = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(leaves)
    rng = random.Random(3)
    for _ in range(140):
        x = rng.uniform(wx0, wx1)
        y = rng.uniform(wy0, wy0 + (wy1 - wy0) * 0.75)
        r = rng.uniform(30, 90) * SS / 2
        c = mix((120, 150, 112), (186, 200, 160), rng.random())
        ld.ellipse([x - r, y - r, x + r, y + r], fill=rgba(c, 150))
    leaves = leaves.filter(ImageFilter.GaussianBlur(26 * SS))
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).rectangle([wx0, wy0, wx1, wy1], fill=255)
    img.paste(leaves, (0, 0), Image.fromarray((np.array(leaves)[..., 3] * (np.array(mask) / 255)).astype(np.uint8)))
    d = ImageDraw.Draw(img)
    # 窓枠
    fw = 14 * SS
    for x in [wx0, (wx0 + wx1) // 2, wx1]:
        d.rectangle([x - fw // 2, wy0, x + fw // 2, wy1], fill=rgba(INK))
    for y in [wy0, wy0 + (wy1 - wy0) * 0.42, wy1]:
        d.rectangle([wx0, y - fw // 2, wx1, y + fw // 2], fill=rgba(INK))
    # 差し込む光
    light = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(light).polygon([(wx0, wy1), (wx1, wy1), (int(W * 0.98), int(H * 0.96)), (int(W * 0.30), int(H * 0.96))], fill=(255, 236, 196, 70))
    light = light.filter(ImageFilter.GaussianBlur(40 * SS))
    img = Image.alpha_composite(img, light)
    # 右の棚
    d = ImageDraw.Draw(img)
    sx = int(W * 0.70)
    for i, y in enumerate([int(H * 0.16), int(H * 0.36)]):
        d.rectangle([sx, y, W, y + 12 * SS], fill=rgba(WOOD_D))
        # 瓶
        for j in range(4):
            bx = sx + 40 * SS + j * 92 * SS
            bh = (90 + (j % 2) * 26) * SS
            d.rounded_rectangle([bx, y - bh, bx + 62 * SS, y], 10 * SS, fill=rgba(mix(CERAMIC, (200, 190, 170), 0.3), 235))
            d.rectangle([bx + 6 * SS, y - bh * 0.62, bx + 56 * SS, y - 6 * SS], fill=rgba(mix(COFFEE, WOOD, 0.3 + 0.15 * j)))
            d.rectangle([bx + 4 * SS, y - bh - 14 * SS, bx + 58 * SS, y - bh], fill=rgba(ORIBE if j % 2 else INK))
    # 鉢植え
    px, py = int(W * 0.04), int(H * 0.62)
    d.rounded_rectangle([px, py - 120 * SS, px + 130 * SS, py], 18 * SS, fill=rgba(mix(CERAMIC, KAKI, 0.2)))
    for k in range(9):
        a = -math.pi / 2 + (k - 4) * 0.28
        L = (180 + (k % 3) * 40) * SS
        x2, y2 = px + 65 * SS + math.cos(a) * L, py - 120 * SS + math.sin(a) * L
        d.ellipse([x2 - 36 * SS, y2 - 16 * SS, x2 + 36 * SS, y2 + 16 * SS], fill=rgba(mix(ORIBE, (90, 130, 100), (k % 3) / 3)))
        d.line([(px + 65 * SS, py - 120 * SS), (x2, y2)], fill=rgba(ORIBE), width=4 * SS)
    # カウンター
    cy = int(H * 0.62)
    counter = wood_texture(W, H - cy, (176, 128, 86), WOOD_D, seed=5)
    img.paste(counter, (0, cy))
    d = ImageDraw.Draw(img)
    d.rectangle([0, cy, W, cy + 10 * SS], fill=rgba(mix(WOOD, (230, 200, 160), 0.4)))
    # ドリップスタンド
    stx = int(W * 0.36)
    sh = shadow((W, H), lambda dd, o: dd.ellipse([stx - 210 * SS, cy + 80 * SS, stx + 240 * SS, cy + 150 * SS], fill=(0, 0, 0, 255)), 18 * SS, 120)
    img = Image.alpha_composite(img, sh)
    d = ImageDraw.Draw(img)
    d.rectangle([stx - 170 * SS, cy + 90 * SS, stx + 170 * SS, cy + 118 * SS], fill=rgba(INK))
    d.rectangle([stx + 130 * SS, cy - 250 * SS, stx + 150 * SS, cy + 100 * SS], fill=rgba(INK))
    d.rectangle([stx - 80 * SS, cy - 250 * SS, stx + 150 * SS, cy - 232 * SS], fill=rgba(INK))
    # ドリッパー
    d.polygon([(stx - 95 * SS, cy - 236 * SS), (stx + 55 * SS, cy - 236 * SS), (stx + 10 * SS, cy - 140 * SS), (stx - 50 * SS, cy - 140 * SS)], fill=rgba(CERAMIC))
    d.polygon([(stx - 95 * SS, cy - 236 * SS), (stx - 60 * SS, cy - 236 * SS), (stx - 30 * SS, cy - 140 * SS), (stx - 50 * SS, cy - 140 * SS)], fill=rgba(mix(CERAMIC, INK, 0.12)))
    # サーバー（ガラス）
    gx0, gx1, gy0, gy1 = stx - 105 * SS, stx + 65 * SS, cy - 110 * SS, cy + 92 * SS
    glass = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glass)
    gd.rounded_rectangle([gx0, gy0, gx1, gy1], 50 * SS, fill=(255, 255, 255, 70), outline=(255, 255, 255, 170), width=4 * SS)
    gd.rounded_rectangle([gx0 + 8 * SS, gy0 + 90 * SS, gx1 - 8 * SS, gy1 - 8 * SS], 40 * SS, fill=rgba(COFFEE, 235))
    gd.rectangle([gx0 + 26 * SS, gy0 + 20 * SS, gx0 + 40 * SS, gy1 - 30 * SS], fill=(255, 255, 255, 90))
    img = Image.alpha_composite(img, glass)
    img = steam(img, stx - 20 * SS, cy - 250 * SS, 170 * SS, 70 * SS, 2, 55)
    # ケトル
    d = ImageDraw.Draw(img)
    kx = int(W * 0.56)
    sh = shadow((W, H), lambda dd, o: dd.ellipse([kx - 140 * SS, cy + 70 * SS, kx + 170 * SS, cy + 130 * SS], fill=(0, 0, 0, 255)), 16 * SS, 110)
    img = Image.alpha_composite(img, sh)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([kx - 100 * SS, cy - 90 * SS, kx + 110 * SS, cy + 100 * SS], 60 * SS, fill=rgba((58, 60, 62)))
    d.rounded_rectangle([kx - 80 * SS, cy - 70 * SS, kx - 50 * SS, cy + 80 * SS], 14 * SS, fill=(255, 255, 255, 40))
    d.line([(kx - 100 * SS, cy + 40 * SS), (kx - 230 * SS, cy - 130 * SS)], fill=rgba((58, 60, 62)), width=14 * SS)
    d.arc([kx + 60 * SS, cy - 90 * SS, kx + 200 * SS, cy + 60 * SS], -90, 90, fill=rgba(WOOD_D), width=18 * SS)
    d.ellipse([kx - 20 * SS, cy - 116 * SS, kx + 30 * SS, cy - 86 * SS], fill=rgba(WOOD_D))
    # カップ
    cx = int(W * 0.80)
    sh = shadow((W, H), lambda dd, o: dd.ellipse([cx - 150 * SS, cy + 100 * SS, cx + 150 * SS, cy + 160 * SS], fill=(0, 0, 0, 255)), 14 * SS, 120)
    img = Image.alpha_composite(img, sh)
    d = ImageDraw.Draw(img)
    d.ellipse([cx - 150 * SS, cy + 96 * SS, cx + 150 * SS, cy + 150 * SS], fill=rgba(CERAMIC))
    d.rounded_rectangle([cx - 90 * SS, cy - 10 * SS, cx + 90 * SS, cy + 125 * SS], 40 * SS, fill=rgba(mix(ORIBE, CERAMIC, 0.15)))
    d.arc([cx + 60 * SS, cy + 10 * SS, cx + 140 * SS, cy + 90 * SS], -80, 80, fill=rgba(mix(ORIBE, CERAMIC, 0.15)), width=16 * SS)
    d.ellipse([cx - 90 * SS, cy - 28 * SS, cx + 90 * SS, cy + 8 * SS], fill=rgba(mix(ORIBE, CERAMIC, 0.35)))
    d.ellipse([cx - 78 * SS, cy - 22 * SS, cx + 78 * SS, cy + 3 * SS], fill=rgba(COFFEE))
    img = steam(img, cx, cy - 30 * SS, 220 * SS, 80 * SS, 5, 60)
    finish(img, "hero", (1600, 1000))


# ---------------------------------------------------------------- latte
def latte():
    W = H = 1200 * SS
    img = wood_texture(W, H, (164, 118, 78), WOOD_D, seed=8)
    img = Image.alpha_composite(img, radial(W, H, W * 0.3, H * 0.2, W * 0.9, (255, 236, 200), 0.35))
    cx, cy = W * 0.5, H * 0.52
    sh = shadow((W, H), lambda d, o: d.ellipse([cx - 430 * SS + 40 * SS, cy - 430 * SS + 50 * SS, cx + 430 * SS + 40 * SS, cy + 430 * SS + 50 * SS], fill=(0, 0, 0, 255)), 40 * SS, 120)
    img = Image.alpha_composite(img, sh)
    d = ImageDraw.Draw(img)
    d.ellipse([cx - 430 * SS, cy - 430 * SS, cx + 430 * SS, cy + 430 * SS], fill=rgba(CERAMIC))
    d.ellipse([cx - 300 * SS, cy - 300 * SS, cx + 300 * SS, cy + 300 * SS], fill=rgba(mix(CERAMIC, INK, 0.07)))
    # 取っ手
    d.rounded_rectangle([cx + 300 * SS, cy - 50 * SS, cx + 420 * SS, cy + 50 * SS], 40 * SS, fill=rgba(mix(ORIBE, CERAMIC, 0.1)))
    d.ellipse([cx - 290 * SS, cy - 290 * SS, cx + 290 * SS, cy + 290 * SS], fill=rgba(mix(ORIBE, CERAMIC, 0.1)))
    d.ellipse([cx - 255 * SS, cy - 255 * SS, cx + 255 * SS, cy + 255 * SS], fill=rgba(CREMA))
    cr = radial(W, H, cx, cy, 255 * SS, COFFEE, 0.0)
    ring = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse([cx - 255 * SS, cy - 255 * SS, cx + 255 * SS, cy + 255 * SS], outline=rgba(COFFEE, 200), width=40 * SS)
    img = Image.alpha_composite(img, ring.filter(ImageFilter.GaussianBlur(14 * SS)))
    d = ImageDraw.Draw(img)
    heart_art(d, cx, cy + 10 * SS, 250 * SS, rgba(MILK))
    # スプーン
    d.rounded_rectangle([cx - 520 * SS, cy + 330 * SS, cx - 180 * SS, cy + 352 * SS], 10 * SS, fill=rgba((196, 190, 180)))
    d.ellipse([cx - 600 * SS, cy + 305 * SS, cx - 490 * SS, cy + 378 * SS], fill=rgba((206, 200, 190)))
    # 小皿のクッキー
    bx, by = W * 0.17, H * 0.18
    sh = shadow((W, H), lambda d, o: d.ellipse([bx - 120 * SS + 20 * SS, by - 120 * SS + 26 * SS, bx + 120 * SS + 20 * SS, by + 120 * SS + 26 * SS], fill=(0, 0, 0, 255)), 20 * SS, 110)
    img = Image.alpha_composite(img, sh)
    d = ImageDraw.Draw(img)
    d.ellipse([bx - 120 * SS, by - 120 * SS, bx + 120 * SS, by + 120 * SS], fill=rgba((214, 160, 98)))
    rng = random.Random(4)
    for _ in range(14):
        x, y = bx + rng.uniform(-80, 80) * SS, by + rng.uniform(-80, 80) * SS
        r = rng.uniform(10, 18) * SS
        d.ellipse([x - r, y - r, x + r, y + r], fill=rgba((84, 50, 30)))
    finish(img, "latte", (1200, 1200))


# ---------------------------------------------------------------- pour over
def pourover():
    W, H = 1600 * SS, 1000 * SS
    img = vgrad(W, H, (52, 48, 44), (30, 27, 25))
    img = Image.alpha_composite(img, radial(W, H, W * 0.55, H * 0.25, W * 0.7, (255, 210, 150), 0.32))
    d = ImageDraw.Draw(img)
    ty = int(H * 0.78)
    tbl = wood_texture(W, H - ty, (120, 84, 56), (70, 46, 30), seed=11)
    img.paste(tbl, (0, ty))
    cx = int(W * 0.5)
    sh = shadow((W, H), lambda dd, o: dd.ellipse([cx - 260 * SS, ty + 40 * SS, cx + 300 * SS, ty + 110 * SS], fill=(0, 0, 0, 255)), 20 * SS, 160)
    img = Image.alpha_composite(img, sh)
    # サーバー
    glass = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glass)
    gx0, gx1, gy0, gy1 = cx - 200 * SS, cx + 200 * SS, int(H * 0.40), ty + 70 * SS
    gd.rounded_rectangle([gx0, gy0, gx1, gy1], 120 * SS, fill=(255, 255, 255, 40), outline=(255, 255, 255, 150), width=5 * SS)
    gd.rounded_rectangle([gx0 + 14 * SS, gy0 + 170 * SS, gx1 - 14 * SS, gy1 - 14 * SS], 100 * SS, fill=rgba((110, 60, 28), 240))
    gd.ellipse([gx0 + 14 * SS, gy0 + 150 * SS, gx1 - 14 * SS, gy0 + 200 * SS], fill=rgba(CREMA, 220))
    gd.rounded_rectangle([gx0 + 50 * SS, gy0 + 40 * SS, gx0 + 74 * SS, gy1 - 60 * SS], 12 * SS, fill=(255, 255, 255, 80))
    img = Image.alpha_composite(img, glass)
    d = ImageDraw.Draw(img)
    # ドリッパー
    top = int(H * 0.16)
    d.polygon([(cx - 250 * SS, top), (cx + 250 * SS, top), (cx + 80 * SS, gy0 + 10 * SS), (cx - 80 * SS, gy0 + 10 * SS)], fill=rgba(CERAMIC))
    for k in range(7):
        x = cx - 210 * SS + k * 70 * SS
        d.line([(x, top + 20 * SS), (cx + (x - cx) * 0.3, gy0)], fill=rgba(mix(CERAMIC, INK, 0.12)), width=4 * SS)
    d.rectangle([cx - 260 * SS, top - 18 * SS, cx + 260 * SS, top + 4 * SS], fill=rgba(mix(CERAMIC, INK, 0.08)))
    d.polygon([(cx - 120 * SS, gy0), (cx + 120 * SS, gy0), (cx + 150 * SS, gy0 + 30 * SS), (cx - 150 * SS, gy0 + 30 * SS)], fill=rgba(mix(CERAMIC, INK, 0.1)))
    # 注がれるお湯
    k0 = (cx + 330 * SS, int(H * 0.02))
    d.line([k0, (cx + 40 * SS, top - 10 * SS)], fill=(255, 255, 255, 120), width=6 * SS)
    d.polygon([(cx + 330 * SS, 0), (W, 0), (W, int(H * 0.12)), (cx + 380 * SS, int(H * 0.06))], fill=rgba((70, 72, 74)))
    img = steam(img, cx, top - 10 * SS, 200 * SS, 120 * SS, 9, 60)
    # 豆
    rng = random.Random(7)
    d = ImageDraw.Draw(img)
    for _ in range(26):
        x = rng.uniform(80, 520) * SS if rng.random() < 0.5 else rng.uniform(1100, 1540) * SS
        y = rng.uniform(ty + 40 * SS, H - 30 * SS)
        bean(d, x, y, rng.uniform(22, 30) * SS, rng.uniform(0, 180))
    finish(img, "pourover", (1600, 1000), vignette=0.3)


def bean(d, x, y, r, ang):
    pts = []
    for i in range(30):
        t = i / 30 * 2 * math.pi
        px, py = math.cos(t) * r, math.sin(t) * r * 0.72
        a = math.radians(ang)
        pts.append((x + px * math.cos(a) - py * math.sin(a), y + px * math.sin(a) + py * math.cos(a)))
    d.polygon(pts, fill=rgba((74, 42, 24)))
    a = math.radians(ang)
    d.line([(x - math.cos(a) * r * 0.8, y - math.sin(a) * r * 0.8), (x + math.cos(a) * r * 0.8, y + math.sin(a) * r * 0.8)], fill=rgba((40, 22, 12)), width=max(2, int(r * 0.14)))


# ---------------------------------------------------------------- mont blanc
def montblanc():
    W = H = 1200 * SS
    img = vgrad(W, H, (222, 214, 200), (200, 190, 174))
    img = Image.alpha_composite(img, radial(W, H, W * 0.75, H * 0.1, W * 0.8, (255, 240, 210), 0.4))
    ty = int(H * 0.6)
    tbl = wood_texture(W, H - ty, (170, 122, 82), WOOD_D, seed=21)
    img.paste(tbl, (0, ty))
    cx = W * 0.48
    sh = shadow((W, H), lambda d, o: d.ellipse([cx - 420 * SS, ty + 120 * SS, cx + 460 * SS, ty + 260 * SS], fill=(0, 0, 0, 255)), 26 * SS, 130)
    img = Image.alpha_composite(img, sh)
    d = ImageDraw.Draw(img)
    d.ellipse([cx - 420 * SS, ty + 90 * SS, cx + 420 * SS, ty + 240 * SS], fill=rgba(mix(ORIBE, CERAMIC, 0.25)))
    d.ellipse([cx - 330 * SS, ty + 110 * SS, cx + 330 * SS, ty + 215 * SS], fill=rgba(mix(ORIBE, CERAMIC, 0.4)))
    # タルト台
    base_y = ty + 160 * SS
    d.rounded_rectangle([cx - 210 * SS, base_y - 70 * SS, cx + 210 * SS, base_y], 20 * SS, fill=rgba((206, 150, 88)))
    for k in range(14):
        x = cx - 200 * SS + k * 30 * SS
        d.line([(x, base_y - 66 * SS), (x, base_y - 4 * SS)], fill=rgba((180, 124, 66)), width=3 * SS)
    # マロンクリームの山（重ねた細い帯）
    rng = random.Random(12)
    for i in range(46):
        t = i / 45
        width = (200 - t * 150) * SS
        y = base_y - 70 * SS - t * 360 * SS
        c = mix((150, 104, 64), (196, 150, 104), (math.sin(i * 1.7) + 1) / 2 * 0.6)
        d.rounded_rectangle([cx - width, y - 14 * SS, cx + width, y + 14 * SS], 14 * SS, fill=rgba(c))
        d.line([(cx - width + 10 * SS, y - 6 * SS), (cx + width - 10 * SS, y - 6 * SS)], fill=rgba(mix(c, (240, 210, 170), 0.35)), width=3 * SS)
    # 栗と粉糖
    top_y = base_y - 440 * SS
    d.ellipse([cx - 70 * SS, top_y - 70 * SS, cx + 70 * SS, top_y + 50 * SS], fill=rgba((214, 160, 60)))
    d.ellipse([cx - 40 * SS, top_y - 52 * SS, cx + 10 * SS, top_y - 20 * SS], fill=(255, 240, 200, 160))
    sugar = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sugar)
    for _ in range(260):
        x = cx + rng.gauss(0, 120) * SS
        y = base_y - rng.uniform(80, 420) * SS
        r = rng.uniform(1.5, 4) * SS
        sd.ellipse([x - r, y - r, x + r, y + r], fill=(255, 252, 245, 200))
    img = Image.alpha_composite(img, sugar)
    # フォーク
    d = ImageDraw.Draw(img)
    fx = cx + 380 * SS
    d.rounded_rectangle([fx, ty + 40 * SS, fx + 26 * SS, ty + 420 * SS], 12 * SS, fill=rgba((196, 190, 180)))
    for k in range(3):
        d.rectangle([fx - 18 * SS + k * 22 * SS, ty - 60 * SS, fx - 8 * SS + k * 22 * SS, ty + 40 * SS], fill=rgba((196, 190, 180)))
    # 背景の紅葉
    lv = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ldd = ImageDraw.Draw(lv)
    for _ in range(22):
        x, y = rng.uniform(0, W), rng.uniform(0, ty * 0.8)
        r = rng.uniform(40, 110) * SS
        ldd.ellipse([x - r, y - r, x + r, y + r], fill=rgba(mix(KAKI, (220, 170, 80), rng.random()), 90))
    img = Image.alpha_composite(img, lv.filter(ImageFilter.GaussianBlur(30 * SS)))
    finish(img, "montblanc", (1200, 1200))


# ---------------------------------------------------------------- toast (morning)
def toast():
    W, H = 1600 * SS, 1000 * SS
    img = wood_texture(W, H, (176, 130, 88), WOOD_D, seed=31)
    img = Image.alpha_composite(img, radial(W, H, W * 0.2, H * 0.1, W, (255, 240, 205), 0.35))
    # トレー
    sh = shadow((W, H), lambda d, o: d.rounded_rectangle([170 * SS, 120 * SS, 1470 * SS, 920 * SS], 40 * SS, fill=(0, 0, 0, 255)), 30 * SS, 120)
    img = Image.alpha_composite(img, sh)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([140 * SS, 90 * SS, 1440 * SS, 890 * SS], 40 * SS, fill=rgba(INK))
    d.rounded_rectangle([160 * SS, 110 * SS, 1420 * SS, 870 * SS], 32 * SS, fill=rgba((52, 46, 42)))
    # 皿とトースト
    px, py = 560 * SS, 490 * SS
    d.ellipse([px - 330 * SS, py - 330 * SS, px + 330 * SS, py + 330 * SS], fill=rgba(CERAMIC))
    d.ellipse([px - 260 * SS, py - 260 * SS, px + 260 * SS, py + 260 * SS], fill=rgba(mix(CERAMIC, INK, 0.05)))
    d.rounded_rectangle([px - 210 * SS, py - 200 * SS, px + 210 * SS, py + 210 * SS], 70 * SS, fill=rgba((176, 108, 52)))
    d.rounded_rectangle([px - 185 * SS, py - 175 * SS, px + 185 * SS, py + 185 * SS], 60 * SS, fill=rgba((226, 170, 96)))
    for k in range(5):
        y = py - 140 * SS + k * 70 * SS
        d.line([(px - 160 * SS, y), (px + 160 * SS, y)], fill=rgba((206, 146, 76)), width=6 * SS)
        x = px - 140 * SS + k * 70 * SS
        d.line([(x, py - 150 * SS), (x, py + 160 * SS)], fill=rgba((206, 146, 76)), width=6 * SS)
    d.rounded_rectangle([px - 60 * SS, py - 40 * SS, px + 60 * SS, py + 40 * SS], 10 * SS, fill=rgba((248, 228, 150)))
    # ゆで卵
    ex, ey = 1040 * SS, 330 * SS
    d.ellipse([ex - 110 * SS, ey - 110 * SS, ex + 110 * SS, ey + 110 * SS], fill=rgba(mix(ORIBE, CERAMIC, 0.2)))
    d.ellipse([ex - 70 * SS, ey - 92 * SS, ex + 70 * SS, ey + 82 * SS], fill=rgba((250, 246, 238)))
    d.ellipse([ex - 40 * SS, ey - 70 * SS, ex - 10 * SS, ey - 30 * SS], fill=(255, 255, 255, 180))
    # コーヒー
    cx, cy = 1080 * SS, 650 * SS
    d.ellipse([cx - 170 * SS, cy - 170 * SS, cx + 170 * SS, cy + 170 * SS], fill=rgba(CERAMIC))
    d.ellipse([cx - 120 * SS, cy - 120 * SS, cx + 120 * SS, cy + 120 * SS], fill=rgba(INK))
    d.ellipse([cx - 104 * SS, cy - 104 * SS, cx + 104 * SS, cy + 104 * SS], fill=rgba((70, 36, 18)))
    d.ellipse([cx - 60 * SS, cy - 80 * SS, cx - 20 * SS, cy - 56 * SS], fill=(255, 255, 255, 60))
    d.rounded_rectangle([cx + 116 * SS, cy - 26 * SS, cx + 200 * SS, cy + 26 * SS], 24 * SS, fill=rgba(INK))
    finish(img, "toast", (1600, 1000))


# ---------------------------------------------------------------- interior
def interior():
    W, H = 1600 * SS, 1000 * SS
    img = vgrad(W, H, (214, 208, 196), (190, 182, 168))
    d = ImageDraw.Draw(img)
    # 壁の板張り
    for k in range(0, W, 46 * SS):
        d.line([(k, int(H * 0.45)), (k, int(H * 0.72))], fill=rgba(mix((190, 182, 168), WOOD, 0.3)), width=3 * SS)
    d.rectangle([0, int(H * 0.45), W, int(H * 0.72)], fill=rgba(mix((214, 208, 196), WOOD, 0.35), 120))
    # 大きな窓
    for i in range(3):
        x0 = int(W * (0.06 + i * 0.22))
        win = vgrad(int(W * 0.18), int(H * 0.36), (248, 244, 232), (226, 232, 218))
        img.paste(win, (x0, int(H * 0.06)))
    d = ImageDraw.Draw(img)
    for i in range(3):
        x0 = int(W * (0.06 + i * 0.22))
        d.rectangle([x0, int(H * 0.06), x0 + int(W * 0.18), int(H * 0.42)], outline=rgba(INK), width=10 * SS)
        d.line([(x0 + int(W * 0.09), int(H * 0.06)), (x0 + int(W * 0.09), int(H * 0.42))], fill=rgba(INK), width=6 * SS)
    light = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(light)
    for i in range(3):
        x0 = int(W * (0.06 + i * 0.22))
        ld.polygon([(x0, int(H * 0.42)), (x0 + int(W * 0.18), int(H * 0.42)), (x0 + int(W * 0.34), H), (x0 + int(W * 0.12), H)], fill=(255, 238, 200, 60))
    img = Image.alpha_composite(img, light.filter(ImageFilter.GaussianBlur(30 * SS)))
    # 床
    d = ImageDraw.Draw(img)
    fy = int(H * 0.72)
    img.paste(wood_texture(W, H - fy, (150, 108, 72), WOOD_D, seed=41, horizontal=False), (0, fy))
    d = ImageDraw.Draw(img)
    # ペンダントライト
    for i, x in enumerate([0.70, 0.84, 0.97]):
        lx = int(W * x)
        d.line([(lx, 0), (lx, int(H * 0.22))], fill=rgba(INK), width=3 * SS)
        d.pieslice([lx - 70 * SS, int(H * 0.22) - 60 * SS, lx + 70 * SS, int(H * 0.22) + 60 * SS], 180, 360, fill=rgba(ORIBE if i % 2 else INK))
        img = Image.alpha_composite(img, radial(W, H, lx, int(H * 0.24), 260 * SS, (255, 214, 150), 0.5))
        d = ImageDraw.Draw(img)
    # テーブルと椅子
    for k, x in enumerate([0.2, 0.48, 0.80]):
        tx = int(W * x)
        tyy = int(H * 0.66)
        sh = shadow((W, H), lambda dd, o: dd.ellipse([tx - 200 * SS, tyy + 210 * SS, tx + 200 * SS, tyy + 260 * SS], fill=(0, 0, 0, 255)), 20 * SS, 120)
        img = Image.alpha_composite(img, sh)
        d = ImageDraw.Draw(img)
        # 椅子
        for s in (-1, 1):
            chx = tx + s * 210 * SS
            d.rectangle([chx - 6 * SS, tyy - 120 * SS, chx + 6 * SS, tyy + 230 * SS], fill=rgba(WOOD_D))
            d.rounded_rectangle([chx - 70 * SS, tyy + 60 * SS, chx + 70 * SS, tyy + 84 * SS], 8 * SS, fill=rgba(WOOD))
            d.line([(chx - 60 * SS, tyy + 84 * SS), (chx - 70 * SS, tyy + 240 * SS)], fill=rgba(WOOD_D), width=8 * SS)
            d.line([(chx + 60 * SS, tyy + 84 * SS), (chx + 70 * SS, tyy + 240 * SS)], fill=rgba(WOOD_D), width=8 * SS)
        d.rounded_rectangle([tx - 170 * SS, tyy, tx + 170 * SS, tyy + 22 * SS], 8 * SS, fill=rgba(mix(WOOD, (230, 200, 160), 0.2)))
        d.rectangle([tx - 10 * SS, tyy + 22 * SS, tx + 10 * SS, tyy + 230 * SS], fill=rgba(INK))
        d.rectangle([tx - 80 * SS, tyy + 222 * SS, tx + 80 * SS, tyy + 234 * SS], fill=rgba(INK))
        # カップ
        d.rounded_rectangle([tx - 30 * SS, tyy - 50 * SS, tx + 30 * SS, tyy], 10 * SS, fill=rgba(CERAMIC))
        img = steam(img, tx, tyy - 56 * SS, 110 * SS, 40 * SS, k, 50)
        d = ImageDraw.Draw(img)
    # 観葉植物
    px = int(W * 0.03)
    d.rounded_rectangle([px, int(H * 0.78), px + 120 * SS, H], 14 * SS, fill=rgba(mix(CERAMIC, INK, 0.2)))
    rng = random.Random(2)
    for k in range(14):
        a = -math.pi / 2 + rng.uniform(-1, 1)
        L = rng.uniform(200, 380) * SS
        x2, y2 = px + 60 * SS + math.cos(a) * L, int(H * 0.78) + math.sin(a) * L
        d.line([(px + 60 * SS, int(H * 0.78)), (x2, y2)], fill=rgba(ORIBE), width=4 * SS)
        d.ellipse([x2 - 46 * SS, y2 - 20 * SS, x2 + 46 * SS, y2 + 20 * SS], fill=rgba(mix(ORIBE, (110, 150, 110), rng.random())))
    finish(img, "interior", (1600, 1000))


# ---------------------------------------------------------------- storefront
def storefront():
    W, H = 1600 * SS, 1000 * SS
    img = vgrad(W, H, (206, 220, 222), (232, 228, 214))
    d = ImageDraw.Draw(img)
    # 建物
    d.rectangle([int(W * 0.12), int(H * 0.08), int(W * 0.88), int(H * 0.86)], fill=rgba((226, 222, 212)))
    for k in range(int(H * 0.08), int(H * 0.86), 30 * SS):
        d.line([(int(W * 0.12), k), (int(W * 0.88), k)], fill=rgba((214, 208, 196)), width=2 * SS)
    # 看板（文字はHTML側で表現するため形だけ）
    d.rectangle([int(W * 0.12), int(H * 0.08), int(W * 0.88), int(H * 0.2)], fill=rgba(INK))
    d.rounded_rectangle([int(W * 0.44), int(H * 0.115), int(W * 0.56), int(H * 0.165)], 8 * SS, fill=rgba(KAKI))
    # 日よけ
    aw_y = int(H * 0.26)
    stripes = 16
    for i in range(stripes):
        x0 = int(W * 0.14 + i * (W * 0.72 / stripes))
        x1 = int(W * 0.14 + (i + 1) * (W * 0.72 / stripes))
        d.polygon([(x0, aw_y), (x1, aw_y), (x1 + 6 * SS, aw_y + 110 * SS), (x0 + 6 * SS, aw_y + 110 * SS)], fill=rgba(ORIBE if i % 2 == 0 else (236, 232, 222)))
    for i in range(stripes):
        x0 = int(W * 0.14 + i * (W * 0.72 / stripes)) + 6 * SS
        x1 = int(W * 0.14 + (i + 1) * (W * 0.72 / stripes)) + 6 * SS
        d.pieslice([x0, aw_y + 80 * SS, x1, aw_y + 140 * SS], 0, 180, fill=rgba(ORIBE if i % 2 == 0 else (236, 232, 222)))
    # ガラス面（中に暖色の明かり）
    gy0, gy1 = aw_y + 150 * SS, int(H * 0.86)
    glass = vgrad(int(W * 0.66), gy1 - gy0, (90, 70, 52), (60, 46, 36))
    img.paste(glass, (int(W * 0.17), gy0))
    for x in [0.28, 0.5, 0.72]:
        img = Image.alpha_composite(img, radial(W, H, W * x, gy0 + 80 * SS, 220 * SS, (255, 200, 130), 0.75))
    d = ImageDraw.Draw(img)
    for x in [0.17, 0.39, 0.61, 0.83]:
        d.rectangle([int(W * x) - 8 * SS, gy0, int(W * x) + 8 * SS, gy1], fill=rgba(INK))
    d.rectangle([int(W * 0.17), gy0 - 8 * SS, int(W * 0.83), gy0 + 8 * SS], fill=rgba(INK))
    # 室内の人影とカウンター
    d.rectangle([int(W * 0.18), gy1 - 120 * SS, int(W * 0.82), gy1 - 100 * SS], fill=rgba(WOOD))
    for x in [0.3, 0.56]:
        px = int(W * x)
        d.ellipse([px - 34 * SS, gy1 - 260 * SS, px + 34 * SS, gy1 - 192 * SS], fill=rgba((40, 32, 28), 200))
        d.rounded_rectangle([px - 60 * SS, gy1 - 190 * SS, px + 60 * SS, gy1 - 100 * SS], 30 * SS, fill=rgba((40, 32, 28), 200))
    # 歩道・ベンチ・黒板
    d.rectangle([0, int(H * 0.86), W, H], fill=rgba((176, 170, 160)))
    for k in range(0, W, 120 * SS):
        d.line([(k, int(H * 0.86)), (k - 60 * SS, H)], fill=rgba((160, 154, 144)), width=3 * SS)
    bx = int(W * 0.08)
    d.polygon([(bx, int(H * 0.62)), (bx + 160 * SS, int(H * 0.62)), (bx + 190 * SS, int(H * 0.93)), (bx - 30 * SS, int(H * 0.93))], fill=rgba(WOOD_D))
    d.rectangle([bx + 10 * SS, int(H * 0.645), bx + 150 * SS, int(H * 0.86)], fill=rgba((44, 52, 48)))
    for k in range(4):
        y = int(H * 0.68) + k * 34 * SS
        d.line([(bx + 30 * SS, y), (bx + (130 - k * 14) * SS, y)], fill=(240, 236, 226, 200), width=5 * SS)
    # 植木鉢
    for x in [0.9, 0.95]:
        px = int(W * x)
        d.rounded_rectangle([px - 40 * SS, int(H * 0.8), px + 40 * SS, int(H * 0.9)], 10 * SS, fill=rgba(KAKI))
        d.ellipse([px - 70 * SS, int(H * 0.62), px + 70 * SS, int(H * 0.82)], fill=rgba(ORIBE))
    finish(img, "storefront", (1600, 1000), vignette=0.12)


# ---------------------------------------------------------------- beans
def beans():
    W, H = 1600 * SS, 1000 * SS
    img = wood_texture(W, H, (130, 92, 62), (80, 54, 36), seed=51)
    img = Image.alpha_composite(img, radial(W, H, W * 0.3, H * 0.2, W, (255, 220, 170), 0.3))
    d = ImageDraw.Draw(img)
    rng = random.Random(9)
    # 麻袋
    sh = shadow((W, H), lambda dd, o: dd.ellipse([700 * SS, 180 * SS, 1560 * SS, 980 * SS], fill=(0, 0, 0, 255)), 30 * SS, 120)
    img = Image.alpha_composite(img, sh)
    d = ImageDraw.Draw(img)
    d.ellipse([680 * SS, 140 * SS, 1540 * SS, 940 * SS], fill=rgba((196, 170, 128)))
    for k in range(0, 900 * SS, 14 * SS):
        d.line([(680 * SS + k, 140 * SS), (680 * SS + k, 940 * SS)], fill=rgba((180, 154, 112), 120), width=2 * SS)
    d.ellipse([760 * SS, 220 * SS, 1460 * SS, 860 * SS], fill=rgba((84, 50, 28)))
    for _ in range(420):
        a = rng.uniform(0, 6.28)
        rr = math.sqrt(rng.random())
        x = 1110 * SS + math.cos(a) * rr * 330 * SS
        y = 540 * SS + math.sin(a) * rr * 300 * SS
        bean(d, x, y, rng.uniform(22, 28) * SS, rng.uniform(0, 180))
    # スコップ
    d.rounded_rectangle([360 * SS, 460 * SS, 720 * SS, 520 * SS], 26 * SS, fill=rgba((190, 186, 178)))
    d.ellipse([140 * SS, 380 * SS, 420 * SS, 600 * SS], fill=rgba((200, 196, 188)))
    d.ellipse([170 * SS, 405 * SS, 395 * SS, 575 * SS], fill=rgba((84, 50, 28)))
    for _ in range(40):
        bean(d, rng.uniform(200, 370) * SS, rng.uniform(430, 550) * SS, 22 * SS, rng.uniform(0, 180))
    for _ in range(30):
        bean(d, rng.uniform(60, 640) * SS, rng.uniform(640, 960) * SS, rng.uniform(22, 28) * SS, rng.uniform(0, 180))
    finish(img, "beans", (1600, 1000))


# ---------------------------------------------------------------- hojicha latte
def hojicha():
    W = H = 1200 * SS
    img = vgrad(W, H, (232, 226, 214), (214, 204, 188))
    ty = int(H * 0.66)
    img.paste(wood_texture(W, H - ty, (172, 126, 84), WOOD_D, seed=61), (0, ty))
    img = Image.alpha_composite(img, radial(W, H, W * 0.2, H * 0.15, W * 0.9, (255, 238, 200), 0.4))
    cx = W * 0.5
    sh = shadow((W, H), lambda d, o: d.ellipse([cx - 260 * SS, ty + 150 * SS, cx + 300 * SS, ty + 230 * SS], fill=(0, 0, 0, 255)), 22 * SS, 140)
    img = Image.alpha_composite(img, sh)
    glass = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glass)
    x0, x1, y0, y1 = cx - 210 * SS, cx + 210 * SS, ty - 470 * SS, ty + 200 * SS
    gd.polygon([(x0, y0), (x1, y0), (x1 - 30 * SS, y1), (x0 + 30 * SS, y1)], fill=(255, 255, 255, 60))
    # 層：ほうじ茶 → ミルク → フォーム
    gd.polygon([(x0 + 12 * SS, y0 + 300 * SS), (x1 - 12 * SS, y0 + 300 * SS), (x1 - 40 * SS, y1 - 12 * SS), (x0 + 40 * SS, y1 - 12 * SS)], fill=rgba((150, 98, 58), 245))
    gd.polygon([(x0 + 12 * SS, y0 + 150 * SS), (x1 - 12 * SS, y0 + 150 * SS), (x1 - 16 * SS, y0 + 300 * SS), (x0 + 16 * SS, y0 + 300 * SS)], fill=rgba((214, 176, 132), 245))
    gd.polygon([(x0 + 10 * SS, y0 + 40 * SS), (x1 - 10 * SS, y0 + 40 * SS), (x1 - 12 * SS, y0 + 150 * SS), (x0 + 12 * SS, y0 + 150 * SS)], fill=rgba(MILK, 250))
    glass = glass.filter(ImageFilter.GaussianBlur(3 * SS))
    gd = ImageDraw.Draw(glass)
    gd.line([(x0, y0), (x0 + 30 * SS, y1)], fill=(255, 255, 255, 170), width=5 * SS)
    gd.line([(x1, y0), (x1 - 30 * SS, y1)], fill=(255, 255, 255, 170), width=5 * SS)
    gd.rectangle([x0 + 50 * SS, y0 + 60 * SS, x0 + 74 * SS, y1 - 60 * SS], fill=(255, 255, 255, 70))
    img = Image.alpha_composite(img, glass)
    d = ImageDraw.Draw(img)
    # ほうじ茶パウダー
    rng = random.Random(3)
    for _ in range(260):
        x = cx + rng.gauss(0, 70) * SS
        y = y0 + 40 * SS + rng.uniform(-6, 10) * SS
        r = rng.uniform(2, 5) * SS
        d.ellipse([x - r, y - r, x + r, y + r], fill=rgba((150, 98, 58)))
    # 茶葉
    for _ in range(16):
        x, y = rng.uniform(80, 360) * SS, rng.uniform(ty + 80 * SS, H - 40 * SS)
        bean(d, x, y, rng.uniform(16, 24) * SS, rng.uniform(0, 180))
    finish(img, "hojicha", (1200, 1200))


def og():
    """SNS共有用（1200x630）：hero を切り出し"""
    src = Image.open(os.path.join(OUT, "hero.webp"))
    w, h = src.size
    crop = src.crop((0, int(h * 0.12), w, int(h * 0.12) + int(w * 630 / 1200)))
    crop.resize((1200, 630), Image.LANCZOS).convert("RGB").save(os.path.join(OUT, "og.jpg"), "JPEG", quality=84)
    print("wrote og")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for fn in [hero, latte, pourover, montblanc, toast, interior, storefront, beans, hojicha]:
        fn()
    og()
