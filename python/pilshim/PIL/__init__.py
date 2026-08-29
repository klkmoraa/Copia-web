"""A stand-in for Pillow, so ReportLab can be imported without it.

``reportlab.lib.utils`` imports ``PIL.Image`` at module scope, and Pillow is a compiled
extension: shipping it would mean carrying a WebAssembly build of libjpeg, libpng and zlib for a
document that has no raster image in it. Every mark this report draws is a vector — lines,
outlines, filled paths — which is the property that lets a free-body diagram survive being
zoomed to 800% in a viewer and printed at press resolution.

So the shim satisfies the import and nothing else. The two names ReportLab actually reaches for
are ``Image.Image`` (an ``isinstance`` guard that must answer "no") and ``Image.open``, which
only ``ImageReader`` calls — and ``ImageReader`` is only reached by drawing a bitmap. Asking for
one raises with a sentence saying why rather than failing somewhere deep in ReportLab.
"""
