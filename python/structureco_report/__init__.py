"""structureCo's calculation-report renderer.

The report is composed in TypeScript, beside the solver whose numbers it reports, and arrives
here as one normalized JSON document (``src/utils/pdf/reportDocument.ts``). This package turns
that document into a PDF with ReportLab, entirely offline: no network, no service, no model.

The seam is deliberate and one-directional. Nothing here computes a structural result, chooses
a label, or decides what a drawing shows; and nothing on the composing side knows how a page
breaks, what a table's column widths come out at, or where a glyph lands. ``render_report`` is
the whole public surface.
"""

from .render import render_report

__all__ = ["render_report"]
