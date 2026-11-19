# Generate animated GIF demos for the v0.6 README (T6.2 示意图).
#
# Draws the Any Viewer visual language (styles.css dark tokens) frame by frame
# with Pillow — no browser or screen recording needed. Outputs into
# promo/assets/. Rerun after visual changes: python3 make_demo_gifs.py
#
# Frames are drawn at 2x and downscaled for smooth text; each GIF loops.
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent / "assets"
OUT.mkdir(parents=True, exist_ok=True)

# logical canvas (downscaled output), draw at SCALE for crisp text
W, H, SCALE = 920, 600, 2
PAL = {
    "canvas": (23, 25, 29), "surface": (28, 31, 36), "subtle": (35, 38, 45),
    "line": (52, 57, 67), "ink": (229, 231, 235), "muted": (167, 175, 187),
    "faint": (127, 136, 149), "accent": (139, 132, 232), "on_accent": (23, 25, 29),
    "paper": (255, 255, 255), "page_ink": (32, 36, 45), "page_line": (232, 234, 241),
    "stripe": (247, 248, 252), "th": (238, 240, 255), "grid": (213, 216, 228),
    "word": (122, 176, 255), "excel": (94, 212, 154), "ppt": (201, 99, 43), "html": (22, 134, 155),
    "slide_a": (109, 74, 255), "slide_b": (154, 107, 255), "slide_c": (199, 184, 255),
}
CSS = {
    "t_tag": (122, 162, 247), "t_attr": (187, 154, 247), "t_str": (158, 206, 106),
    "t_com": (86, 95, 137), "t_pn": (86, 95, 137),
}

_font_cache: dict = {}


def font(size: int, mono: bool = False):
    key = (size, mono)
    if key not in _font_cache:
        candidates = (
            ["/System/Library/Fonts/Menlo.ttc", "/System/Library/Fonts/Monaco.ttf"]
            if mono
            else ["/System/Library/Fonts/PingFang.ttc", "/System/Library/Fonts/Hiragino Sans GB.ttc", "/System/Library/Fonts/STHeiti Medium.ttc"]
        )
        for cand in candidates:
            try:
                _font_cache[key] = ImageFont.truetype(cand, size * SCALE)
                return _font_cache[key]
            except OSError:
                continue
        _font_cache[key] = ImageFont.load_default()
    return _font_cache[key]


def rr(d: ImageDraw.ImageDraw, xy, r, **kw):
    d.rounded_rectangle([v * SCALE for v in xy], radius=r * SCALE, **kw)


def text(d: ImageDraw.ImageDraw, xy, s, size, color, mono=False, anchor="la"):
    d.text((xy[0] * SCALE, xy[1] * SCALE), s, font=font(size, mono), fill=color, anchor=anchor)


def hgrad(w: int, h: int, c1, c2):
    # build a 1px row and STRETCH it vertically (same-size resize is identity!)
    row = Image.new("RGB", (max(1, w), 1))
    px = row.load()
    for x in range(row.width):
        t = x / max(1, row.width - 1)
        px[x, 0] = tuple(round(a + (b - a) * t) for a, b in zip(c1, c2))
    return row.resize((max(1, w), max(1, h)))


def mixed_text(d: ImageDraw.ImageDraw, xy, s, size, color, mono=True):
    """Draw mixed ASCII/CJK runs: mono font has no CJK glyphs — fall back per run."""
    x = xy[0]
    run, run_mono = "", None
    def flush():
        nonlocal x, run, run_mono
        if run:
            f = font(size, mono=bool(run_mono))
            d.text((x * SCALE, xy[1] * SCALE), run, font=f, fill=color)
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


