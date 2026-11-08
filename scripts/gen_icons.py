#!/usr/bin/env python3
"""生成 PWA 图标（含 maskable 变体），无需外部图标依赖。"""
import math
import os

from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
os.makedirs(OUT, exist_ok=True)

BG_START = (15, 23, 42)
BG_END = (30, 41, 59)
ACCENT = (56, 189, 248)
ACCENT_2 = (167, 139, 250)
LIGHT = (248, 250, 252)


def gradient(size, c1, c2, angle=35.0):
    """线性渐变底图。"""
    w, h = size
    base = Image.new("RGB", (w, h))
    px = base.load()
    rad = math.radians(angle)
    dx, dy = math.cos(rad), math.sin(rad)
    proj_min = min(0, dx * w) + min(0, dy * h)
    proj_max = max(0, dx * w) + max(0, dy * h)
    span = proj_max - proj_min
    for y in range(h):
        for x in range(w):
            t = ((dx * x + dy * y) - proj_min) / span
            px[x, y] = (
                int(c1[0] + (c2[0] - c1[0]) * t),
                int(c1[1] + (c2[1] - c1[1]) * t),
                int(c1[2] + (c2[2] - c1[2]) * t),
            )
    return base


def draw_mark(img, size, maskable=False):
    """绘制中心标记：三层同心环 + 节点，象征方法论体系与关联。"""
    d = ImageDraw.Draw(img, "RGBA")
    c = size / 2
    scale = size / 512

    if maskable:
        # maskable 需要安全区：内容收进中心 80%
        r1, r2, r3 = 118 * scale, 82 * scale, 46 * scale
    else:
        r1, r2, r3 = 150 * scale, 104 * scale, 58 * scale

    # 外环（半透明）
    d.ellipse(
        [c - r1, c - r1, c + r1, c + r1],
        outline=ACCENT + (110,),
        width=max(1, int(7 * scale)),
    )
    # 中环（强调色）
    d.ellipse(
        [c - r2, c - r2, c + r2, c + r2],
        outline=ACCENT_2 + (190,),
        width=max(1, int(6 * scale)),
    )

    # 节点：圆周上的 6 个关联点
    for i in range(6):
        ang = math.radians(i * 60 - 90)
        nx = c + math.cos(ang) * r2
        ny = c + math.sin(ang) * r2
        rr = 15 * scale
        col = ACCENT if i % 2 == 0 else ACCENT_2
        d.ellipse([nx - rr, ny - rr, nx + rr, ny + rr], fill=col + (235,))

    # 核心：实心圆 + 内环
    d.ellipse(
        [c - r3, c - r3, c + r3, c + r3],
        fill=LIGHT + (245,),
    )
    ir = r3 * 0.52
    d.ellipse([c - ir, c - ir, c + ir, c + ir], fill=ACCENT + (255,))
    return img


def render(size, maskable=False):
    img = gradient((size, size), BG_START, BG_END)
    img = draw_mark(img, size, maskable)
    return img


def render_maskable_padded(size):
    """maskable：整幅铺满 + 内容留安全区。"""
    canvas = gradient((size, size), BG_START, BG_END)
    d = ImageDraw.Draw(canvas, "RGBA")
    c = size / 2
    scale = size / 512
    r = 96 * scale
    d.ellipse(
        [c - r, c - r, c + r, c + r],
        outline=ACCENT_2 + (150,),
        width=max(1, int(6 * scale)),
    )
    for i in range(6):
        ang = math.radians(i * 60 - 90)
        nx = c + math.cos(ang) * r
        ny = c + math.sin(ang) * r
        rr = 13 * scale
        col = ACCENT if i % 2 == 0 else ACCENT_2
        d.ellipse([nx - rr, ny - rr, nx + rr, ny + rr], fill=col + (225,))
    ir = 44 * scale
    d.ellipse([c - ir, c - ir, c + ir, c + ir], fill=LIGHT + (240,))
    ir2 = ir * 0.5
    d.ellipse([c - ir2, c - ir2, c + ir2, c + ir2], fill=ACCENT + (255,))
    return canvas


targets = [
    ("icon-192.png", 192, False),
    ("icon-512.png", 512, False),
    ("icon-180.png", 180, False),
    ("icon-maskable-512.png", 512, True),
]

for name, size, maskable in targets:
    img = render_maskable_padded(size) if maskable else render(size)
    img.save(os.path.join(OUT, name), "PNG", optimize=True)
    print(f"✓ {name} ({size}x{size})")

# Apple touch icon（不透明背景）
apple = render(180).convert("RGB")
apple.save(os.path.join(OUT, "apple-touch-icon.png"), "PNG", optimize=True)
print("✓ apple-touch-icon.png (180x180)")
