from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "output" / "pdf" / "propuestas-redisenio"
RENDER_DIR = ROOT / "tmp" / "pdfs" / "propuestas-redisenio"
PAGE_W, PAGE_H = A4
TOTAL_PAGES = 4


def register_fonts() -> None:
    candidates = {
        "SC-Regular": Path("C:/Windows/Fonts/segoeui.ttf"),
        "SC-Bold": Path("C:/Windows/Fonts/segoeuib.ttf"),
        "SC-Semibold": Path("C:/Windows/Fonts/seguisb.ttf"),
        "SC-Mono": Path("C:/Windows/Fonts/consola.ttf"),
    }
    fallbacks = {
        "SC-Regular": "Helvetica",
        "SC-Bold": "Helvetica-Bold",
        "SC-Semibold": "Helvetica-Bold",
        "SC-Mono": "Courier",
    }
    for name, path in candidates.items():
        if path.exists():
            pdfmetrics.registerFont(TTFont(name, str(path)))
        else:
            pdfmetrics.registerFont(TTFont(name, str(Path("C:/Windows/Fonts/arial.ttf"))))
    # Kept for documentation and for environments where registered aliases are inspected.
    _ = fallbacks


@dataclass(frozen=True)
class Theme:
    slug: str
    name: str
    style: str
    primary: Color
    deep: Color
    accent: Color
    paper: Color
    surface: Color
    ink: Color
    muted: Color
    line: Color
    success: Color


THEMES = [
    Theme(
        "propuesta-1-dashboard",
        "Dashboard ejecutivo",
        "dashboard",
        HexColor("#157A55"), HexColor("#0B3D2A"), HexColor("#153E75"),
        HexColor("#F6F8F7"), white, HexColor("#17211B"), HexColor("#66736B"),
        HexColor("#D6E0D9"), HexColor("#21835A"),
    ),
    Theme(
        "propuesta-2-academica",
        "Academica paso a paso",
        "academic",
        HexColor("#176B45"), HexColor("#123F2B"), HexColor("#B77816"), HexColor("#FBF8EF"),
        HexColor("#FFFDF7"), HexColor("#1D2620"), HexColor("#667066"), HexColor("#D9D0B9"),
        HexColor("#2E7D55"),
    ),
    Theme(
        "propuesta-3-lamina-visual",
        "Lamina visual anotada",
        "plate",
        HexColor("#0D6B4C"), HexColor("#0D2630"), HexColor("#D18B1D"), HexColor("#F3F7F6"),
        HexColor("#FFFFFF"), HexColor("#11232A"), HexColor("#607179"), HexColor("#B9CBD0"),
        HexColor("#138A5B"),
    ),
    Theme(
        "propuesta-4-profesional",
        "Informe profesional verificable",
        "professional",
        HexColor("#075B35"), HexColor("#043A24"), HexColor("#7DAA55"), HexColor("#F4F7F2"),
        HexColor("#FFFFFF"), HexColor("#18221B"), HexColor("#657268"), HexColor("#C9D7CC"),
        HexColor("#0D7A46"),
    ),
]


AXIAL = HexColor("#1769AA")
SHEAR = HexColor("#16804D")
MOMENT = HexColor("#D43F3A")
LOAD = HexColor("#6A4AA1")
DIMENSION = HexColor("#A46E0B")
GRID = HexColor("#E3EAE6")


def set_alpha(c: canvas.Canvas, fill: float | None = None, stroke: float | None = None) -> None:
    try:
        if fill is not None:
            c.setFillAlpha(fill)
        if stroke is not None:
            c.setStrokeAlpha(stroke)
    except AttributeError:
        pass


def reset_alpha(c: canvas.Canvas) -> None:
    set_alpha(c, 1, 1)


def rect(c: canvas.Canvas, x: float, y: float, w: float, h: float, fill: Color, stroke: Color | None = None, radius: float = 8, width: float = 0.8) -> None:
    c.setFillColor(fill)
    c.setStrokeColor(stroke or fill)
    c.setLineWidth(width)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1 if stroke else 0)