# ---------------------------------------------------------------- window chrome
def new_frame() -> Image.Image:
    img = Image.new("RGB", (W * SCALE, H * SCALE), (16, 17, 20))
    d = ImageDraw.Draw(img)
    rr(d, (0, 0, W, H), 10, fill=PAL["canvas"], outline=PAL["line"], width=1)
    rr(d, (1, 1, W - 2, 35), 9, fill=PAL["surface"])
    d.line([(1 * SCALE, 36 * SCALE), ((W - 1) * SCALE, 36 * SCALE)], fill=PAL["line"], width=SCALE)
    for i, c in enumerate(((255, 95, 87), (254, 188, 46), (40, 200, 64))):
        d.ellipse([(16 + i * 18) * SCALE, 13 * SCALE, (27 + i * 18) * SCALE, 24 * SCALE], fill=c)
    text(d, (80, 12), "1-Projects / demo-assets", 11, PAL["muted"])
    d.line([(1 * SCALE, 71 * SCALE), ((W - 1) * SCALE, 71 * SCALE)], fill=PAL["line"], width=SCALE)
    rr(d, (1, 36, W - 2, 70), 8, fill=PAL["surface"])
    return img


def tabs(img: Image.Image, active: str):
    d = ImageDraw.Draw(img)
    text(d, (24, 46), "产品周报", 12, PAL["ink"] if active == "产品周报" else PAL["muted"])
    text(d, (110, 46), "项目需求说明书.docx", 12, PAL["ink"] if active != "产品周报" else PAL["muted"])


# ---------------------------------------------------------------- content mocks
def pptx_slide(d: ImageDraw.ImageDraw, xy, small=False):
    x0, y0, x1, y1 = [v * SCALE for v in xy]
    grad = hgrad(x1 - x0, y1 - y0, PAL["slide_a"], PAL["slide_c"]).convert("RGB")
    mask = Image.new("L", grad.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, x1 - x0, y1 - y0], radius=(4 if small else 4) * SCALE, fill=255)
    d._image.paste(grad, (x0, y0), mask)  # noqa: SLF001 - draw target image access
    pad = 16 if small else 26
    tx, ty = x0 + pad * SCALE, y0 + pad * SCALE
    text(d, (tx / SCALE, ty / SCALE), "DATA · WEEK 46", 9 if small else 10, (255, 255, 255))
    text(d, (tx / SCALE, (ty + 20 * SCALE) / SCALE), "数据看板", 20 if small else 26, (255, 255, 255))
    text(d, (tx / SCALE, (ty + 52 * SCALE) / SCALE), "48,210 日活跃 · 4.8% 付费转化 · 87.4% 周留存", 11 if small else 13, (255, 255, 255))
    text(d, (tx / SCALE, (ty + 76 * SCALE) / SCALE), "DAU ▲ 6.2%   转化 ▲ 0.3pt   留存 ▼ 1.5pt", 10 if small else 11, (255, 255, 255))


def embed_card(img: Image.Image, xy, icon: tuple, title: str, badge: str | None, stage_draw, stage_h):
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = xy
    rr(d, xy, 8, fill=PAL["surface"], outline=PAL["line"], width=1)
    rr(d, (x0, y0, x1, y0 + 36), 8, fill=PAL["subtle"])
    d.line([(x0 * SCALE, (y0 + 36) * SCALE), (x1 * SCALE, (y0 + 36) * SCALE)], fill=PAL["line"], width=SCALE)
    rr(d, (x0 + 10, y0 + 11, x0 + 24, y0 + 25), 3, fill=icon)
    text(d, (x0 + 30, y0 + 11), title, 12, PAL["muted"])
    bx = x0 + 30 + len(title) * 12 + 10
    if badge:
        bw = len(badge) * 6.2 + 16
        rr(d, (bx, y0 + 9, bx + bw, y0 + 27), 9, fill=PAL["accent"])
        text(d, (bx + 8, y0 + 12), badge, 10, PAL["on_accent"])
    for i, g in enumerate(("⇥", "↗")):
        text(d, (x1 - 64 + i * 30, y0 + 10), g, 13, PAL["muted"])
    stage_draw(d, (x0, y0 + 36, x1, y0 + 36 + stage_h))
    return y0 + 36 + stage_h


