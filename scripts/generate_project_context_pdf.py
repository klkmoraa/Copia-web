from __future__ import annotations

import html
import hashlib
import json
import os
import re
import textwrap
from datetime import datetime
from pathlib import Path
from typing import Iterable

from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Image,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Preformatted,
    Spacer,
    Table,
    TableStyle,
    Frame,
)
from reportlab.platypus.tableofcontents import TableOfContents
from xml.sax.saxutils import escape


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "structureCo-contexto-completo-2026-07-16.pdf"
SNAPSHOT_DATE = "2026-07-16"
VERSION = "0.7.0"
GREEN = colors.HexColor("#0E7A56")
GREEN_DARK = colors.HexColor("#07563D")
GREEN_PALE = colors.HexColor("#E8F4EE")
INK = colors.HexColor("#14201B")
MUTED = colors.HexColor("#5C6B64")
LINE = colors.HexColor("#D5E4DC")
RED_PALE = colors.HexColor("#FFF1EF")
YELLOW_PALE = colors.HexColor("#FFF8E3")


def register_fonts() -> tuple[str, str, str]:
    candidates = [
        ("SegoeUI", r"C:\Windows\Fonts\segoeui.ttf", r"C:\Windows\Fonts\segoeuib.ttf", r"C:\Windows\Fonts\consola.ttf"),
        ("Arial", r"C:\Windows\Fonts\arial.ttf", r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\consola.ttf"),
    ]
    for family, regular_path, bold_path, mono_path in candidates:
        if all(Path(path).exists() for path in (regular_path, bold_path, mono_path)):
            try:
                pdfmetrics.registerFont(TTFont(family, regular_path))
                pdfmetrics.registerFont(TTFont(f"{family}-Bold", bold_path))
                pdfmetrics.registerFont(TTFont(f"{family}-Mono", mono_path))
                return family, f"{family}-Bold", f"{family}-Mono"
            except Exception:
                pass
    return "Helvetica", "Helvetica-Bold", "Courier"


FONT, FONT_BOLD, FONT_MONO = register_fonts()


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def file_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def clean_text(value: object) -> str:
    text = str(value)
    replacements = {
        "\u2010": "-",
        "\u2011": "-",
        "\u2012": "-",
        "\u2013": "-",
        "\u2014": "-",
        "\u2015": "-",
        "\u2212": "-",
        "\u00a0": " ",
        "\u200b": "",
        "\ufeff": "",
        "\u2022": "-",
        "\u2026": "...",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    return "".join(ch if ch == "\n" or ch == "\t" or ord(ch) >= 32 else " " for ch in text)


def para(value: object, style: ParagraphStyle) -> Paragraph:
    text = clean_text(value)
    return Paragraph(escape(text).replace("\n", "<br/>").replace("  ", "&nbsp; "), style)


def rich(value: object, style: ParagraphStyle) -> Paragraph:
    return Paragraph(clean_text(value), style)


def code_chunks(text: str, width: int = 112, lines_per_chunk: int = 72) -> list[Preformatted]:
    rendered: list[str] = []
    for line_number, original in enumerate(clean_text(text).splitlines(), start=1):
        if original == "":
            rendered.append(f"{line_number:05d} | ")
            continue
        pieces = textwrap.wrap(
            original,
            width=width,
            replace_whitespace=False,
            drop_whitespace=False,
            break_long_words=False,
            break_on_hyphens=False,
        ) or [""]
        rendered.append(f"{line_number:05d} | {pieces[0]}")
        for piece in pieces[1:]:
            rendered.append(f"       | {piece}")
    chunks: list[Preformatted] = []
    for start in range(0, len(rendered), lines_per_chunk):
        chunk = "\n".join(rendered[start:start + lines_per_chunk])
        chunks.append(Preformatted(escape(chunk), STYLES["Code"]))
    return chunks


class ContextDocTemplate(BaseDocTemplate):
    def __init__(self, filename: str, **kwargs):
        super().__init__(filename, **kwargs)
        self._context_heading_count = 0
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="normal")
        self.addPageTemplates([PageTemplate(id="context", frames=frame, onPage=draw_page)])

    def beforeDocument(self) -> None:
        self._context_heading_count = 0
        super().beforeDocument()

    def afterFlowable(self, flowable: Flowable) -> None:
        if not isinstance(flowable, Paragraph):
            return
        style_name = flowable.style.name
        level = {"Heading1": 0, "Heading2": 1, "Heading3": 2}.get(style_name)
        if level is None:
            return
        title = flowable.getPlainText()
        self._context_heading_count += 1
        key = f"heading-{self._context_heading_count}-{self.page}"
        self.canv.bookmarkPage(key)
        self.canv.addOutlineEntry(title[:120], key, level=level, closed=False)
        self.notify("TOCEntry", (level, title, self.page, key))


def draw_page(canvas, doc) -> None:
    canvas.saveState()
    width, height = A4
    if doc.page > 1:
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.5)
        canvas.line(doc.leftMargin, height - 16 * mm, width - doc.rightMargin, height - 16 * mm)
        canvas.setFont(FONT, 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(doc.leftMargin, height - 12 * mm, "structureCo - Contexto de transferencia")
        canvas.drawRightString(width - doc.rightMargin, height - 12 * mm, f"snapshot {SNAPSHOT_DATE}")
        canvas.line(doc.leftMargin, 14 * mm, width - doc.rightMargin, 14 * mm)
        canvas.drawString(doc.leftMargin, 9 * mm, "Fuente: workspace local structureCo, versión 0.7.0")
        canvas.drawRightString(width - doc.rightMargin, 9 * mm, f"p. {doc.page}")
    canvas.restoreState()


STYLES = {}
sample = getSampleStyleSheet()
STYLES["Title"] = ParagraphStyle(
    "ContextTitle", parent=sample["Title"], fontName=FONT_BOLD, fontSize=28, leading=33,
    textColor=GREEN_DARK, alignment=TA_LEFT, spaceAfter=12,
)
STYLES["Subtitle"] = ParagraphStyle(
    "ContextSubtitle", parent=sample["Normal"], fontName=FONT, fontSize=13, leading=18,
    textColor=MUTED, spaceAfter=8,
)
STYLES["Heading1"] = ParagraphStyle(
    "Heading1", parent=sample["Heading1"], fontName=FONT_BOLD, fontSize=17, leading=21,
    textColor=GREEN_DARK, spaceBefore=13, spaceAfter=8, keepWithNext=True,
)
STYLES["Heading2"] = ParagraphStyle(
    "Heading2", parent=sample["Heading2"], fontName=FONT_BOLD, fontSize=12.5, leading=16,
    textColor=INK, spaceBefore=10, spaceAfter=5, keepWithNext=True,
)
STYLES["Heading3"] = ParagraphStyle(
    "Heading3", parent=sample["Heading3"], fontName=FONT_BOLD, fontSize=9.5, leading=12,
    textColor=GREEN_DARK, spaceBefore=7, spaceAfter=3, keepWithNext=True,
)
STYLES["Body"] = ParagraphStyle(
    "Body", parent=sample["BodyText"], fontName=FONT, fontSize=8.8, leading=12.2,
    textColor=INK, alignment=TA_LEFT, spaceAfter=5,
)
STYLES["Small"] = ParagraphStyle(
    "Small", parent=STYLES["Body"], fontSize=7.7, leading=10.2, textColor=MUTED,
)
STYLES["Tiny"] = ParagraphStyle(
    "Tiny", parent=STYLES["Body"], fontSize=6.7, leading=8.6, textColor=MUTED,
)
STYLES["Bullet"] = ParagraphStyle(
    "Bullet", parent=STYLES["Body"], leftIndent=12, firstLineIndent=-8, bulletIndent=2,
    spaceAfter=2,
)
STYLES["Callout"] = ParagraphStyle(
    "Callout", parent=STYLES["Body"], fontName=FONT, fontSize=8.8, leading=12.5,
    textColor=INK, spaceAfter=0,
)
STYLES["Code"] = ParagraphStyle(
    "Code", parent=sample["Code"], fontName=FONT_MONO, fontSize=5.35, leading=6.45,
    textColor=colors.HexColor("#17362A"), backColor=colors.HexColor("#F5F9F6"),
    borderColor=LINE, borderWidth=0.35, borderPadding=4, spaceAfter=4,
)
STYLES["TableHead"] = ParagraphStyle(
    "TableHead", parent=STYLES["Small"], fontName=FONT_BOLD, textColor=colors.white,
)
STYLES["TableCell"] = ParagraphStyle(
    "TableCell", parent=STYLES["Small"], fontSize=7.3, leading=9.2, textColor=INK,
)
STYLES["CoverKicker"] = ParagraphStyle(
    "CoverKicker", parent=STYLES["Small"], fontName=FONT_BOLD, fontSize=9,
    leading=12, textColor=GREEN, tracking=1.0,
)


def h(text: str, level: int = 1) -> Paragraph:
    return para(text, STYLES[f"Heading{level}"])


def body(text: str) -> Paragraph:
    return para(text, STYLES["Body"])


def bullet(text: str) -> Paragraph:
    return Paragraph(f"- {escape(clean_text(text))}", STYLES["Bullet"])


def callout(title: str, text: str, background=GREEN_PALE, border=GREEN) -> Table:
    content = [rich(f"<b>{escape(clean_text(title))}</b><br/>{escape(clean_text(text))}", STYLES["Callout"])]
    table = Table([[content[0]]], colWidths=[170 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), background),
        ("BOX", (0, 0), (-1, -1), 0.7, border),
        ("LINEBEFORE", (0, 0), (0, -1), 4, border),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return table


def simple_table(headers: list[str], rows: list[list[str]], widths: list[float] | None = None) -> Table:
    data = [[rich(f"<b>{escape(clean_text(item))}</b>", STYLES["TableHead"]) for item in headers]]
    for row in rows:
        data.append([para(item, STYLES["TableCell"]) for item in row])
    table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), GREEN),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.35, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7FBF8")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return table