def line(c: canvas.Canvas, x1: float, y1: float, x2: float, y2: float, color: Color, width: float = 1, dash: Iterable[float] | None = None) -> None:
    c.setStrokeColor(color)
    c.setLineWidth(width)
    c.setDash(list(dash) if dash else [])
    c.line(x1, y1, x2, y2)
    c.setDash([])


def text(c: canvas.Canvas, value: str, x: float, y: float, size: float = 9, color: Color = HexColor("#17211B"), font: str = "SC-Regular", align: str = "left") -> None:
    c.setFont(font, size)
    c.setFillColor(color)
    if align == "center":
        c.drawCentredString(x, y, value)
    elif align == "right":
        c.drawRightString(x, y, value)
    else:
        c.drawString(x, y, value)


def wrap_lines(value: str, max_width: float, size: float, font: str = "SC-Regular") -> list[str]:
    lines: list[str] = []
    for paragraph in value.split("\n"):
        words = paragraph.split()
        current = ""
        for word in words:
            candidate = f"{current} {word}".strip()
            if current and pdfmetrics.stringWidth(candidate, font, size) > max_width:
                lines.append(current)
                current = word
            else:
                current = candidate
        lines.append(current)
    return lines


def paragraph(c: canvas.Canvas, value: str, x: float, y: float, width: float, size: float = 8.5, leading: float | None = None, color: Color = HexColor("#17211B"), font: str = "SC-Regular") -> float:
    leading = leading or size * 1.35
    for item in wrap_lines(value, width, size, font):
        text(c, item, x, y, size, color, font)
        y -= leading
    return y


def arrow(c: canvas.Canvas, x1: float, y1: float, x2: float, y2: float, color: Color, width: float = 1.5, head: float = 5) -> None:
    import math

    line(c, x1, y1, x2, y2, color, width)
    angle = math.atan2(y2 - y1, x2 - x1)
    for delta in (2.55, -2.55):
        line(c, x2, y2, x2 + head * math.cos(angle + delta), y2 + head * math.sin(angle + delta), color, width)


def pill(c: canvas.Canvas, label: str, x: float, y: float, fill: Color, color: Color = white, w: float | None = None) -> float:
    w = w or max(46, pdfmetrics.stringWidth(label, "SC-Semibold", 7.5) + 18)
    rect(c, x, y, w, 19, fill, radius=9)
    text(c, label, x + w / 2, y + 6, 7.5, color, "SC-Semibold", "center")
    return w


def number_badge(c: canvas.Canvas, number: int, x: float, y: float, theme: Theme) -> None:
    c.setFillColor(theme.primary)
    c.circle(x, y, 9, fill=1, stroke=0)
    text(c, str(number), x, y - 3, 8, white, "SC-Bold", "center")