def docx_page(d: ImageDraw.ImageDraw, xy, heading, line_widths, clip_h=None):
    x0, y0, x1, y1 = xy
    h = y1 - y0
    rr(d, (x0 + 8, y0, x1 - 8, y1), 2, fill=PAL["paper"])
    if clip_h:
        d.rectangle([(x0 + 8) * SCALE, (y0 + clip_h) * SCALE, (x1 - 8) * SCALE, y1 * SCALE], fill=PAL["surface"])
    text(d, (x0 + 24, y0 + 14), heading, 14, (79, 70, 229))
    y = y0 + 42
    for w in line_widths:
        rr(d, (x0 + 24, y, x0 + 24 + (x1 - x0 - 64) * w, y + 8), 3, fill=PAL["page_line"])
        y += 16
    d.line([(x0 * SCALE, y1 * SCALE), (x1 * SCALE, y1 * SCALE)], fill=PAL["canvas"], width=SCALE * 3)


def sheet(d: ImageDraw.ImageDraw, xy, rows, highlight_row=None):
    x0, y0, x1, _ = xy
    col_w = [150, 110, 110]
    y = y0
    for r, row in enumerate(rows):
        x = x0
        for c, cell in enumerate(row):
            w = col_w[c] if c < len(col_w) else 110
            fill = PAL["th"] if r == 0 else (PAL["stripe"] if r % 2 == 0 else PAL["paper"])
            d.rectangle([x * SCALE, y * SCALE, (x + w) * SCALE, (y + 26) * SCALE], fill=fill, outline=PAL["grid"], width=SCALE)
            color = (220, 38, 38) if (highlight_row is not None and r == highlight_row and c == len(row) - 1) else PAL["page_ink"]
            text(d, (x + 8, y + 6), cell, 11, color)
            x += w
        y += 26
    return y


def search_bar(d: ImageDraw.ImageDraw, query: str, count: str):
    rr(d, (260, 12, 660, 52), 10, fill=PAL["surface"], outline=PAL["line"], width=1)
    d.ellipse([276 * SCALE, 24 * SCALE, 290 * SCALE, 38 * SCALE], outline=PAL["faint"], width=SCALE)
    d.line([(288 * SCALE, 36 * SCALE), (293 * SCALE, 41 * SCALE)], fill=PAL["faint"], width=SCALE)
    text(d, (300, 18), query, 12, PAL["ink"])
    if not query:
        text(d, (300, 18), "查找…", 12, PAL["faint"])
    if count:
        text(d, (610, 22), count, 11, PAL["muted"])
    for sym, dx in (("↑", 0), ("↓", 26), ("✕", 52)):
        text(d, (672 + dx, 20), sym, 12, PAL["muted"], anchor="ra")


def outline_panel(d: ImageDraw.ImageDraw, active_text: str | None):
    rr(d, (0, 71, 210, H), 8, fill=PAL["surface"])
    d.line([(210 * SCALE, 71 * SCALE), (210 * SCALE, H * SCALE)], fill=PAL["line"], width=SCALE)
    text(d, (14, 82), "大纲", 12, PAL["muted"])
    text(d, (196, 82), "‹", 13, PAL["muted"], anchor="ra")
    d.line([(0, 106 * SCALE), (210 * SCALE, 106 * SCALE)], fill=PAL["line"], width=SCALE)
    items = [("项目概述", 0, 1), ("功能需求", 8, 2), ("多人文档编辑", 24, 2), ("离线草稿", 24, 2), ("非功能需求", 8, 3), ("里程碑与排期", 0, 4), ("风险与对策", 0, 5)]
    y = 114
    for label, indent, page in items:
        if label == active_text:
            rr(d, (6, y - 3, 204, y + 20), 5, fill=(90, 84, 168))
        text(d, (14 + indent, y), label, 12, PAL["ink"])
        text(d, (196, y), str(page), 11, PAL["faint"], anchor="ra")
        y += 27


def markdown_line(d: ImageDraw.ImageDraw, xy, s, caret_at_end=False, partial=None):
    shown = s if partial is None else s[:partial]
    width = sum((7.4 if c.isascii() else 13.5) for c in shown)
    rr(d, (xy[0], xy[1] - 4, xy[0] + 12 + width, xy[1] + 26), 6, fill=PAL["subtle"], outline=PAL["line"], width=SCALE)
    mixed_text(d, (xy[0] + 8, xy[1] + 2), shown, 12, PAL["ink"])
    if caret_at_end:
        x = xy[0] + 10 + width
        d.rectangle([x * SCALE, (xy[1] + 2) * SCALE, (x + 2) * SCALE, (xy[1] + 17) * SCALE], fill=PAL["accent"])


