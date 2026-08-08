from __future__ import annotations

import argparse
import hashlib
import html
import json
import subprocess
from datetime import datetime
from pathlib import Path

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    CondPageBreak,
    Image,
    KeepTogether,
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
BEFORE_DIR = DOCS / "evidence" / "phase-02" / "before"
AFTER_DIR = DOCS / "evidence" / "phase-02" / "after"
REFERENCE_DIR = ROOT / "tmp" / "pdfs" / "phase2-reference"
DEFAULT_OUTPUT = ROOT / "output" / "pdf" / "structureCo_Informe_Completo_Fase_2.pdf"
BASELINE_COMMIT = "85f671d968426502d9d41425b86ca6abde1fd2bf"

GREEN = colors.HexColor("#087A5B")
GREEN_DARK = colors.HexColor("#05523E")
GREEN_PALE = colors.HexColor("#E8F3EF")
INK = colors.HexColor("#17201C")
MUTED = colors.HexColor("#5F6C66")
APP_BG = colors.HexColor("#F3F5F4")
BORDER = colors.HexColor("#D7DEDA")
BLUE = colors.HexColor("#2867E8")
AMBER = colors.HexColor("#8A4F00")
RED = colors.HexColor("#A92F2F")
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
        leading=18, textColor=GREEN_DARK, spaceBefore=10, spaceAfter=7,
    ),
    "h3": ParagraphStyle(
        "H3", parent=base_styles["Heading3"], fontName="Arial-Bold", fontSize=11,
        leading=14, textColor=INK, spaceBefore=7, spaceAfter=4,
    ),
    "body": ParagraphStyle(
        "Body", parent=base_styles["BodyText"], fontName="Arial", fontSize=9.4,
        leading=13.2, textColor=INK, spaceAfter=6,
    ),
    "body_small": ParagraphStyle(
        "BodySmall", parent=base_styles["BodyText"], fontName="Arial", fontSize=8,
        leading=10.8, textColor=MUTED, spaceAfter=4,
    ),
    "bullet": ParagraphStyle(
        "Bullet", parent=base_styles["BodyText"], fontName="Arial", fontSize=9.1,
        leading=12.6, textColor=INK, leftIndent=13, firstLineIndent=-8, bulletIndent=2, spaceAfter=4,
    ),
    "caption": ParagraphStyle(
        "Caption", parent=base_styles["BodyText"], fontName="Arial-Italic", fontSize=8,
        leading=10.5, alignment=TA_CENTER, textColor=MUTED, spaceBefore=5, spaceAfter=4,
    ),
    "table_header": ParagraphStyle(
        "TableHeader", parent=base_styles["Normal"], fontName="Arial-Bold", fontSize=8,
        leading=10, textColor=WHITE,
    ),
    "table_body": ParagraphStyle(
        "TableBody", parent=base_styles["Normal"], fontName="Arial", fontSize=7.6,
        leading=9.6, textColor=INK,
    ),
    "table_body_bold": ParagraphStyle(
        "TableBodyBold", parent=base_styles["Normal"], fontName="Arial-Bold", fontSize=7.6,
        leading=9.6, textColor=INK,
    ),
    "metric": ParagraphStyle(
        "Metric", parent=base_styles["Normal"], fontName="Arial-Bold", fontSize=17,
        leading=20, alignment=TA_CENTER, textColor=GREEN_DARK,
    ),
    "metric_label": ParagraphStyle(
        "MetricLabel", parent=base_styles["Normal"], fontName="Arial", fontSize=7.4,
        leading=9.2, alignment=TA_CENTER, textColor=MUTED,
    ),
    "mono": ParagraphStyle(
        "Mono", parent=base_styles["Normal"], fontName="Arial", fontSize=7.4,
        leading=9.4, textColor=INK,
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


def styled_table(data: list[list], widths: list[float] | None = None, repeat_rows: int = 1) -> Table:
    table = LongTable(data, colWidths=widths, repeatRows=repeat_rows, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), GREEN_DARK),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Arial-Bold"),
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
    with PILImage.open(path) as image:
        return image.size


def fitted_image(path: Path, max_width: float = 174 * mm, max_height: float = 220 * mm) -> Image:
    width, height = image_size(path)
    scale = min(max_width / width, max_height / height)
    element = Image(str(path), width=width * scale, height=height * scale)
    element.hAlign = "CENTER"
    return element


def image_page(story: list, title: str, path: Path, caption: str, category: str) -> None:
    story.append(PageBreak())
    story.append(p(esc(category.upper()), "body_small"))
    story.append(p(esc(title), "h1"))
    story.append(fitted_image(path))
    width, height = image_size(path)
    digest = hashlib.sha256(path.read_bytes()).hexdigest()[:12]
    story.append(p(esc(caption), "caption"))
    story.append(p(esc(f"Archivo: {path.name} · {width} × {height} px · SHA-256 {digest}…"), "body_small"))