def image_flowable(path: Path, width: float = 82 * mm) -> Image | None:
    if not path.exists():
        return None
    try:
        from PIL import Image as PILImage

        with PILImage.open(path) as image:
            aspect = image.height / image.width
        return Image(str(path), width=width, height=width * aspect, hAlign="LEFT")
    except Exception:
        return None


def add_markdown(story: list[Flowable], path: Path, include_title=True) -> None:
    if include_title:
        story.append(h(f"Documento fuente: {rel(path)}", 2))
    lines = clean_text(file_text(path)).splitlines()
    in_code = False
    code_lines: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.strip().startswith("```"):
            if in_code:
                story.extend(code_chunks("\n".join(code_lines), width=105, lines_per_chunk=56))
                code_lines = []
            in_code = not in_code
            i += 1
            continue
        if in_code:
            code_lines.append(line)
            i += 1
            continue
        if not line.strip():
            story.append(Spacer(1, 2))
            i += 1
            continue
        if line.startswith("# "):
            story.append(h(line[2:].strip(), 1))
        elif line.startswith("## "):
            story.append(h(line[3:].strip(), 2))
        elif line.startswith("### "):
            story.append(h(line[4:].strip(), 3))
        elif line.startswith("#### "):
            story.append(para(f"<b>{escape(line[5:].strip())}</b>", STYLES["Body"]))
        elif line.startswith("- ") or line.startswith("* "):
            story.append(bullet(line[2:].strip()))
        elif line.startswith("> "):
            story.append(callout("Nota de la documentación", line[2:].strip(), YELLOW_PALE, colors.HexColor("#C58C00")))
        elif line.startswith("|") and line.rstrip().endswith("|"):
            table_lines = [line]
            j = i + 1
            while j < len(lines) and lines[j].startswith("|") and lines[j].rstrip().endswith("|"):
                table_lines.append(lines[j])
                j += 1
            rows = []
            for table_line in table_lines:
                cells = [cell.strip() for cell in table_line.strip().strip("|").split("|")]
                rows.append(cells)
            if len(rows) >= 2 and all(re.fullmatch(r"[-: ]+", cell or " ") for cell in rows[1]):
                rows.pop(1)
            if rows and len(rows) >= 2:
                column_count = max(len(row) for row in rows)
                rows = [row + [""] * (column_count - len(row)) for row in rows]
                story.append(simple_table(rows[0], rows[1:]))
            else:
                story.append(body(line))
            i = j
        elif line.startswith("\\[") or line.startswith("\\]") or line.startswith("$$"):
            story.append(Preformatted(escape(line), STYLES["Code"]))
        else:
            story.append(body(line))
        i += 1
    if in_code and code_lines:
        story.extend(code_chunks("\n".join(code_lines), width=105, lines_per_chunk=56))


def key_symbols(path: Path) -> str:
    text = file_text(path)
    matches = re.findall(
        r"\bexport\s+(?:const|function|interface|type|class)\s+([A-Za-z_$][\w$]*)|\bexport\s*\{([^}]+)\}",
        text,
    )
    symbols: list[str] = []
    for first, group in matches:
        if first:
            symbols.append(first)
        elif group:
            symbols.extend(re.findall(r"[A-Za-z_$][\w$]*", group))
    return ", ".join(dict.fromkeys(symbols)) or "(sin export directo)"


def source_role(path: Path) -> str:
    path_text = rel(path)
    if ".test." in path.name:
        return "prueba automatizada / regresión"
    if path_text.startswith("src/engine/"):
        return "motor estructural / análisis"
    if path_text.startswith("src/components/"):
        return "interfaz / interacción"
    if path_text.startswith("src/data/"):
        return "modelo / persistencia / topología"
    if path_text.startswith("src/utils/"):
        return "importación / exportación / soporte"
    if path_text.startswith("src/education/"):
        return "modo Aula / ejercicios"
    if path_text.startswith("src/store/"):
        return "estado global / sesión"
    if path_text.startswith("src/workers/"):
        return "ejecución fuera del hilo UI"
    if path_text.startswith("src/i18n/"):
        return "internacionalización"
    if path_text.startswith("scripts/"):
        return "script de generación / mantenimiento"
    return "configuración / entrada de aplicación"


def text_files() -> list[Path]:
    extensions = {".ts", ".tsx", ".css", ".mjs", ".py", ".ftl", ".pos", ".html", ".json", ".toml", ".xml", ".svg", ".txt"}
    result = []
    excluded_names = {"package-lock.json", "state.json"}
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        parts = set(path.parts)
        if "node_modules" in parts or ".vite" in parts or "dist" in parts or "tmp" in parts or "output" in parts or "qa-artifacts" in parts:
            continue
        if path.name in excluded_names:
            continue
        if path.suffix.lower() in extensions or path.name in {"README.md", "LICENSE", ".gitignore", ".oxlintrc.json"}:
            result.append(path)
    return sorted(result, key=lambda item: rel(item).lower())


