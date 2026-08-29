"""Document metadata and the embedded portable payload.

The attachment is what makes the report re-importable without OCR: the import centre looks the
file up inside the PDF by name. Its name, MIME type, serialisation and dates are part of the
file format, so this module is deliberately the only place that writes them, on this side of the
seam exactly as ``pdfPayloadSection.ts`` is on the other.

ReportLab has no embedded-file API, so the ``/EmbeddedFiles`` name tree is built here from its
own low-level objects — the same shape the previous generator wrote by hand — and hung off the
catalogue, which already knows ``Names`` is a reference.
"""

import os

from reportlab.pdfbase.pdfdoc import (
    PDFArray,
    PDFDictionary,
    PDFName,
    PDFStream,
    PDFString,
    PDFZCompress,
)

#: Key the payload stream is registered under. Internal; the reader finds the file by its name.
_PAYLOAD_ID = "structureCoPayload"


def source_date_epoch(iso_stamp):
    """The instant every date in the file is stamped with, as ReportLab wants it.

    ReportLab reads ``SOURCE_DATE_EPOCH`` and, when it is set, uses it for ``CreationDate``,
    ``ModDate`` and the document ID digest. Anchoring it to the payload's own ``generatedAt``
    rather than to the clock is what makes two exports of an unchanged model identical byte for
    byte — so a reader can compare two PDFs the way they would compare two checksums.
    """
    from datetime import datetime, timezone

    try:
        text = (iso_stamp or "").replace("Z", "+00:00")
        moment = datetime.fromisoformat(text)
        if moment.tzinfo is None:
            moment = moment.replace(tzinfo=timezone.utc)
        return str(int(moment.timestamp()))
    except (TypeError, ValueError):
        return None


class anchored_dates:
    """Context manager pinning ReportLab's clock for the length of a build."""

    def __init__(self, iso_stamp):
        self.value = source_date_epoch(iso_stamp)
        self.previous = None
        self.had = False

    def __enter__(self):
        if self.value is None:
            return self
        self.had = "SOURCE_DATE_EPOCH" in os.environ
        self.previous = os.environ.get("SOURCE_DATE_EPOCH")
        os.environ["SOURCE_DATE_EPOCH"] = self.value
        return self

    def __exit__(self, *_):
        if self.value is None:
            return False
        if self.had:
            os.environ["SOURCE_DATE_EPOCH"] = self.previous
        else:
            os.environ.pop("SOURCE_DATE_EPOCH", None)
        return False


def apply_metadata(canvas, metadata):
    """Title, author, subject, keywords, producer, creator and the document language."""
    if not metadata:
        return
    canvas.setTitle(metadata.get("title", ""))
    canvas.setAuthor(metadata.get("author", ""))
    canvas.setSubject(metadata.get("subject", ""))
    canvas.setCreator(metadata.get("creator", ""))
    producer = metadata.get("producer")
    if producer:
        canvas.setProducer(producer)
    keywords = metadata.get("keywords")
    if keywords:
        canvas.setKeywords(", ".join(str(word) for word in keywords))
    language = metadata.get("language")
    if language:
        canvas._doc.Catalog.Lang = PDFString(language)


def attach_payload(canvas, attachment):
    """Hangs the portable payload off the catalogue as an embedded file."""
    if not attachment:
        return
    text = attachment.get("text") or ""
    raw = text.encode("utf-8")
    document = canvas._doc

    stream = PDFStream(
        dictionary=PDFDictionary({
            "Type": PDFName("EmbeddedFile"),
            # A MIME type is written with a slash, which is a name delimiter, so it travels
            # through the `#2F` escape a PDF name uses for one.
            "Subtype": PDFName(attachment.get("mimeType", "application/json").replace("/", "#2F")),
            "Params": PDFDictionary({"Size": len(raw)}),
        }),
        content=raw,
        filters=[PDFZCompress],
    )
    stream_reference = document.Reference(stream, _PAYLOAD_ID)

    name = attachment.get("filename", "payload.json")
    filespec = PDFDictionary({
        "Type": PDFName("Filespec"),
        "F": PDFString(name),
        "UF": PDFString(name),
        "Desc": PDFString(attachment.get("description", "")),
        "EF": PDFDictionary({"F": stream_reference}),
    })
    filespec_reference = document.Reference(filespec, _PAYLOAD_ID + "Spec")

    document.Catalog.Names = PDFDictionary({
        "EmbeddedFiles": PDFDictionary({"Names": PDFArray([PDFString(name), filespec_reference])}),
    })
    # PDF 1.7 is the first version every reader treats `/UF` and the embedded-file name tree as
    # normative, and it is what the previous generator wrote.
    document._pdfVersion = max(document._pdfVersion, (1, 7))
