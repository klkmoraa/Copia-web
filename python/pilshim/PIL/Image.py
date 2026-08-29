"""The two names ReportLab imports from Pillow. See ``PIL/__init__.py`` for why they are stubs."""


class Image:
    """Never instantiated: it exists so ReportLab's ``isinstance`` guard answers "not a bitmap"."""


def open(*_args, **_kwargs):
    raise NotImplementedError(
        "structureCo's calculation report is entirely vector; no raster image should reach "
        "ReportLab's ImageReader."
    )