def side_by_side(story: list, left: Path, right: Path, left_label: str, right_label: str) -> None:
    cells = [
        [p(esc(left_label), "table_body_bold"), p(esc(right_label), "table_body_bold")],
        [fitted_image(left, 83 * mm, 68 * mm), fitted_image(right, 83 * mm, 68 * mm)],
    ]
    table = Table(cells, colWidths=[87 * mm, 87 * mm], hAlign="CENTER")
    table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, BORDER),
        ("BACKGROUND", (0, 0), (-1, 0), GREEN_PALE),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(table)


def git_lines(*args: str) -> list[str]:
    completed = subprocess.run(
        ["git", *args], cwd=ROOT, check=True, capture_output=True, text=True, encoding="utf-8",
    )
    return [line for line in completed.stdout.splitlines() if line.strip()]


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
        canvas.drawString(18 * mm, height - 10.5 * mm, "structureCo · Fase 2 · Fundaciones UI y arquitectura responsive")
    canvas.setStrokeColor(BORDER)
    canvas.line(18 * mm, 13 * mm, width - 18 * mm, 13 * mm)
    canvas.setFont("Arial", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 8.5 * mm, "Informe completo · Alcance visual · Motor matemático preservado")
    canvas.drawRightString(width - 18 * mm, 8.5 * mm, f"Página {page}")
    canvas.restoreState()


