"""The cover and the contents page, drawn straight onto their reserved sheets.

Both need something the flow cannot give them: the cover is a full-bleed identity page with a
dark rail running off the trim, and the contents page needs the folio every part landed on,
which is only known once the whole body has been laid out. So neither flows. The document
reserves one blank sheet for each at the front, and these two functions paint them in the
deferred pass, beside the running head — the same pass, for the same reason.
"""

from .text import width_of, wrap_text
from .theme import SPACE, TYPE, color, face

RAIL = 118


def draw_wordmark(canvas, x, y, size, tone):
    """The wordmark, set in the two weights the document owns."""
    canvas.setFillColor(color(tone))
    canvas.setFont(face("regular"), size)
    canvas.drawString(x, y, "structure")
    offset = width_of("structure", "regular", size)
    canvas.setFont(face("bold"), size)
    canvas.drawString(x + offset, y, "Co")
    return offset + width_of("Co", "bold", size)


def _draw_fact_column(canvas, x, top, width, facts, label_tone, value_tone):
    """The cover's identity block: label above value, each fact its own paragraph."""
    y = top
    for label, value in facts:
        canvas.setFillColor(color(label_tone))
        canvas.setFont(face("bold"), TYPE["micro"])
        canvas.drawString(x, y - TYPE["micro"], label.upper())
        y -= TYPE["micro"] * 2.1
        # A 64-character checksum needs the full measure; anything else reads at the body size.
        size = TYPE["micro"] if len(value) > 44 else TYPE["small"] + 0.6
        if " " in value:
            lines = wrap_text(value, "regular", size, width)
        else:
            # One unbroken token — the checksum — wraps on characters, not on spaces.
            lines, line = [], ""
            for character in value:
                if line and width_of(line + character, "regular", size) > width:
                    lines.append(line)
                    line = character
                else:
                    line += character
            if line:
                lines.append(line)
        canvas.setFillColor(color(value_tone))
        canvas.setFont(face("regular"), size)
        for entry in lines[:2]:
            canvas.drawString(x, y - size, entry)
            y -= size * 1.35
        y -= TYPE["micro"] * 1.4
    return y


def draw_cover(canvas, cover, page_width, page_height, margin):
    """The identity page: what this document is, of what project, and the hash that ties it to
    the payload attached to the file."""
    # A single dark field down the left third: the document's one strong graphic gesture, and
    # the thing that makes a printed stack of these findable by spine.
    canvas.setFillColor(color("band"))
    canvas.rect(0, 0, RAIL, page_height, stroke=0, fill=1)
    draw_wordmark(canvas, 26, page_height - 60, 12, "paper")
    canvas.setFillColor(color("inkFaint"))
    canvas.setFont(face("bold"), TYPE["micro"])
    canvas.drawString(26, 96, "MEMORIA DE")
    canvas.drawString(26, 86, "CÁLCULO")

    left = RAIL + 46
    measure = page_width - left - margin

    canvas.setFillColor(color("ink"))
    canvas.setFont(face("bold"), TYPE["display"])
    canvas.drawString(left, page_height - 132, cover.get("documentTitle", ""))
    canvas.setStrokeColor(color("accent"))
    canvas.setLineWidth(1.4)
    canvas.setDash()
    canvas.line(left, page_height - 152, page_width - margin, page_height - 152)

    name = cover.get("projectName", "")
    name_size = 13 if len(name) > 44 else 17
    canvas.setFillColor(color("inkSoft"))
    canvas.setFont(face("regular"), name_size)
    for index, line in enumerate(wrap_text(name, "regular", name_size, measure)[:2]):
        canvas.drawString(left, page_height - 182 - index * name_size * 1.3, line)

    _draw_fact_column(
        canvas, left, page_height - 268, measure, cover.get("facts", []), "inkFaint", "ink"
    )

    canvas.setStrokeColor(color("rule"))
    canvas.setLineWidth(0.5)
    canvas.line(left, 168, page_width - margin, 168)
    canvas.setFillColor(color("inkFaint"))
    canvas.setFont(face("bold"), TYPE["micro"])
    canvas.drawString(left, 152, cover.get("noticeTitle", "").upper())
    canvas.setFillColor(color("inkSoft"))
    canvas.setFont(face("regular"), TYPE["small"])
    for index, line in enumerate(wrap_text(cover.get("notice", ""), "regular", TYPE["small"], measure)[:5]):
        canvas.drawString(left, 136 - index * TYPE["small"] * 1.45, line)


def draw_contents(canvas, title, entries, page_width, page_height, margin):
    """Parts at full weight with their two-digit numeral; the sections inside them indented
    under their part, leadered to a real folio.

    Two levels when they fit on one sheet, parts alone when they do not: a contents list that
    stops halfway down a long document is worse than one that only promises the parts.
    """
    if not entries:
        return
    canvas.setFillColor(color("ink"))
    canvas.setFont(face("bold"), TYPE["title"])
    canvas.drawString(margin, page_height - 118, title)
    canvas.setStrokeColor(color("ink"))
    canvas.setLineWidth(1.1)
    canvas.setDash()
    canvas.line(margin, page_height - 132, page_width - margin, page_height - 132)

    def line_for(level):
        return (TYPE["body"] + 0.6 if level == 1 else TYPE["small"]) * 2.1 + (SPACE * 2 if level == 1 else 0)

    available = page_height - 160 - 90
    full_height = sum(line_for(entry["level"]) for entry in entries)
    shown = entries if full_height <= available else [e for e in entries if e["level"] == 1]

    y = page_height - 160
    for entry in shown:
        is_part = entry["level"] == 1
        size = TYPE["body"] + 0.6 if is_part else TYPE["small"]
        face_name = "bold" if is_part else "regular"
        tone = "ink" if is_part else "inkSoft"
        if is_part:
            y -= SPACE * 2
        if y < 90:
            break

        if is_part and entry.get("number") is not None:
            canvas.setFillColor(color("accent"))
            canvas.setFont(face("bold"), size)
            canvas.drawString(margin, y, "%02d" % entry["number"])

        title_x = margin + (26 if is_part else 40)
        canvas.setFillColor(color(tone))
        canvas.setFont(face(face_name), size)
        canvas.drawString(title_x, y, entry["title"])

        folio = str(entry["page"])
        folio_width = width_of(folio, "regular", size)
        canvas.drawString(page_width - margin - folio_width, y, folio)

        start = title_x + width_of(entry["title"], face_name, size) + 6
        end = page_width - margin - folio_width - 6
        if end > start:
            canvas.setStrokeColor(color("rule"))
            canvas.setLineWidth(0.4)
            canvas.line(start, y + 2.2, end, y + 2.2)
        y -= size * 2.1