def fade(img_a: Image.Image, img_b: Image.Image, t: float) -> Image.Image:
    return Image.blend(img_a, img_b, t)


def save_gif(name: str, frames: list[Image.Image], durations: list[int]):
    frames = [f.resize((W, H), Image.LANCZOS).convert("P", palette=Image.ADAPTIVE, colors=128) for f in frames]
    frames[0].save(OUT / name, save_all=True, append_images=frames[1:], duration=durations, loop=0, disposal=2)
    size = (OUT / name).stat().st_size
    print(f"{name:28s} {len(frames):2d} frames {size:>8,d} B")


# ================================================================ GIF 1 片段语法
frames, durs = [], []
SRC = "![[发布计划.pptx#page=3|420]]"
for shown in (6, 14, len(SRC)):
    img = new_frame(); tabs(img, "产品周报")
    d = ImageDraw.Draw(img)
    text(d, (40, 100), "## 本周材料", 13, PAL["muted"])
    markdown_line(d, (40, 130), SRC, caret_at_end=True, partial=shown)
    frames.append(img); durs.append(260)
img = new_frame(); tabs(img, "产品周报")
d = ImageDraw.Draw(img)
text(d, (40, 100), "## 本周材料", 13, PAL["muted"])
markdown_line(d, (40, 130), SRC, caret_at_end=False)
embed_card(img, (40, 170, 470, 170 + 36 + 170), PAL["ppt"], "发布计划.pptx", None, lambda dd, xy: pptx_slide(dd, (xy[0] + 6, xy[1] + 6, xy[2] - 6, xy[3] - 6), small=True), 170)
frames.append(img); durs.append(420)
img_a = img.copy()
img = new_frame(); tabs(img, "产品周报")
d = ImageDraw.Draw(img)
text(d, (40, 100), "## 本周材料", 13, PAL["muted"])
markdown_line(d, (40, 130), SRC, caret_at_end=False)
embed_card(img, (40, 170, 470, 170 + 36 + 170), PAL["ppt"], "发布计划.pptx", "第 3 页", lambda dd, xy: pptx_slide(dd, (xy[0] + 6, xy[1] + 6, xy[2] - 6, xy[3] - 6), small=True), 170)
frames.append(img); durs.append(1500)
img_b = img.copy()
frames.append(fade(img_a, img_b, 0.5)); durs.append(120)
save_gif("demo-fragment.gif", frames, durs)

# ================================================================ GIF 2 预览内搜索
ROWS = [["指标", "本周", "环比"], ["日活跃用户", "48,210", "▲ 6.2%"], ["付费转化率", "4.8%", "▲ 0.3pt"], ["周留存", "87.4%", "▼ 1.5pt"]]
def doc_frame(search_state):
    img = new_frame(); tabs(img, "产品周报")
    d = ImageDraw.Draw(img)
    if search_state:
        query, count, cur = search_state
        search_bar(d, "灰度" if query else "", count)
    docx_page(d, (40, 100, 880, 250), "项目概述", [1, .8])
    if search_state:
        text(d, (64, 150), "项目采用两轮灰度发布策略，先在 500 人内测群验证核心链路。", 12, PAL["page_ink"])
    docx_page(d, (40, 268, 880, 420), "里程碑与排期", [0.8, 1])
    if search_state:
        text(d, (64, 318), "01-05 首轮灰度放量；01-20 二轮灰度并全量开放。", 12, PAL["page_ink"])
    return img
