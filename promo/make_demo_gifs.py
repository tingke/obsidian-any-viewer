# Generate animated GIF demos for the v0.6 README (T6.2 示意图).
#
# Draws the Any Viewer visual language (styles.css dark tokens) frame by frame
# with Pillow — no browser or screen recording needed. Outputs into
# promo/assets/. Rerun after visual changes: python3 make_demo_gifs.py
#
# v2: real text content (no skeleton bars), smoothstep-tweened transitions
# (5–8 interpolated frames per state change), pre-rendered RGBA layers with
# drop shadows, 3x supersampling. Scenes are parametric; timelines walk
# keyframes and interpolate between them.
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).resolve().parent / "assets"
OUT.mkdir(parents=True, exist_ok=True)

W, H, SCALE = 920, 600, 3
PAL = {
    "canvas": (23, 25, 29), "surface": (28, 31, 36), "subtle": (35, 38, 45),
    "line": (52, 57, 67), "ink": (229, 231, 235), "muted": (167, 175, 187),
    "faint": (127, 136, 149), "accent": (139, 132, 232), "on_accent": (23, 25, 29),
    "paper": (255, 255, 255), "page_ink": (32, 36, 45), "page_line": (232, 234, 241),
    "stripe": (247, 248, 252), "th": (238, 240, 255), "grid": (213, 216, 228),
    "heading": (79, 70, 229),
    "word": (122, 176, 255), "excel": (94, 212, 154), "ppt": (201, 99, 43), "html": (22, 134, 155),
    "slide_a": (109, 74, 255), "slide_b": (154, 107, 255), "slide_c": (199, 184, 255),
}
TOK = {
    "tag": (122, 162, 247), "attr": (187, 154, 247), "str": (158, 206, 106),
    "com": (86, 95, 137), "pn": (86, 95, 137), "plain": (200, 205, 216),
}

_font_cache: dict = {}


def font(size: float, mono: bool = False):
    key = (round(size, 1), mono)
    if key not in _font_cache:
        candidates = (
            ["/System/Library/Fonts/Menlo.ttc", "/System/Library/Fonts/Monaco.ttf"]
            if mono
            else ["/System/Library/Fonts/PingFang.ttc", "/System/Library/Fonts/Hiragino Sans GB.ttc", "/System/Library/Fonts/STHeiti Medium.ttc"]
        )
        for cand in candidates:
            try:
                _font_cache[key] = ImageFont.truetype(cand, int(size * SCALE))
                return _font_cache[key]
            except OSError:
                continue
        _font_cache[key] = ImageFont.load_default()
    return _font_cache[key]


def ease(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def S(v: float) -> int:
    return int(round(v * SCALE))


# ---------------------------------------------------------------- text helpers
def tlen(d, s: str, size: float, mono: bool = False) -> float:
    return d.textlength(s, font=font(size, mono)) / SCALE


def text(d, xy, s, size, color, mono=False, anchor="la", bold=False):
    kw = {"stroke_width": SCALE if bold else 0, "stroke_fill": color} if bold else {}
    d.text((S(xy[0]), S(xy[1])), s, font=font(size, mono), fill=color, anchor=anchor, **kw)


def mixed_text(d, xy, s, size, color) -> float:
    """Mixed ASCII/CJK runs (mono font has no CJK glyphs). Returns end x."""
    x = xy[0]
    run, run_mono = "", None

    def flush():
        nonlocal x, run, run_mono
        if run:
            f = font(size, mono=bool(run_mono))
            d.text((S(x), S(xy[1])), run, font=f, fill=color)
            x += d.textlength(run, font=f) / SCALE
        run, run_mono = "", None

    for ch in s:
        ch_mono = ch.isascii()
        if run_mono is None or ch_mono == run_mono:
            run, run_mono = run + ch, ch_mono
        else:
            flush()
            run, run_mono = ch, ch_mono
    flush()
    return x


def icon_tab(d, x, y, s=9, color=(167, 175, 187)):
    """open-in-tab: horizontal arrow into a vertical bar"""
    d.line([(S(x), S(y + s / 2)), (S(x + s * 0.62), S(y + s / 2))], fill=color, width=SCALE)
    d.line([(S(x + s * 0.62), S(y + s / 2)), (S(x + s * 0.44), S(y + s * 0.32))], fill=color, width=SCALE)
    d.line([(S(x + s * 0.62), S(y + s / 2)), (S(x + s * 0.44), S(y + s * 0.68))], fill=color, width=SCALE)
    d.line([(S(x + s * 0.82), S(y + s * 0.12)), (S(x + s * 0.82), S(y + s * 0.88))], fill=color, width=SCALE)


def icon_external(d, x, y, s=9, color=(167, 175, 187)):
    """open with system app: box + diagonal arrow out of the top-right corner"""
    d.line([(S(x + s * 0.18), S(y + s * 0.85)), (S(x + s * 0.18), S(y + s * 0.18)), (S(x + s * 0.6), S(y + s * 0.18))], fill=color, width=SCALE)
    d.line([(S(x + s * 0.42), S(y + s * 0.58)), (S(x + s * 0.92), S(y + s * 0.08))], fill=color, width=SCALE)
    d.line([(S(x + s * 0.92), S(y + s * 0.08)), (S(x + s * 0.92), S(y + s * 0.34))], fill=color, width=SCALE)
    d.line([(S(x + s * 0.92), S(y + s * 0.08)), (S(x + s * 0.66), S(y + s * 0.08))], fill=color, width=SCALE)


def icon_refresh(d, x, y, s=9, color=(167, 175, 187)):
    """reload: open circular arc + arrowhead"""
    d.arc([S(x), S(y), S(x + s), S(y + s)], start=-60, end=210, fill=color, width=SCALE)
    d.polygon([(S(x + s * 0.82), S(y + s * 0.06)), (S(x + s * 1.02), S(y + s * 0.32)), (S(x + s * 0.6), S(y + s * 0.26))], fill=color)


def wrap(d, s: str, size: float, width: float) -> list[str]:
    lines, cur = [], ""
    for ch in s:
        if d.textlength(cur + ch, font=font(size)) / SCALE > width:
            lines.append(cur)
            cur = ch
        else:
            cur += ch
    if cur:
        lines.append(cur)
    return lines


def rr(d, xy, r, **kw):
    d.rounded_rectangle([S(xy[0]), S(xy[1]), S(xy[2]), S(xy[3])], radius=S(r), **kw)


def hgrad(w: int, h: int, c1, c2, r: int = 0):
    row = Image.new("RGB", (max(1, w), 1))
    px = row.load()
    for x in range(row.width):
        t = x / max(1, row.width - 1)
        px[x, 0] = tuple(round(a + (b - a) * t) for a, b in zip(c1, c2))
    img = row.resize((max(1, w), max(1, h)))
    if r:
        mask = Image.new("L", img.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.width - 1, img.height - 1], radius=r, fill=255)
        out = Image.new("RGBA", img.size)
        out.paste(img, (0, 0), mask)
        return out
    return img


