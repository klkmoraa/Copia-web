"""Replays a drawing's marks onto a ReportLab canvas.

A figure arrives as a list of marks in *figure-local* points — origin at the bottom-left of the
rectangle the block reserved — because that is what makes artwork independent of where it
lands. This module is the only thing that knows how each mark becomes ink, which is why the
beams, portal frames, free-body diagrams and N/V/M strips of the report all stroke the same
weights, dashes and glyph outlines: there is one implementation of each primitive, here.

Everything drawn is vector. Nothing is rasterised, at any size, so a figure survives being
zoomed to 800% in a viewer and printed at press resolution — which for a document somebody
signs is the whole point.

Two defaults do a lot of quiet work. Strokes are round-capped and round-joined unless a mark
says otherwise: a load arrow's shaft no longer ends in a visible square nib, and a diagram's
peak no longer grows a mitre spike where two steep segments meet. And a `path` can be *filled*,
which is what lets a shear diagram be an area rather than a fringe of hatch lines and an
arrowhead be a solid triangle rather than two barbs.
"""

from .theme import color, face
from .paths import draw_svg_path

#: Round cap and round join. The PDF specification's own numbering, and ReportLab's.
ROUND = 1


def _stroke_style(canvas, mark, default_width=1.0):
    canvas.setLineWidth(mark.get("width", default_width) or default_width)
    canvas.setLineCap(mark.get("cap", ROUND))
    canvas.setLineJoin(mark.get("join", ROUND))
    dash = mark.get("dash")
    canvas.setDash(list(dash), 0) if dash else canvas.setDash()


def _opacity(mark):
    """The mark's alpha, or ``None`` for opaque.

    It has to travel with every colour rather than being set once around the mark:
    ``setFillColor`` ends by applying the colour object's *own* alpha, and a plain ``Color`` is
    opaque — so an alpha set beforehand is silently wiped and a translucent diagram area prints
    as a solid block of ink. Passing it explicitly is the only ordering that holds.
    """
    opacity = mark.get("opacity")
    return opacity if opacity is not None and opacity < 1 else None


def _fill(canvas, tone, opacity):
    canvas.setFillColor(color(tone), alpha=opacity if opacity is not None else 1)


def _stroke(canvas, tone, opacity):
    canvas.setStrokeColor(color(tone), alpha=opacity if opacity is not None else 1)


def _build_path(canvas, ops, ox, oy):
    """One path object from the composer's steps. Cubic only; a quadratic was raised upstream."""
    path = canvas.beginPath()
    for op in ops:
        kind = op.get("o")
        if kind == "m":
            path.moveTo(ox + op["x"], oy + op["y"])
        elif kind == "l":
            path.lineTo(ox + op["x"], oy + op["y"])
        elif kind == "c":
            path.curveTo(
                ox + op["x1"], oy + op["y1"],
                ox + op["x2"], oy + op["y2"],
                ox + op["x"], oy + op["y"],
            )
        elif kind == "z":
            path.close()
    return path


def _draw_text(canvas, mark, ox, oy, opacity=None):
    text = mark.get("text") or ""
    if not text:
        return
    font, size = face(mark.get("face")), mark["size"]
    canvas.setFont(font, size)
    x, y = ox + mark["at"]["x"], oy + mark["at"]["y"]
    right = mark.get("align") == "right"
    halo = mark.get("halo")
    if halo is not None:
        # A small plate of the ground colour under the label, so a value can stay beside the
        # thing it measures instead of being moved somewhere emptier.
        #
        # It is a rectangle rather than a stroked copy of the glyphs, which would knock out a
        # tighter shape: a stroked copy is a second text-showing operator, and every extractor
        # then reports the label twice — in the report's own text inspection, in a reader's
        # copy-paste, and in the gates that read the finished PDF back.
        width = canvas.stringWidth(text, font, size)
        pad = max(1.1, size * 0.16)
        canvas.saveState()
        _fill(canvas, halo, None)
        canvas.roundRect(
            (x - width if right else x) - pad,
            y - size * 0.26,
            width + pad * 2,
            size * 1.16,
            pad,
            stroke=0,
            fill=1,
        )
        canvas.restoreState()
        canvas.setFont(font, size)
    _fill(canvas, mark["tone"], opacity)
    if right:
        canvas.drawRightString(x, y, text)
    else:
        canvas.drawString(x, y, text)


def draw_mark(canvas, mark, ox, oy):
    """One mark, offset to where the block was placed."""
    kind = mark.get("t")
    opacity = _opacity(mark)

    if kind == "line":
        _stroke(canvas, mark["tone"], opacity)
        _stroke_style(canvas, mark)
        a, b = mark["from"], mark["to"]
        canvas.line(ox + a["x"], oy + a["y"], ox + b["x"], oy + b["y"])

    elif kind == "polyline":
        points = mark.get("points") or []
        if len(points) < 2:
            return
        _stroke(canvas, mark["tone"], opacity)
        _stroke_style(canvas, mark)
        path = canvas.beginPath()
        path.moveTo(ox + points[0]["x"], oy + points[0]["y"])
        for point in points[1:]:
            path.lineTo(ox + point["x"], oy + point["y"])
        canvas.drawPath(path, stroke=1, fill=0)

    elif kind == "path":
        fill, stroke = mark.get("fill"), mark.get("stroke")
        if fill is None and stroke is None:
            return
        if fill is not None:
            _fill(canvas, fill, opacity)
        if stroke is not None:
            _stroke(canvas, stroke, opacity)
        _stroke_style(canvas, mark, 0.8)
        canvas.drawPath(
            _build_path(canvas, mark.get("d") or [], ox, oy),
            stroke=1 if stroke is not None else 0,
            fill=1 if fill is not None else 0,
        )

    elif kind == "rect":
        rect = mark["rect"]
        fill, stroke = mark.get("fill"), mark.get("stroke")
        if fill is None and stroke is None:
            return
        if fill is not None:
            _fill(canvas, fill, opacity)
        if stroke is not None:
            _stroke(canvas, stroke, opacity)
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
            _fill(canvas, fill, opacity)
        if stroke is not None:
            _stroke(canvas, stroke, opacity)
            _stroke_style(canvas, mark, 0.5)
        canvas.circle(
            ox + mark["at"]["x"], oy + mark["at"]["y"], mark["radius"],
            stroke=1 if stroke is not None else 0,
            fill=1 if fill is not None else 0,
        )

    elif kind == "text":
        _draw_text(canvas, mark, ox, oy, opacity)

    elif kind == "glyph":
        # A typeset outline: the composer already folded placement and scale into the matrix,
        # so the renderer concatenates it and fills the raw path.
        a, b, c, d, e, f = mark["matrix"]
        canvas.saveState()
        _fill(canvas, mark["tone"], opacity)
        canvas.transform(a, b, c, d, ox + e, oy + f)
        draw_svg_path(canvas, mark["path"])
        canvas.restoreState()


def draw_marks(canvas, marks, ox=0.0, oy=0.0):
    """Replays a whole drawing. State is saved once around it so a mark that changes the dash
    pattern, the cap or the alpha cannot leak into the block that follows."""
    if not marks:
        return
    canvas.saveState()
    try:
        canvas.setLineCap(ROUND)
        canvas.setLineJoin(ROUND)
        for mark in marks:
            draw_mark(canvas, mark, ox, oy)
    finally:
        canvas.restoreState()
