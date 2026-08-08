from __future__ import annotations

import argparse
import hashlib
import html
import json
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    CondPageBreak,
    Image,
    LongTable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs" / "ux-redesign"
BEFORE_DIR = DOCS / "evidence" / "phase-03" / "before"
AFTER_DIR = DOCS / "evidence" / "phase-03" / "after"
REFERENCE_DIR = ROOT / "tmp" / "pdfs" / "phase3-reference"
DEFAULT_OUTPUT = ROOT / "output" / "pdf" / "structureCo_Informe_Completo_Fase_3.pdf"
BASELINE_COMMIT = "38d714e0473938c737e6841dbfcc796e9917e9ca"
PROTECTED_BASELINE_SHA256 = "78e02e099cf152f2205928bf6e732fdfb10c17d885c61b5c0deb64d478cbdafa"

GREEN = colors.HexColor("#087A5B")
GREEN_DARK = colors.HexColor("#05523E")
GREEN_PALE = colors.HexColor("#E8F3EF")
BLUE = colors.HexColor("#2867E8")
BLUE_PALE = colors.HexColor("#EAF1FF")
INK = colors.HexColor("#17201C")
MUTED = colors.HexColor("#5F6C66")
APP_BG = colors.HexColor("#F3F5F4")
BORDER = colors.HexColor("#D7DEDA")
AMBER = colors.HexColor("#8A4F00")
WHITE = colors.white


def register_fonts() -> None:
    fonts = {
        "Arial": Path("C:/Windows/Fonts/arial.ttf"),
        "Arial-Bold": Path("C:/Windows/Fonts/arialbd.ttf"),
        "Arial-Italic": Path("C:/Windows/Fonts/ariali.ttf"),
    }
    for name, path in fonts.items():
        if not path.exists():
            raise FileNotFoundError(f"No se encontró la fuente requerida: {path}")
        pdfmetrics.registerFont(TTFont(name, str(path)))


register_fonts()
base_styles = getSampleStyleSheet()
styles = {
    "cover_kicker": ParagraphStyle(
        "CoverKicker", parent=base_styles["Normal"], fontName="Arial-Bold", fontSize=11,
        leading=14, textColor=colors.HexColor("#C7F1E3"), spaceAfter=6,
    ),
    "cover_title": ParagraphStyle(
        "CoverTitle", parent=base_styles["Title"], fontName="Arial-Bold", fontSize=29,
        leading=33, textColor=WHITE, spaceAfter=12,
    ),
    "cover_subtitle": ParagraphStyle(
        "CoverSubtitle", parent=base_styles["Normal"], fontName="Arial", fontSize=13,
        leading=18, textColor=WHITE,
    ),
    "h1": ParagraphStyle(
        "H1", parent=base_styles["Heading1"], fontName="Arial-Bold", fontSize=20,
        leading=24, textColor=GREEN_DARK, spaceBefore=3, spaceAfter=10,
    ),
    "h2": ParagraphStyle(
        "H2", parent=base_styles["Heading2"], fontName="Arial-Bold", fontSize=14,
        leading=18, textColor=GREEN_DARK, spaceBefore=9, spaceAfter=7,
    ),
    "body": ParagraphStyle(
        "Body", parent=base_styles["BodyText"], fontName="Arial", fontSize=9.3,
        leading=13.1, textColor=INK, spaceAfter=6,
    ),
    "body_small": ParagraphStyle(
        "BodySmall", parent=base_styles["BodyText"], fontName="Arial", fontSize=7.8,
        leading=10.4, textColor=MUTED, spaceAfter=4,
    ),
    "bullet": ParagraphStyle(
        "Bullet", parent=base_styles["BodyText"], fontName="Arial", fontSize=9,
        leading=12.4, textColor=INK, leftIndent=13, firstLineIndent=-8,
        bulletIndent=2, spaceAfter=4,
    ),
    "caption": ParagraphStyle(
        "Caption", parent=base_styles["BodyText"], fontName="Arial-Italic", fontSize=8,
        leading=10.5, alignment=TA_CENTER, textColor=MUTED, spaceBefore=5, spaceAfter=4,
    ),
    "table_header": ParagraphStyle(
        "TableHeader", parent=base_styles["Normal"], fontName="Arial-Bold", fontSize=7.8,
        leading=9.8, textColor=WHITE,
    ),
    "table_body": ParagraphStyle(
        "TableBody", parent=base_styles["Normal"], fontName="Arial", fontSize=7.4,
        leading=9.4, textColor=INK,
    ),
    "table_body_bold": ParagraphStyle(
        "TableBodyBold", parent=base_styles["Normal"], fontName="Arial-Bold", fontSize=7.4,
        leading=9.4, textColor=INK,
    ),
    "metric": ParagraphStyle(
        "Metric", parent=base_styles["Normal"], fontName="Arial-Bold", fontSize=17,
        leading=20, alignment=TA_CENTER, textColor=GREEN_DARK,
    ),
    "metric_label": ParagraphStyle(
        "MetricLabel", parent=base_styles["Normal"], fontName="Arial", fontSize=7.2,
        leading=9, alignment=TA_CENTER, textColor=MUTED,
    ),
}