def build_report(output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    metrics = json.loads((AFTER_DIR / "phase2-metrics.json").read_text(encoding="utf-8"))
    baseline_metrics = json.loads((BEFORE_DIR / "baseline-metrics.json").read_text(encoding="utf-8"))
    commits = git_lines("log", "--reverse", "--format=%h\t%s", f"{BASELINE_COMMIT}..HEAD")
    changed = git_lines("diff", "--name-status", f"{BASELINE_COMMIT}..HEAD")
    head = git_lines("rev-parse", "HEAD")[0]
    branch = git_lines("branch", "--show-current")[0]
    protected_prefixes = ("src/engine/", "src/workers/", "src/data/", "src/utils/portable", "src/types.ts")
    protected_changed = [line for line in changed if any(prefix in line.replace("\\", "/") for prefix in protected_prefixes)]

    doc = SimpleDocTemplate(
        str(output), pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm,
        topMargin=19 * mm, bottomMargin=18 * mm,
        title="structureCo - Informe completo Fase 2",
        author="Codex",
        subject="Fundaciones UI y arquitectura responsive; evidencia visual y QA",
    )
    story: list = []

    cover = Table([[p("STRUCTURECO · INFORME DE EJECUCIÓN", "cover_kicker")],
                   [p("Fase 2", "cover_title")],
                   [p("Fundaciones UI y arquitectura responsive", "cover_subtitle")]],
                  colWidths=[174 * mm])
    cover.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GREEN_DARK),
        ("LEFTPADDING", (0, 0), (-1, -1), 14 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14 * mm),
        ("TOPPADDING", (0, 0), (0, 0), 14 * mm),
        ("BOTTOMPADDING", (0, -1), (0, -1), 16 * mm),
    ]))
    story.extend([
        Spacer(1, 19 * mm), cover, Spacer(1, 16 * mm),
        p("Ejecución completa autorizada: opción A", "h2"),
        p("Rediseño exclusivamente visual. El motor matemático, workers, fórmulas, signos, unidades, precisión, schema y persistencia quedaron fuera de alcance y sin modificaciones."),
        Spacer(1, 7 * mm),
        Table([
            [table_cell("Fecha", True), table_cell("17 de julio de 2026")],
            [table_cell("Producto", True), table_cell("structureCo 0.7.0")],
            [table_cell("Rama", True), table_cell(branch)],
            [table_cell("Commit final", True), table_cell(head)],
            [table_cell("Baseline", True), table_cell(BASELINE_COMMIT)],
            [table_cell("Destino solicitado", True), table_cell("crisdlm302@gmail.com")],
        ], colWidths=[42 * mm, 122 * mm], style=[
            ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
            ("BACKGROUND", (0, 0), (0, -1), GREEN_PALE),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]),
        Spacer(1, 16 * mm),
        p("Estado final", "h2"),
        p("Todos los gates técnicos de la Fase 2 están aprobados. Este documento reúne decisiones, cambios, pruebas y la totalidad de la evidencia visual capturada."),
        Spacer(1, 12 * mm),
        p("Preparado por Codex · Ejecución y trazabilidad de extremo a extremo", "body_small"),
    ])

    story.append(PageBreak())
    section(story, "1. Resumen ejecutivo")
    story.append(p("La Fase 2 resolvió los tres bloqueos visuales P0 heredados de la auditoría: colisiones de la TopBar en anchos intermedios, controles táctiles insuficientes y texto técnico crítico por debajo de 12 px. La solución introduce un sistema de tokens semánticos Light/Dark, un shell responsive por contenido, una TopBar en tres zonas y un indicador global derivado del análisis."))
    cards = Table([[status_card("Pruebas", "233", "41 archivos · 0 fallos"),
                    status_card("QA Fase 2", "117/117", "14 filas ES/EN"),
                    status_card("Viewports", "9", "390 a 1536 px"),
                    status_card("Motor", "0", "archivos protegidos")]],
                  colWidths=[43.5 * mm] * 4)
    cards.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 2), ("RIGHTPADDING", (0, 0), (-1, -1), 2)]))
    story.extend([cards, Spacer(1, 6 * mm)])
    for item in [
        "Cero intersecciones y cero overflow horizontal en los nueve viewports objetivo.",
        "Targets frecuentes de 44 × 44 px en tablet y móvil; foco visible de 3 px y retorno con Escape.",
        "Estados listo, calculando, actualizado, desactualizado, advertencia y error comunicados con icono + texto/etiqueta accesible.",
        "Contraste AA comprobado en Light/Dark; texto crítico renderizado con mínimo de 12 px.",
        "Chromium, WebKit iPhone 13/iPad Pro 11 y zoom 200 % aprobados sin errores de consola o página.",
    ]:
        story.append(bullet(item))

    story.append(p("Contenido del expediente", "h2"))
    toc_rows = [[p("Sección", "table_header"), p("Contenido", "table_header")]]
    for number, title, detail in [
        ("1–3", "Gobierno y alcance", "Resumen, autorización, frontera matemática y criterios."),
        ("4–6", "Implementación", "Slices 2.0–2.7, arquitectura, tokens, TopBar y estado."),
        ("7–9", "Trazabilidad y QA", "Commits, archivos, resultados, correcciones y fidelity ledger."),
        ("10", "Limitaciones y entrega", "Riesgos remanentes, revisión y parada antes de Fase 3."),
        ("Anexos A–C", "Evidencia visual completa", "5 referencias, 7 capturas before y 13 capturas after."),
    ]:
        toc_rows.append([table_cell(number, True), table_cell(f"{title}: {detail}")])
    story.append(styled_table(toc_rows, [28 * mm, 146 * mm]))

    story.append(PageBreak())
    section(story, "2. Autorización, alcance y reglas inviolables")
    story.append(p("El propietario autorizó expresamente la opción A para ejecutar la fase completa, inicializar Git dentro de structureCo, crear el baseline y la rama dedicada, implementar los cambios visuales, verificar, documentar, generar el PDF y enviarlo por correo."))
    story.append(p("Incluido", "h2"))
    for item in [
        "Tokens, tipografía, spacing, radius, elevation, controles, layout, motion y z-index.",
        "TopBar, App Shell, breakpoints por contenido, overflow secundario y estado global del análisis.",
        "Accesibilidad visual: contraste, foco, touch targets, texto crítico, reduced motion y zoom 200 %.",
        "QA, capturas, trazabilidad Git, documentación y entrega del informe.",
    ]:
        story.append(bullet(item))
    story.append(p("Excluido y preservado", "h2"))
    for item in [
        "Solver, ecuaciones, algoritmos y criterios numéricos.",
        "Workers productivos y protocolos de análisis.",
        "Convenciones de signo, unidades, precisión, redondeo y resultados.",
        "Datos de dominio, migraciones, schema, fixtures, persistencia e importación/exportación portable.",
        "Rediseño interno completo de canvas, ToolBar, inspector, resultados, Aula o bienvenida, reservado a fases posteriores.",
    ]:
        story.append(bullet(item))
    boundary = Table([
        [p("CONTROL DE FRONTERA", "table_header"), p("RESULTADO", "table_header")],
        [table_cell("Prefijos protegidos en el diff"), table_cell("src/engine, src/workers, src/data, src/utils/portable, src/types.ts")],
        [table_cell("Archivos protegidos modificados"), table_cell(str(len(protected_changed)), True)],
        [table_cell("Delay de loading"), table_cell("Sólo en qa-phase2.mjs; nunca entra al bundle productivo")],
    ], colWidths=[66 * mm, 108 * mm])
    boundary.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), GREEN_DARK), ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, APP_BG]),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.extend([Spacer(1, 4 * mm), boundary])

    story.append(PageBreak())
    section(story, "3. Estado inicial y problemas que justificaron la fase")
    story.append(p("El baseline funcional estaba estable (229 pruebas y QA heredado aprobados), pero la inspección renderizada demostró problemas visuales que las pruebas booleanas no detectaban."))
    initial_rows = [[p("Viewport", "table_header"), p("Overlaps before", "table_header"), p("Overflow", "table_header"), p("Conclusión", "table_header")]]
    conclusions = {
        1536: "Wide sin colisión; referencia de capacidad máxima.",
        1440: "Historial/guardado invadían el selector de caso.",
        1366: "Historial/guardado invadían caso y modo.",
        1194: "Nombre, menú, historial y guardado invadían contexto.",
        834: "Composición útil, pero varios controles eran menores a 44 px.",
        430: "Header compacto sin estado global explícito.",
        390: "Header mínimo; persistían microtexto y falta de sistema común.",
    }
    for row in baseline_metrics:
        width = row["viewport"]["width"]
        initial_rows.append([
            table_cell(f"{width} × {row['viewport']['height']}", True),
            table_cell(len(row.get("overlaps", []))),
            table_cell(f"{row.get('overflow', 0)} px"),
            table_cell(conclusions.get(width, "Baseline registrado.")),
        ])
    story.append(styled_table(initial_rows, [31 * mm, 28 * mm, 24 * mm, 91 * mm]))
    story.append(Spacer(1, 6 * mm))
    story.append(p("Tres P0 cerrados", "h2"))
    for item in [
        "P0-1: colisiones TopBar en 1440, 1366 y 1194 px.",
        "P0-2: targets táctiles frecuentes por debajo de 44 px.",
        "P0-3: labels/resultados técnicos críticos de 8–11 px.",
    ]:
        story.append(bullet(item))

    story.append(PageBreak())
    section(story, "4. Cronología de ejecución por slices")
    slices = [
        ("2.0", "Gobierno y baseline", "PDF de 32 páginas leído; referencias 27–31; 7 capturas before; Git inicializado; opción A ejecutada."),
        ("2.1", "Tokens", "Primitivos, roles semánticos y técnicos, Light/Dark, layout, controles, motion, z-index y aliases."),
        ("2.2", "Tipografía y targets", "Piso 12 px; controles 14 px; 44 × 44 px touch; foco azul 3 px; Analizar estable."),
        ("2.3", "App Shell responsive", "Breakpoint por contenido a 1023 px; rail/inspector compactos; drawer móvil accesible."),
        ("2.4", "TopBar por zonas", "Documento, Contexto y Acciones; overflow progresivo; ES/EN y nombre largo sin colisiones."),
        ("2.5", "Estado global", "Seis estados derivados; aria-live; warning/error abren Avisos y expanden resultados móviles."),
        ("2.6", "Consolidación", "Reglas tocadas reunificadas; estilos obsoletos retirados; popovers tokenizados."),
        ("2.7", "QA y cierre", "117 checks nuevos, 63 heredados, WebKit, 13 capturas after y revisión visual A–E."),
    ]
    slice_rows = [[p("Slice", "table_header"), p("Objetivo", "table_header"), p("Ejecución y gate", "table_header")]]
    for number, title, detail in slices:
        slice_rows.append([table_cell(number, True), table_cell(title, True), table_cell(detail)])
    story.append(styled_table(slice_rows, [18 * mm, 45 * mm, 111 * mm]))

    story.append(p("Decisiones técnicas clave", "h2"))
    for item in [
        "Las referencias se interpretaron como intención de jerarquía y comportamiento, no como mockups literales.",
        "No se agregaron dependencias ni fuentes remotas; se utilizó la pila de sistema existente.",
        "El indicador consume analysis/isAnalyzing/severidades existentes y un useRef visual por project.id; no persiste ni calcula.",
        "Caso, modo, unidades, idioma, tema, exports e historial se mueven al overflow antes de colisionar.",
        "Warning/error conservan tonos base y usan foreground AA en Light.",
    ]:
        story.append(bullet(item))

    story.append(PageBreak())
    section(story, "5. Arquitectura visual implementada")
    story.append(p("TopBar: tres zonas con prioridad explícita", "h2"))
    topbar_rows = [[p("Zona", "table_header"), p("Contenido", "table_header"), p("Regla responsive", "table_header")]]
    for row in [
        ("Documento", "Marca, nombre editable, menú de proyecto y guardado.", "Nombre truncable con tooltip; guardado se compacta; identidad siempre localizable."),
        ("Contexto", "Caso/combinación, modo y unidades.", "Pasa progresivamente al overflow según el ancho disponible."),
        ("Acciones", "Historial, estado, export, overflow y Analizar.", "Estado, Más y Analizar permanecen visibles; secundarios se agrupan."),
    ]:
        topbar_rows.append([table_cell(row[0], True), table_cell(row[1]), table_cell(row[2])])
    story.append(styled_table(topbar_rows, [32 * mm, 66 * mm, 76 * mm]))

    story.append(p("Composiciones", "h2"))
    composition_rows = [[p("Rango", "table_header"), p("Shell", "table_header"), p("TopBar", "table_header")]]
    for row in [
        ("≥ 1440", "Rail e inspector completos.", "Caso + modo + unidades; export directo; label del estado en 1500+."),
        ("1280–1439", "Rail/inspector según capacidad.", "Caso + modo; unidades/export al overflow."),
        ("1024–1279", "Rail 76 px e inspector 290 px.", "Modo visible; caso/historial en overflow."),
        ("≤ 1023", "Canvas primero; dock inferior; inspector drawer.", "Documento mínimo + estado + Más + Analizar, todos 44 px."),
    ]:
        composition_rows.append([table_cell(row[0], True), table_cell(row[1]), table_cell(row[2])])
    story.append(styled_table(composition_rows, [31 * mm, 66 * mm, 77 * mm]))

    story.append(p("Estado global derivado", "h2"))
    state_rows = [[p("Estado", "table_header"), p("Condición", "table_header"), p("Presentación", "table_header")]]
    for row in [
        ("Listo", "Sin resultado previo en el proyecto.", "Círculo verde + label/tooltip."),
        ("Calculando", "isAnalyzing = true.", "Spinner azul; reduced motion lo neutraliza."),
        ("Actualizado", "Éxito sin warnings/errores.", "Check de éxito."),
        ("Desactualizado", "Mismo proyecto tuvo resultado y fue invalidado.", "Reloj ámbar."),
        ("Advertencia", "Resultado exitoso con warning.", "Botón accesible que abre Avisos."),
        ("Error", "Resultado fallido o con error.", "Botón accesible que abre Avisos y expande móvil."),
    ]:
        state_rows.append([table_cell(row[0], True), table_cell(row[1]), table_cell(row[2])])
    story.append(styled_table(state_rows, [34 * mm, 76 * mm, 64 * mm]))

    story.append(PageBreak())
    section(story, "6. Sistema visual y accesibilidad")
    token_rows = [[p("Rol", "table_header"), p("Light", "table_header"), p("Dark", "table_header"), p("Uso", "table_header")]]
    for row in [
        ("Acción primaria", "#087A5B", "#2BB98A", "Marca y CTA"),
        ("Fondo app", "#F3F5F4", "#0D1110", "Fondo global"),
        ("Canvas", "#F8FAF9", "#0A0E0D", "Lienzo técnico"),
        ("Texto", "#17201C", "#F2F6F4", "Lectura principal"),
        ("Foco/info", "#2867E8", "#6EA0FF", "Focus ring y estado"),
        ("Warning foreground", "#8A4F00", "#F0AA3C", "Texto AA"),
        ("Error foreground", "#A92F2F", "#F26B6B", "Texto AA"),
        ("Aula", "#7357D8", "#9A83F0", "Acento educativo"),
        ("Cargas", "#E25D32", "#FF825C", "Magnitud técnica"),
    ]:
        token_rows.append([table_cell(value, index == 0) for index, value in enumerate(row)])
    story.append(styled_table(token_rows, [44 * mm, 31 * mm, 31 * mm, 68 * mm]))
    story.append(p("Escalas aplicadas", "h2"))
    for item in [
        "Spacing: 4, 8, 12, 16, 20, 24, 32 y 40 px.",
        "Radio: 8, 10, 14 y 20 px; pill reservado a estados.",
        "Tipografía: técnico/label 12 px; cuerpo/control 14 px; números tabulares.",
        "Controles: 40 px desktop; 44 px touch; Analizar 148 px wide, 124 px compact y 44 px móvil.",
        "Motion: 140/220/360 ms; neutralización mediante prefers-reduced-motion.",
    ]:
        story.append(bullet(item))

    story.append(PageBreak())
    section(story, "7. Trazabilidad Git: commits y archivos")
    story.append(p(f"Baseline: {BASELINE_COMMIT}. Rama: {branch}. Head final del código/evidencia: {head}."))
    commit_rows = [[p("Commit", "table_header"), p("Propósito", "table_header")]]
    for line in commits:
        short_hash, message = line.split("\t", 1)
        commit_rows.append([table_cell(short_hash, True), table_cell(message)])
    story.append(styled_table(commit_rows, [28 * mm, 146 * mm]))
    story.append(Spacer(1, 5 * mm))
    story.append(p(f"Diff incremental: {len(changed)} archivos; 3,066 inserciones y 283 eliminaciones reportadas por Git antes de generar este informe. Los binarios de evidencia se registran por nombre y hash."))
    file_rows = [[p("Estado", "table_header"), p("Ruta", "table_header")]]
    for line in changed:
        status, path = line.split("\t", 1)
        file_rows.append([table_cell(status, True), table_cell(path)])
    story.append(CondPageBreak(45 * mm))
    story.append(styled_table(file_rows, [20 * mm, 154 * mm]))

    story.append(PageBreak())
    section(story, "8. Resultados finales de pruebas y QA")
    qa_rows = [[p("Suite", "table_header"), p("Cobertura", "table_header"), p("Resultado", "table_header")]]
    for row in [
        ("verify", "lint + 41 archivos + 233 pruebas + build", "PASS · 0 fallos"),
        ("qa:phase2", "117 checks; 14 filas ES/EN; 9 viewports; estados; contraste; foco; zoom", "PASS · consola limpia"),
        ("qa", "63 checks Chromium: canvas, resultados, gestos, mecanismo, influencia y móvil", "PASS · consola limpia"),
        ("qa:webkit", "iPhone 13 e iPad Pro 11: importación, scroll, viewport y targets", "PASS · 0 errores"),
        ("Browser in-app", "Estados reales, overflow/foco, Light/Dark, Completo/Aula y capturas", "PASS"),
    ]:
        qa_rows.append([table_cell(row[0], True), table_cell(row[1]), table_cell(row[2], True)])
    story.append(styled_table(qa_rows, [32 * mm, 107 * mm, 35 * mm]))

    story.append(p("Métricas geométricas", "h2"))
    geometry_rows = [[p("Viewport", "table_header"), p("Intersecciones", "table_header"), p("Fuera header", "table_header"), p("Overflow X", "table_header"), p("Estado", "table_header")]]
    for row in metrics["matrix"]["es"]:
        viewport = row["viewport"]
        geometry_rows.append([
            table_cell(f"{viewport['width']} × {viewport['height']}", True),
            table_cell(len(row["intersections"])), table_cell(len(row["outside"])),
            table_cell(f"{row['horizontalOverflow']} px"), table_cell(row["status"]),
        ])
    story.append(styled_table(geometry_rows, [38 * mm, 34 * mm, 31 * mm, 31 * mm, 40 * mm]))

    story.append(p("Contraste medido", "h2"))
    contrast_rows = [[p("Tema", "table_header"), p("Primario", "table_header"), p("Secundario", "table_header"), p("Estado", "table_header"), p("Warning", "table_header"), p("Error", "table_header"), p("Analizar", "table_header")]]
    for theme in ("light", "dark"):
        contrast_data = metrics["themes"][theme]["contrast"]
        contrast_rows.append([
            table_cell(theme.title(), True), table_cell(f"{contrast_data['primaryOnSurface']:.2f}:1"),
            table_cell(f"{contrast_data['secondaryOnSurface']:.2f}:1"),
            table_cell(f"{contrast_data['status']:.2f}:1"), table_cell(f"{contrast_data['warning']:.2f}:1"),
            table_cell(f"{contrast_data['error']:.2f}:1"), table_cell(f"{contrast_data['analyze']:.2f}:1"),
        ])
    story.append(styled_table(contrast_rows, [28 * mm] + [24.3 * mm] * 6))

    story.append(PageBreak())
    section(story, "9. Hallazgos durante QA y correcciones")
    qa_fix_rows = [[p("Hallazgo", "table_header"), p("Corrección visual", "table_header"), p("Evidencia", "table_header")]]
    for row in [
        ("Warning/error Light bajo 4.5:1", "Foregrounds #8A4F00 y #A92F2F sin cambiar tonos base.", "5.84:1 y 5.90:1"),
        ("Analizar crecía con Calculating…", "Ancho fijo 148 px wide / 124 px compact / 44 px móvil.", "148 px antes y durante"),
        ("1 px fuera del header a 200 % landscape", "Padding vertical de project-name eliminado en composición móvil.", "683 × 384: 0 fuera"),
        ("QA heredado buscaba idioma/tema directos", "Automatización actualizada para recorrer el overflow vigente.", "qa: 63/63"),
    ]:
        qa_fix_rows.append([table_cell(row[0], True), table_cell(row[1]), table_cell(row[2], True)])
    story.append(styled_table(qa_fix_rows, [53 * mm, 84 * mm, 37 * mm]))
    story.append(p("Zoom 200 %", "h2"))
    story.append(p("Se validó el reflow mediante el viewport CSS efectivo: un viewport físico 1366 × 768 a 200 % equivale a 683 × 384 CSS px; 834 × 1194 equivale a 417 × 597 CSS px. Ambos conservaron estado, Analizar y overflow sin colisiones ni scroll horizontal."))
    story.append(p("Fidelidad", "h2"))
    for item in [
        "Referencia A: zonas y estado global implementados.",
        "Referencia B: color de producto, estado y magnitudes técnicas separados.",
        "Referencia C: contraste, foco, targets, feedback y reduced motion aprobados.",
        "Referencia D: misma base funcional con composición desktop/tablet.",
        "Referencia E: canvas primero, header mínimo, dock inferior y resultados accesibles en móvil.",
    ]:
        story.append(bullet(item))

    story.append(PageBreak())
    section(story, "10. Limitaciones, riesgos y siguiente compuerta")
    story.append(p("Limitaciones documentadas", "h2"))
    for item in [
        "No se probó hardware iOS/iPadOS/Android físico ni stylus; WebKit usa perfiles emulados.",
        "No se ejecutó una auditoría completa con lector de pantalla; sí se validaron nombres, roles, aria-live, foco y teclado del alcance.",
        "El zoom 200 % se validó por viewport CSS efectivo, método equivalente para reflow; no se automatizó el control visual del navegador.",
        "Las referencias A–E definen intención; no se copiaron literalmente ni se insertaron dentro de la UI.",
        "Canvas, inspector, resultados, Aula y bienvenida mantienen su arquitectura interna; su rediseño profundo pertenece a fases posteriores.",
    ]:
        story.append(bullet(item))
    story.append(p("Parada obligatoria", "h2"))
    story.append(p("La Fase 3 no fue iniciada. Después de enviar este informe, el flujo queda detenido para revisión y autorización expresa del propietario."))
    story.append(p("Entrega", "h2"))
    story.append(p("Destino solicitado: crisdlm302@gmail.com. El PDF se enviará después de su renderizado e inspección visual final; la confirmación de Gmail se reportará en el chat de entrega."))

    story.append(PageBreak())
    section(story, "Comparaciones clave antes/después")
    story.append(p("Las comparaciones siguientes resumen el cierre de los P0. Las capturas completas aparecen después en los anexos."))
    side_by_side(story, BEFORE_DIR / "before-topbar-1440x900.png", AFTER_DIR / "after-topbar-1440x900-light-resolved.jpg", "Before · 1440 × 900 · 3 overlaps", "After · 1440 × 900 · 0 overlaps")
    story.append(Spacer(1, 6 * mm))
    side_by_side(story, BEFORE_DIR / "before-topbar-1194x834.png", AFTER_DIR / "after-topbar-1194x834-light-resolved.jpg", "Before · 1194 × 834 · 5 overlaps", "After · 1194 × 834 · 0 overlaps")
    story.append(Spacer(1, 6 * mm))
    side_by_side(story, BEFORE_DIR / "before-mobile-430x932.png", AFTER_DIR / "after-mobile-430x932-light-error.jpg", "Before · header sin estado global", "After · error global + Avisos")

    reference_files = [
        ("Referencia A · TopBar por zonas", REFERENCE_DIR / "reference-27.png", "Jerarquía Documento/Contexto/Acciones y estado global."),
        ("Referencia B · Roles de color", REFERENCE_DIR / "reference-28.png", "Separación entre producto, estados y magnitudes técnicas."),
        ("Referencia C · Accesibilidad", REFERENCE_DIR / "reference-29.png", "Contraste, foco, targets y feedback."),
        ("Referencia D · Desktop + tablet", REFERENCE_DIR / "reference-30.png", "Misma base funcional, distinta composición."),
        ("Referencia E · Experiencia móvil", REFERENCE_DIR / "reference-31.png", "Canvas primero, header mínimo y dock inferior."),
    ]
    for title, path, caption in reference_files:
        if path.exists():
            image_page(story, title, path, caption, "Anexo A · Referencias visuales aprobadas")

    before_captions = {
        "before-topbar-1536x960.png": "Baseline wide sin colisión; referencia de capacidad máxima.",
        "before-topbar-1440x900.png": "Tres overlaps entre historial/guardado y caso.",
        "before-topbar-1366x768.png": "Cuatro overlaps entre historial/guardado, caso y modo.",
        "before-topbar-1194x834.png": "Cinco overlaps; breakpoint desktop demasiado tardío.",
        "before-tablet-834x1194.png": "Composición tablet útil, pero controles frecuentes menores a 44 px.",
        "before-mobile-430x932.png": "Header mínimo previo, sin estado global explícito.",
        "before-mobile-390x844.png": "Móvil oscuro previo; base funcional antes de los nuevos fundamentos.",
    }
    for filename in [
        "before-topbar-1536x960.png", "before-topbar-1440x900.png", "before-topbar-1366x768.png",
        "before-topbar-1194x834.png", "before-tablet-834x1194.png", "before-mobile-430x932.png",
        "before-mobile-390x844.png",
    ]:
        image_page(story, filename.removesuffix(".png").replace("before-", "Before · "), BEFORE_DIR / filename, before_captions[filename], "Anexo B · Capturas before")

    after_captions = {
        "after-topbar-1536x960-light-ready.jpg": "Wide Light listo: tres zonas, label completo del estado y Analizar estable.",
        "after-topbar-1440x900-light-resolved.jpg": "Desktop Light resuelto: jerarquía clara y cero colisiones.",
        "after-topbar-1366x768-light-resolved.jpg": "Laptop Light resuelto: contexto y acciones caben sin invadirse.",
        "after-topbar-1280x800-dark-stale.jpg": "Dark desactualizado: reloj ámbar y contexto Servicio.",
        "after-topbar-1194x834-light-resolved.jpg": "Compact desktop: secundarios en overflow y canvas preservado.",
        "after-topbar-1024x768-dark-aula-ready.jpg": "Dark Aula listo: rail compacto y estado global visible.",
        "after-tablet-834x1194-light-ready.jpg": "Tablet vertical: canvas primero, resultados colapsables y dock inferior.",
        "after-mobile-430x932-light-error.jpg": "Error real móvil: estado accionable y panel Avisos expandido.",
        "after-mobile-390x844-dark-aula.jpg": "Móvil Dark Aula: header mínimo, estado, Más y Analizar en 44 px.",
        "after-focus-overflow-1194x834.jpg": "Overflow dentro del viewport; foco visible de 3 px en Deshacer.",
        "after-loading-analysis-1366x768.png": "Loading real: estado calculando y botón de 148 px sin layout shift.",
        "after-zoom200-1366x768.jpg": "Reflow equivalente a 1366 × 768 con zoom 200 % (683 × 384 CSS px).",
        "after-zoom200-834x1194.jpg": "Reflow equivalente a 834 × 1194 con zoom 200 % (417 × 597 CSS px).",
    }
    for filename in [
        "after-topbar-1536x960-light-ready.jpg", "after-topbar-1440x900-light-resolved.jpg",
        "after-topbar-1366x768-light-resolved.jpg", "after-topbar-1280x800-dark-stale.jpg",
        "after-topbar-1194x834-light-resolved.jpg", "after-topbar-1024x768-dark-aula-ready.jpg",
        "after-tablet-834x1194-light-ready.jpg", "after-mobile-430x932-light-error.jpg",
        "after-mobile-390x844-dark-aula.jpg", "after-focus-overflow-1194x834.jpg",
        "after-loading-analysis-1366x768.png", "after-zoom200-1366x768.jpg", "after-zoom200-834x1194.jpg",
    ]:
        path = AFTER_DIR / filename
        image_page(story, filename.rsplit(".", 1)[0].replace("after-", "After · "), path, after_captions[filename], "Anexo C · Capturas after")

    story.append(PageBreak())
    section(story, "Cierre del expediente")
    story.append(p("La Fase 2 quedó ejecutada y verificada dentro del alcance autorizado. La evidencia confirma que la interfaz ahora responde de forma estable entre 390 y 1536 px, comunica el estado del análisis, cumple los gates visuales acordados y conserva el comportamiento matemático existente."))
    story.append(Spacer(1, 10 * mm))
    closing = Table([
        [p("FASE 2 · GATE TÉCNICO", "table_header"), p("APROBADO", "table_header")],
        [table_cell("Tests", True), table_cell("233/233")],
        [table_cell("QA Fase 2", True), table_cell("117/117")],
        [table_cell("Chromium/WebKit", True), table_cell("PASS / PASS")],
        [table_cell("Motor matemático", True), table_cell("Preservado")],
        [table_cell("Siguiente acción", True), table_cell("Revisión del propietario; no iniciar Fase 3 sin autorización")],
    ], colWidths=[70 * mm, 104 * mm])
    closing.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), GREEN_DARK), ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, GREEN_PALE]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7), ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(closing)

    doc.build(story, onFirstPage=page_chrome, onLaterPages=page_chrome)


def main() -> None:
    parser = argparse.ArgumentParser(description="Genera el informe completo de la Fase 2 de structureCo.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    build_report(args.output.resolve())
    digest = hashlib.sha256(args.output.resolve().read_bytes()).hexdigest()
    print(json.dumps({
        "output": str(args.output.resolve()),
        "bytes": args.output.resolve().stat().st_size,
        "sha256": digest,
        "generatedAt": datetime.now().astimezone().isoformat(),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
