"""The report's design system, as the renderer reads it.

Every colour in the document arrives as a *token name* — ``'ink'``, ``'moment'`` — never as a
hex or an RGB triple. The composer names roles (``src/utils/pdf/pdfTheme.ts``) and this table
turns each name into ink, so the two sides can be diffed by eye and the document stays
renderer-agnostic.

The hexes below mirror ``src/design-system/tokens.css`` in its light appearance, the one that is
correct on white paper. They are duplicated rather than parsed because this module runs inside
a Python runtime with no stylesheet in reach; ``theme_test.py`` pins them against the
TypeScript table so a drift fails rather than prints.
"""

from reportlab.lib.colors import Color

#: Token name -> hex, mirroring ``tokens.css`` light appearance.
REPORT_TOKENS = {
    "paper": "#ffffff",
    "tint": "#f5f5f7",
    "tintDeep": "#efeff1",
    "rule": "#d2d2d7",
    "inkFaint": "#8e8e93",
    "inkSoft": "#6e6e73",
    "ink": "#1d1d1f",
    "band": "#141416",
    "accent": "#0071eb",
    "axial": "#0071a4",
    "shear": "#248a3d",
    "moment": "#c93400",
    "reaction": "#0040dd",
    "load": "#3634a3",
    "deformed": "#5e46c8",
    "ok": "#248a3d",
    "warn": "#b25000",
    "danger": "#d70015",
}

#: Type scale. Six steps, each a role rather than a size.
TYPE = {
    "display": 26,
    "title": 16,
    "section": 10.8,
    "sub": 8.8,
    "body": 8.6,
    "small": 7.4,
    "micro": 6.3,
}

#: Vertical rhythm. Every gap in the document is a multiple of this.
SPACE = 4

#: The three faces the document owns, by the name a block asks for.
FACES = {
    "regular": "Helvetica",
    "bold": "Helvetica-Bold",
    "mathRegular": "Times-Roman",
}

_CACHE = {}


def color(token, default="ink"):
    """The ink a token names. An unknown token falls back rather than raising: a document that
    lost one colour is still worth printing, and the fallback is the document's own body ink."""
    name = token if token in REPORT_TOKENS else default
    hit = _CACHE.get(name)
    if hit is None:
        raw = REPORT_TOKENS[name].lstrip("#")
        hit = Color(
            int(raw[0:2], 16) / 255.0,
            int(raw[2:4], 16) / 255.0,
            int(raw[4:6], 16) / 255.0,
        )
        _CACHE[name] = hit
    return hit


def face(name):
    """The PDF font a face name resolves to."""
    return FACES.get(name or "regular", FACES["regular"])