def header(c: canvas.Canvas, theme: Theme, title: str, page: int, section: str) -> None:
    c.setFillColor(theme.paper)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    if theme.style == "plate":
        c.setFillColor(theme.deep)
        c.rect(0, PAGE_H - 66, PAGE_W, 66, fill=1, stroke=0)
        rect(c, 28, PAGE_H - 49, 32, 32, theme.primary, radius=7)
        text(c, "S", 44, PAGE_H - 40, 19, white, "SC-Bold", "center")
        text(c, "structureCo", 72, PAGE_H - 35, 17, white, "SC-Bold")
        text(c, title.upper(), PAGE_W - 28, PAGE_H - 34, 12, white, "SC-Bold", "right")
        text(c, section, PAGE_W - 28, PAGE_H - 50, 7.5, HexColor("#C9E3DB"), "SC-Regular", "right")
    elif theme.style == "professional":
        c.setFillColor(theme.deep)
        c.rect(0, PAGE_H - 76, PAGE_W, 76, fill=1, stroke=0)
        text(c, "structureCo", 30, PAGE_H - 37, 18, white, "SC-Bold")
        text(c, "MEMORIA DE CALCULO", 30, PAGE_H - 57, 8, HexColor("#CFE5D7"), "SC-Semibold")
        text(c, title, PAGE_W - 30, PAGE_H - 36, 13, white, "SC-Bold", "right")
        text(c, f"HIBBELER 4-39  |  kip, ft  |  Pagina {page}/{TOTAL_PAGES}", PAGE_W - 30, PAGE_H - 56, 7.5, HexColor("#D9E8DE"), "SC-Regular", "right")
    else:
        c.setFillColor(theme.surface)
        c.rect(0, PAGE_H - 70, PAGE_W, 70, fill=1, stroke=0)
        rect(c, 28, PAGE_H - 51, 34, 34, theme.primary, radius=8)
        text(c, "S", 45, PAGE_H - 42, 20, white, "SC-Bold", "center")
        text(c, "structureCo", 74, PAGE_H - 35, 17, theme.deep, "SC-Bold")
        text(c, "ANALISIS ESTRUCTURAL", 74, PAGE_H - 51, 7, theme.muted, "SC-Semibold")
        text(c, title, PAGE_W - 28, PAGE_H - 35, 13, theme.deep, "SC-Bold", "right")
        text(c, section, PAGE_W - 28, PAGE_H - 52, 7.5, theme.muted, "SC-Regular", "right")
        line(c, 28, PAGE_H - 70, PAGE_W - 28, PAGE_H - 70, theme.line, 0.8)


def footer(c: canvas.Canvas, theme: Theme, page: int) -> None:
    line(c, 28, 35, PAGE_W - 28, 35, theme.line, 0.7)
    text(c, "structureCo - propuesta de redisenio PDF", 28, 20, 7, theme.muted)
    text(c, "Ejercicio Hibbeler 4-39 | Unidades: kip, ft", PAGE_W / 2, 20, 7, theme.muted, "SC-Regular", "center")
    text(c, f"{page} / {TOTAL_PAGES}", PAGE_W - 28, 20, 7, theme.muted, "SC-Semibold", "right")


def section_title(c: canvas.Canvas, theme: Theme, index: str, title_value: str, subtitle: str, y: float) -> None:
    if theme.style == "plate":
        rect(c, 28, y - 4, 34, 27, theme.deep, radius=3)
        text(c, index, 45, y + 4, 11, white, "SC-Bold", "center")
        text(c, title_value.upper(), 72, y + 6, 15, theme.deep, "SC-Bold")
        text(c, subtitle, 72, y - 8, 7.5, theme.muted)
    else:
        pill(c, index, 28, y - 2, theme.primary, w=30)
        text(c, title_value, 70, y + 3, 15, theme.deep, "SC-Bold")
        text(c, subtitle, 70, y - 11, 7.5, theme.muted)


def support_pin(c: canvas.Canvas, x: float, y: float, color: Color) -> None:
    c.setStrokeColor(color)
    c.setLineWidth(1.4)
    c.line(x, y, x - 11, y - 15)
    c.line(x, y, x + 11, y - 15)
    c.line(x - 13, y - 15, x + 13, y - 15)
    for offset in range(-10, 11, 5):
        c.line(x + offset, y - 15, x + offset - 4, y - 20)


def support_roller(c: canvas.Canvas, x: float, y: float, color: Color) -> None:
    support_pin(c, x, y, color)
    c.setFillColor(white)
    for offset in (-6, 6):
        c.circle(x + offset, y - 19, 2.5, fill=1, stroke=1)
    line(c, x - 15, y - 23, x + 15, y - 23, color, 1.2)


def frame_points(x: float, y: float, w: float, h: float) -> dict[str, tuple[float, float]]:
    return {
        "A": (x + w * 0.18, y + h * 0.15),
        "B": (x + w * 0.18, y + h * 0.78),
        "C": (x + w * 0.78, y + h * 0.78),
        "D": (x + w * 0.78, y + h * 0.15),
    }