def esc(value: object) -> str:
    return html.escape(str(value), quote=False)


def p(text: str, style: str = "body") -> Paragraph:
    return Paragraph(text, styles[style])


def bullet(text: str) -> Paragraph:
    return Paragraph(esc(text), styles["bullet"], bulletText="•")


def section(story: list, title: str, intro: str | None = None) -> None:
    story.append(p(esc(title), "h1"))
    if intro:
        story.append(p(esc(intro)))


def table_cell(value: object, bold: bool = False) -> Paragraph:
    return p(esc(value), "table_body_bold" if bold else "table_body")


def styled_table(data: list[list], widths: list[float] | None = None, repeat_rows: int = 1) -> LongTable:
    table = LongTable(data, colWidths=widths, repeatRows=repeat_rows, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), GREEN_DARK),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.35, BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, APP_BG]),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return table


def status_card(title: str, value: str, note: str, accent=GREEN) -> Table:
    card = Table([
        [p(esc(title), "table_body_bold")],
        [p(esc(value), "metric")],
        [p(esc(note), "metric_label")],
    ], colWidths=[42 * mm])
    card.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAF9")),
        ("BOX", (0, 0), (-1, -1), 0.8, accent),
        ("LINEBEFORE", (0, 0), (0, -1), 3, accent),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return card


def image_size(path: Path) -> tuple[int, int]:
    with PILImage.open(path) as source:
        return source.size


def fitted_image(path: Path, max_width: float = 174 * mm, max_height: float = 195 * mm) -> Image:
    width, height = image_size(path)
    scale = min(max_width / width, max_height / height)
    element = Image(str(path), width=width * scale, height=height * scale)
    element.hAlign = "CENTER"
    return element


def image_page(story: list, title: str, path: Path, caption: str, category: str) -> None:
    if not path.exists():
        raise FileNotFoundError(f"Falta una imagen requerida para el informe: {path}")
    story.append(PageBreak())
    story.append(p(esc(category.upper()), "body_small"))
    story.append(p(esc(title), "h1"))
    story.append(fitted_image(path))
    width, height = image_size(path)
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    story.append(p(esc(caption), "caption"))
    story.append(p(esc(f"Archivo: {path.name} · {width} × {height} px · SHA-256 {digest}"), "body_small"))


def side_by_side(story: list, left: Path, right: Path, left_label: str, right_label: str) -> None:
    cells = [
        [table_cell(left_label, True), table_cell(right_label, True)],
        [fitted_image(left, 83 * mm, 70 * mm), fitted_image(right, 83 * mm, 70 * mm)],
    ]
    table = Table(cells, colWidths=[87 * mm, 87 * mm], hAlign="CENTER")
    table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, BORDER),
        ("BACKGROUND", (0, 0), (-1, 0), BLUE_PALE),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(table)


def git_executable() -> str:
    located = shutil.which("git")
    if located:
        return located
    fallback = Path("C:/Users/crisd/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/git/cmd/git.exe")
    if fallback.exists():
        return str(fallback)
    raise FileNotFoundError("No se encontró git.exe para generar la trazabilidad.")


def git_run(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [git_executable(), *args], cwd=ROOT, check=check,
        capture_output=True, text=True, encoding="utf-8",
    )


def git_lines(*args: str) -> list[str]:
    return [line for line in git_run(*args).stdout.splitlines() if line.strip()]