def shadow(layer: Image.Image, blur=6, offset=(0, 3), strength=30) -> Image.Image:
    a = layer.split()[3].filter(ImageFilter.GaussianBlur(blur * SCALE // 2))
    m = a.point(lambda v: int(v * strength / 100))
    sh = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    sh.paste((0, 0, 0, 255), (S(offset[0]), S(offset[1])), m)
    return sh


def with_opacity(layer: Image.Image, alpha: float) -> Image.Image:
    if alpha >= 1:
        return layer
    out = layer.copy()
    out.putalpha(out.split()[3].point(lambda v: int(v * max(0.0, min(1.0, alpha)))))
    return out


def compose(base: Image.Image, *layers):
    for item in layers:
        layer, pos = (item if isinstance(item, tuple) else (item, (0, 0)))
        base.alpha_composite(layer, (S(pos[0]), S(pos[1])))


# ---------------------------------------------------------------- window chrome
def window_base(active: str) -> Image.Image:
    img = Image.new("RGBA", (W * SCALE, H * SCALE), (14, 15, 18, 255))
    d = ImageDraw.Draw(img)
    rr(d, (0, 0, W, H), 10, fill=PAL["canvas"], outline=(60, 65, 76), width=SCALE)
    rr(d, (1, 1, W - 2, 36), 9, fill=PAL["surface"])
    d.line([(S(1), S(36)), (S(W - 1), S(36))], fill=PAL["line"], width=SCALE)
    for i, c in enumerate(((255, 95, 87), (254, 188, 46), (40, 200, 64))):
        d.ellipse([S(16 + i * 18), S(13), S(27 + i * 18), S(24)], fill=c)
    text(d, (84, 12.5), "1-Projects / demo-assets", 11, PAL["faint"])
    rr(d, (1, 36, W - 2, 70), 8, fill=PAL["surface"])
    d.line([(S(1), S(70)), (S(W - 1), S(70))], fill=PAL["line"], width=SCALE)
    for label, x0 in (("产品周报", 14), ("项目需求说明书.docx", 104), ("活动页.html", 300)):
        on = label == active
        if on:
            rr(d, (x0 - 4, 40, x0 + tlen(d, label, 12) + 14, 70), 8, fill=PAL["canvas"])
            text(d, (x0, 46), label, 12, PAL["ink"], bold=True)
        else:
            text(d, (x0, 46), label, 12, PAL["muted"])
    return img


def frame(active: str, *layers) -> Image.Image:
    img = window_base(active)
    compose(img, *layers)
    return img


# ---------------------------------------------------------------- mocks
def slide_layer(xy, small=False) -> Image.Image:
    x0, y0, x1, y1 = S(xy[0]), S(xy[1]), S(xy[2]), S(xy[3])
    w, h = x1 - x0, y1 - y0
    out = Image.new("RGBA", (W * SCALE, H * SCALE), (0, 0, 0, 0))
    grad = hgrad(w, h, PAL["slide_a"], PAL["slide_c"], r=4 * SCALE)
    out.alpha_composite(shadow(grad, blur=5, offset=(0, 2), strength=40), (x0, y0))
    out.alpha_composite(grad, (x0, y0))
    d = ImageDraw.Draw(out)
    pad = 14 if small else 24
    f_k, f_h, f_p, f_m = (9, 16, 11, 10) if small else (10, 25, 13, 11)
    bar_h = S(h / SCALE * 0.5)
    d.rounded_rectangle([S(x0 / SCALE + pad), y0 + S(pad), S(x0 / SCALE + pad + 5), y0 + S(pad) + bar_h], radius=2 * SCALE, fill=(124, 58, 237))
    tx = x0 / SCALE + pad + (10 if small else 16)
    text(d, (tx, y0 / SCALE + pad + 1), "DATA · WEEK 46", f_k, (255, 255, 255, 216))
    text(d, (tx, y0 / SCALE + pad + 16), "数据看板", f_h, (255, 255, 255), bold=True)
    text(d, (tx, y0 / SCALE + pad + 16 + f_h + 7), "48,210 日活跃 · 4.8% 付费转化 · 87.4% 周留存", f_p, (255, 255, 255, 235))
    text(d, (tx, y0 / SCALE + pad + 16 + f_h + 7 + f_p + 9), "DAU ▲ 6.2%   转化 ▲ 0.3pt   留存 ▼ 1.5pt", f_m, (255, 255, 255, 205))
    return out


def sheet(img, xy, rows):
    x0, y0 = S(xy[0]), S(xy[1])
    d = ImageDraw.Draw(img)
    col_w = [150, 110, 110]
    y = y0
    for r, row in enumerate(rows):
        x = x0
        for c, cell in enumerate(row):
            w = col_w[c] if c < len(col_w) else 110
            fill = PAL["th"] if r == 0 else (PAL["stripe"] if r % 2 == 0 else PAL["paper"])
            d.rectangle([x, y, x + w * SCALE, y + 26 * SCALE], fill=fill, outline=PAL["grid"], width=SCALE)
            color = (220, 38, 38) if cell.startswith(("▲", "▼")) else PAL["page_ink"]
            d.text((x + 8 * SCALE, y + 6 * SCALE), cell, font=font(11), fill=color)
            x += w * SCALE
        y += 26 * SCALE


def sheet_layer(xy, rows) -> Image.Image:
    x0, y0 = S(xy[0]), S(xy[1])
    out = Image.new("RGBA", (W * SCALE, H * SCALE), (0, 0, 0, 0))
    d = ImageDraw.Draw(out)
    col_w = [150, 110, 110]
    y = y0
    for r, row in enumerate(rows):
        x = x0
        for c, cell in enumerate(row):
            w = col_w[c] if c < len(col_w) else 110
            fill = PAL["th"] if r == 0 else (PAL["stripe"] if r % 2 == 0 else PAL["paper"])
            d.rectangle([x, y, x + w * SCALE, y + 26 * SCALE], fill=fill, outline=PAL["grid"], width=SCALE)
            color = (220, 38, 38) if cell.startswith(("▲", "▼")) else PAL["page_ink"]
            d.text((x + 8 * SCALE, y + 6 * SCALE), cell, font=font(11), fill=color)
            x += w * SCALE
        y += 26 * SCALE
    return out


def page_layer(xy, heading, paras, page_no=1) -> Image.Image:
    x0, y0, x1, y1 = S(xy[0]), S(xy[1]), S(xy[2]), S(xy[3])
    w, h = x1 - x0, y1 - y0
    page = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(page)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=2 * SCALE, fill=PAL["paper"])
    d.text((S(22), S(14)), heading, font=font(14), fill=PAL["heading"], stroke_width=SCALE, stroke_fill=PAL["heading"])
    y = 44
    for para in paras:
        for line in wrap(d, para, 11.5, w / SCALE - 44):
            d.text((S(22), S(y)), line, font=font(11.5), fill=PAL["page_ink"])
            y += 19
        y += 8
    if y < h - 10 * SCALE:
        d.text((w // 2, h - S(6)), f"— {page_no} —", font=font(9), fill=(150, 155, 168), anchor="ma")
    out = Image.new("RGBA", (W * SCALE, H * SCALE), (0, 0, 0, 0))
    out.alpha_composite(shadow(page, blur=5, offset=(0, 2), strength=25), (x0, y0))
    out.alpha_composite(page, (x0, y0))
    return out


def clip(layers, xy):
    """Soft-clip a layer group to the stage box (mask everything outside)."""
    x0, y0, x1, y1 = S(xy[0]), S(xy[1]), S(xy[2]), S(xy[3])
    mask = Image.new("L", (W * SCALE, H * SCALE), 0)
    ImageDraw.Draw(mask).rounded_rectangle([x0, y0, x1 - 1, y1 - 1], radius=2 * SCALE, fill=255)
    combined = Image.new("RGBA", (W * SCALE, H * SCALE), (0, 0, 0, 0))
    for layer in layers:
        combined.alpha_composite(layer)
    combined.putalpha(Image.composite(combined.split()[3], Image.new("L", mask.size, 0), mask))
    rr_layer = Image.new("RGBA", (W * SCALE, H * SCALE), (0, 0, 0, 0))
    rr_layer.alpha_composite(combined)
    return rr_layer


def save_gif(name, frames, durations, colors=160):
    frames = [f.resize((W, H), Image.LANCZOS).convert("P", palette=Image.ADAPTIVE, colors=colors) for f in frames]
    frames[0].save(OUT / name, save_all=True, append_images=frames[1:], duration=durations, loop=0, disposal=2)
    print(f"{name:28s} {len(frames):2d} frames {(OUT / name).stat().st_size:>8,d} B")


# ================================================================ GIF 1 片段语法
SRC = "![[发布计划.pptx#page=3|420]]"
CARD_LAYER = Image.new("RGBA", (W * SCALE, H * SCALE), (0, 0, 0, 0))


def _draw_card(d):
    rr(d, (40, 168, 470, 168 + 36 + 158), 8, fill=PAL["surface"], outline=PAL["line"], width=SCALE)
    rr(d, (40, 168, 470, 204), 8, fill=PAL["subtle"])
    d.line([(S(40), S(204)), (S(470), S(204))], fill=PAL["line"], width=SCALE)
    rr(d, (50, 179, 64, 193), 3, fill=PAL["ppt"])
    text(d, (70, 179), "发布计划.pptx", 12, PAL["muted"])
    for i, g in enumerate(("⇥", "↗")):
        text(d, (438 - i * 28, 178), g, 13, PAL["muted"], anchor="ra")


_tmp = Image.new("RGBA", (W * SCALE, H * SCALE), (0, 0, 0, 0))
_draw_card(ImageDraw.Draw(_tmp))
CARD_LAYER = _tmp
CARD_SHADOW = shadow(CARD_LAYER, blur=6, offset=(0, 3), strength=35)
SLIDE = slide_layer((52, 210, 458, 366), small=True)


def frag_frame(typed: int, alpha: float, rise: float, badge_a: float) -> Image.Image:
    img = window_base("产品周报")
    d = ImageDraw.Draw(img)
    text(d, (40, 96), "## 本周材料", 13, PAL["muted"])
    shown = SRC[:typed]
    width = sum((7.6 if c.isascii() else 14.4) for c in shown)
    rr(d, (38, 124, 52 + width, 152), 6, fill=PAL["subtle"], outline=PAL["line"], width=SCALE)
    mixed_text(d, (46, 130), shown, 12, PAL["ink"])
    if typed < len(SRC):
        d.rectangle([S(44 + width), S(131), S(46 + width), S(147)], fill=PAL["accent"])
    if alpha > 0.01:
        y = S(168 + rise)
        compose(img, (with_opacity(CARD_SHADOW, alpha), (0, 0)), (with_opacity(CARD_LAYER, alpha), (0, 0)))
        compose(img, (with_opacity(SLIDE, alpha), (0, S(rise))))
        if badge_a > 0.05:
            bd = ImageDraw.Draw(img)
            bx = 70 + tlen(bd, "发布计划.pptx", 12) + 10
            rr(bd, (bx, 177 + rise, bx + 56, 195 + rise), 9, fill=PAL["accent"])
            text(bd, (bx + 8, 180 + rise), "第 3 页", 10, PAL["on_accent"])
            sl = with_opacity(SLIDE, alpha)
            compose(img, (sl, (0, S(rise))))
    return img


frames, durs = [], []
for n in (8, 16, 24):
    frames.append(frag_frame(n, 0, 0, 0)); durs.append(240)
for i in range(1, 6):
    t = ease(i / 5)
    frames.append(frag_frame(24, t, lerp(10, 0, t), 0)); durs.append(85)
for i in range(1, 4):
    frames.append(frag_frame(24, 1, 0, ease(i / 3))); durs.append(80)
frames.append(frag_frame(24, 1, 0, 1)); durs.append(1500)


save_gif("demo-fragment.gif", frames, durs)

# ================================================================ GIF 2 预览内搜索
DOC_PAGES = [
    ("项目概述", ["项目采用两轮灰度发布策略，先在 500 人内测群验证核心链路，再逐步扩大到 5% 全量用户。"]),
    ("里程碑与排期", ["01-05 首轮灰度放量；01-20 二轮灰度并全量开放；02-10 版本回顾。"]),
]
SEARCH_BAR_LAYER = Image.new("RGBA", (W * SCALE, H * SCALE), (0, 0, 0, 0))


def _draw_search_bar(d):
    rr(d, (260, 10, 660, 52), 10, fill=PAL["surface"], outline=PAL["line"], width=SCALE)
    d.ellipse([S(276), S(23), S(290), S(37)], outline=PAL["faint"], width=SCALE)
    d.line([(S(288), S(35)), (S(293), S(40))], fill=PAL["faint"], width=SCALE)
    text(d, (300, 23), "灰度", 12, PAL["ink"])
    rr(d, (584, 19, 630, 41), 8, fill=(45, 49, 58))
    text(d, (607, 24), "", 11, PAL["ink"], anchor="ma")
    for sym, dx in (("↑", 0), ("↓", 26), ("✕", 52)):
        text(d, (660 + dx, 25), sym, 12, PAL["muted"], anchor="ra")


_draw_search_bar(ImageDraw.Draw(SEARCH_BAR_LAYER))
SEARCH_BAR_SHADOW = shadow(SEARCH_BAR_LAYER, blur=5, offset=(0, 2), strength=40)
QUERY = "灰度"


def marked_paragraph(d, xy, text_s, query, current: int | None, occurrence: int):
    """Draw text with rounded highlight marks on query occurrences."""
    x = xy[0]
    parts = text_s.split(query)
    occ = 0
    for i, part in enumerate(parts):
        if i:
            w = tlen(d, query, 11.5)
            if current is not None and occ == current:
                rr(d, (x - 2, xy[1] - 2, x + w + 2, xy[1] + 18), 3, fill=PAL["accent"])
                text(d, (x, xy[1]), query, 11.5, PAL["on_accent"])
            else:
                rr(d, (x - 2, xy[1] - 2, x + w + 2, xy[1] + 18), 3, fill=(139, 132, 232, 90) if False else (74, 70, 130))
                text(d, (x, xy[1]), query, 11.5, PAL["ink"])
            occ += 1
            x += w
        x = mixed_text(d, (x, xy[1]), part, 11.5, PAL["page_ink"])


def search_frame(mode, drop=0.0, current=None):
    img = window_base("产品周报")
    d = ImageDraw.Draw(img)
    y = 96
    for heading, paras in DOC_PAGES:
        text(d, (44, y), heading, 13, PAL["heading"], bold=True)
        y += 26
        para = paras[0]
        if mode in ("marked", "jump"):
            marked_paragraph(d, (44, y), para, QUERY, current if mode == "jump" else 0, 0)
        else:
            mixed_text(d, (44, y), para, 11.5, PAL["page_ink"])
        y += 52
    if mode != "plain":
        drop_y = S(lerp(-14, 0, 1 - drop))
        img.alpha_composite(with_opacity(SEARCH_BAR_SHADOW, 1 - drop), (0, drop_y))
        img.alpha_composite(with_opacity(SEARCH_BAR_LAYER, 1 - drop), (0, drop_y))
        if mode in ("marked", "jump"):
            bd = ImageDraw.Draw(img)
            rr(bd, (584, 19, 630, 41), 8, fill=(45, 49, 58))
            text(bd, (607, 24), "1 / 4" if mode == "marked" else "3 / 4", 11, PAL["ink"], anchor="ma")
    return img


frames, durs = [], []
frames.append(search_frame("plain")); durs.append(400)
for i in range(1, 5):
    frames.append(search_frame("bar", drop=1 - ease(i / 4))); durs.append(80)
frames.append(search_frame("typed")); durs.append(450)
frames.append(search_frame("marked")); durs.append(800)
for i in range(1, 3):
    frames.append(fade := Image.blend(search_frame("marked"), search_frame("jump"), ease(i / 2))); durs.append(110)
frames.append(search_frame("jump")); durs.append(1400)
save_gif("demo-search.gif", frames, durs)

def outline_panel(d, active_text, width=210):
    rr(d, (0, 71, width, H), 8, fill=PAL["surface"])
    d.line([(S(width), S(71)), (S(width), S(H))], fill=PAL["line"], width=SCALE)
    if width > 60:
        text(d, (14, 82), "大纲", 12, PAL["muted"])
        text(d, (width - 14, 82), "‹", 13, PAL["muted"], anchor="ra")
        d.line([(0, S(106)), (S(width), S(106))], fill=PAL["line"], width=SCALE)
        items = [("项目概述", 0, 1), ("功能需求", 8, 2), ("多人文档编辑", 24, 2), ("离线草稿", 24, 2), ("非功能需求", 8, 3), ("里程碑与排期", 0, 4), ("风险与对策", 0, 5)]
        y = 114
        for label, indent, page in items:
            if width > 120:
                if label == active_text:
                    rr(d, (6, y - 3, width - 6, y + 21), 5, fill=(84, 78, 158))
                    d.rectangle([S(6), S(y - 3), S(9), S(y + 21)], fill=PAL["accent"])
                text(d, (14 + indent, y), label, 12, PAL["ink"])
                text(d, (width - 14, y), str(page), 11, PAL["faint"], anchor="ra")
            y += 27


# ================================================================ GIF 3 大纲 + 位置记忆
PAGES = [
    ("项目概述", ["本说明书定义「移动端协同编辑」项目的目标、范围与交付节奏。项目采用两轮灰度发布策略，先在 500 人内测群验证核心链路，再逐步扩大到 5% 全量用户。", "灰度期间重点收集崩溃率、同步成功率与编辑延迟三项核心指标；任一指标连续两天劣化即暂停放量并回滚。", "范围覆盖移动端全文档协同，不含桌面端历史版本合并。"], 1),
    ("功能需求", ["多人文档编辑：支持最多 20 人同时编辑同一篇文档，协作者光标与选区实时可见，段落级锁机制避免编辑冲突。", "离线草稿：断网时编辑内容自动落盘本地草稿，恢复联网后按段落合并，冲突段落提供双方版本对比。", "评论与提醒：支持段落锚点评论，被 @ 成员在灰度名单内优先收到推送。", "版本历史：保留 90 天内的段落级历史，支持一键回滚到任意版本。"], 2),
    ("非功能需求", ["同步成功率 ≥ 99.9%，灰度阶段目标放宽到 99.5%。", "移动端冷启动 ≤ 1.2s，编辑延迟 P95 ≤ 200ms。", "单文档支持 10 万字，低端机编辑帧率 ≥ 50fps。"], 3),
    ("里程碑与排期", ["01-05 首轮灰度放量：内测群与 1% 用户先行。", "01-20 二轮灰度并全量开放。", "02-10 版本回顾与复盘会。"], 4),
    ("风险与对策", ["冲突合并算法复杂度被低估：预留两周缓冲，必要时收缩放量范围，合并算法先行在草稿同步链路上验证。", "公测反馈处理带宽不足：临时抽调两名工程师支援支持组，持续两周。"], 5),
]


def outline_frame(panel_w: float, scroll: float, active: str | None) -> Image.Image:
    img = window_base("项目需求说明书.docx")
    d = ImageDraw.Draw(img)
    if panel_w > 1:
        outline_panel(d, active, panel_w)
    ox = 226 if panel_w > 1 else 40
    clip = (ox, 96, W - 36, 566)
    # pages drawn on their own layer, clipped through the rounded stage mask
    content = Image.new("RGBA", (W * SCALE, H * SCALE), (0, 0, 0, 0))
    d2 = ImageDraw.Draw(content)
    rr(d2, clip, 2, fill=PAL["paper"])
    y = 110 - scroll
    for heading, paras, page_no in PAGES:
        text(d2, (ox + 24, y), heading, 14, PAL["heading"], bold=True)
        y += 30
        for para in paras:
            for line in wrap(d2, para, 11.5, W - ox - 90):
                text(d2, (ox + 24, y), line, 11.5, PAL["page_ink"])
                y += 19
            y += 12
    mask = Image.new("L", content.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [S(clip[0]), S(clip[1]), S(clip[2]) - SCALE, S(clip[3]) - SCALE], radius=2 * SCALE, fill=255)
    content.putalpha(Image.composite(content.split()[3], Image.new("L", mask.size, 0), mask))
    img.alpha_composite(content)
    return img


frames, durs = [], []
frames.append(outline_frame(0, 0, None)); durs.append(400)
for i in range(1, 6):
    frames.append(outline_frame(lerp(0, 210, ease(i / 5)), 0, None)); durs.append(80)
frames.append(outline_frame(210, 0, None)); durs.append(500)
for i in range(1, 6):
    frames.append(outline_frame(210, lerp(0, 218, ease(i / 5)), "非功能需求")); durs.append(85)
frames.append(outline_frame(210, 218, "非功能需求")); durs.append(600)
for i in range(1, 6):
    frames.append(outline_frame(210, lerp(218, 415, ease(i / 5)), "里程碑与排期")); durs.append(85)
frames.append(outline_frame(210, 415, "里程碑与排期")); durs.append(1300)
save_gif("demo-outline.gif", frames, durs, colors=110)

# ================================================================ GIF 4 Style Settings
ROWS = [["指标", "本周", "环比"], ["日活跃用户", "48,210", "▲ 6.2%"], ["付费转化率", "4.8%", "▲ 0.3pt"], ["周留存", "87.4%", "▼ 1.5pt"]]


def ss_frame(knob: float, header_h: float, label: str) -> Image.Image:
    img = window_base("产品周报")
    d = ImageDraw.Draw(img)
    rr(d, (14, 90, 300, 560), 8, fill=PAL["surface"])
    d.line([(S(300), S(90)), (S(300), S(560))], fill=PAL["line"], width=SCALE)
    text(d, (30, 104), "Any Viewer", 13, PAL["ink"], bold=True)
    text(d, (30, 140), "标题栏高度", 12, PAL["ink"])
    text(d, (286, 139), label, 13, PAL["accent"], anchor="ra")
    rr(d, (30, 169, 286, 173), 2, fill=PAL["line"])
    rr(d, (30, 169, 30 + 256 * knob, 173), 2, fill=PAL["accent"])
    kx = 30 + 256 * knob
    d.ellipse([S(kx - 7), S(164), S(kx + 7), S(178)], fill=PAL["accent"], outline=(255, 255, 255), width=SCALE)
    text(d, (30, 196), "工具栏按钮尺寸", 12, PAL["muted"]); text(d, (286, 196), "28", 12, PAL["muted"], anchor="ra")
    text(d, (30, 226), "内容内边距", 12, PAL["muted"]); text(d, (286, 226), "12", 12, PAL["muted"], anchor="ra")
    text(d, (30, 536), "样式由 Style Settings 注入 body，实时生效", 11, PAL["faint"])
    rr(d, (316, 100, 900, 100 + header_h), 8, fill=PAL["subtle"], outline=PAL["line"], width=SCALE)
    rr(d, (328, 100 + (header_h - 14) / 2, 342, 100 + (header_h + 14) / 2), 3, fill=PAL["word"])
    text(d, (352, 100 + header_h / 2 - 8), "产品周报.docx", 12, PAL["muted"])
    icon_external(d, 852, 100 + (header_h - 10) / 2)
    icon_refresh(d, 878, 100 + (header_h - 10) / 2)
    sheet(img, (330, 118 + header_h, 890, 560), ROWS)
    return img


frames, durs = [], []
frames.append(ss_frame(0.18, 36, "36")); durs.append(600)
for i in range(1, 7):
    frames.append(ss_frame(lerp(0.18, 0.5, ease(i / 6)), lerp(36, 28, ease(i / 6)), str(round(lerp(36, 28, ease(i / 6)))))); durs.append(80)
frames.append(ss_frame(0.5, 28, "28")); durs.append(500)
for i in range(1, 7):
    frames.append(ss_frame(lerp(0.5, 0.92, ease(i / 6)), lerp(28, 48, ease(i / 6)), str(round(lerp(28, 48, ease(i / 6)))))); durs.append(80)
frames.append(ss_frame(0.92, 48, "48")); durs.append(500)
for i in range(1, 5):
    frames.append(ss_frame(lerp(0.92, 0.5, ease(i / 4)), lerp(48, 28, ease(i / 4)), str(round(lerp(48, 28, ease(i / 4)))))); durs.append(80)
frames.append(ss_frame(0.5, 28, "28")); durs.append(1200)
save_gif("demo-style-settings.gif", frames, durs)

# ================================================================ GIF 5 HTML 源码切换
SRC_LINES = [
    [("pn", "<!DOCTYPE html>")],
    [("pn", "<"), ("tag", "html"), ("attr", " lang"), ("pn", "="), ("str", '"zh-CN"'), ("pn", ">")],
    [("pn", "<"), ("tag", "head"), ("pn", ">")],
    [("com", "  /* 发布会 hero 区块 */")],
    [("pn", "  "), ("tag", ".hero"), ("pn", " {")],
    [("attr", "    background"), ("pn", ": "), ("str", "linear-gradient(135deg,#6d4aff,#9a6bff)"), ("pn", ";")],
    [("attr", "    color"), ("pn", ": "), ("str", "#fff"), ("pn", ";")],
    [("pn", "  }")],
    [("pn", "</"), ("tag", "style"), ("pn", ">")],
    [("pn", "<"), ("tag", "body"), ("pn", ">")],
    [("pn", "  <"), ("tag", "section"), ("attr", " class"), ("pn", "="), ("str", '"hero"'), ("attr", " id"), ("pn", "="), ("str", '"hero"'), ("pn", ">")],
]


def html_frame(source_t: float) -> Image.Image:
    img = window_base("活动页.html")
    d = ImageDraw.Draw(img)
    rr(d, (40, 96, 880, 132), 8, fill=PAL["subtle"])
    d.line([(S(40), S(132)), (S(880), S(132))], fill=PAL["line"], width=SCALE)
    rr(d, (50, 107, 64, 121), 3, fill=PAL["html"])
    text(d, (70, 107), "活动页.html", 12, PAL["muted"])
    rr(d, (168, 105, 246, 123), 9, fill=PAL["accent"])
    text(d, (176, 108), "定位 #hero", 10, PAL["on_accent"])
    icon_tab(d, 824, 106)
    icon_external(d, 852, 106)
    rr(d, (40, 138, 880, 560), 8, fill=(18, 19, 23))
    d.line([(S(40), S(138)), (S(40), S(560))], fill=PAL["line"], width=SCALE)
    if source_t < 1:
        rd = Image.new("RGBA", (W * SCALE, H * SCALE), (0, 0, 0, 0))
        rdd = ImageDraw.Draw(rd)
        x0, y0, x1, y1 = S(48), S(146), S(872), S(552)
        grad = hgrad(x1 - x0, y1 - y0, PAL["slide_a"], PAL["slide_b"], r=4 * SCALE)
        rd.alpha_composite(grad, (x0, y0))
        text(rdd, (72, y0 / SCALE + 24), "LIVE · 2026.12.02", 11, (255, 255, 255))
        text(rdd, (72, y0 / SCALE + 58), "冬季新品发布会", 24, (255, 255, 255), bold=True)
        text(rdd, (72, y0 / SCALE + 110), "Any Viewer v2.0 首次公开：全新的预览引擎、更完整的样式还原，", 13, (255, 255, 255))
        text(rdd, (72, y0 / SCALE + 134), "以及为长文档准备的性能重构。线上直播，全程回放。", 13, (255, 255, 255))
        img.alpha_composite(with_opacity(rd, 1 - source_t))
    if source_t > 0:
        sd = Image.new("RGBA", (W * SCALE, H * SCALE), (0, 0, 0, 0))
        sdd = ImageDraw.Draw(sd)
        y = 152
        for line in SRC_LINES:
            x = 62
            for cls, s in line:
                x = mixed_text(sdd, (x, y), s, 12, TOK[cls])
            y += 24
        img.alpha_composite(with_opacity(sd, source_t))
    icon_code = "</>"  # plain text glyph renders in PingFang
    text(d, (844, 107), icon_code, 12, PAL["muted"], anchor="ra")
    return img


frames, durs = [], []
frames.append(html_frame(0)); durs.append(700)
frames.append(html_frame(0)); durs.append(200)
for i in range(1, 6):
    frames.append(html_frame(ease(i / 5))); durs.append(90)
frames.append(html_frame(1)); durs.append(1600)
save_gif("demo-html-source.gif", frames, durs)

# ================================================================ 静态 PNG（静态场景直接出图）
def save_png(name: str, img: Image.Image):
    img.resize((W, H), Image.LANCZOS).convert("RGB").save(OUT / name)
    print(f"{name:28s} {(OUT / name).stat().st_size:>8,d} B")


# 多格式混排：pptx / xlsx / docx 三种嵌入卡片
img = window_base("产品周报")
d = ImageDraw.Draw(img)
text(d, (40, 92), "## 本周材料", 13, PAL["muted"])
y = 118
# card chrome first, then content layers on top (order matters)
rr(d, (40, y, 560, y + 36 + 124), 8, fill=PAL["surface"], outline=PAL["line"], width=SCALE)
rr(d, (40, y, 560, y + 36), 8, fill=PAL["subtle"]); d.line([(S(40), S(y + 36)), (S(560), S(y + 36))], fill=PAL["line"], width=SCALE)
rr(d, (50, y + 11, 64, y + 25), 3, fill=PAL["ppt"]); text(d, (70, y + 11), "发布计划.pptx", 12, PAL["muted"])
rr(d, (214, y + 9, 272, y + 27), 9, fill=PAL["accent"]); text(d, (222, y + 12), "第 3 页", 10, PAL["on_accent"])
icon_tab(d, 498, y + 9); icon_external(d, 526, y + 9)
compose(img, slide_layer((46, y + 42, 454, y + 42 + 112), small=True))
y += 36 + 124
rr(d, (40, y, 560, y + 36 + 104), 8, fill=PAL["surface"], outline=PAL["line"], width=SCALE)
rr(d, (40, y, 560, y + 36), 8, fill=PAL["subtle"]); d.line([(S(40), S(y + 36)), (S(560), S(y + 36))], fill=PAL["line"], width=SCALE)
rr(d, (50, y + 11, 64, y + 25), 3, fill=PAL["excel"]); text(d, (70, y + 11), "市场预算.xlsx", 12, PAL["muted"])
rr(d, (200, y + 9, 274, y + 27), 9, fill=PAL["accent"]); text(d, (208, y + 12), "预算总览", 10, PAL["on_accent"])
icon_tab(d, 498, y + 9); icon_external(d, 526, y + 9)
compose(img, sheet_layer((48, y + 44, 552, y + 44 + 82), ROWS[:3]))
y += 36 + 104
rr(d, (40, y, 560, y + 36 + 96), 8, fill=PAL["surface"], outline=PAL["line"], width=SCALE)
rr(d, (40, y, 560, y + 36), 8, fill=PAL["subtle"]); d.line([(S(40), S(y + 36)), (S(560), S(y + 36))], fill=PAL["line"], width=SCALE)
rr(d, (50, y + 11, 64, y + 25), 3, fill=PAL["word"]); text(d, (70, y + 11), "项目需求说明书.docx", 12, PAL["muted"])
icon_tab(d, 498, y + 9); icon_external(d, 526, y + 9)
compose(img, page_layer((46, y + 44, 554, y + 44 + 84), "项目概述", ["项目采用两轮灰度发布策略，先在 500 人内测群验证核心链路。"], 1))
save_png("static-mixed-embeds.png", img)

# 元素单提取
img = window_base("产品周报")
d = ImageDraw.Draw(img)
mixed_text(d, (40, 92), "![[活动页.html#hero]]", 12, PAL["ink"])
rr(d, (40, 118, 560, 118 + 36 + 130), 8, fill=PAL["surface"], outline=PAL["line"], width=SCALE)
rr(d, (40, 118, 560, 154), 8, fill=PAL["subtle"]); d.line([(S(40), S(154)), (S(560), S(154))], fill=PAL["line"], width=SCALE)
rr(d, (50, 129, 64, 143), 3, fill=PAL["html"]); text(d, (70, 129), "活动页.html", 12, PAL["muted"])
rr(d, (178, 127, 262, 145), 9, fill=PAL["accent"]); text(d, (186, 130), "定位 #hero", 10, PAL["on_accent"])
icon_tab(d, 498, 127)
icon_external(d, 526, 127)
hx0, hy0, hx1, hy1 = S(46), S(160), S(554), S(278)
grad = hgrad(hx1 - hx0, hy1 - hy0, PAL["slide_a"], PAL["slide_b"], r=4 * SCALE)
d._image.alpha_composite(grad, (hx0, hy0))  # noqa: SLF001
text(d, (66, 172), "LIVE · 2026.12.02", 10, (255, 255, 255))
text(d, (66, 194), "冬季新品发布会", 17, (255, 255, 255), bold=True)
text(d, (66, 226), "Any Viewer v2.0 首次公开：全新的预览引擎。", 11, (255, 255, 255))
save_png("static-element-extract.png", img)

# 标签页填充
img = window_base("项目需求说明书.docx")
d = ImageDraw.Draw(img)
rr(d, (1, 71, W - 1, 107), 8, fill=PAL["subtle"])
d.line([(S(1), S(107)), (S(W - 1), S(107))], fill=PAL["line"], width=SCALE)
rr(d, (328, 83, 342, 97), 3, fill=PAL["word"])
text(d, (350, 85), "项目需求说明书.docx", 12, PAL["muted"])
text(d, (W - 110, 85), "↗   ⟳", 12, PAL["muted"], anchor="ra")
compose(img, page_layer((16, 114, 904, 556), "项目概述", [
    "项目采用两轮灰度发布策略，先在 500 人内测群验证核心链路，再逐步扩大到 5% 全量用户。",
    "灰度期间重点收集崩溃率、同步成功率与编辑延迟三项核心指标；任一指标连续两天劣化即暂停放量并回滚。",
    "支持最多 20 人同时编辑同一篇文档，协作者光标与选区实时可见；段落级锁机制避免编辑冲突。",
    "断网时编辑内容自动落盘本地草稿，恢复联网后按段落合并；冲突段落提供双方版本对比。",
    "同步成功率 ≥ 99.9%，灰度阶段目标放宽到 99.5%；移动端冷启动 ≤ 1.2s，编辑延迟 P95 ≤ 200ms。",
], 1))
save_png("static-tab-fill.png", img)

print("done →", OUT)