def draw_base_frame(c: canvas.Canvas, x: float, y: float, w: float, h: float, color: Color, labels: bool = True, supports: bool = True) -> dict[str, tuple[float, float]]:
    pts = frame_points(x, y, w, h)
    c.setLineCap(1)
    for start, end in (("A", "B"), ("B", "C"), ("C", "D")):
        line(c, *pts[start], *pts[end], color, 3)
    if supports:
        support_pin(c, *pts["A"], color)
        support_roller(c, *pts["D"], color)
    c.setFillColor(white)
    c.setStrokeColor(color)
    for name, point in pts.items():
        c.circle(point[0], point[1], 3.4, fill=1, stroke=1)
        if labels:
            dx = -13 if name in ("A", "B") else 7
            dy = -2 if name in ("A", "D") else 7
            text(c, name, point[0] + dx, point[1] + dy, 8.5, color, "SC-Bold")
    return pts


def draw_dcl(c: canvas.Canvas, x: float, y: float, w: float, h: float, theme: Theme) -> None:
    pts = draw_base_frame(c, x, y, w, h, theme.ink)
    ax, ay = pts["A"]
    bx, by = pts["B"]
    cx, cy = pts["C"]
    dx, dy = pts["D"]
    # Distributed horizontal load on AB.
    for i in range(7):
        yy = ay + 18 + i * (by - ay - 30) / 6
        arrow(c, bx - 32, yy, bx - 4, yy, LOAD, 1.2, 4)
    text(c, "w_h = 0.60 kip/ft", bx - 44, by + 20, 7.5, LOAD, "SC-Semibold")
    # Distributed vertical load on BC.
    for i in range(9):
        xx = bx + 12 + i * (cx - bx - 24) / 8
        arrow(c, xx, by + 31, xx, by + 4, SHEAR, 1.2, 4)
    line(c, bx + 12, by + 31, cx - 12, by + 31, SHEAR, 1)
    text(c, "w_v = 0.80 kip/ft", (bx + cx) / 2, by + 39, 7.5, SHEAR, "SC-Semibold", "center")
    # Reactions.
    arrow(c, ax, ay, ax - 42, ay, AXIAL, 1.8, 6)
    text(c, "Ax = -9.60", ax - 46, ay + 8, 7.3, AXIAL, "SC-Semibold")
    arrow(c, ax, ay, ax, ay + 44, SHEAR, 1.8, 6)
    text(c, "Ay = 4.16", ax + 7, ay + 34, 7.3, SHEAR, "SC-Semibold")
    arrow(c, dx, dy, dx, dy + 52, SHEAR, 1.8, 6)
    text(c, "Dy = 11.84", dx + 7, dy + 42, 7.3, SHEAR, "SC-Semibold")
    # Dimensions.
    dim_y = ay - 38
    line(c, ax, dim_y, dx, dim_y, DIMENSION, 0.8)
    line(c, ax, dim_y - 4, ax, dim_y + 4, DIMENSION, 0.8)
    line(c, dx, dim_y - 4, dx, dim_y + 4, DIMENSION, 0.8)
    text(c, "20.00 ft", (ax + dx) / 2, dim_y + 5, 7.5, DIMENSION, "SC-Semibold", "center")
    dim_x = ax - 58
    line(c, dim_x, ay, dim_x, by, DIMENSION, 0.8)
    line(c, dim_x - 4, ay, dim_x + 4, ay, DIMENSION, 0.8)
    line(c, dim_x - 4, by, dim_x + 4, by, DIMENSION, 0.8)
    text(c, "16.00 ft", dim_x - 7, (ay + by) / 2, 7.5, DIMENSION, "SC-Semibold", "right")


