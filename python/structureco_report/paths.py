"""An SVG path, filled as a PDF path.

The math typesetter hands over glyph outlines exactly as MathJax authored them — ``M289 629Q289
635 232 637Q...`` — with no separators between a command and its first number and none between
a number and a following minus sign. ReportLab has no SVG path reader, so this is one: a
tokeniser that understands that shape, and a walk that turns each command into ``moveTo`` /
``lineTo`` / ``curveTo``.

Quadratics become cubics by the exact degree-elevation ``C1 = P0 + 2/3 (Q - P0)``, so a curve is
raised, never approximated: the outline that is filled is the outline the font declares.
"""

import re

_TOKEN = re.compile(r"[MmZzLlHhVvCcSsQqTtAa]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?")


def _tokens(data):
    for match in _TOKEN.finditer(data or ""):
        yield match.group(0)


def draw_svg_path(canvas, data, stroke=0, fill=1):
    """Fills ``data`` on ``canvas``, in the current transform and fill colour."""
    path = build_path(canvas, data)
    if path is not None:
        canvas.drawPath(path, stroke=stroke, fill=fill)


def build_path(canvas, data):
    """The path object for ``data``, or ``None`` when it draws nothing."""
    path = canvas.beginPath()
    stream = list(_tokens(data))
    if not stream:
        return None

    index = 0
    command = None
    # Current point, the subpath's start, and the previous curve's control point — the last is
    # what the shorthand commands (``S``, ``T``) reflect to produce their own.
    x = y = start_x = start_y = 0.0
    last_control = None
    last_quad = None
    drew = False

    def number():
        nonlocal index
        value = float(stream[index])
        index += 1
        return value

    while index < len(stream):
        token = stream[index]
        if re.match(r"[A-Za-z]", token):
            command = token
            index += 1
            # ``M x y x y`` means moveto then implicit linetos; every other command simply
            # repeats. Both are handled by looping on the command with the reader left in place.
            if command in ("Z", "z"):
                path.close()
                x, y = start_x, start_y
                last_control = last_quad = None
                continue
        elif command is None:
            break
        elif command in ("M", "m"):
            command = "L" if command == "M" else "l"

        relative = command.islower()
        upper = command.upper()

        if index >= len(stream) and upper not in ("Z",):
            break

        if upper == "M":
            nx, ny = number(), number()
            x, y = (x + nx, y + ny) if relative else (nx, ny)
            start_x, start_y = x, y
            path.moveTo(x, y)
            last_control = last_quad = None
        elif upper == "L":
            nx, ny = number(), number()
            x, y = (x + nx, y + ny) if relative else (nx, ny)
            path.lineTo(x, y)
            drew = True
            last_control = last_quad = None
        elif upper == "H":
            nx = number()
            x = x + nx if relative else nx
            path.lineTo(x, y)
            drew = True
            last_control = last_quad = None
        elif upper == "V":
            ny = number()
            y = y + ny if relative else ny
            path.lineTo(x, y)
            drew = True
            last_control = last_quad = None
        elif upper == "C":
            x1, y1, x2, y2, nx, ny = (number() for _ in range(6))
            if relative:
                x1, y1, x2, y2, nx, ny = x + x1, y + y1, x + x2, y + y2, x + nx, y + ny
            path.curveTo(x1, y1, x2, y2, nx, ny)
            drew = True
            x, y, last_control, last_quad = nx, ny, (x2, y2), None
        elif upper == "S":
            x2, y2, nx, ny = (number() for _ in range(4))
            if relative:
                x2, y2, nx, ny = x + x2, y + y2, x + nx, y + ny
            cx, cy = (2 * x - last_control[0], 2 * y - last_control[1]) if last_control else (x, y)
            path.curveTo(cx, cy, x2, y2, nx, ny)
            drew = True
            x, y, last_control, last_quad = nx, ny, (x2, y2), None
        elif upper == "Q":
            qx, qy, nx, ny = (number() for _ in range(4))
            if relative:
                qx, qy, nx, ny = x + qx, y + qy, x + nx, y + ny
            _quad(path, x, y, qx, qy, nx, ny)
            drew = True
            x, y, last_quad, last_control = nx, ny, (qx, qy), None
        elif upper == "T":
            nx, ny = number(), number()
            if relative:
                nx, ny = x + nx, y + ny
            qx, qy = (2 * x - last_quad[0], 2 * y - last_quad[1]) if last_quad else (x, y)
            _quad(path, x, y, qx, qy, nx, ny)
            drew = True
            x, y, last_quad, last_control = nx, ny, (qx, qy), None
        elif upper == "A":
            # Elliptical arcs do not occur in the typesetter's glyph outlines. Should a font ever
            # introduce one, the chord keeps the contour closed rather than dropping the segment
            # and leaving a filled shape with a hole in its edge.
            for _ in range(5):
                number()
            nx, ny = number(), number()
            x, y = (x + nx, y + ny) if relative else (nx, ny)
            path.lineTo(x, y)
            drew = True
            last_control = last_quad = None
        else:
            break

    return path if drew or stream else None


def _quad(path, x0, y0, qx, qy, x1, y1):
    """A quadratic segment, raised exactly to the cubic ReportLab draws."""
    path.curveTo(
        x0 + 2.0 / 3.0 * (qx - x0), y0 + 2.0 / 3.0 * (qy - y0),
        x1 + 2.0 / 3.0 * (qx - x1), y1 + 2.0 / 3.0 * (qy - y1),
        x1, y1,
    )
