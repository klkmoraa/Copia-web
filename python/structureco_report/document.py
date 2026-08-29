"""The document: page furniture, front matter, bookmarks, and the two-pass canvas that needs
the page count before it can print a folio.

Everything that has to know *where a page is* lives here, and nowhere else. The blocks flow;
this decides where they land, what runs across the top of each sheet, which sheet each part
opened on, and how the reader gets from a bookmark to it.

The one subtlety is the deferred canvas. A running head that says "página 7 de 24" cannot be
drawn while page 7 is being composed, because 24 is not known yet — and neither is the contents
page's folio column, nor which part a given sheet belongs to when a part spills over. So the
first pass composes only the body, recording as it goes; the deferred pass then walks the saved
pages and paints the furniture, the cover, the contents and the outline with the whole document
in hand. It is one build, not two: nothing is laid out twice.
"""

from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.platypus import BaseDocTemplate, Flowable, Frame, PageBreak, PageTemplate, Spacer

from . import frontmatter
from .attachment import apply_metadata, attach_payload
from .theme import SPACE, TYPE, color, face

#: Height reserved at the top of every ordinary page for the running head.
HEAD_SPACE = 74
#: Baseline of the last line that may be printed before the footer rule.
CONTENT_BOTTOM = 58

#: Page one is the cover, page two the contents. Both are painted, not flowed.
COVER_PAGE = 1
CONTENTS_PAGE = 2
FIRST_BODY_PAGE = 3


class Ledger:
    """What the deferred pass needs to know, filled while the body is composed."""

    def __init__(self):
        #: ``page number -> part title``, for the running head.
        self.page_parts = {}
        #: Contents and outline entries, each with the page it opened on.
        self.entries = []
        self._current = ""

    def open_part(self, page, title, number):
        self._current = title
        self.page_parts[page] = title
        self.entries.append({"title": title, "page": page, "level": 1, "number": number})

    def open_section(self, page, title):
        self.entries.append({"title": title, "page": page, "level": 2, "number": None})

    def touch(self, page):
        """Names a page that carries no marker of its own — a part continuing over the fold."""
        self.page_parts.setdefault(page, self._current)


class Marker(Flowable):
    """A zero-height note in the flow that records the page it was drawn on.

    A part's title and a heading's folio are both facts about *where a block ended up*, which
    only exists once Platypus has placed it. Asking the flow itself is the only way to be right
    when a part opens on a page a previous part overflowed onto.
    """

    def __init__(self, ledger, kind, title, number=None):
        Flowable.__init__(self)
        self.ledger = ledger
        self.kind = kind
        self.title = title
        self.number = number
        self.width = 0
        self.height = 0

    def wrap(self, available_width, available_height):
        return 0, 0

    def draw(self):
        page = self.canv.getPageNumber()
        if self.kind == "part":
            self.ledger.open_part(page, self.title, self.number)
        else:
            self.ledger.open_section(page, self.title)


class PartHead(Flowable):
    """The opening of a numbered part: the numeral, the title, an optional standfirst, a rule.

    It never splits and never sits alone at the foot of a page — it always opens one, because
    the story puts a page break in front of it.
    """

    def __init__(self, title, number, standfirst=None):
        Flowable.__init__(self)
        self.title = title
        self.number = number
        self.standfirst = standfirst
        self.width = 0
        self.height = 0

    def wrap(self, available_width, available_height):
        from .text import width_of, wrap_text

        self.width = available_width
        numeral = "%02d" % self.number
        self._numeral = numeral
        self._numeral_width = width_of(numeral, "bold", TYPE["display"]) + SPACE * 4
        self._standfirst_lines = (
            wrap_text(self.standfirst, "regular", TYPE["small"], available_width - self._numeral_width)[:2]
            if self.standfirst
            else []
        )
        self.height = (
            TYPE["title"]
            + SPACE * 3
            + len(self._standfirst_lines) * TYPE["small"] * 1.4
            + SPACE
            + SPACE * 5
        )
        return self.width, self.height

    def draw(self):
        canvas = self.canv
        top = self.height
        canvas.setFillColor(color("tintDeep"))
        canvas.setFont(face("bold"), TYPE["display"])
        canvas.drawString(0, top - TYPE["display"], self._numeral)
        canvas.setFillColor(color("ink"))
        canvas.setFont(face("bold"), TYPE["title"])
        canvas.drawString(self._numeral_width, top - TYPE["title"] - 2, self.title)
        y = top - TYPE["title"] - SPACE * 3
        if self._standfirst_lines:
            canvas.setFillColor(color("inkSoft"))
            canvas.setFont(face("regular"), TYPE["small"])
            for line in self._standfirst_lines:
                canvas.drawString(self._numeral_width, y - TYPE["small"], line)
                y -= TYPE["small"] * 1.4
        y -= SPACE
        canvas.setStrokeColor(color("ink"))
        canvas.setLineWidth(1.1)
        canvas.setDash()
        canvas.line(0, y, self.width, y)