def artifact_files() -> list[Path]:
    roots = [ROOT / "output", ROOT / "qa-artifacts", ROOT / "dist", ROOT / "docs" / "design"]
    files: list[Path] = []
    for root in roots:
        if root.exists():
            files.extend(path for path in root.rglob("*") if path.is_file())
    return sorted(files, key=lambda item: rel(item).lower())


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()[:16]


def pdf_pages(path: Path) -> str:
    try:
        return str(len(PdfReader(str(path)).pages))
    except Exception:
        return "-"


def add_cover(story: list[Flowable]) -> None:
    story.append(Spacer(1, 23 * mm))
    story.append(para("DOCUMENTO DE TRANSFERENCIA", STYLES["CoverKicker"]))
    story.append(Spacer(1, 6 * mm))
    story.append(para("structureCo", STYLES["Title"]))
    story.append(para("Contexto completo del proyecto para introducirlo en otro chat de ChatGPT", STYLES["Subtitle"]))
    story.append(Spacer(1, 9 * mm))
    story.append(callout(
        "Objetivo del documento",
        "Conservar en un solo PDF la intención del producto, su estado funcional actual, la arquitectura, el motor matemático, los flujos de usuario, las pruebas, las limitaciones, los artefactos generados y los anexos de código/documentación necesarios para que un nuevo chat pueda continuar el trabajo con contexto técnico suficiente.",
    ))
    story.append(Spacer(1, 9 * mm))
    story.append(simple_table(
        ["Campo", "Valor"],
        [
            ["Snapshot", SNAPSHOT_DATE],
            ["Versión de aplicación", VERSION],
            ["Esquema de proyecto", "v5"],
            ["Stack", "React 19 + TypeScript + Vite + Vitest + Playwright"],
            ["Unidades internas", "kN, m, kN-m"],
            ["Estado de verify", "lint aprobado; 39 archivos / 227 pruebas aprobadas; build aprobado"],
            ["Ruta raíz", str(ROOT)],
        ],
        widths=[45 * mm, 125 * mm],
    ))
    story.append(Spacer(1, 12 * mm))
    story.append(body("Este PDF está diseñado para ser leído primero por un modelo de lenguaje. La parte inicial resume y organiza; los anexos conservan la documentación y el código fuente en texto. Cuando exista una discrepancia, se debe priorizar el código vigente y la verificación ejecutada en este snapshot sobre una auditoría histórica o una idea del roadmap."))
    story.append(PageBreak())


def add_toc(story: list[Flowable]) -> None:
    story.append(h("Índice navegable", 1))
    story.append(body("El índice incluye los capítulos principales y los anexos. Los marcadores del PDF permiten saltar entre secciones."))
    toc = TableOfContents()
    toc.levelStyles = [
        ParagraphStyle("TOC0", fontName=FONT_BOLD, fontSize=9, leading=12, leftIndent=0, firstLineIndent=0, textColor=GREEN_DARK),
        ParagraphStyle("TOC1", fontName=FONT, fontSize=8, leading=10, leftIndent=12, firstLineIndent=0, textColor=INK),
        ParagraphStyle("TOC2", fontName=FONT, fontSize=7, leading=9, leftIndent=24, firstLineIndent=0, textColor=MUTED),
    ]
    story.append(toc)
    story.append(PageBreak())


def add_transfer_prompt(story: list[Flowable]) -> None:
    story.append(h("Cómo debe leerlo el próximo ChatGPT", 1))
    story.append(callout(
        "Instrucción recomendada para acompañar el PDF",
        "Lee este PDF como el expediente técnico vigente de structureCo. Primero entiende el resumen, el estado actual y las limitaciones; después usa los anexos de documentación y código para responder. Distingue siempre entre funciones implementadas, funciones verificadas, funciones planeadas y artefactos históricos. Si propones cambios, menciona los archivos y contratos afectados, conserva las convenciones de signos/unidades, y no afirmes que una capacidad existe solo porque aparece en el roadmap.",
    ))
    story.append(body("El objetivo no es que el nuevo chat memorice cada línea, sino que tenga un mapa fiable para continuar: qué problema resuelve la aplicación, cómo se representa el modelo, cómo se resuelve, cómo se verifica, qué archivos tocar y qué límites no se deben ocultar."))
    story.append(h("Reglas de interpretación", 2))
    for item in [
        "La fuente primaria de comportamiento es src/ y package.json en el snapshot indicado.",
        "La especificación matemática y el informe de verificación explican contratos que deben mantenerse junto con sus pruebas.",
        "Los documentos AUDIT_2026-07-12 y ROADMAP.md contienen contexto histórico; no sustituyen la ejecución actual.",
        "Los resultados estructurales son lineales-elásticos, de primer orden y de pequeñas deformaciones; no son diseño normativo ni prueba de estabilidad frente a pandeo.",
        "Antes de cambiar el solver, conservar equilibrio global, auditoría de cargas, residuos, condición, compatibilidad y trazabilidad educativa.",
        "Antes de cambiar la UI, preservar gestos mouse/touch/stylus, responsive, accesibilidad, undo/redo y la invalidación de análisis obsoletos.",
    ]:
        story.append(bullet(item))
    story.append(PageBreak())


def add_executive_summary(story: list[Flowable]) -> None:
    story.append(h("1. Identidad y propósito del proyecto", 1))
    story.append(body("structureCo es una aplicación web local-first para modelar, analizar y aprender estructuras planas 2D. Combina un editor gráfico tipo CAD, un motor matricial independiente de React y paneles de resultados trazables desde el modelo hasta matrices, reacciones, diagramas y verificaciones."))
    story.append(body("La aplicación tiene dos experiencias sobre el mismo solucionador. Aula - diagramas reduce el flujo a geometría, miembros, apoyos, liberaciones y cargas; Completo muestra propiedades de material/sección, teoría de viga, conexiones, asentamientos, temperatura, deformaciones iniciales y deformada. Cambiar de experiencia cambia controles visibles, no crea resultados incompatibles."))
    story.append(h("Qué problema resuelve", 2))
    for item in [
        "Permite dibujar una estructura plana sin abandonar el lienzo para configurar nodos, miembros, apoyos y cargas.",
        "Resuelve marcos/vigas y armaduras con método directo de rigidez, recuperando reacciones, desplazamientos y acciones internas.",
        "Explica el cálculo mediante matrices, grados de libertad, transformación, ensamblaje, restricciones, residuos y energía.",
        "Convierte los resultados en diagramas polinomiales exactos por tramo, envolventes, líneas de influencia, trenes de ejes y expedientes PDF reimportables.",
        "Mantiene los proyectos en el navegador y permite exportarlos como JSON, SVG, PNG, CSV, PDF y paquete .structureco.",
    ]:
        story.append(bullet(item))
    story.append(h("Estado actual", 2))
    story.append(simple_table(
        ["Evidencia", "Estado vigente en el snapshot"],
        [
            ["Calidad estática", "npm.cmd run verify ejecutado con exit code 0."],
            ["Lint", "oxlint aprobado."],
            ["Pruebas", "39 archivos aprobados; 227 pruebas aprobadas."],
            ["Build", "tsc -b y vite build aprobados; 2002 módulos transformados."],
            ["QA existente", "Chromium desktop/móvil y WebKit iPhone/iPad con resultados JSON sin errores."],
            ["Producto", "Versión declarada 0.7.0; esquema serializado vigente v5."],
        ],
        widths=[42 * mm, 128 * mm],
    ))
    story.append(Spacer(1, 6))
    story.append(callout("Aviso de alcance", "La herramienta es educativa y de apoyo. Sus resultados deben revisarse con unidades, hipótesis, equilibrio y un cálculo independiente antes de usarse en una decisión real.", RED_PALE, colors.HexColor("#C94B3C")))
    story.append(PageBreak())