def result_card(c: canvas.Canvas, x: float, y: float, w: float, label: str, value: str, color: Color, theme: Theme) -> None:
    rect(c, x, y, w, 56, theme.surface, theme.line, 8)
    c.setFillColor(color)
    c.rect(x, y, 4, 56, fill=1, stroke=0)
    text(c, label.upper(), x + 13, y + 37, 7, theme.muted, "SC-Semibold")
    text(c, value, x + 13, y + 15, 14, color, "SC-Bold")


def operation_row(c: canvas.Canvas, theme: Theme, number: int, title_value: str, equation: str, result: str, x: float, y: float, w: float, color: Color | None = None) -> None:
    color = color or theme.primary
    number_badge(c, number, x + 11, y + 12, theme)
    text(c, title_value.upper(), x + 29, y + 17, 7.2, theme.deep, "SC-Semibold")
    text(c, equation, x + 29, y + 3, 8.1, theme.ink, "SC-Mono")
    if result:
        tw = max(62, pdfmetrics.stringWidth(result, "SC-Semibold", 8) + 16)
        rect(c, x + w - tw, y - 1, tw, 22, Color(color.red, color.green, color.blue, alpha=0.09), color, 5)
        text(c, result, x + w - tw / 2, y + 6, 8, color, "SC-Semibold", "center")


def page_dcl(c: canvas.Canvas, theme: Theme) -> None:
    header(c, theme, "Hibbeler 4-39", 1, theme.name)
    section_title(c, theme, "01", "DCL global y equilibrio", "Modelo completo, cargas equivalentes y reacciones", PAGE_H - 105)
    card_w = (PAGE_W - 72) / 4
    labels = [("Ax", "-9.60 kip", AXIAL), ("Ay", "4.16 kip", SHEAR), ("Dy", "11.84 kip", SHEAR), ("M max", "87.616 kip-ft", MOMENT)]
    for i, item in enumerate(labels):
        result_card(c, 28 + i * (card_w + 5), PAGE_H - 188, card_w, *item, theme)
    rect(c, 28, 335, PAGE_W - 56, 292, theme.surface, theme.line, 10)
    text(c, "DCL GLOBAL", 42, 603, 9, theme.deep, "SC-Bold")
    draw_dcl(c, 46, 352, 390, 225, theme)
    rect(c, 445, 357, 108, 205, Color(theme.primary.red, theme.primary.green, theme.primary.blue, alpha=0.06), theme.line, 7)
    text(c, "CARGAS EQUIVALENTES", 455, 540, 7, theme.deep, "SC-Semibold")
    y = paragraph(c, "Horizontal en AB:\nR_H = w_h L\nR_H = 0.60(16)\nR_H = 9.60 kip\n\nActua a 8.00 ft sobre A.", 455, 523, 90, 7.2, 10, theme.ink, "SC-Regular")
    paragraph(c, "Vertical en BC:\nR_V = w_v L\nR_V = 0.80(20)\nR_V = 16.00 kip\n\nActua a 10.00 ft de B.", 455, y - 7, 90, 7.2, 10, theme.ink, "SC-Regular")
    rect(c, 28, 61, PAGE_W - 56, 252, theme.surface, theme.line, 10)
    text(c, "OPERACIONES DE EQUILIBRIO", 42, 290, 9, theme.deep, "SC-Bold")
    rows = [
        (1, "Resultante horizontal", "R_H = 0.60 x 16.00", "9.60 kip", AXIAL),
        (2, "Resultante vertical", "R_V = 0.80 x 20.00", "16.00 kip", SHEAR),
        (3, "Equilibrio horizontal", "Sum Fx = Ax + 9.60 = 0", "Ax = -9.60 kip", AXIAL),
        (4, "Momentos respecto de A", "20 Dy - 16(10) - 9.60(8) = 0", "Dy = 11.84 kip", SHEAR),
        (5, "Equilibrio vertical", "Sum Fy = Ay + 11.84 - 16.00 = 0", "Ay = 4.16 kip", SHEAR),
    ]
    yy = 255
    for number, title_value, equation, result, color in rows:
        operation_row(c, theme, number, title_value, equation, result, 42, yy, PAGE_W - 84, color)
        if number < len(rows):
            line(c, 42, yy - 8, PAGE_W - 42, yy - 8, theme.line, 0.45)
        yy -= 42
    footer(c, theme, 1)
    c.showPage()


