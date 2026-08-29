"""The document's reusable blocks, as ReportLab flowables.

One class per thing a section can say — a heading, running prose, a micro label, bullets, a
key/value grid, the summary strip, a callout, a rule, air, a numbered figure, a typeset
equation — and each of them owns its own measure and its own break behaviour. That is what lets
the same composed document print correctly whether it runs to four pages or a hundred: a block
that no longer fits reports how much of itself does, and Platypus carries the rest to the next
page instead of running it into the footer.

Everything draws with the canvas directly rather than through ``Paragraph``. The composer has
already reduced its prose to WinAnsi (``≤`` became ``<=``, ``→`` became ``->``), and those are
exactly the characters ReportLab's mini-XML parser would choke on.
"""

from reportlab.platypus import Flowable

from .marks import draw_marks
from .text import wrap_text
from .theme import SPACE, TYPE, color, face

#: A block's line height, as a multiple of its size. Matches the composer's own rhythm.
LINE = 1.42


class _Block(Flowable):
    """Common plumbing: full measure, no splitting unless a subclass says otherwise."""

    def __init__(self):
        Flowable.__init__(self)
        self.width = 0
        self.height = 0

    def wrap(self, available_width, available_height):
        self.width = available_width
        self.height = self.measure(available_width)
        return self.width, self.height


class Gap(_Block):
    """Vertical air. Collapses at a page break, because space nobody sees is not space."""

    def __init__(self, units=1):
        _Block.__init__(self)
        self.units = units

    def measure(self, width):
        return SPACE * self.units

    def draw(self):
        pass


class Rule(_Block):
    """A hairline across the measure, with the document's own air above and below it."""

    def __init__(self, tone="rule", weight=0.5):
        _Block.__init__(self)
        self.tone = tone
        self.weight = weight

    def measure(self, width):
        return SPACE * 2

    def draw(self):
        canvas = self.canv
        canvas.setStrokeColor(color(self.tone))
        canvas.setLineWidth(self.weight)
        canvas.setDash()
        canvas.line(0, self.height, self.width, self.height)


class Heading(_Block):
    """A landmark. A first-level one carries a rule under it and earns a bookmark."""

    def __init__(self, text, level=1):
        _Block.__init__(self)
        self.text = text
        self.level = level
        self.size = TYPE["section"] if level == 1 else TYPE["sub"] if level == 2 else TYPE["small"]

    def measure(self, width):
        lines = wrap_text(self.text, "bold", self.size, width)
        self._lines = lines
        lead = SPACE * (3 if self.level == 1 else 2)
        body = len(lines) * self.size * 1.35
        tail = SPACE * 1.5 if self.level == 1 else SPACE
        return lead + body + tail

    def draw(self):
        canvas = self.canv
        top = self.height - SPACE * (3 if self.level == 1 else 2)
        canvas.setFillColor(color("inkSoft" if self.level == 3 else "ink"))
        canvas.setFont(face("bold"), self.size)
        y = top
        for line in self._lines:
            y -= self.size
            canvas.drawString(0, y, line)
            y -= self.size * 0.35
        if self.level == 1:
            canvas.setStrokeColor(color("rule"))
            canvas.setLineWidth(0.5)
            canvas.setDash()
            canvas.line(0, y + SPACE * 0.5, self.width, y + SPACE * 0.5)