def add_runbook(story: list[Flowable]) -> None:
    story.append(h("2. Ejecución, verificación y publicación", 1))
    story.append(h("Instalación y desarrollo", 2))
    story.extend(code_chunks("npm ci\nnpm run dev\n# normalmente: http://localhost:5173", width=100, lines_per_chunk=20))
    story.append(body("El proyecto está en la carpeta structureCo dentro del workspace. El package manager declarado es npm. En PowerShell, si npm.ps1 está bloqueado por ExecutionPolicy, usar npm.cmd."))
    story.append(h("Comandos de calidad", 2))
    story.extend(code_chunks("npm run lint\nnpm test\nnpm run build\nnpm run verify\nnpm run qa\nnpm run qa:webkit", width=100, lines_per_chunk=20))
    story.append(simple_table(
        ["Comando", "Qué hace", "Evidencia"],
        [
            ["npm run verify", "lint + Vitest + build", "Aprobado en el snapshot actual."],
            ["npm run qa", "build + recorrido Playwright Chromium desktop/móvil", "qa-artifacts/qa-results.json y PNGs."],
            ["npm run qa:webkit", "build + importación portable/PDF nativo en WebKit", "qa-artifacts/webkit-results.json y PNGs."],
            ["npx netlify deploy --build", "deploy de preview", "netlify.toml contiene la configuración reproducible."],
            ["npx netlify deploy --prod --build", "deploy de producción", "El vínculo local del sitio no se versiona."],
        ],
        widths=[35 * mm, 75 * mm, 60 * mm],
    ))
    story.append(h("Entradas y salidas principales", 2))
    story.append(simple_table(
        ["Entrada", "Tratamiento", "Salida"],
        [
            ["Modelo dibujado", "ProjectModel normalizado, reparado topológicamente y validado", "análisis o lista de issues"],
            ["JSON", "Migración profunda a esquema v5; rechaza referencias, enums y números inválidos", "proyecto listo para editar"],
            ["PDF nativo", "pdfjs-dist inspecciona texto, snapshot y checksum", "vista previa/importación"],
            [".structureco", "ZIP fflate con manifest, proyecto, análisis y memoria PDF", "proyecto/restauración trazable"],
            ["Resultados", "resumen exacto y unidades activas", "CSV, SVG, PNG, PDF de cálculo"],
        ],
        widths=[38 * mm, 82 * mm, 50 * mm],
    ))
    story.append(PageBreak())


def add_architecture(story: list[Flowable]) -> None:
    story.append(h("3. Arquitectura completa", 1))
    story.append(body("La arquitectura separa el modelo, el motor, el estado y la presentación. La UI no duplica las ecuaciones: el panel Aprender consume la traza emitida por el mismo solver y los Workers devuelven resultados con protocolo explícito."))
    story.append(simple_table(
        ["Capa", "Responsabilidad", "Archivos principales"],
        [
            ["Entrada", "Welcome, creación de ejercicios, barra de herramientas y lienzo SVG", "App.tsx, WelcomeScreen.tsx, NewExerciseDialog.tsx, StructuralCanvas.tsx"],
            ["Estado", "ProjectModel, historial, undo/redo, combinación activa, análisis y cursor", "ProjectContext.tsx, ClassroomSessionContext.tsx"],
            ["Datos", "defaults, migración, persistencia local, topología, selección/copia/división", "defaultProject.ts, migrate.ts, projectStorage.ts, modelOperations.ts"],
            ["Motor", "rigidez, restricciones, cargas equivalentes, recuperación, auditoría y resultados", "solver.ts, math.ts, loadAudit.ts"],
            ["Postproceso", "diagramas, deformada, extremos, envolventes, influencia y trenes", "diagram.ts, resultSummary.ts, envelope.ts, influence.ts"],
            ["Workers", "análisis pesado fuera del hilo de interfaz", "analysis.worker.ts, scenarios.worker.ts, influence.worker.ts"],
            ["Educación", "plantillas, progreso, predicción y guía contextual", "exerciseTemplates.ts, classroomProgress.ts, ClassroomGuide.tsx"],
            ["Interoperabilidad", "JSON, CSV, SVG/PNG, PDF, PDF import y bundle ZIP", "export.ts, resultsExport.ts, calculationPdf.ts, pdfImport.ts, portable*.ts"],
            ["Presentación", "inspector, resultados, influencia, import center, tema, idioma y responsive", "Inspector.tsx, ResultsPanel.tsx, InfluenceLineView.tsx, ImportCenterDialog.tsx, styles.css"],
        ],
        widths=[28 * mm, 76 * mm, 66 * mm],
    ))
    story.append(h("Flujo de datos", 2))
    story.append(callout("Pipeline de análisis", "ProjectModel -> normalize/migrate -> repair topology -> validate -> resolve cases/combinations -> assemble K and F -> impose C and g -> solve -> recover U, lambda and reactions -> audit loads/equilibrium/compatibility -> build exact diagrams/deformation -> summarize/envelope/influence -> render UI/export.", GREEN_PALE, GREEN))
    story.append(h("Carga de trabajo y concurrencia", 2))
    for item in [
        "analysis.worker.ts recibe una solicitud con proyecto y combinación, ejecuta analyzeProject y devuelve la respuesta serializable.",
        "scenarios.worker.ts calcula escenarios/envolventes sin bloquear el lienzo.",
        "influence.worker.ts calcula líneas de influencia y trenes, con fallback local cuando el Worker no está disponible.",
        "ProjectContext invalida resultados al editar o cambiar combinación y descarta respuestas obsoletas mediante token/revisión.",
        "La cámara, marquee y drag se agrupan por frame de animación para reducir renders durante gestos continuos.",
    ]:
        story.append(bullet(item))
    story.append(PageBreak())


