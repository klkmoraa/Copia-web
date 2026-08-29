"""The report's one table: ruled, with a header that repeats after every break.

Cells wrap inside their own column, rows keep their cells on one baseline grid, and a row that
no longer fits starts a fresh page under a repeated header rather than being split across the
fold. The header is set in small caps over a rule instead of a filled band: forty rows under a
coloured header read as a screenshot, not as a document.

Column widths follow exactly the rule the composer used (``resolveColumnWidths`` in
``pdfBuilder.ts``) — fixed columns first, the rest sharing the remainder by weight. They have to
agree: a cell the composer sent as typeset glyphs was laid out against the width computed there,
and a column that came out narrower here would print a formula over its own gridline.
"""

from reportlab.platypus import Flowable

from .marks import draw_marks
from .text import width_of, wrap_text
from .theme import SPACE, TYPE, color, face

CELL_PAD_X = 5
CELL_PAD_Y = 3.6


def resolve_column_widths(columns, available):
    """Mirrors ``pdfBuilder.resolveColumnWidths``. A mis-declared table splits evenly rather than
    printing negative widths that overlap into the margin."""
    if not columns:
        return []
    fixed = sum(column.get("width") or 0 for column in columns)
    remaining = available - fixed
    flex_total = sum(column.get("flex", 1) for column in columns if column.get("width") is None)
    if remaining < 0 or (flex_total == 0 and fixed > available):
        return [available / len(columns)] * len(columns)
    widths = []
    for column in columns:
        if column.get("width") is not None:
            widths.append(column["width"])
        elif flex_total == 0:
            widths.append(0)
        else:
            widths.append(remaining * column.get("flex", 1) / flex_total)
    return widths


class Table(Flowable):
    """A run of rows under one header. Splits between rows, never through one."""

    def __init__(self, columns, rows, typeset, size, indent=0, zebra=False, first_row=0):
        Flowable.__init__(self)
        self.columns = columns
        self.rows = rows
        self.typeset = typeset or {}
        self.size = size
        self.indent = indent
        self.zebra = zebra
        # Index of ``rows[0]`` in the original table, so the zebra stripe and the typeset-cell
        # lookup stay right after a split.
        self.first_row = first_row
        self.width = 0
        self.height = 0

    # -- geometry ------------------------------------------------------------------------

    def _header_size(self):
        return min(self.size, TYPE["micro"] + 0.4)

    def _header_height(self):
        return self.size * 1.34 + CELL_PAD_Y * 2

    def _layout(self, available_width):
        self._widths = resolve_column_widths(self.columns, available_width - self.indent)
        offsets = [self.indent]
        for width in self._widths:
            offsets.append(offsets[-1] + width)
        self._offsets = offsets
        self._total = sum(self._widths)

    def _row_heights(self):
        line_height = self.size * 1.34
        heights = []
        cells = []
        for row_index, row in enumerate(self.rows):
            wrapped = []
            tallest = line_height
            for column_index, column in enumerate(self.columns):
                key = "%d:%d" % (self.first_row + row_index, column_index)
                cell = self.typeset.get(key)
                if cell is not None:
                    wrapped.append(cell)
                    tallest = max(tallest, cell.get("height", 0))
                    continue
                value = row[column_index] if column_index < len(row) else ""
                lines = wrap_text(value, "regular", self.size, max(1, self._widths[column_index] - CELL_PAD_X * 2))
                wrapped.append(lines)
                tallest = max(tallest, max(1, len(lines)) * line_height)
            cells.append(wrapped)
            heights.append(tallest + CELL_PAD_Y * 2)
        self._cells = cells
        return heights

    def wrap(self, available_width, available_height):
        self.width = available_width
        self._layout(available_width)
        self._heights = self._row_heights()
        self.height = self._header_height() + sum(self._heights) + SPACE * 2.5
        return self.width, self.height

    def split(self, available_width, available_height):
        self._layout(available_width)
        heights = self._row_heights()
        # The head has to fit *including* the air `wrap` adds after the last row, or ReportLab
        # rejects the split and the table is stranded.
        budget = available_height - SPACE * 2.5
        # A break is only worth taking if at least one row travels with the header it repeats.
        used = self._header_height()
        cut = 0
        for height in heights:
            if used + height > budget:
                break
            used += height
            cut += 1
        if cut <= 0 or cut >= len(self.rows):
            return []
        head = Table(self.columns, self.rows[:cut], self.typeset, self.size, self.indent, self.zebra, self.first_row)
        tail = Table(self.columns, self.rows[cut:], self.typeset, self.size, self.indent, self.zebra, self.first_row + cut)
        return [head, tail]

    # -- ink -----------------------------------------------------------------------------

    def _draw_header(self, canvas, top):
        header_size = self._header_size()
        canvas.setFillColor(color("inkSoft"))
        canvas.setFont(face("bold"), header_size)
        for index, column in enumerate(self.columns):
            text = column.get("header", "")
            lines = wrap_text(text, "bold", header_size, max(1, self._widths[index] - CELL_PAD_X * 2))
            shown = lines[0] if lines else text
            baseline = top - CELL_PAD_Y - header_size
            if column.get("align") == "right":
                canvas.drawRightString(self._offsets[index] + self._widths[index] - CELL_PAD_X, baseline, shown)
            else:
                canvas.drawString(self._offsets[index] + CELL_PAD_X, baseline, shown)
        bottom = top - self._header_height()
        canvas.setStrokeColor(color("ink"))
        canvas.setLineWidth(0.8)
        canvas.setDash()
        canvas.line(self.indent, bottom + SPACE * 0.4, self.indent + self._total, bottom + SPACE * 0.4)
        return bottom

    def draw(self):
        canvas = self.canv
        line_height = self.size * 1.34
        y = self._draw_header(canvas, self.height)
        for row_index, height in enumerate(self._heights):
            if self.zebra and (self.first_row + row_index) % 2 == 1:
                canvas.setFillColor(color("tint"))
                canvas.rect(self.indent, y - height, self._total, height, stroke=0, fill=1)
            for column_index, column in enumerate(self.columns):
                cell = self._cells[row_index][column_index]
                x = self._offsets[column_index]
                if isinstance(cell, dict):
                    draw_marks(canvas, cell.get("marks"), x + CELL_PAD_X, y - CELL_PAD_Y - cell.get("height", 0))
                    continue
                canvas.setFillColor(color("ink"))
                canvas.setFont(face("regular"), self.size)
                for line_index, line in enumerate(cell):
                    baseline = y - CELL_PAD_Y - self.size - line_index * line_height
                    if column.get("align") == "right":
                        canvas.drawRightString(x + self._widths[column_index] - CELL_PAD_X, baseline, line)
                    else:
                        canvas.drawString(x + CELL_PAD_X, baseline, line)
            y -= height
            canvas.setStrokeColor(color("rule"))
            canvas.setLineWidth(0.4)
            canvas.setDash()
            canvas.line(self.indent, y, self.indent + self._total, y)


def measure_text(text, face_name, size):
    """Re-exported so a caller sizing a column against a known string uses the same ruler."""
    return width_of(text, face_name, size)