def diagram_axes_note(c: canvas.Canvas, theme: Theme, color: Color, symbol: str, unit: str, y: float) -> None:
    rect(c, 420, y, 133, 62, Color(color.red, color.green, color.blue, alpha=0.06), theme.line, 7)
    text(c, f"{symbol} - CONVENCION", 432, y + 43, 7.5, color, "SC-Semibold")
    text(c, "positivo segun ejes locales", 432, y + 28, 7, theme.muted)
    text(c, f"Unidad: {unit}", 432, y + 13, 7.5, theme.ink, "SC-Semibold")


def draw_axial(c: canvas.Canvas, x: float, y: float, w: float, h: float, theme: Theme) -> None:
    pts = draw_base_frame(c, x, y, w, h, HexColor("#82918A"))
    ax, ay = pts["A"]; bx, by = pts["B"]; cx, cy = pts["C"]; dx, dy = pts["D"]
    set_alpha(c, fill=0.16)
    c.setFillColor(AXIAL)
    c.rect(ax - 30, ay, 22, by - ay, fill=1, stroke=0)
    c.rect(dx + 8, dy, 39, cy - dy, fill=1, stroke=0)
    reset_alpha(c)
    line(c, ax - 30, ay, ax - 30, by, AXIAL, 2)
    line(c, dx + 47, dy, dx + 47, cy, AXIAL, 2)
    text(c, "-4.16", ax - 35, (ay + by) / 2, 9, AXIAL, "SC-Bold", "right")
    text(c, "compresion", ax - 35, (ay + by) / 2 - 14, 6.8, theme.muted, "SC-Regular", "right")
    text(c, "-11.84", dx + 52, (dy + cy) / 2, 9, AXIAL, "SC-Bold")
    text(c, "compresion", dx + 52, (dy + cy) / 2 - 14, 6.8, theme.muted)
    line(c, bx + 10, by + 16, cx - 10, cy + 16, AXIAL, 1.5, [5, 4])
    text(c, "N_BC = 0", (bx + cx) / 2, by + 25, 8.2, AXIAL, "SC-Semibold", "center")


def draw_shear(c: canvas.Canvas, x: float, y: float, w: float, h: float, theme: Theme) -> None:
    pts = draw_base_frame(c, x, y, w, h, HexColor("#82918A"))
    ax, ay = pts["A"]; bx, by = pts["B"]; cx, cy = pts["C"]; dx, dy = pts["D"]
    # AB triangular diagram.
    p = c.beginPath(); p.moveTo(ax, ay); p.lineTo(ax - 48, ay); p.lineTo(bx, by); p.close()
    c.setFillColor(Color(SHEAR.red, SHEAR.green, SHEAR.blue, alpha=0.15)); c.setStrokeColor(SHEAR); c.setLineWidth(1.7); c.drawPath(p, fill=1, stroke=1)
    # BC piecewise linear diagram relative to the beam baseline.
    zero_x = bx + (cx - bx) * (5.2 / 20)
    p = c.beginPath(); p.moveTo(bx, by); p.lineTo(bx, by + 33); p.lineTo(zero_x, by); p.lineTo(cx, by - 66); p.lineTo(cx, by); p.close()
    c.setFillColor(Color(SHEAR.red, SHEAR.green, SHEAR.blue, alpha=0.15)); c.drawPath(p, fill=1, stroke=1)
    text(c, "+9.60", ax - 52, ay + 5, 8.5, SHEAR, "SC-Bold", "right")
    text(c, "0", bx - 8, by + 8, 8, SHEAR, "SC-Bold")
    text(c, "+4.16", bx + 4, by + 39, 8.5, SHEAR, "SC-Bold")
    text(c, "-11.84", cx + 4, by - 67, 8.5, SHEAR, "SC-Bold")
    line(c, zero_x, by - 80, zero_x, by + 8, theme.line, 0.8, [3, 3])
    text(c, "x = 5.20 ft", zero_x, by - 92, 7.5, theme.muted, "SC-Semibold", "center")
    text(c, "V_CD = 0", dx + 14, (dy + cy) / 2, 8, SHEAR, "SC-Semibold")


