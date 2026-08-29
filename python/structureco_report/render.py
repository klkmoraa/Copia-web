"""Entry point: a normalized report document in, PDF bytes out.

This is the whole public surface of the renderer. It takes the JSON the TypeScript composer
produced (``src/utils/pdf/reportDocument.ts``), turns each block into the flowable that knows
how to draw it, lets Platypus paginate, and hands back bytes. It computes nothing about the
structure being reported: every number, every label and every mark on every drawing was decided
on the other side of the seam.
"""

import io
import json

from reportlab.platypus import KeepTogether

from . import blocks as B
from . import document as D
from .attachment import anchored_dates
from .tables import Table


def _block_flowables(block, ledger):
    """One block of the document, as the flowables that print it."""
    kind = block.get("kind")

    if kind == "heading":
        made = [B.Heading(block.get("text", ""), block.get("level", 1))]
        if block.get("level", 1) == 1:
            # The marker travels *with* the heading so a page break between them cannot record
            # the folio of a page the heading did not land on.
            made = [KeepTogether([D.Marker(ledger, "section", block.get("text", "")), made[0]])]
        return made

    if kind == "text":
        return [B.Prose(
            block.get("text", ""),
            block.get("size", 8.6),
            block.get("face", "regular"),
            block.get("tone", "ink"),
            block.get("indent", 0),
        )]

    if kind == "label":
        return [B.MicroLabel(block.get("text", ""), block.get("tone", "inkFaint"))]

    if kind == "bullets":
        return [B.Bullets(block.get("items", []))]

    if kind == "keyValues":
        return [B.KeyValues(block.get("entries", []), block.get("labelWidth", 150))]

    if kind == "metrics":
        return [B.Metrics(block.get("items", []))]

    if kind == "callout":
        return [B.Callout(block.get("tone", "neutral"), block.get("title", ""), block.get("body", ""))]

    if kind == "rule":
        return [B.Rule(block.get("tone", "rule"), block.get("width", 0.5))]

    if kind == "gap":
        return [B.Gap(block.get("units", 1))]

    if kind == "table":
        return [Table(
            block.get("columns", []),
            block.get("rows", []),
            block.get("typeset", {}),
            block.get("size", 7.4),
            block.get("indent", 0),
            block.get("zebra", False),
        )]

    if kind == "figure":
        return [B.Figure(block.get("marks", []), block.get("height", 0), block.get("caption"))]

    if kind == "equation":
        return [B.Equation(block.get("marks", []), block.get("height", 0), block.get("indent", 0))]

    # An unknown block is dropped rather than raised on: a renderer one version behind its
    # composer should still print everything it does understand.
    return []


def render_report(document):
    """The PDF for ``document``, as ``bytes``.

    ``document`` is the parsed JSON, or the JSON text itself.
    """
    if isinstance(document, (str, bytes, bytearray)):
        document = json.loads(document)

    ledger = D.Ledger()
    buffer = io.BytesIO()
    template, page_size, margin = D.make_template(buffer, document)
    story = D.build_story(document, ledger, _block_flowables)

    # Every sheet the body opens is named for the part it belongs to, so the running head is
    # right on a page a part merely continued onto.
    original_handle = template.handle_pageBegin

    def handle_page_begin():
        original_handle()
        ledger.touch(template.page)

    template.handle_pageBegin = handle_page_begin

    with anchored_dates(document.get("metadata", {}).get("stampedAt")):
        template.build(story, canvasmaker=D.numbered_canvas(ledger, document, page_size, margin))
    return buffer.getvalue()