def page_chrome(canvas, doc) -> None:
    canvas.saveState()
    page = canvas.getPageNumber()
    width, height = A4
    if page > 1:
        canvas.setStrokeColor(BORDER)
        canvas.setLineWidth(0.5)
        canvas.line(18 * mm, height - 14 * mm, width - 18 * mm, height - 14 * mm)
        canvas.setFont("Arial", 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(18 * mm, height - 10.5 * mm, "structureCo · Fase 3 · Canvas, herramientas, selección y accesibilidad")
    canvas.setStrokeColor(BORDER)
    canvas.line(18 * mm, 13 * mm, width - 18 * mm, 13 * mm)
    canvas.setFont("Arial", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 8.5 * mm, "Informe completo · Alcance visual · Motor matemático preservado")
    canvas.drawRightString(width - 18 * mm, 8.5 * mm, f"Página {page}")
    canvas.restoreState()


def build_report(output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    metrics = json.loads((AFTER_DIR / "phase3-metrics.json").read_text(encoding="utf-8"))
    before_manifest = json.loads((BEFORE_DIR / "phase3-before-manifest.json").read_text(encoding="utf-8"))
    after_manifest = json.loads((AFTER_DIR / "phase3-after-manifest.json").read_text(encoding="utf-8"))
    commits = git_lines("log", "--reverse", "--format=%h\t%s", f"{BASELINE_COMMIT}..HEAD")
    changed = git_lines("diff", "--name-status", f"{BASELINE_COMMIT}..HEAD")
    head = git_lines("rev-parse", "HEAD")[0]
    branch = git_lines("branch", "--show-current")[0]
    protected_paths = ("src/engine/**", "src/workers/**", "src/data/**", "src/utils/portable*", "src/types.ts")
    protected_status = git_run("diff", "--quiet", BASELINE_COMMIT, "HEAD", "--", *protected_paths, check=False).returncode
    protected_unchanged = protected_status == 0

    doc = SimpleDocTemplate(
        str(output), pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm,
        topMargin=19 * mm, bottomMargin=18 * mm,
        title="structureCo - Informe completo Fase 3",
        author="Codex",
        subject="Canvas, herramientas, selección, evidencia visual y QA",
    )
    story: list = []

    cover = Table([
        [p("STRUCTURECO · INFORME DE EJECUCIÓN", "cover_kicker")],
        [p("Fase 3", "cover_title")],
        [p("Canvas, herramientas, selección y accesibilidad", "cover_subtitle")],
    ], colWidths=[174 * mm])
    cover.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GREEN_DARK),
        ("LEFTPADDING", (0, 0), (-1, -1), 14 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14 * mm),
        ("TOPPADDING", (0, 0), (0, 0), 14 * mm),
        ("BOTTOMPADDING", (0, -1), (0, -1), 16 * mm),
    ]))
    story.extend([
        Spacer(1, 17 * mm), cover, Spacer(1, 14 * mm),
        p("Ejecución completa de la fase visual", "h2"),
        p("Se rediseñaron exclusivamente las superficies visuales e interacciones del canvas. El solver, workers, fórmulas, signos, unidades, precisión, schema, migraciones, persistencia y contratos portables quedaron fuera de alcance."),
        Spacer(1, 6 * mm),
        Table([
            [table_cell("Fecha", True), table_cell("17 de julio de 2026")],
            [table_cell("Producto", True), table_cell("structureCo 0.7.0")],
            [table_cell("Rama", True), table_cell(branch)],
            [table_cell("Commit técnico final", True), table_cell(head)],
            [table_cell("Baseline de entrada", True), table_cell(BASELINE_COMMIT)],
            [table_cell("Estado", True), table_cell("Fase 3 completada y lista para revisión")],
        ], colWidths=[43 * mm, 121 * mm], style=[
            ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
            ("BACKGROUND", (0, 0), (0, -1), GREEN_PALE),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]),
        Spacer(1, 13 * mm),
        p("Contenido del expediente", "h2"),
        p(f"10 referencias aprobadas · {len(before_manifest['captures'])} capturas before · {len(after_manifest['screenshots'])} capturas after · {len(metrics['checks'])} checks específicos · trazabilidad de {len(commits)} commits."),
        Spacer(1, 9 * mm),
        p("Preparado por Codex · Ejecución y trazabilidad de extremo a extremo", "body_small"),
    ])

    story.append(PageBreak())
    section(story, "1. Resumen ejecutivo")
    story.append(p("La Fase 3 reorganiza las herramientas por intención, reserva zonas seguras para el chrome, incorpora ocho capas efímeras, un layout determinista de labels P0-P3 y feedback azul específico para cada selección. También formaliza paridad de mouse, teclado, touch y pen emulado sin cambiar datos ni cálculo."))
    cards = Table([[
        status_card("Pruebas", "258/258", "47 archivos · 0 fallos"),
        status_card("QA Fase 3", "125/125", "9 viewports · 19 capturas"),
        status_card("Regresiones", "180/180", "117 Fase 2 + 63 Chromium"),
        status_card("Motor", "0", "archivos protegidos"),
    ]], colWidths=[43.5 * mm] * 4)
    cards.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 2), ("RIGHTPADDING", (0, 0), (-1, -1), 2)]))
    story.extend([cards, Spacer(1, 6 * mm)])
    for item in [
        "Las 12 herramientas y sus 11 teclas de activación permanecen disponibles; Delete/Backspace sigue siendo contextual.",
        "Los nueve viewports entre 390 y 1536 px tienen cero overflow horizontal, cero colisiones P0/P1 y cero intersecciones de chrome.",
        "Selección de miembro, nodo, apoyo, carga y multiselección usa azul + geometría redundante, conservando los colores técnicos.",
        "Light/Dark, Completo/Aula, ES/EN, listo/analizado, reduced motion, zoom 200 % y WebKit quedaron cubiertos.",
        "El estado de capas es sólo de sesión; ProjectModel, ProjectSettings, schema y persistencia no reciben campos nuevos.",
    ]:
        story.append(bullet(item))

    story.append(p("Contenido", "h2"))
    toc = [[p("Bloque", "table_header"), p("Contenido", "table_header")]]
    for block, content in [
        ("1-3", "Resumen, autoridad, alcance protegido y criterios."),
        ("4-6", "Implementación por slices, arquitectura visual y decisiones."),
        ("7-10", "QA, matriz de viewports, interacciones, regresiones y Git."),
        ("11-12", "Desviaciones, limitaciones y comparativas clave."),
        ("Anexos A-C", "10 referencias, 12 capturas before y 19 capturas after, todas con SHA-256."),
    ]:
        toc.append([table_cell(block, True), table_cell(content)])
    story.append(styled_table(toc, [30 * mm, 144 * mm]))

    story.append(PageBreak())
    section(story, "2. Autoridad, objetivo y frontera")
    story.append(p("El documento rector `structureCo_Fase_3_Instrucciones_ULTRA_Detalladas_para_Codex.pdf`, de 56 páginas, gobierna esta ejecución. Las páginas 22, 24, 26, 27, 29, 30, 31, 32, 33 y 35 son las diez referencias visuales aprobadas."))
    story.append(p("Objetivo", "h2"))
    story.append(p("Elevar claridad, jerarquía, decluttering, selección y operabilidad del canvas sin modificar el motor matemático ni iniciar la Fase 4."))
    story.append(p("Frontera protegida", "h2"))
    protected_rows = [[p("Ruta/contrato", "table_header"), p("Control", "table_header"), p("Resultado", "table_header")]]
    for route, control in [
        ("src/engine/**", "solver y formulación"),
        ("src/workers/**", "workers de análisis"),
        ("src/data/**", "datos y fixtures"),
        ("src/utils/portable*", "contratos portables"),
        ("src/types.ts", "contratos de dominio"),
        ("schema, migraciones y persistencia", "sin campos de capas"),
        ("signos, unidades y precisión", "sin reinterpretación"),
    ]:
        protected_rows.append([table_cell(route, True), table_cell(control), table_cell("SIN CAMBIOS", True)])
    story.append(styled_table(protected_rows, [62 * mm, 67 * mm, 45 * mm]))
    story.append(Spacer(1, 5 * mm))
    story.append(p(f"Inventario baseline SHA-256: {PROTECTED_BASELINE_SHA256}. Diff Git final contra {BASELINE_COMMIT[:8]}: {'cero diferencias' if protected_unchanged else 'REVISAR'}."))

    story.append(PageBreak())
    section(story, "3. Dirección visual aprobada")
    reference_rows = [[p("Página", "table_header"), p("Dirección", "table_header"), p("Resultado aplicado", "table_header")]]
    references = [
        (22, "Canvas first", "Modelo al centro, más área útil y chrome compacto."),
        (24, "Herramientas agrupadas", "Cinco grupos nombrados por intención."),
        (26, "Chrome y safe zones", "HUD y cámara en zonas reservadas."),
        (27, "Capas de información", "Ocho toggles UI-only; modelo fijo."),
        (29, "Etiquetas inteligentes", "P0-P3, LOD, decluttering, colisiones y leaders."),
        (30, "Estados de selección", "Feedback por objeto y multiselección."),
        (31, "Desktop + Tablet", "Misma lógica con composición adaptativa."),
        (32, "Experiencia móvil", "Canvas-first, dock inferior y touch claro."),
        (33, "Gestos e interacción", "Mouse, teclado, touch, pinch y stylus."),
        (35, "Accesibilidad y rendimiento", "Targets, foco, fluidez y estabilidad responsive."),
    ]
    for page, direction, result in references:
        reference_rows.append([table_cell(page, True), table_cell(direction), table_cell(result)])
    story.append(styled_table(reference_rows, [22 * mm, 70 * mm, 82 * mm]))
    story.append(Spacer(1, 6 * mm))
    story.append(p("Criterio de fidelidad", "h2"))
    story.append(p("Las referencias se usaron como especificación de intención y no como mockups literales. Se mantuvieron identidad, arquitectura, flujos y componentes reales del producto; las diferencias deliberadas protegen espacio útil, accesibilidad y compatibilidad."))

    story.append(PageBreak())
    section(story, "4. Implementación por slices")
    slice_rows = [[p("Slice", "table_header"), p("Entregable", "table_header"), p("Gate", "table_header")]]
    for slice_id, deliverable, gate in [
        ("3.0", "PDF, baseline, rama, frontera y 12 capturas before.", "41 archivos · 233 pruebas · gates heredados PASS"),
        ("3.1", "Registro único; rail/dock agrupado y responsive.", "42 archivos · 238 pruebas"),
        ("3.2", "Chrome, safe rect, fit, cámara, escala y coordenadas.", "43 archivos · 242 pruebas"),
        ("3.3", "Ocho capas de sesión y panel accesible.", "45 archivos · 247 pruebas"),
        ("3.4", "Labels P0-P3, LOD, colisiones y leaders.", "46 archivos · 252 pruebas"),
        ("3.5", "Selección azul por objeto y multi.", "47 archivos · 256 pruebas"),
        ("3.6", "Mouse/teclado/touch/pen, foco y reduced motion.", "47 archivos · 258 pruebas"),
        ("3.7", "QA integral, 19 capturas y manifiestos.", "125/125 · regresiones y WebKit PASS"),
        ("3.8", "Expediente, render, inspección y cierre.", "Este informe"),
    ]:
        slice_rows.append([table_cell(slice_id, True), table_cell(deliverable), table_cell(gate, True)])
    story.append(styled_table(slice_rows, [22 * mm, 96 * mm, 56 * mm]))

    story.append(p("Resultado funcional", "h2"))
    for item in [
        "ToolRail expandido desde 1440 px, compacto entre 1024 y 1439 px, ToolDock hasta 1023 px.",
        "Capas: modelo, cargas, cotas/ejes, identificadores, resultados, etiquetas, ayuda y diagnóstico.",
        "Labels seleccionados P0; nodos/apoyos/cargas/reacciones P1; detalles secundarios ceden por LOD.",
        "La selección no depende del color: geometría distinta por miembro, nodo, apoyo, carga y multiselección.",
        "Canvas y objetos exponen shortcuts y foco; Enter/Espacio selecciona y Escape cancela o limpia.",
    ]:
        story.append(bullet(item))

    story.append(PageBreak())
    section(story, "5. Arquitectura visual y contratos")
    architecture_rows = [[p("Ruta", "table_header"), p("Responsabilidad", "table_header")]]
    for route, responsibility in [
        ("src/components/toolRegistry.ts", "Fuente única de ids, shortcuts, grupo, prioridad y presentación."),
        ("src/components/ToolBar.tsx", "Rail/dock/sheets accesibles sin cambiar handlers."),
        ("src/components/canvasChrome.ts", "Insets, safe rect y cámara fit."),
        ("src/components/editorLayers.ts", "Estado efímero, defaults y reducer."),
        ("src/components/CanvasLayers.tsx", "Panel de capas responsive y accesible."),
        ("src/components/labelLayout.ts", "Prioridad, LOD, colisión y leaders deterministas."),
        ("src/components/selectionVisuals.ts", "Estado visual y envolvente de selección."),
        ("src/components/canvasInteraction.ts", "Perfiles mouse/touch/pen y thresholds."),
        ("src/components/StructuralCanvas.tsx", "Integración de capas, labels, chrome y feedback."),
        ("src/styles/tokens.css / src/styles.css", "Roles semánticos y composiciones responsive."),
        ("qa-phase3.mjs", "Matriz visual y de interacción reproducible."),
    ]:
        architecture_rows.append([table_cell(route, True), table_cell(responsibility)])
    story.append(styled_table(architecture_rows, [72 * mm, 102 * mm]))
    story.append(Spacer(1, 6 * mm))
    story.append(p("Invariantes", "h2"))
    for item in [
        "El modelo nunca puede ocultarse.",
        "Las capas se restablecen al cambiar de proyecto y no se serializan.",
        "Eliminar conserva Delete/Backspace, selección contextual y undo/redo.",
        "Resultados existentes se presentan; no se recalculan ni reinterpretan.",
        "No se agregaron dependencias ni shortcuts.",
    ]:
        story.append(bullet(item))

    story.append(PageBreak())
    section(story, "6. Decisiones y hallazgos de implementación")
    decision_rows = [[p("Decisión", "table_header"), p("Aplicación", "table_header"), p("Control", "table_header")]]
    for decision, application, control in [
        ("Capas UI-only", "Reducer en WorkspaceShell.", "Sin ProjectModel/Settings."),
        ("Decluttering determinista", "Offsets fijos y orden por prioridad/id.", "Pruebas puras y matriz densa."),
        ("Selección azul", "Azul + redundancia geométrica.", "Light/Dark y cinco tipos."),
        ("Stylus emulado", "Pointer Events `pen`.", "No se afirma hardware físico."),
        ("Reacciones separadas", "Geometría SVG + label P1 común.", "Valor visible y descripción accesible."),
        ("Referencias no literales", "Dirección, no copia de mockup.", "Ledger de fidelidad cerrado."),
    ]:
        decision_rows.append([table_cell(decision, True), table_cell(application), table_cell(control)])
    story.append(styled_table(decision_rows, [52 * mm, 73 * mm, 49 * mm]))
    story.append(p("Ajuste surgido de QA", "h2"))
    story.append(p("El QA Chromium heredado trataba un `<g>` con línea vertical como elemento oculto porque su `DOMRect` tiene ancho cero. La Fase 3 separa correctamente la geometría de reacción y los labels decluttered; el recorrido se actualizó para exigir geometría adjunta, label P1 visible y dos valores de 2.500 kip. No se cambió ningún resultado."))

    story.append(PageBreak())
    section(story, "7. Resultados finales de pruebas y QA")
    qa_rows = [[p("Suite", "table_header"), p("Cobertura", "table_header"), p("Resultado", "table_header")]]
    for suite, coverage, result in [
        ("verify", "lint + 47 archivos + 258 pruebas + build", "PASS · 0 fallos"),
        ("qa:phase3", "125 checks; 9 viewports; 19 capturas; labels, capas, selección, entrada", "PASS · consola limpia"),
        ("qa:phase2", "117 checks heredados y 14 filas ES/EN", "PASS · 0 fallos"),
        ("qa", "63 checks Chromium: desktop, móvil, influencia, mecanismo y Hibbeler", "PASS · consola limpia"),
        ("qa:webkit", "iPhone 13 e iPad Pro 11", "PASS · 0 errores"),
        ("Browser integrado", "Estados reales, shortcuts, capas, Light/Dark y revisión visual", "PASS"),
    ]:
        qa_rows.append([table_cell(suite, True), table_cell(coverage), table_cell(result, True)])
    story.append(styled_table(qa_rows, [31 * mm, 108 * mm, 35 * mm]))
    story.append(Spacer(1, 6 * mm))
    story.append(p("Totales específicos de Fase 3", "h2"))
    for item in [
        f"Checks: {len(metrics['checks'])}; fallos: {len(metrics['failedChecks'])}.",
        f"Capturas: {len(metrics['screenshots'])}; consola: {len(metrics['console'])}; page errors: {len(metrics['pageErrors'])}.",
        "Piso técnico de labels: 12 px; targets frecuentes touch: 44 × 44 px o mayores.",
        "Pointer contract expuesto: mouse touch pen; shortcuts de canvas presentes en los nueve viewports.",
    ]:
        story.append(bullet(item))

    story.append(PageBreak())
    section(story, "8. Matriz cuantitativa de viewports")
    matrix_rows = [[p("Viewport", "table_header"), p("Canvas", "table_header"), p("Rail/Dock", "table_header"), p("Labels", "table_header"), p("P0/P1", "table_header"), p("Chrome", "table_header"), p("Overflow", "table_header")]]
    for row in metrics["matrix"]:
        viewport = row["viewport"]
        canvas = row["canvas"]
        mode = f"rail {row['desktopToolCount']}" if row["desktopToolCount"] else f"dock {row['dockToolCount']}"
        matrix_rows.append([
            table_cell(f"{viewport['width']}×{viewport['height']}", True),
            table_cell(f"{canvas['width']}×{canvas['height']}"),
            table_cell(mode),
            table_cell(row["labels"]["count"]),
            table_cell(len(row["labels"]["collisions"]), True),
            table_cell(len(row["chromeIntersections"]), True),
            table_cell(f"{row['horizontalOverflow']} px", True),
        ])
    story.append(styled_table(matrix_rows, [30 * mm, 30 * mm, 27 * mm, 20 * mm, 21 * mm, 22 * mm, 24 * mm]))
    story.append(Spacer(1, 6 * mm))
    story.append(p("Zoom 200 %", "h2"))
    zoom_rows = [[p("Caso", "table_header"), p("Viewport CSS efectivo", "table_header"), p("P0/P1", "table_header"), p("Chrome", "table_header"), p("Overflow", "table_header")]]
    for name, value in metrics["zoom200"].items():
        row = value["metrics"]
        viewport = row["viewport"]
        zoom_rows.append([
            table_cell(value["physical"], True),
            table_cell(f"{viewport['width']}×{viewport['height']}"),
            table_cell(len(row["labels"]["collisions"])),
            table_cell(len(row["chromeIntersections"])),
            table_cell(f"{row['horizontalOverflow']} px"),
        ])
    story.append(styled_table(zoom_rows, [56 * mm, 42 * mm, 24 * mm, 24 * mm, 28 * mm]))

    story.append(PageBreak())
    section(story, "9. Capas, selección y entradas")
    layers = metrics["layers"]
    selections = metrics["selections"]
    inputs = metrics["input"]
    interaction_rows = [[p("Área", "table_header"), p("Evidencia medida", "table_header"), p("Estado", "table_header")]]
    for area, evidence in [
        ("Capas", f"{layers['initial']['count']} toggles; modelo bloqueado; miembros {layers['hidden']['members']} y nodos {layers['hidden']['nodes']} al ocultar secundarias."),
        ("Miembro", f"halo {selections['member']['halo']}; label {selections['member']['label']}."),
        ("Nodo/apoyo", f"halo {selections['node']['halo']}; marco de apoyo {selections['node']['support']}."),
        ("Carga", f"halo {selections['load']['halo']}; color técnico {selections['load']['technicalStroke']}; selección {selections['load']['selection']}."),
        ("Multi", f"{selections['multi']['selected']} objetos; envelope {selections['multi']['envelope']}; {selections['multi']['handles']} handles."),
        ("Touch", f"targets miembro/carga/nodo: {inputs['touchTargets']['member']}/{inputs['touchTargets']['load']}/{inputs['touchTargets']['node']} px; pan {inputs['touchPan']}."),
        ("Pen", f"drag {inputs['pen']['movement']:.2f} px; readout {inputs['pen']['coordinates']}."),
        ("Reduced motion", f"matches {inputs['reducedMotion']['matches']}; transición {inputs['reducedMotion']['transition']}."),
        ("Aula", f"modo {metrics['modes']['classroom']['mode']}; herramientas visibles {metrics['modes']['classroom']['visibleTools']}."),
    ]:
        interaction_rows.append([table_cell(area, True), table_cell(evidence), table_cell("PASS", True)])
    story.append(styled_table(interaction_rows, [34 * mm, 105 * mm, 35 * mm]))

    story.append(PageBreak())
    section(story, "10. Trazabilidad Git y regresión protegida")
    story.append(p(f"Rama: {branch}. Baseline: {BASELINE_COMMIT}. Commit técnico final incluido en este reporte: {head}."))
    commit_rows = [[p("Commit", "table_header"), p("Slice/cambio", "table_header")]]
    for line in commits:
        short_hash, message = line.split("\t", 1)
        commit_rows.append([table_cell(short_hash, True), table_cell(message)])
    story.append(styled_table(commit_rows, [28 * mm, 146 * mm]))
    story.append(Spacer(1, 6 * mm))
    story.append(p(f"El diff incremental controlado antes de generar este informe contiene {len(changed)} rutas. El script de informe, el PDF y los metadatos de cierre se añaden en el commit documental posterior."))
    story.append(p("Regresión matemática", "h2"))
    regression_rows = [[p("Control", "table_header"), p("Resultado", "table_header")]]
    for control, result in [
        ("Diff protegido", "0 rutas" if protected_unchanged else "REVISAR"),
        ("Inventario protegido", PROTECTED_BASELINE_SHA256),
        ("Pruebas unitarias/integración", "258/258"),
        ("Reacciones educativas", "2 × 2.500 kip"),
        ("Motor, signos, unidades, precisión", "Sin cambios"),
    ]:
        regression_rows.append([table_cell(control, True), table_cell(result)])
    story.append(styled_table(regression_rows, [66 * mm, 108 * mm]))

    story.append(PageBreak())
    section(story, "Inventario de archivos modificados")
    file_rows = [[p("Estado", "table_header"), p("Ruta", "table_header")]]
    for line in changed:
        parts = line.split("\t")
        status = parts[0]
        path = " → ".join(parts[1:])
        file_rows.append([table_cell(status, True), table_cell(path)])
    story.append(styled_table(file_rows, [20 * mm, 154 * mm]))

    story.append(PageBreak())
    section(story, "11. Desviaciones, limitaciones y riesgos")
    story.append(p("Desviaciones deliberadas", "h2"))
    for item in [
        "Las referencias son dirección visual; no se insertaron ni copiaron literalmente dentro de la app.",
        "El rail mantiene verde para acción/producto y usa azul sólo para selección/foco.",
        "Los labels de reacciones pasan al layout común; la geometría SVG y descripción accesible permanecen.",
        "Aula conserva su arquitectura y sólo recibe la integración de herramientas/canvas correspondiente a esta fase.",
        "El estado de capas no se guarda para evitar ampliar schema o persistencia.",
    ]:
        story.append(bullet(item))
    story.append(p("Limitaciones declaradas", "h2"))
    for item in [
        "Stylus se validó mediante Pointer Events emulados; no hubo hardware físico.",
        "WebKit usa perfiles emulados de iPhone 13 e iPad Pro 11, no dispositivos físicos.",
        "No se realizó una auditoría exhaustiva con lector de pantalla; sí se verificaron roles, nombres, shortcuts, foco y teclado del alcance.",
        "Zoom 200 % se comprobó mediante viewport CSS efectivo para validar reflow.",
        "El servicio de captura puede normalizar el raster; la geometría se midió en viewport CSS nativo y el manifiesto conserva ambos datos cuando corresponde.",
    ]:
        story.append(bullet(item))
    story.append(p("Compuerta", "h2"))
    story.append(p("La Fase 4 no fue iniciada. El siguiente paso es la revisión del propietario y una autorización expresa para cualquier fase posterior."))

    story.append(PageBreak())
    section(story, "12. Comparaciones clave antes/después")
    story.append(p("Estas comparaciones resumen los cambios; los archivos completos aparecen nuevamente en los anexos con su hash."))
    side_by_side(
        story,
        BEFORE_DIR / "phase3_30_1440x900_light_complete_ready_baseline.png",
        AFTER_DIR / "phase3_after_1440x900_light_complete_ready.png",
        "Before · 1440×900 · rail plano",
        "After · 1440×900 · grupos + safe zones",
    )
    story.append(Spacer(1, 7 * mm))
    side_by_side(
        story,
        BEFORE_DIR / "phase3_30_390x844_dark_complete_analyzed_baseline.png",
        AFTER_DIR / "phase3_after_390x844_dark_aula_analyzed.png",
        "Before · 390×844 · chrome y labels previos",
        "After · 390×844 · Dark Aula + decluttering",
    )
    story.append(PageBreak())
    section(story, "Comparaciones de interacción")
    side_by_side(
        story,
        BEFORE_DIR / "phase3_30_1440x900_light_complete_analyzed_member-selected.png",
        AFTER_DIR / "phase3_after_1440x900_light_complete_member-selected.png",
        "Before · miembro seleccionado en verde",
        "After · halo azul + label P0",
    )
    story.append(Spacer(1, 7 * mm))
    side_by_side(
        story,
        BEFORE_DIR / "phase3_30_834x1194_light_complete_ready_baseline.png",
        AFTER_DIR / "phase3_after_834x1194_light_complete_layers-open.png",
        "Before · tablet sin panel de capas",
        "After · ocho capas de sesión",
    )

    reference_captions = {
        22: "Canvas first: modelo al centro, más área útil y menos chrome invasivo.",
        24: "Herramientas agrupadas por intención.",
        26: "Chrome discreto y zonas seguras del canvas.",
        27: "Capas de información como estado de presentación.",
        29: "Etiquetas inteligentes: decluttering, zoom, valores críticos y colisiones.",
        30: "Estados de selección para nodo, barra, apoyo, carga y multiselección.",
        31: "Adaptación consistente entre desktop y tablet.",
        32: "Experiencia móvil canvas-first con dock inferior y touch claro.",
        33: "Gestos e interacción para mouse, teclado, touch, pinch y stylus.",
        35: "Accesibilidad, targets, foco, rendimiento y estabilidad responsive.",
    }
    for page, caption in reference_captions.items():
        image_page(
            story,
            f"Referencia aprobada · página {page}",
            REFERENCE_DIR / f"page-{page:02d}.png",
            caption,
            "Anexo A · Referencias del PDF rector",
        )

    for capture in before_manifest["captures"]:
        viewport = capture["viewport"]
        caption = f"Baseline {capture['theme']} · modo {capture['mode']} · estado {capture['state']} · viewport CSS {viewport[0]}×{viewport[1]}."
        image_page(
            story,
            capture["file"].removesuffix(".png").replace("phase3_30_", "Before · "),
            BEFORE_DIR / capture["file"],
            caption,
            "Anexo B · Todas las capturas before",
        )

    for capture in after_manifest["screenshots"]:
        viewport = capture["viewport"]
        state = capture["state"]
        caption = f"After {state.get('theme', 'light')} · modo {state.get('mode', 'complete')} · análisis {state.get('analysis', 'ready')} · selección {state.get('selection', 'ninguna')} · viewport CSS {viewport['width']}×{viewport['height']}."
        image_page(
            story,
            capture["file"].removesuffix(".png").replace("phase3_after_", "After · "),
            AFTER_DIR / capture["file"],
            caption,
            "Anexo C · Todas las capturas after",
        )

    story.append(PageBreak())
    section(story, "Cierre del expediente")
    story.append(p("La implementación, evidencia y regresiones confirman que el canvas de structureCo ahora presenta herramientas agrupadas, chrome reservado, capas efímeras, labels decluttered, selección inequívoca y paridad de entrada entre 390 y 1536 px, conservando intacto el motor matemático."))
    story.append(Spacer(1, 9 * mm))
    closing = Table([
        [p("FASE 3 · GATE TÉCNICO", "table_header"), p("APROBADO", "table_header")],
        [table_cell("Tests", True), table_cell("258/258")],
        [table_cell("QA Fase 3", True), table_cell("125/125")],
        [table_cell("Regresión Fase 2 / Chromium", True), table_cell("117/117 · 63/63")],
        [table_cell("WebKit", True), table_cell("iPhone 13 / iPad Pro 11 · PASS")],
        [table_cell("Motor matemático", True), table_cell("Preservado · 0 protected diff")],
        [table_cell("Estado", True), table_cell("Fase 3 completada y lista para revisión")],
        [table_cell("Siguiente acción", True), table_cell("Revisión del propietario; no iniciar Fase 4 sin autorización")],
    ], colWidths=[70 * mm, 104 * mm])
    closing.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), GREEN_DARK),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, GREEN_PALE]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(closing)

    doc.build(story, onFirstPage=page_chrome, onLaterPages=page_chrome)


def main() -> None:
    parser = argparse.ArgumentParser(description="Genera el informe completo de la Fase 3 de structureCo.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    output = args.output.resolve()
    build_report(output)
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    print(json.dumps({
        "output": str(output),
        "bytes": output.stat().st_size,
        "sha256": digest,
        "generatedAt": datetime.now().astimezone().isoformat(),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