def draw_moment(c: canvas.Canvas, x: float, y: float, w: float, h: float, theme: Theme) -> None:
    pts = draw_base_frame(c, x, y, w, h, HexColor("#82918A"))
    ax, ay = pts["A"]; bx, by = pts["B"]; cx, cy = pts["C"]; dx, dy = pts["D"]
    # AB parabola, offset to the left.
    p = c.beginPath(); p.moveTo(ax, ay); p.curveTo(ax - 4, ay + (by - ay) * 0.35, bx - 42, by - 30, bx - 45, by); p.lineTo(bx, by); p.lineTo(ax, ay); p.close()
    c.setFillColor(Color(MOMENT.red, MOMENT.green, MOMENT.blue, alpha=0.14)); c.setStrokeColor(MOMENT); c.setLineWidth(1.8); c.drawPath(p, fill=1, stroke=1)
    # BC moment curve below beam. End ordinates: B=76.8, C=0; maximum at x=5.2.
    max_x = bx + (cx - bx) * 5.2 / 20
    p = c.beginPath(); p.moveTo(bx, by); p.lineTo(bx, by - 61); p.curveTo(max_x - 25, by - 73, max_x + 8, by - 74, max_x, by - 70); p.curveTo(cx - 80, by - 66, cx - 24, by - 16, cx, by); p.lineTo(bx, by); p.close()
    c.setFillColor(Color(MOMENT.red, MOMENT.green, MOMENT.blue, alpha=0.14)); c.drawPath(p, fill=1, stroke=1)
    text(c, "M_A = 0", ax - 4, ay - 30, 7.5, theme.muted, "SC-Semibold", "center")
    text(c, "76.80", bx - 50, by - 4, 8.5, MOMENT, "SC-Bold", "right")
    text(c, "87.616", max_x, by - 89, 9.5, MOMENT, "SC-Bold", "center")
    text(c, "maximo en x = 5.20 ft", max_x, by - 103, 7.2, theme.muted, "SC-Semibold", "center")
    line(c, max_x, by - 74, max_x, by + 8, theme.line, 0.8, [3, 3])
    text(c, "M_C = 0", cx, by + 13, 7.5, MOMENT, "SC-Semibold", "center")
    text(c, "M_CD = 0", dx + 15, (dy + cy) / 2, 8, MOMENT, "SC-Semibold")