def add_domain_model(story: list[Flowable]) -> None:
    story.append(h("4. Modelo de dominio y formato persistente", 1))
    story.append(body("El contrato central está en src/types.ts. El proyecto serializado vigente es schemaVersion 5. El importador no hace una aserción TypeScript superficial: valida tipos, finitud, enums, límites, identificadores, referencias y compatibilidad geométrica."))
    story.append(h("Entidades", 2))
    story.append(simple_table(
        ["Entidad", "Contenido esencial", "Notas"],
        [
            ["NodeModel", "id, x, y, support, internalHinge", "6 GDL globales por nodo en el solver conceptual: Ux, Uy, Rz; rx, ry, rm son reacciones."],
            ["MemberModel", "i, j, type, E, A, I, teoría, G/As, densidad", "frame, truss o rigid; releases, springs y offsets colineales."],
            ["LoadCase", "id, name, category, active, selfWeightFactor", "permanent, variable, accidental u other."],
            ["LoadCombination", "id, name, factors", "factores lineales por caso; metadatos de fuente/jurisdicción opcionales."],
            ["NodalLoad", "fx, fy, mz por nodo y caso", "kN y kN-m internos."],
            ["MemberLoad", "distributed/point/moment, base y coordenadas", "global/local; longitud real/horizontal/vertical; dominios parciales."],
            ["PrescribedDisplacement", "ux, uy, rz o normal", "dependiente del caso; se verifica compatibilidad con restricciones."],
            ["MemberInitialEffect", "temperature o initial-strain", "alpha, deltaT, gradient, axialStrain y curvature."],
            ["ProjectSettings", "unidades, idioma, snap, filtros, escalas, modo", "presentación no altera magnitudes almacenadas."],
            ["AnalysisResult", "U, reacciones, miembro, auditorías, trazas", "incluye residuo, condicionamiento, mecanismo y explicación."],
        ],
        widths=[37 * mm, 74 * mm, 59 * mm],
    ))
    story.append(h("Validación y migración", 2))
    for item in [
        "Versiones v1-v4 se normalizan a v5 con valores compatibles; una versión futura desconocida se rechaza.",
        "Se detectan IDs duplicados, referencias a nodos/miembros/casos inexistentes, longitudes cero, propiedades no finitas, resortes negativos, cargas huérfanas, proyección de longitud nula y cargas intermedias en armaduras.",
        "El almacenamiento conserva una primaria, un respaldo y el payload dañado para recuperación; si ambas copias fallan se carga el proyecto inicial con aviso.",
        "repairProjectTopology fusiona/repara únicamente casos compatibles y divide miembros cuando un nodo activo se encuentra sobre ellos; no conecta cruces ambiguos sin nodo.",
        "La internacionalización es de presentación: ids, números, unidades y resultados no dependen del idioma.",
    ]:
        story.append(bullet(item))
    story.append(h("Tipos de salida de análisis", 2))
    story.append(body("NodeResult contiene desplazamientos y reacciones; MemberResult conserva fuerzas de extremo, segmentos polinomiales, saltos, puntos críticos, diagramas, deformada, extremos y error de compatibilidad. EducationTrace conserva DOFs, matrices dispersas, cargas, restricciones, energía de deformación y transformaciones."))
    story.append(PageBreak())


def add_engine(story: list[Flowable]) -> None:
    story.append(h("5. Motor matemático y comportamiento numérico", 1))
    story.append(body("El motor es estático, lineal-elástico, de primer orden y pequeñas deformaciones. Las unidades internas son kN, m y kN-m; la interfaz convierte solo en entrada/salida."))
    story.append(h("Convenciones", 2))
    for item in [
        "+X global a la derecha; +Y hacia arriba; rotación positiva antihoraria alrededor de +Z.",
        "Cada miembro se orienta de i a j; x local va de i a j y y local es el giro antihorario de x.",
        "Axial positivo = tensión; momento positivo = sagante. El lado gráfico del diagrama puede invertirse sin cambiar el signo numérico.",
        "Relaciones de diagramas: dN/dx = -px(x), dV/dx = py(x), dM/dx = V(x).",
    ]:
        story.append(bullet(item))
    story.append(h("Formulaciones", 2))
    story.append(simple_table(
        ["Elemento", "Formulación", "Capacidades / límites"],
        [
            ["Marco Euler-Bernoulli", "6 GDL locales [ui, vi, thetai, uj, vj, thetaj]; EA/L y flexión EI", "desprecia cortante; matrices y cargas consistentes."],
            ["Marco Timoshenko", "Ks=GAs; phi=12EI/(Ks L^2); bloque de flexión corregido", "incluye deformación por cortante; requiere G y As efectivos."],
            ["Armadura 2D", "EA/L en traslaciones; filas transversales/rotacionales cero", "solo axial; las cargas entre nodos se rechazan."],
            ["Miembro rígido", "vínculo rígido y compatibilidad exacta", "no confundir con un material de rigidez infinita no condicionado."],
            ["Liberación / bisagra", "condensación estática de DOFs de rotación", "la fuerza del grado liberado queda numéricamente nula."],
            ["Conexión semirrígida", "resorte rotacional concentrado y condensación", "rigidez 0 equivale a release; no modela placa/pernos no lineales."],
            ["Zona rígida", "offset colineal desde nodo a cara flexible", "offsets no pueden consumir toda la longitud flexible."],
        ],
        widths=[38 * mm, 69 * mm, 63 * mm],
    ))
    story.append(h("Sistema global y solución", 2))
    story.append(body("Para restricciones y movimientos prescritos se ensambla el sistema aumentado [K C^T; C 0][U; lambda] = [F; g]. Se aplica equilibrado diagonal simétrico, LU con pivoteo parcial escalado, refinamiento iterativo, residuo relativo y estimación de condicionamiento kappa_1 mediante iteraciones de Hager."))
    story.append(body("La detección de mecanismo recupera rango/nulidad y un vector del espacio nulo. Las advertencias de condicionamiento, residuo lineal, error hacia delante y dígitos confiables se incluyen en AnalysisResult; un sistema singular no se disfraza como resultado válido."))
    story.append(h("Cargas y efectos", 2))
    for item in [
        "Cargas nodales fx/fy/mz.",
        "Cargas distribuidas constantes, lineales o parciales, en ejes globales o locales y referidas a longitud real/horizontal/vertical.",
        "Cargas puntuales y momentos puntuales con posición normalizada; saltos de V/M conservados.",
        "Peso propio por densidad y factor por caso; no se confunde una densidad válida con una carga real ausente.",
        "Asentamientos y desplazamientos prescritos por caso/combinación.",
        "Temperatura uniforme, gradiente, deformación axial y curvatura inicial como acciones equivalentes superpuestas linealmente.",
    ]:
        story.append(bullet(item))
    story.append(h("Auditorías y tolerancias", 2))
    story.append(body("El motor compara el resultante de las cargas fuente con el vector ensamblado por una ruta independiente y verifica equilibrio global sumFx, sumFy y sumM. También conserva source/assembled/difference de acciones generalizadas por miembro y el residuo CU-g de compatibilidad."))
    story.append(simple_table(
        ["Diagnóstico", "Regla documentada"],
        [
            ["Residuo normalizado de equilibrio", "advertencia entre 1e-8 y 1e-6; error por encima de 1e-6"],
            ["Auditoría fuente/ensamblaje", "advertencia entre 1e-10 y 1e-8; error por encima de 1e-8"],
            ["Condicionamiento", "advertencia si kappa_1 > 1e12"],
            ["Residuo lineal", "advertencia si residuo relativo > 1e-12 después del refinamiento"],
            ["Pequeñas deformaciones", "aviso si desplazamiento relativo > 0.05L, separación interna > 0.05L o giro > 0.1 rad"],
            ["Geometría coincidente", "tolerancia aproximada 1e-9 por longitud de referencia"],
        ],
        widths=[55 * mm, 115 * mm],
    ))
    story.append(PageBreak())