def numbered_canvas(ledger, document, page_size, margin):
    """A canvas that holds every page until the last one exists.

    ReportLab writes a page out as soon as it is finished, which is too early for anything that
    depends on the total — the folio, the contents column, the part a sheet belongs to when a
    part runs over. Saving the page states and replaying them is the standard way round it, and
    the only place the report needs it.
    """
    page_width, page_height = page_size

    class NumberedCanvas(pdfcanvas.Canvas):
        def __init__(self, *args, **kwargs):
            pdfcanvas.Canvas.__init__(self, *args, **kwargs)
            self._pages = []

        def showPage(self):
            self._pages.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            apply_metadata(self, document.get("metadata", {}))
            attach_payload(self, document.get("attachment"))
            if ledger.entries:
                # An outline nobody can see is an outline nobody uses.
                self._doc.Catalog.showOutline()
            total = len(self._pages)
            for index, state in enumerate(self._pages):
                self.__dict__.update(state)
                number = index + 1
                if number == COVER_PAGE:
                    frontmatter.draw_cover(self, document.get("cover", {}), page_width, page_height, margin)
                elif number == CONTENTS_PAGE:
                    frontmatter.draw_contents(
                        self,
                        document.get("contentsTitle", "Contenido"),
                        ledger.entries,
                        page_width,
                        page_height,
                        margin,
                    )
                else:
                    _draw_chrome(self, document, ledger, number, total, page_width, page_height, margin)
                _bookmark(self, ledger, number)
                pdfcanvas.Canvas.showPage(self)
            pdfcanvas.Canvas.save(self)

    return NumberedCanvas


def _draw_chrome(canvas, document, ledger, number, total, page_width, page_height, margin):
    """The running head and the footer: who this is, which part you are in, and where you are."""
    part = ledger.page_parts.get(number) or document.get("documentTitle", "")
    head_y = page_height - 44
    canvas.saveState()
    canvas.setFillColor(color("ink"))
    canvas.setFont(face("bold"), TYPE["micro"])
    canvas.drawString(margin, head_y, document.get("runningTitle", ""))
    canvas.setFillColor(color("inkSoft"))
    canvas.setFont(face("regular"), TYPE["micro"])
    canvas.drawRightString(page_width - margin, head_y, part)
    canvas.setStrokeColor(color("rule"))
    canvas.setLineWidth(0.5)
    canvas.setDash()
    canvas.line(margin, head_y - 7, page_width - margin, head_y - 7)

    canvas.line(margin, 42, page_width - margin, 42)
    canvas.setFillColor(color("inkFaint"))
    canvas.setFont(face("regular"), TYPE["micro"])
    canvas.drawString(margin, 30, document.get("documentTitle", ""))
    canvas.drawRightString(page_width - margin, 30, "página %d de %d" % (number, total))
    canvas.restoreState()


def _bookmark(canvas, ledger, number):
    """Bookmarks for every part and every first-level heading, in reading order.

    A twelve-page report without them is a scroll; the contents page covers the same ground on
    paper. Written in the deferred pass because that is where the page a section opened on is
    finally a fact.
    """
    for index, entry in enumerate(ledger.entries):
        if entry["page"] != number:
            continue
        key = "sc-%d" % index
        canvas.bookmarkPage(key)
        canvas.addOutlineEntry(entry["title"], key, level=entry["level"] - 1, closed=False)


def build_story(document, ledger, block_factory):
    """The flow: two reserved sheets, then each part behind its own page break."""
    story = [Spacer(1, 1), PageBreak(), Spacer(1, 1), PageBreak()]
    for index, part in enumerate(document.get("parts", [])):
        if index:
            story.append(PageBreak())
        story.append(Marker(ledger, "part", part.get("title", ""), part.get("number")))
        story.append(PartHead(part.get("title", ""), part.get("number", index + 1), part.get("standfirst")))
        for block in part.get("blocks", []):
            story.extend(block_factory(block, ledger))
    return story


def make_template(buffer, document):
    """A single frame under the running head, on every sheet including the two reserved ones."""
    page = document.get("page", {})
    width = page.get("width", 595.28)
    height = page.get("height", 841.89)
    margin = page.get("margin", 50)
    template = BaseDocTemplate(
        buffer,
        pagesize=(width, height),
        leftMargin=margin,
        rightMargin=margin,
        topMargin=HEAD_SPACE,
        bottomMargin=CONTENT_BOTTOM,
        title=document.get("metadata", {}).get("title", ""),
        author=document.get("metadata", {}).get("author", ""),
        subject=document.get("metadata", {}).get("subject", ""),
        creator=document.get("metadata", {}).get("creator", ""),
    )
    frame = Frame(
        margin,
        CONTENT_BOTTOM,
        width - margin * 2,
        height - HEAD_SPACE - CONTENT_BOTTOM,
        id="body",
        leftPadding=0,
        rightPadding=0,
        topPadding=0,
        bottomPadding=0,
    )
    template.addPageTemplates([PageTemplate(id="main", frames=[frame])])
    return template, (width, height), margin