def diagram_page(c: canvas.Canvas, theme: Theme, kind: str, page: int) -> None:
    specs = {
        "N": ("Diagrama axial N", "Fuerza normal por miembro", AXIAL, "kip", draw_axial),
        "V": ("Diagrama cortante V", "Variacion local y punto de cortante nulo", SHEAR, "kip", draw_shear),
        "M": ("Diagrama de momento M", "Continuidad, ecuaciones y maximo interior", MOMENT, "kip-ft", draw_moment),
    }
    title_value, subtitle, color, unit, drawer = specs[kind]
    header(c, theme, "Hibbeler 4-39", page, theme.name)
    section_title(c, theme, f"0{page}", title_value, subtitle, PAGE_H - 105)
    rect(c, 28, 364, PAGE_W - 56, 335, theme.surface, theme.line, 10)
    pill(c, f"DIAGRAMA {kind}", 42, 671, color)
    drawer(c, 68, 397, 430, 235, theme)
    diagram_axes_note(c, theme, color, kind, unit, 610)
    rect(c, 28, 61, PAGE_W - 56, 281, theme.surface, theme.line, 10)
    text(c, "OPERACIONES CLARAS", 42, 318, 9, theme.deep, "SC-Bold")
    if kind == "N":
        rows = [
            (1, "Columna AB", "N_AB = -Ay", "N_AB = -4.16 kip"),
            (2, "Viga BC", "No existe resultante horizontal transmitida en B-C", "N_BC = 0 kip"),
            (3, "Columna DC", "N_DC = -Dy", "N_DC = -11.84 kip"),
            (4, "Interpretacion", "N < 0 segun la convencion local", "COMPRESION"),
        ]
        conclusion = "La columna DC gobierna el axial con 11.84 kip de compresion. La viga BC no desarrolla fuerza axial en este modelo."
    elif kind == "V":
        rows = [
            (1, "Columna AB", "V_AB(y) = 9.60 - 0.60 y   |   0 <= y <= 16", "V_A = 9.60; V_B = 0"),
            (2, "Viga BC", "V_BC(x) = 4.16 - 0.80 x   |   0 <= x <= 20", "V_B = 4.16; V_C = -11.84"),
            (3, "Cortante nulo", "4.16 - 0.80 x = 0", "x = 5.20 ft"),
            (4, "Columna DC", "No existe accion transversal en DC", "V_DC = 0 kip"),
        ]
        conclusion = "El cambio de signo del cortante en x = 5.20 ft identifica la posicion del momento maximo sobre la viga BC."
    else:
        rows = [
            (1, "Columna AB", "M_AB(y) = 9.60 y - 0.30 y^2", "M_A = 0; M_B = 76.80"),
            (2, "Viga BC", "M_BC(x) = 76.80 + 4.16 x - 0.40 x^2", "M_C = 0 kip-ft"),
            (3, "Posicion del maximo", "dM/dx = V = 4.16 - 0.80 x = 0", "x = 5.20 ft"),
            (4, "Valor maximo", "M(5.20) = 76.80 + 4.16(5.20) - 0.40(5.20)^2", "Mmax = 87.616 kip-ft"),
        ]
        conclusion = "El maximo absoluto ocurre en la viga BC, a 5.20 ft de B. En C y a lo largo de DC el momento es cero."
    yy = 280
    for num, row_title, equation, result in rows:
        operation_row(c, theme, num, row_title, equation, result, 42, yy, PAGE_W - 84, color)
        if num < len(rows):
            line(c, 42, yy - 8, PAGE_W - 42, yy - 8, theme.line, 0.45)
        yy -= 47
    rect(c, 42, 78, PAGE_W - 84, 38, Color(theme.success.red, theme.success.green, theme.success.blue, alpha=0.07), theme.success, 6)
    text(c, "LECTURA", 54, 99, 7, theme.success, "SC-Bold")
    paragraph(c, conclusion, 107, 102, PAGE_W - 165, 7.4, 10, theme.ink, "SC-Regular")
    footer(c, theme, page)
    c.showPage()


def add_metadata(c: canvas.Canvas, theme: Theme) -> None:
    c.setTitle(f"Hibbeler 4-39 - {theme.name} - structureCo")
    c.setAuthor("structureCo")
    c.setSubject("Propuesta real de redisenio de memoria de calculo con DCL global, diagramas N-V-M y operaciones")
    c.setKeywords("structureCo, DCL, axial, cortante, momento, Hibbeler 4-39")


def generate(theme: Theme) -> Path:
    output = OUT_DIR / f"{theme.slug}.pdf"
    c = canvas.Canvas(str(output), pagesize=A4, pageCompression=1)
    add_metadata(c, theme)
    page_dcl(c, theme)
    diagram_page(c, theme, "N", 2)
    diagram_page(c, theme, "V", 3)
    diagram_page(c, theme, "M", 4)
    c.save()
    return output


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    register_fonts()
    for theme in THEMES:
        path = generate(theme)
        print(path)


if __name__ == "__main__":
    main()
