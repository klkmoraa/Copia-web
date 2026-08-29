"""Measuring and wrapping prose, with the same ruler the composer used.

``src/utils/pdf/standardFontWidths.ts`` is generated from ReportLab's own metrics, so a caption
measured in TypeScript and the same caption wrapped here agree glyph for glyph. Nothing in the
report may measure text any other way.

Wrapping is deliberately hand-rolled rather than delegated to ``Paragraph``. The composer has
already transliterated every glyph outside WinAnsi (``pdfGlyphs.pdfText``), which turns ``≤``
into ``<=`` and ``→`` into ``->``; handing those to ReportLab's mini-XML parser would either
raise or silently swallow the rest of the line as an unclosed tag.
"""

from reportlab.pdfbase.pdfmetrics import stringWidth

from .theme import face


def width_of(text, face_name, size):
    """Advance width of ``text``, in points."""
    if not text:
        return 0.0
    return stringWidth(text, face(face_name), size)


def wrap_text(text, face_name, size, max_width):
    """Breaks ``text`` into lines no wider than ``max_width``.

    Mirrors ``pdfGlyphs.wrapText``: words first, and a word too long for the measure is broken
    character by character rather than allowed to run into the margin. Explicit newlines are
    kept, including the empty line a blank paragraph asks for.
    """
    lines = []
    for paragraph in str(text).replace("\r\n", "\n").split("\n"):
        if not paragraph:
            lines.append("")
            continue
        line = ""
        for word in paragraph.split():
            candidate = (line + " " + word) if line else word
            if width_of(candidate, face_name, size) <= max_width:
                line = candidate
                continue
            if line:
                lines.append(line)
            if width_of(word, face_name, size) <= max_width:
                line = word
                continue
            fragment = ""
            for character in word:
                if fragment and width_of(fragment + character, face_name, size) > max_width:
                    lines.append(fragment)
                    fragment = character
                else:
                    fragment += character
            line = fragment
        if line:
            lines.append(line)
    return lines