class Prose(_Block):
    """Running copy at a stated size, face and tone. Splits between its own lines."""

    def __init__(self, text, size, face_name="regular", tone="ink", indent=0):
        _Block.__init__(self)
        self.text = text
        self.size = size
        self.face_name = face_name
        self.tone = tone
        self.indent = indent
        self._lines = None

    def lines(self, width):
        if self._lines is None:
            self._lines = wrap_text(self.text, self.face_name, self.size, max(1, width - self.indent))
        return self._lines

    def measure(self, width):
        return len(self.lines(width)) * self.size * LINE

    def split(self, available_width, available_height):
        lines = self.lines(available_width)
        line_height = self.size * LINE
        fits = int(available_height // line_height)
        if fits <= 0 or fits >= len(lines):
            return []
        head = Prose("\n".join(lines[:fits]), self.size, self.face_name, self.tone, self.indent)
        tail = Prose("\n".join(lines[fits:]), self.size, self.face_name, self.tone, self.indent)
        return [head, tail]

    def draw(self):
        canvas = self.canv
        canvas.setFillColor(color(self.tone))
        canvas.setFont(face(self.face_name), self.size)
        y = self.height
        for line in self.lines(self.width):
            y -= self.size * LINE
            if line:
                canvas.drawString(self.indent, y + self.size * (LINE - 1), line)


class MicroLabel(_Block):
    """The document's one piece of typographic furniture: a small-caps micro label."""

    def __init__(self, text, tone="inkFaint"):
        _Block.__init__(self)
        self.text = text
        self.tone = tone

    def measure(self, width):
        return TYPE["micro"] * 1.9

    def draw(self):
        canvas = self.canv
        canvas.setFillColor(color(self.tone))
        canvas.setFont(face("bold"), TYPE["micro"])
        canvas.drawString(0, self.height - TYPE["micro"], self.text)


class Bullets(_Block):
    """A list, each item hanging off a dot and wrapping under itself."""

    GUTTER = 14

    def __init__(self, items):
        _Block.__init__(self)
        self.items = list(items)

    def measure(self, width):
        self._wrapped = [wrap_text(item, "regular", TYPE["body"], width - self.GUTTER) for item in self.items]
        line_height = TYPE["body"] * LINE
        return sum(len(lines) * line_height + SPACE * 0.5 for lines in self._wrapped) + SPACE

    def split(self, available_width, available_height):
        self.measure(available_width)
        line_height = TYPE["body"] * LINE
        budget = available_height - SPACE
        used = 0.0
        cut = 0
        for lines in self._wrapped:
            block = len(lines) * line_height + SPACE * 0.5
            if used + block > budget:
                break
            used += block
            cut += 1
        if cut <= 0 or cut >= len(self.items):
            return []
        return [Bullets(self.items[:cut]), Bullets(self.items[cut:])]

    def draw(self):
        canvas = self.canv
        line_height = TYPE["body"] * LINE
        y = self.height
        for lines in self._wrapped:
            canvas.setFillColor(color("inkFaint"))
            canvas.circle(3, y - TYPE["body"] * 0.62, 1.3, stroke=0, fill=1)
            canvas.setFillColor(color("ink"))
            canvas.setFont(face("regular"), TYPE["body"])
            for index, line in enumerate(lines):
                canvas.drawString(self.GUTTER, y - TYPE["body"] - index * line_height, line)
            y -= len(lines) * line_height + SPACE * 0.5


class KeyValues(_Block):
    """``label | value`` rows on a hairline grid — the column a reader scans down."""

    def __init__(self, entries, label_width=150):
        _Block.__init__(self)
        self.entries = [tuple(entry) for entry in entries]
        self.label_width = label_width

    def _rows(self, width):
        size = TYPE["small"]
        rows = []
        for label, value in self.entries:
            label_lines = wrap_text(label, "bold", size, max(1, self.label_width - SPACE * 2))
            value_lines = wrap_text(value, "regular", size, max(1, width - self.label_width - SPACE * 2))
            height = max(len(label_lines), len(value_lines)) * size * 1.4 + SPACE * 1.5
            rows.append((label_lines, value_lines, height))
        return rows

    def measure(self, width):
        self._cache = self._rows(width)
        return sum(row[2] for row in self._cache) + SPACE

    def split(self, available_width, available_height):
        self.measure(available_width)
        budget = available_height - SPACE
        used = 0.0
        cut = 0
        for _, _, height in self._cache:
            if used + height > budget:
                break
            used += height
            cut += 1
        if cut <= 0 or cut >= len(self.entries):
            return []
        return [
            KeyValues(self.entries[:cut], self.label_width),
            KeyValues(self.entries[cut:], self.label_width),
        ]

    def draw(self):
        canvas = self.canv
        size = TYPE["small"]
        y = self.height
        for label_lines, value_lines, height in self._cache:
            top = y
            canvas.setFont(face("bold"), size)
            canvas.setFillColor(color("inkSoft"))
            for index, line in enumerate(label_lines):
                canvas.drawString(0, top - size - index * size * 1.4, line)
            canvas.setFont(face("regular"), size)
            canvas.setFillColor(color("ink"))
            for index, line in enumerate(value_lines):
                canvas.drawString(self.label_width, top - size - index * size * 1.4, line)
            y = top - height
            canvas.setStrokeColor(color("rule"))
            canvas.setLineWidth(0.4)
            canvas.setDash()
            canvas.line(0, y + SPACE * 0.5, self.width, y + SPACE * 0.5)


class Metrics(_Block):
    """Headline figures across the measure, separated by hairlines rather than boxed."""

    HEIGHT = 46

    def __init__(self, items):
        _Block.__init__(self)
        self.items = list(items)

    def measure(self, width):
        return self.HEIGHT + SPACE * 2

    def draw(self):
        canvas = self.canv
        if not self.items:
            return
        cell = self.width / len(self.items)
        top = self.height
        for index, item in enumerate(self.items):
            x = cell * index
            if index > 0:
                canvas.setStrokeColor(color("rule"))
                canvas.setLineWidth(0.5)
                canvas.setDash()
                canvas.line(x - SPACE * 2, top - self.HEIGHT + 4, x - SPACE * 2, top - 2)
            canvas.setFillColor(color("inkFaint"))
            canvas.setFont(face("bold"), TYPE["micro"])
            canvas.drawString(x, top - TYPE["micro"] - 2, item.get("label", ""))
            canvas.setFillColor(color(item.get("tone") or "ink"))
            canvas.setFont(face("bold"), 13.5)
            canvas.drawString(x, top - 30, item.get("value", ""))
            detail = item.get("detail")
            if detail:
                lines = wrap_text(detail, "regular", TYPE["micro"], cell - SPACE * 3)
                canvas.setFillColor(color("inkSoft"))
                canvas.setFont(face("regular"), TYPE["micro"])
                canvas.drawString(x, top - 42, lines[0] if lines else "")


CALLOUT_TONES = {
    "accent": "accent",
    "ok": "ok",
    "warn": "warn",
    "danger": "danger",
    "neutral": "inkSoft",
}


class Callout(_Block):
    """A block the reader must not skim past: a left rail in the tone's colour, a quiet ground."""

    def __init__(self, tone, title, body):
        _Block.__init__(self)
        self.tone = CALLOUT_TONES.get(tone, "inkSoft")
        self.title = title
        self.body = body

    def measure(self, width):
        inner = width - 18
        self._lines = wrap_text(self.body, "regular", TYPE["small"], inner)
        title_height = TYPE["micro"] * 1.9 if self.title else 0
        self._box = title_height + len(self._lines) * TYPE["small"] * LINE + SPACE * 3
        return self._box + SPACE * 2

    def draw(self):
        canvas = self.canv
        top = self.height
        bottom = top - self._box
        canvas.setFillColor(color("tint"))
        canvas.rect(0, bottom, self.width, self._box, stroke=0, fill=1)
        canvas.setFillColor(color(self.tone))
        canvas.rect(0, bottom, 2.2, self._box, stroke=0, fill=1)
        cursor = top - SPACE * 1.5
        if self.title:
            canvas.setFont(face("bold"), TYPE["micro"])
            canvas.drawString(12, cursor - TYPE["micro"], self.title)
            cursor -= TYPE["micro"] * 1.9
        canvas.setFillColor(color("ink"))
        canvas.setFont(face("regular"), TYPE["small"])
        for index, line in enumerate(self._lines):
            canvas.drawString(12, cursor - TYPE["small"] - index * TYPE["small"] * LINE, line)


class Figure(_Block):
    """Reserved artwork, replayed from its marks, with its numbered caption underneath.

    The drawing arrives in figure-local points, so the flowable simply offsets it to wherever
    Platypus put the block. A figure never splits: half a free-body diagram is not a diagram.
    """

    def __init__(self, marks, height, caption=None):
        _Block.__init__(self)
        self.marks = marks or []
        self.art_height = height
        self.caption = caption

    def measure(self, width):
        self._caption_lines = wrap_text(self.caption, "regular", TYPE["small"], width) if self.caption else []
        caption_height = (
            len(self._caption_lines) * TYPE["small"] * 1.35 + SPACE * 0.5 if self._caption_lines else 0
        )
        self._caption_height = caption_height
        return self.art_height + caption_height + SPACE * 3

    def draw(self):
        canvas = self.canv
        bottom = self.height - self.art_height
        draw_marks(canvas, self.marks, 0, bottom)
        if not self._caption_lines:
            return
        canvas.setFillColor(color("inkSoft"))
        canvas.setFont(face("regular"), TYPE["small"])
        y = bottom - SPACE
        for index, line in enumerate(self._caption_lines):
            canvas.drawString(0, y - TYPE["small"] - index * TYPE["small"] * 1.35, line)


class Equation(_Block):
    """A displayed relation: placed glyph outlines.

    The typesetting happened in the composer — there is no TeX engine on this side, by design —
    so what arrives is already folded to the measure, tag included: the number hangs off the
    relation's own last baseline, which only the typesetter knows. Like a figure, an equation
    never splits, because one broken across a page fold is a different equation.
    """

    def __init__(self, marks, height, indent=0):
        _Block.__init__(self)
        self.marks = marks or []
        self.box = height
        self.indent = indent

    def measure(self, width):
        return self.box

    def draw(self):
        draw_marks(self.canv, self.marks, self.indent, 0)
