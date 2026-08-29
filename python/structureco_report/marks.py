"""Replays a drawing's marks onto a ReportLab canvas.

A figure arrives as a list of marks in *figure-local* points — origin at the bottom-left of the
rectangle the block reserved — because that is what makes artwork independent of where it
lands. This module is the only thing that knows how each mark becomes ink, which is why the
beams, portal frames, free-body diagrams and N/V/M strips of the report all stroke the same
weights, dashes and glyph outlines: there is one implementation of each primitive, here.

Everything drawn is vector. Nothing is rasterised, at any size, so a figure survives being
zoomed to 800% in a viewer and printed at press resolution — which for a document somebody
signs is the whole point.
"""

from .theme import color, face
from .paths import draw_svg_path


def _stroke_style(canvas, mark, default_width=1.0):
    canvas.setLineWidth(mark.get("width", default_width) or default_width)
    dash = mark.get("dash")
    canvas.setDash(list(dash), 0) if dash else canvas.setDash()


def _alpha(canvas, mark):
    opacity = mark.get("opacity")
    if opacity is not None and opacity < 1:
        canvas.setFillAlpha(opacity)
        canvas.setStrokeAlpha(opacity)
        return True
    return False


def draw_mark(canvas, mark, ox, oy):
    """One mark, offset to where the block was placed."""
    kind = mark.get("t")
    faded = _alpha(canvas, mark)
    try:
        if kind == "line":
            canvas.setStrokeColor(color(mark["tone"]))
            _stroke_style(canvas, mark)
            a, b = mark["from"], mark["to"]
            canvas.line(ox + a["x"], oy + a["y"], ox + b["x"], oy + b["y"])

        elif kind == "polyline":
            points = mark.get("points") or []
            if len(points) < 2:
                return
            canvas.setStrokeColor(color(mark["tone"]))
            _stroke_style(canvas, mark)
            path = canvas.beginPath()
            path.moveTo(ox + points[0]["x"], oy + points[0]["y"])
            for point in points[1:]:
                path.lineTo(ox + point["x"], oy + point["y"])
            canvas.drawPath(path, stroke=1, fill=0)

        elif kind == "rect":
            rect = mark["rect"]
            fill, stroke = mark.get("fill"), mark.get("stroke")
            if fill is None and stroke is None:
                return
            if fill is not None:
                canvas.setFillColor(color(fill))
            if stroke is not None:
                canvas.setStrokeColor(color(stroke))
                canvas.setLineWidth(mark.get("width", 0.5) or 0.5)
                canvas.setDash()
            canvas.rect(
                ox + rect["x"], oy + rect["y"], rect["width"], rect["height"],
                stroke=1 if stroke is not None else 0,
                fill=1 if fill is not None else 0,
            )

        elif kind == "circle":
            fill, stroke = mark.get("fill"), mark.get("stroke")
            if fill is None and stroke is None:
                return
            if fill is not None:
                canvas.setFillColor(color(fill))
            if stroke is not None:
                canvas.setStrokeColor(color(stroke))
                canvas.setLineWidth(mark.get("width", 0.5) or 0.5)
                canvas.setDash()
            canvas.circle(
                ox + mark["at"]["x"], oy + mark["at"]["y"], mark["radius"],
                stroke=1 if stroke is not None else 0,
                fill=1 if fill is not None else 0,
            )

        elif kind == "text":
            text = mark.get("text") or ""
            if not text:
                return
            canvas.setFillColor(color(mark["tone"]))
            canvas.setFont(face(mark.get("face")), mark["size"])
            x, y = ox + mark["at"]["x"], oy + mark["at"]["y"]
            if mark.get("align") == "right":
                canvas.drawRightString(x, y, text)
            else:
                canvas.drawString(x, y, text)

        elif kind == "glyph":
            # A typeset outline: the composer already folded placement and scale into the
            # matrix, so the renderer concatenates it and fills the raw path.
            a, b, c, d, e, f = mark["matrix"]
            canvas.saveState()
            canvas.setFillColor(color(mark["tone"]))
            canvas.transform(a, b, c, d, ox + e, oy + f)
            draw_svg_path(canvas, mark["path"])
            canvas.restoreState()
    finally:
        if faded:
            canvas.setFillAlpha(1)
            canvas.setStrokeAlpha(1)


def draw_marks(canvas, marks, ox=0.0, oy=0.0):
    """Replays a whole drawing. State is saved once around it so a mark that changes the dash
    pattern or the alpha cannot leak into the block that follows."""
    if not marks:
        return
    canvas.saveState()
    try:
        for mark in marks:
            draw_mark(canvas, mark, ox, oy)
    finally:
        canvas.restoreState()