frames, durs = [], []
frames.append(doc_frame(None)); durs.append(400)
frames.append(doc_frame((True, "", 0))); durs.append(500)
img = new_frame(); tabs(img, "产品周报"); d = ImageDraw.Draw(img)
search_bar(d, "灰度", "1 / 4")
docx_page(d, (40, 100, 880, 250), "项目概述", [1, .8])
text(d, (64, 150), "项目采用两轮 ", 12, PAL["page_ink"])
w = d.textlength("项目采用两轮 ", font=font(12)) / SCALE
text(d, (64 + w, 150), "灰度", 12, (255, 255, 255))
rr(d, ((64 + w) * SCALE, 149 * SCALE, (64 + w + 26) * SCALE, 167 * SCALE), 2, fill=PAL["accent"])
text(d, (64 + w + 28, 150), "发布策略，先在 500 人内测群验证核心链路。", 12, PAL["page_ink"])
docx_page(d, (40, 268, 880, 420), "里程碑与排期", [0.8, 1])
text(d, (64, 318), "01-05 首轮灰度放量；01-20 二轮灰度并全量开放。", 12, PAL["page_ink"])
frames.append(img); durs.append(700)
img = new_frame(); tabs(img, "产品周报"); d = ImageDraw.Draw(img)
search_bar(d, "灰度", "3 / 4")
docx_page(d, (40, 100, 880, 250), "项目概述", [1, .8])
text(d, (64, 150), "项目采用两轮灰度发布策略，先在 500 人内测群验证核心链路。", 12, PAL["page_ink"])
docx_page(d, (40, 268, 880, 420), "里程碑与排期", [0.8, 1])
text(d, (64, 318), "01-05 首轮", 12, PAL["page_ink"])
w = d.textlength("01-05 首轮", font=font(12)) / SCALE
rr(d, ((64 + w) * SCALE, 317 * SCALE, (64 + w + 26) * SCALE, 335 * SCALE), 2, fill=PAL["accent"])
text(d, (64 + w + 2, 318), "灰度", 12, (255, 255, 255))
text(d, (64 + w + 30, 318), "放量；01-20 二轮灰度并全量开放。", 12, PAL["page_ink"])
frames.append(img); durs.append(1400)
save_gif("demo-search.gif", frames, durs)

# ================================================================ GIF 3 大纲 + 位置记忆
def outline_frame(active, scroll, with_panel=True):
    img = new_frame(); tabs(img, "项目需求说明书.docx")
    d = ImageDraw.Draw(img)
    if with_panel:
        outline_panel(d, active)
    ox = 226 if with_panel else 40
    clip_top, clip_bottom = 100, 560
    d.rounded_rectangle([ox * SCALE, clip_top * SCALE, (W - 40) * SCALE, clip_bottom * SCALE], radius=2 * SCALE, fill=PAL["paper"])
    y = clip_top + 14 - scroll
    pages = [("项目概述", 3), ("功能需求", 4), ("非功能需求", 3), ("里程碑与排期", 3), ("风险与对策", 2)]
    for heading, lines in pages:
        text(d, (ox + 24, y), heading, 14, (79, 70, 229))
        y += 30
        for w in range(lines):
            lw = (W - ox - 90) * (0.7 if w % 2 else 1.0)
            rr(d, (ox + 24, y, ox + 24 + lw, y + 8), 3, fill=PAL["page_line"])
            y += 18
        y += 14
        if y > clip_bottom:
            break
    d.rectangle([ox * SCALE, clip_top * SCALE, (W - 40) * SCALE, (clip_top + 8) * SCALE], fill=PAL["canvas"])
    d.rectangle([ox * SCALE, (clip_bottom - 8) * SCALE, (W - 40) * SCALE, clip_bottom * SCALE], fill=PAL["canvas"])
    return img
frames, durs = [], []
frames.append(outline_frame(None, 0, with_panel=False)); durs.append(400)
frames.append(outline_frame(None, 0)); durs.append(600)
frames.append(outline_frame("非功能需求", 205)); durs.append(800)
frames.append(outline_frame("里程碑与排期", 400)); durs.append(1400)
save_gif("demo-outline.gif", frames, durs)