def add_postprocess(story: list[Flowable]) -> None:
    story.append(h("6. Diagramas, deformada, envolventes e influencia", 1))
    story.append(h("Diagramas exactos por tramo", 2))
    story.append(body("diagram.ts representa N(x), V(x) y M(x) como polinomios por segmento. Integra la intensidad distribuida, aplica saltos laterales de cargas puntuales/momentos, encuentra raíces y extremos interiores y construye puntos críticos. La transformación a Bézier para polinomios de grado tres es analítica; el SVG se adapta para visualización, no para decidir los valores."))
    story.append(h("Deformada", 2))
    story.append(body("Se integran u(x), theta(x) y v(x) por tramo a partir de N/EA, M/EI y, en Timoshenko, V/(GAs). Se conservan coeficientes polinomiales, extremos interiores y compatibilityError contra desplazamientos nodales. Una escala amplificada es representación visual y no una geometría de grandes desplazamientos."))
    story.append(h("Resumen y escenarios", 2))
    for item in [
        "resultSummary.ts calcula extremos exactos de N, V, M, u, v y theta a partir de segmentos, no del muestreo del SVG.",
        "envelope.ts separa tramos en intersecciones de escenarios, desplaza polinomios y conserva la rama gobernante para mínimos/máximos.",
        "Las combinaciones son factores lineales definidos por el usuario; no se generan combinaciones normativas automáticamente.",
        "Los resultados se pueden comparar por caso/combinación, localizar con cursor en el modelo y exportar a CSV.",
    ]:
        story.append(bullet(item))
    story.append(h("Líneas de influencia", 2))
    story.append(body("influence.ts ordena una cadena abierta de miembros frame, crea un caso unitario vertical móvil, resuelve respuestas unitarias y ajusta por tramos cúbicos. El módulo expone N, V y M, límites izquierdo/derecho en discontinuidades, extremos analíticos, diagnósticos de ajuste/solver y validación en abscisas independientes."))
    story.append(body("Las cargas estáticas del proyecto se eliminan de la influencia: el problema responde a la carga unitaria móvil. El cursor del gráfico está vinculado al miembro/corte en el lienzo."))
    story.append(h("Tren de ejes concentrados", 2))
    story.append(body("Para ejes positivos descendentes Pa, offsets da y factor gamma >= 1 se evalúa R(s)=gamma sum Pa psiQ(s+da). Los cambios de polinomio trasladados por cada eje forman la partición exacta del recorrido; se resuelven raíces de R'(s) para extremos sin barrido por una malla de posiciones."))
    story.append(h("Imagen conceptual y evidencia", 2))
    concept = image_flowable(ROOT / "docs" / "design" / "influence-line-concept.png", width=160 * mm)
    if concept:
        story.append(concept)
        story.append(para("Concepto visual existente para explicar una línea de influencia; el módulo implementado además conserva diagnósticos y certificación analítica.", STYLES["Small"]))
    story.append(PageBreak())


def add_ui_education(story: list[Flowable]) -> None:
    story.append(h("7. Funcionalidad visible y experiencia de usuario", 1))
    story.append(h("Herramientas del editor", 2))
    story.append(simple_table(
        ["Herramienta", "Función", "Interacción / notas"],
        [
            ["Seleccionar", "selección simple, múltiple, ventana/cruce", "filtros nodes/members/loads; tecla V y selección por click."],
            ["Desplazar", "pan de cámara", "botón central, Espacio + arrastre, Pan H, un dedo en touch."],
            ["Nodo", "crear/mover nodos", "snapping CAD; drag deliberado; undo agrupa el gesto."],
            ["Miembro", "crear barra/frame/truss/rigid", "entrada rápida por coordenadas o longitud/ángulo."],
            ["Apoyo", "pin, roller, fixed, custom, springs", "rollers orientables y desplazamientos prescritos."],
            ["Carga puntual", "carga nodal o sobre miembro", "placement mode táctil; fx/fy/mz."],
            ["Carga distribuida", "uniforme, lineal, parcial", "base real/horizontal/vertical y eje global/local."],
            ["Momento", "momento nodal o de miembro", "salto exacto de M y sign convention visible."],
            ["Cota", "dimensión gráfica", "labels y grid controlados por settings."],
            ["Dividir miembro", "divide topología y remapea cargas", "conserva propiedades, releases y offsets."],
            ["Corte", "DCL local interactivo", "N/V/M, resultantes, sustitución y residuos."],
            ["Eliminar", "borra objetos", "historial y recuperación respetan referencias."],
        ],
        widths=[33 * mm, 68 * mm, 69 * mm],
    ))
    story.append(h("Paneles y estados", 2))
    for item in [
        "TopBar: nombre/proyecto, casos activos, undo/redo, modo Aula/Completo, unidades, idioma, tema, exportación y Analizar.",
        "Inspector: propiedades de selección, geometría, material/sección, teoría, temperatura, deformación inicial, liberaciones, cargas y apoyos.",
        "ResultsPanel: Resumen, Reacciones, Axial, Cortante, Momento, Influencia, Deformada, Aprender y Avisos.",
        "Import Center: inspección previa, selección de contenido, confirmación de reemplazo, JSON/PDF/.structureco y estado de checksum.",
        "Responsive: layout desktop con inspector lateral y layout mobile con toolbar inferior, menú Más e inspector/modal contenido.",
        "Accesibilidad: ARIA en tabs/selectores, foco, Escape, targets touch >=44 px, estados de herramienta visibles y `lang` sincronizado.",
    ]:
        story.append(bullet(item))
    story.append(h("Modo Aula y educación", 2))
    story.append(body("El modo Aula mantiene el mismo solver y oculta propiedades avanzadas. DeriveClassroomProgress identifica geometría, apoyos, cargas y análisis; ClassroomGuide conduce con predicción previa, revelado progresivo, expectativas machine-checkable y foco sobre nodos/miembros reales."))
    story.append(simple_table(
        ["Plantilla", "Uso", "Parámetros"],
        [
            ["blank", "lienzo vacío", "ninguno"],
            ["simple-beam", "viga simplemente apoyada", "longitud, carga puntual, posición, UDL"],
            ["cantilever", "voladizo", "longitud, carga y posición"],
            ["portal-frame", "pórtico", "longitud, altura, carga"],
            ["triangular-truss", "armadura triangular", "luz, altura, carga central"],
        ],
        widths=[38 * mm, 72 * mm, 60 * mm],
    ))
    story.append(PageBreak())