# ================================================================ GIF 4 Style Settings
def ss_frame(knob_pct, header_h, label):
    img = new_frame(); tabs(img, "产品周报")
    d = ImageDraw.Draw(img)
    rr(d, (14, 90, 300, 560), 8, fill=PAL["surface"])
    d.line([(300 * SCALE, 90 * SCALE), (300 * SCALE, 560 * SCALE)], fill=PAL["line"], width=SCALE)
    text(d, (30, 104), "Any Viewer", 13, PAL["ink"])
    text(d, (30, 140), "标题栏高度", 12, PAL["ink"])
    text(d, (280, 138), label, 13, PAL["accent"], anchor="ra")
    rr(d, (30, 168, 284, 172), 2, fill=PAL["line"])
    d.ellipse([(14 + 254 * knob_pct) * SCALE - 7 * SCALE, 163 * SCALE, (14 + 254 * knob_pct) * SCALE + 7 * SCALE, 177 * SCALE], fill=PAL["accent"])
    text(d, (30, 196), "工具栏按钮尺寸", 12, PAL["muted"]); text(d, (280, 196), "28", 12, PAL["muted"], anchor="ra")
    text(d, (30, 226), "内容内边距", 12, PAL["muted"]); text(d, (280, 226), "12", 12, PAL["muted"], anchor="ra")
    text(d, (30, 500), "样式由 Style Settings 注入，实时生效", 11, PAL["faint"])
    rr(d, (316, 100, 900, 100 + header_h), 8, fill=PAL["subtle"], outline=PAL["line"], width=1)
    rr(d, (326, 100 + header_h // 2 - 7, 340, 100 + header_h // 2 + 7), 3, fill=PAL["word"])
    text(d, (350, 100 + header_h // 2 - 8), "产品周报.docx", 12, PAL["muted"])
    sheet(d, (330, 120 + header_h, 890, 560), ROWS)
    return img
frames, durs = [], []
frames.append(ss_frame(0.18, 36, "36")); durs.append(500)
frames.append(ss_frame(0.18, 36, "36")); durs.append(150)
frames.append(ss_frame(0.62, 28, "28")); durs.append(700)
frames.append(ss_frame(0.92, 48, "48")); durs.append(700)
frames.append(ss_frame(0.62, 28, "28")); durs.append(900)
save_gif("demo-style-settings.gif", frames, durs)

# ================================================================ GIF 5 HTML 源码切换
def html_frame(source: bool):
    img = new_frame(); tabs(img, "活动页.html")
    d = ImageDraw.Draw(img)
    embed_card(img, (40, 100, 880, 100 + 36 + 380), PAL["html"], "活动页.html", "定位 #hero", lambda dd, xy: None, 380)
    if not source:
        x0, y0, x1, y1 = 46, 142, 874, 516
        grad = hgrad(x1 - x0, 180, PAL["slide_a"], PAL["slide_b"]).convert("RGB")
        d._image.paste(grad, (x0, y0))  # noqa: SLF001
        text(d, (70, y0 / SCALE + 24), "LIVE · 2026.12.02", 11, (255, 255, 255))
        text(d, (70, y0 / SCALE + 58), "冬季新品发布会", 24, (255, 255, 255))
        text(d, (70, y0 / SCALE + 106), "Any Viewer v2.0 首次公开：全新的预览引擎、更完整的样式还原，", 13, (255, 255, 255))
        text(d, (70, y0 / SCALE + 128), "以及为长文档准备的性能重构。线上直播，全程回放。", 13, (255, 255, 255))
    else:
        y = 152
        lines = [
            [("t_pn", "<!DOCTYPE html>")],
            [("t_pn", "<"), ("t_tag", "html"), ("t_attr", " lang"), ("t_pn", "="), ("t_str", '"zh-CN"'), ("t_pn", ">")],
            [("t_pn", "<"), ("t_tag", "style"), ("t_pn", ">")],
            [("t_com", "  /* 发布会 hero 区块 */")],
            [("t_pn", "  "), ("t_tag", ".hero"), ("t_pn", " {")],
            [("t_attr", "    background"), ("t_pn", ": "), ("t_str", "linear-gradient(135deg,#6d4aff,#9a6bff)"), ("t_pn", ";")],
            [("t_attr", "    color"), ("t_pn", ": "), ("t_str", "#fff"), ("t_pn", ";")],
            [("t_pn", "  }")],
            [("t_pn", "</"), ("t_tag", "style"), ("t_pn", ">")],
            [("t_pn", "<"), ("t_tag", "body"), ("t_pn", ">")],
            [("t_pn", "  <"), ("t_tag", "section"), ("t_attr", " class"), ("t_pn", "="), ("t_str", '"hero"'), ("t_attr", " id"), ("t_pn", "="), ("t_str", '"hero"'), ("t_pn", ">")],
        ]
        for line in lines:
            x = 64
            for cls, s in line:
                x = mixed_text(d, (x, y), s, 12, CSS[cls])
            y += 22
    return img
frames, durs = [], []
frames.append(html_frame(False)); durs.append(700)
frames.append(html_frame(False)); durs.append(200)
frames.append(html_frame(True)); durs.append(1600)
save_gif("demo-html-source.gif", frames, durs)

# ================================================================ static PNGs (静态场景直接出图)
def save_png(name: str, img: Image.Image):
    img.resize((W, H), Image.LANCZOS).save(OUT / name)
    print(f"{name:28s} {(OUT / name).stat().st_size:>8,d} B")

# 多格式混排：一篇笔记里 docx / xlsx / pptx / html 四种嵌入
img = new_frame(); tabs(img, "产品周报")
d = ImageDraw.Draw(img)
text(d, (40, 92), "## 本周材料", 13, PAL["muted"])
y = 118
y = embed_card(img, (40, y, 560, y + 36 + 120), PAL["ppt"], "发布计划.pptx", "第 3 页", lambda dd, xy: pptx_slide(dd, (xy[0] + 5, xy[1] + 5, xy[2] - 5, xy[3] - 5), small=True), 120) + 10
def sheet_stage(dd, xy):
    sheet(dd, (xy[0] + 8, xy[1] + 8, xy[2] - 8, xy[3] - 8), ROWS[:2])
y = embed_card(img, (40, y, 560, y + 36 + 78), PAL["excel"], "市场预算.xlsx", "预算总览", sheet_stage, 78) + 10
y = embed_card(img, (40, y, 560, y + 36 + 96), PAL["word"], "项目需求说明书.docx", None, lambda dd, xy: docx_page(dd, (xy[0] + 6, xy[1] + 6, xy[2] - 6, min(xy[3], xy[1] + 90)), "项目概述", [1, .7]), 96)
save_png("static-mixed-embeds.png", img)

# 元素单提取：![[活动页.html#hero]] 只渲染 hero 区块
img = new_frame(); tabs(img, "产品周报")
d = ImageDraw.Draw(img)
def hero_stage(dd, xy):
    x0, y0, x1, y1 = [v * SCALE for v in (xy[0] + 5, xy[1] + 5, xy[2] - 5, xy[3] - 5)]
    grad = hgrad(x1 - x0, y1 - y0, PAL["slide_a"], PAL["slide_b"]).convert("RGB")
    dd._image.paste(grad, (int(x0), int(y0)))  # noqa: SLF001
    text(dd, ((x0 + 20 * SCALE) / SCALE, (y0 + 16 * SCALE) / SCALE), "LIVE · 2026.12.02", 10, (255, 255, 255))
    text(dd, ((x0 + 20 * SCALE) / SCALE, (y0 + 40 * SCALE) / SCALE), "冬季新品发布会", 18, (255, 255, 255))
    text(dd, ((x0 + 20 * SCALE) / SCALE, (y0 + 74 * SCALE) / SCALE), "Any Viewer v2.0 首次公开：全新的预览引擎。", 11, (255, 255, 255))
mixed_text(d, (40, 92), "![[活动页.html#hero]]", 12, PAL["ink"])
embed_card(img, (40, 118, 560, 118 + 36 + 130), PAL["html"], "活动页.html", "定位 #hero", hero_stage, 130)
save_png("static-element-extract.png", img)

# 标签页填充：内容顶格无外框
img = new_frame(); tabs(img, "项目需求说明书.docx")
d = ImageDraw.Draw(img)
rr(d, (1, 71, W - 1, 107), 8, fill=PAL["subtle"])
d.line([(1 * SCALE, 107 * SCALE), ((W - 1) * SCALE, 107 * SCALE)], fill=PAL["line"], width=SCALE)
rr(d, (326, 82, 340, 96), 3, fill=PAL["word"])
text(d, (348, 84), "项目需求说明书.docx", 12, PAL["muted"])
text(d, (W - 100, 84), "↗   ⟳", 13, PAL["muted"], anchor="ra")
docx_page(d, (20, 115, 900, 400), "项目概述", [1, .85, .7, 1, .8])
save_png("static-tab-fill.png", img)

print("done →", OUT)