def add_portable(story: list[Flowable]) -> None:
    story.append(h("8. Persistencia, PDF, importación y expedientes portables", 1))
    story.append(body("El proyecto es local-first: el navegador guarda estado y respaldo. Para mover contexto entre dispositivos o chats se exportan JSON, PDF de cálculo o paquete .structureco. El PDF nativo contiene un snapshot protegido con checksum SHA-256; el importador puede reconocer PDF nativo, externo o escaneado."))
    story.append(h("PDF de cálculo", 2))
    for item in [
        "calculationPdf.ts usa pdf-lib y produce una memoria A4 con portada, modelo, cargas, reacciones, diagramas N-V-M, procedimiento, matrices, auditorías y snapshot portable.",
        "Los números se conservan sin redondear dentro del motor; el PDF aplica formateo de presentación y limpia valores casi cero de forma explícita.",
        "El reporte incluye matrices y traza educativa, por lo que puede reimportarse con el proyecto y análisis originales.",
        "portablePayload.ts canonicaliza JSON, calcula SHA-256 y conserva projectSnapshot, analysisSnapshot, reportMetadata y provenance.",
    ]:
        story.append(bullet(item))
    story.append(h("Paquete .structureco", 2))
    story.append(simple_table(
        ["Archivo / bloque", "Contenido"],
        [
            ["manifest.json", "versión de bundle, lista de archivos, metadatos y nombres."],
            ["structureco-payload.json", "payload portable con snapshot y checksum."],
            ["project.json", "modelo serializado del proyecto."],
            ["analysis.json", "análisis restaurable cuando existe."],
            ["memory.pdf", "memoria de cálculo asociada."],
        ],
        widths=[55 * mm, 115 * mm],
    ))
    story.append(h("Importación PDF", 2))
    story.append(body("pdfImport.ts usa pdfjs-dist para leer texto y clasifica contenido. El centro de importación muestra título, páginas, tipo detectado y acciones antes de reemplazar el proyecto. En iPhone/iPad usa la hoja nativa de compartir cuando está disponible."))
    story.append(h("Formatos de exportación", 2))
    story.append(simple_table(
        ["Formato", "Uso"],
        [
            ["JSON", "backup del modelo editable y compatible con migración."],
            ["CSV", "resumen de resultados, extremos, escenarios e issues."],
            ["SVG", "lienzo/diagramas vectoriales."],
            ["PNG", "captura raster desde SVG."],
            ["PDF", "memoria humana y expediente reimportable."],
            [".structureco", "bundle portátil con proyecto, análisis, memoria y manifest."],
        ],
        widths=[34 * mm, 136 * mm],
    ))
    story.append(PageBreak())


def add_verification(story: list[Flowable]) -> None:
    story.append(h("9. Verificación, QA y evidencia visual", 1))
    story.append(body("El informe vigente docs/VERIFICATION_REPORT.md y la suite actual describen benchmarks analíticos y recorridos de interfaz. En este snapshot se volvió a ejecutar npm.cmd run verify y terminó con exit code 0."))
    story.append(h("Benchmarks estructurales", 2))
    story.append(simple_table(
        ["Familia", "Comprobaciones representativas"],
        [
            ["Vigas", "viga simple puntual/UDL, voladizo puntual/UDL, empotrada-empotrada, carga triangular/parcial."],
            ["Acciones", "momento concentrado, saltos, inclinación y transformación local/global."],
            ["Armadas", "armadura triangular, tensión/compresión, cargas solo en nodos."],
            ["Conexiones", "resortes axial/rotacional, liberaciones, articulación interna, vínculo rígido y zona rígida."],
            ["Superposición", "casos completos y combinaciones lineales."],
            ["Avanzado", "asentamientos, temperatura, curvatura, Timoshenko, deformada, envolvente, influencia y tren de ejes."],
            ["Trazabilidad", "matrices/DOFs/traza educativa coinciden con el análisis real."],
        ],
        widths=[35 * mm, 135 * mm],
    ))
    story.append(h("QA de interfaz", 2))
    story.append(body("qa-artifacts/qa-results.json conserva checks de canvas, pan, pinch, touch, momento, cortante, corte, aprendizaje, idioma, multiselección, división, unidades, tema oscuro, mecanismo, influencia, tren, responsive, proyecto Hibbeler y errores de consola. qa-artifacts/webkit-results.json conserva iPhone 13/iPad Pro 11, ausencia de overflow horizontal, diálogo visible, copia portable, PDF nativo reconocido, targets táctiles y scroll de bienvenida."))
    qa_path = ROOT / "qa-artifacts" / "qa-results.json"
    webkit_path = ROOT / "qa-artifacts" / "webkit-results.json"
    if qa_path.exists():
        story.append(h("Registro JSON de QA Chromium", 3))
        story.extend(code_chunks(file_text(qa_path), width=105, lines_per_chunk=60))
    if webkit_path.exists():
        story.append(h("Registro JSON de QA WebKit", 3))
        story.extend(code_chunks(file_text(webkit_path), width=105, lines_per_chunk=60))
    story.append(h("Capturas existentes", 2))
    image_paths = [
        ROOT / "qa-artifacts" / "desktop.png",
        ROOT / "qa-artifacts" / "mobile.png",
        ROOT / "qa-artifacts" / "influence-line.png",
        ROOT / "qa-artifacts" / "hibbeler-example.png",
    ]
    images = [image_flowable(path, width=82 * mm) for path in image_paths]
    images = [image for image in images if image is not None]
    for start in range(0, len(images), 2):
        row = images[start:start + 2]
        while len(row) < 2:
            row.append(Spacer(82 * mm, 10))
        table = Table([row], colWidths=[85 * mm, 85 * mm], hAlign="LEFT")
        table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 3)]))
        story.append(table)
        labels = [rel(path) for path in image_paths[start:start + 2]]
        story.append(para(" | ".join(labels), STYLES["Tiny"]))
        story.append(Spacer(1, 4))
    story.append(PageBreak())


def add_artifacts(story: list[Flowable]) -> None:
    story.append(h("10. Todo lo generado y dónde está", 1))
    story.append(body("Los artefactos siguientes fueron encontrados en el workspace. Se listan para que el próximo chat sepa qué ya existe, qué es binario visual y qué no debe confundirse con fuente canónica."))
    story.append(h("PDFs existentes", 2))
    pdf_rows: list[list[str]] = []
    for path in artifact_files():
        if path.suffix.lower() != ".pdf":
            continue
        pdf_rows.append([rel(path), f"{path.stat().st_size / 1024:.1f} KB", pdf_pages(path), sha256(path)])
    if pdf_rows:
        story.append(simple_table(["Ruta", "Tamaño", "Páginas", "SHA-256 (16)"] , pdf_rows, widths=[93 * mm, 25 * mm, 20 * mm, 32 * mm]))
    story.append(h("Imágenes y capturas", 2))
    image_rows: list[list[str]] = []
    for path in artifact_files():
        if path.suffix.lower() in {".png", ".jpg", ".jpeg"}:
            image_rows.append([rel(path), f"{path.stat().st_size / 1024:.1f} KB", sha256(path)])
    story.append(simple_table(["Ruta", "Tamaño", "SHA-256 (16)"], image_rows, widths=[118 * mm, 25 * mm, 27 * mm]))
    story.append(h("Build y configuración", 2))
    build_rows: list[list[str]] = []
    for path in sorted((ROOT / "dist").rglob("*") if (ROOT / "dist").exists() else [], key=lambda item: rel(item)):
        if path.is_file():
            build_rows.append([rel(path), f"{path.stat().st_size / 1024:.1f} KB"])
    if build_rows:
        story.append(simple_table(["dist artifact", "Tamaño"], build_rows, widths=[135 * mm, 35 * mm]))
    story.append(body("node_modules no se incluye en el PDF: son dependencias instaladas, no contexto funcional del producto. package-lock.json también se excluye del anexo de código por ser un lockfile generado; package.json sí se conserva."))
    story.append(PageBreak())


def add_limitations(story: list[Flowable]) -> None:
    story.append(h("11. Limitaciones, riesgos y roadmap", 1))
    story.append(h("No implementado o no certificado", 2))
    for item in [
        "P-Delta, pandeo, grandes desplazamientos y no linealidad geométrica.",
        "Plasticidad, rótulas plásticas, daño y no linealidad del material.",
        "Cables, elementos solo a tensión/compresión, contacto y apoyos unilaterales.",
        "Dinámica, modal, espectral, historia de tiempo y generación sísmica.",
        "Placas, cascarones, sólidos, panel zones deformables y diseño normativo.",
        "Trenes móviles con cargas distribuidas, carga viva interior/exterior y envolvente móvil simultánea para todos los cortes.",
        "Matrices dispersas; el solver actual usa matrices densas y escala mal para modelos grandes.",
        "Paridad externa completa con FTool: SC-FT-01 y SC-FT-02 están documentados; SC-FT-03...11 quedan pendientes de archivo externo cerrado.",
        "Interoperabilidad .ftl/.pos completa y catálogo normativo de materiales/secciones.",
    ]:
        story.append(bullet(item))
    story.append(h("Riesgos de interpretación", 2))
    story.append(callout("Hiperestaticidad en Aula", "En estructuras isostáticas, reacciones y N/V/M se determinan por equilibrio. En estructuras hiperestáticas, el reparto depende de E/A/I automáticos; Aula lo advierte y no debe interpretarse como selección física de material.", YELLOW_PALE, colors.HexColor("#C58C00")))
    story.append(Spacer(1, 5))
    story.append(callout("Unidades y signos", "Verificar kN-m, N-mm, kgf-m o kip-ft, orientación i->j, ejes locales, sentido de cargas y lado gráfico. Un diagrama puede dibujarse al lado opuesto sin cambiar su signo numérico.", YELLOW_PALE, colors.HexColor("#C58C00")))
    story.append(Spacer(1, 5))
    story.append(callout("Modelo mal condicionado", "Un residuo pequeño no convierte en confiable un modelo físicamente incorrecto o casi mecanismo. Revisar condición, dígitos confiables, warnings, propiedades y restricciones.", RED_PALE, colors.HexColor("#C94B3C")))
    story.append(h("Roadmap documentado", 2))
    for item in [
        "Completar comparaciones externas FTool SC-FT-03...11 y archivar modelos/versiones/salidas.",
        "Contrastar influencia y tren de ejes contra el tutorial oficial de puente.",
        "Añadir trenes distribuidos, carga viva interior/exterior y superposición móvil-estática.",
        "Biblioteca de materiales/secciones, importación/exportación .ftl y herramientas CAD más avanzadas.",
        "Matrices dispersas para modelos grandes.",
        "P-Delta, plasticidad, dinámica o diseño solo como módulos nuevos con referencias y bancos independientes.",
    ]:
        story.append(bullet(item))
    story.append(PageBreak())


def add_file_map(story: list[Flowable]) -> None:
    story.append(h("12. Mapa completo de archivos", 1))
    story.append(body("Esta tabla es el índice operativo para que un nuevo chat pueda localizar la implementación. Los símbolos públicos se extraen automáticamente del snapshot y sirven como brújula, no como sustituto de leer el contrato completo."))
    paths = text_files()
    rows: list[list[str]] = []
    for path in paths:
        if path.suffix.lower() in {".md", ".json", ".toml", ".html", ".css", ".svg", ".ftl", ".pos", ".txt"} and path.parts[-2:] == ("docs", path.name):
            symbols = "documentación"
        else:
            symbols = key_symbols(path)
        rows.append([rel(path), source_role(path), str(len(file_text(path).splitlines())), symbols[:235]])
    story.append(simple_table(["Archivo", "Rol", "Líneas", "Exports / símbolos clave"], rows, widths=[48 * mm, 36 * mm, 16 * mm, 70 * mm]))
    story.append(PageBreak())


def add_canonical_docs(story: list[Flowable]) -> None:
    story.append(h("13. Documentación canónica preservada", 1))
    story.append(body("Se incorpora el texto de los documentos de proyecto para que el contexto no dependa de enlaces externos. Los nombres y rutas se conservan. La auditoría y el roadmap se marcan como históricos o prospectivos cuando corresponde."))
    doc_paths = [ROOT / "README.md"] + sorted((ROOT / "docs").glob("*.md"), key=lambda item: item.name.lower())
    for index, path in enumerate(doc_paths):
        if index:
            story.append(PageBreak())
        add_markdown(story, path, include_title=True)
    story.append(PageBreak())


def add_full_source(story: list[Flowable]) -> None:
    story.append(h("14. Anexo de código fuente en texto", 1))
    story.append(body("Este anexo conserva el contenido legible de la configuración, scripts, UI, motor, persistencia, utilidades y pruebas. Se excluyen dependencias instaladas, bundles minificados de dist, lockfile y binarios visuales. Las líneas están numeradas para facilitar que otro chat cite una ubicación; los guiones tipográficos se normalizan a ASCII por compatibilidad PDF."))
    paths = text_files()
    for path in paths:
        path_text = rel(path)
        if path.suffix.lower() == ".md":
            continue
        story.append(PageBreak())
        story.append(h(path_text, 2))
        story.append(para(f"Rol: {escape(source_role(path))} | líneas: {len(file_text(path).splitlines())} | tamaño: {path.stat().st_size / 1024:.1f} KB", STYLES["Small"]))
        story.append(para(f"Símbolos públicos: {escape(key_symbols(path)[:420])}", STYLES["Tiny"]))
        story.extend(code_chunks(file_text(path), width=110, lines_per_chunk=68))


def build_story() -> list[Flowable]:
    story: list[Flowable] = []
    add_cover(story)
    add_toc(story)
    add_transfer_prompt(story)
    add_executive_summary(story)
    add_runbook(story)
    add_architecture(story)
    add_domain_model(story)
    add_engine(story)
    add_postprocess(story)
    add_ui_education(story)
    add_portable(story)
    add_verification(story)
    add_artifacts(story)
    add_limitations(story)
    add_file_map(story)
    add_canonical_docs(story)
    add_full_source(story)
    story.append(PageBreak())
    story.append(h("15. Cierre para la siguiente sesión", 1))
    story.append(body("Si el siguiente chat necesita modificar structureCo, debe comenzar leyendo este expediente, luego confirmar el estado del árbol y ejecutar las pruebas pertinentes. Las decisiones de alto riesgo son: cambiar convenciones de signos/unidades, alterar la topología automática, modificar la condensación de liberaciones/conexiones, cambiar la invalidación de resultados, o presentar Aula como si tuviera propiedades físicas reales."))
    story.append(callout("Resumen de una línea", "structureCo es un editor/analizador 2D educativo, local-first y trazable: el modelo se valida, el mismo solver genera resultados y explicaciones, y las limitaciones físicas están declaradas.", GREEN_PALE, GREEN))
    return story


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = ContextDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=22 * mm,
        bottomMargin=20 * mm,
        title="structureCo - Contexto completo del proyecto",
        author="Codex",
        subject="Expediente técnico para transferencia a ChatGPT",
    )
    story = build_story()
    doc.multiBuild(story)
    reader = PdfReader(str(OUTPUT))
    print(json.dumps({
        "output": str(OUTPUT),
        "pages": len(reader.pages),
        "bytes": OUTPUT.stat().st_size,
        "text_files_included": len(text_files()),
        "artifact_files_indexed": len(artifact_files()),
        "sha256_16": sha256(OUTPUT),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
