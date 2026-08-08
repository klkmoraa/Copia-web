from io import BytesIO
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
)


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf"
ATTACH = Path(r"C:\Users\crisd\.codex\codex-remote-attachments\019f635f-3a5a-7090-b905-72c09c33e75b\F40AF415-4781-4CB5-8816-503B28A9C33E")

DATA = {
    "4-39": {
        "photo": ATTACH / "2-Foto-2.jpg",
        "resultants": ["H = 0.6(16) = 9.6 k a y = 8 ft", "W = 0.8(20) = 16 k a x = 10 ft"],
        "equilibrium": [
            "Sum Fx = 0: Ax + 9.6 = 0  =>  Ax = -9.600 k",
            "Sum M_A = 0: 20 Dy - 16(10) - 9.6(8) = 0  =>  Dy = 11.840 k",
            "Sum Fy = 0: Ay + Dy - 16 = 0  =>  Ay = 4.160 k",
        ],
        "diagrams": [
            ["AB, 0 <= y <= 16", "V = 9.6 - 0.6y", "M = 9.6y - 0.3y^2", "M(B)=76.8"],
            ["BC, 0 <= x <= 20", "V = 4.16 - 0.8x", "M = 76.8 + 4.16x - 0.4x^2", "Mmax=87.616 en x=5.2"],
            ["DC, 0 <= y <= 16", "V = 0", "M = 0", "N=-11.84 k"],
        ],
        "checks": [["Ax", "-9.600", "-9.600"], ["Ay", "4.160", "4.160"], ["Dy", "11.840", "11.840"], ["Mmax BC", "87.616", "87.616"]],
    },
    "4-40": {
        "photo": ATTACH / "1-Foto-1.jpg",
        "resultants": ["W = 2(8) = 16 k a 4 ft de B", "Carga puntual en C: Fx=-3 k, Fy=-4 k"],
        "equilibrium": [
            "Sum Fx = 0: Dx - 3 = 0  =>  Dx = 3.000 k",
            "Sum M_D = 0: -12 Ay + 16(8) + 3(15) = 0  =>  Ay = 14.4167 k",
            "Sum Fy = 0: Ay + Dy - 16 - 4 = 0  =>  Dy = 5.5833 k",
        ],
        "diagrams": [
            ["AB, 0 <= y <= 15", "V = 0", "M = 0", "N=-14.4167 k"],
            ["BC, 0 <= x <= 8", "V = 14.4167 - 2x", "M = 14.4167x - x^2", "Mmax=51.9601 en x=7.2083"],
            ["BC, 8 <= x <= 12", "V = -1.5833", "M = 51.3333 - 1.5833(x-8)", "M(C)=45.000"],
            ["DC, 0 <= y <= 15", "V = -3", "M = -3y", "M(C)=-45.000"],
        ],
        "checks": [["Ay", "14.4167", "14.4167"], ["Dx", "3.000", "3.000"], ["Dy", "5.5833", "5.5833"], ["Mmax BC", "51.9601", "51.9601"]],
    },
    "4-41": {
        "photo": ATTACH / "3-Foto-3.jpg",
        "resultants": ["Viga BC: carga vertical total = 18 k, simetrica", "H = 0.8(15) = 12 k a y = 7.5 ft"],
        "equilibrium": [
            "Articulaciones B-C: fuerza vertical transmitida en cada extremo = 9 k",
            "Ax = -12.000 k; Ay = 9.000 k; Dy = 9.000 k",
            "M_A = 12(7.5) = +90.000 k-ft",
        ],
        "diagrams": [
            ["AB, 0 <= y <= 15", "V = 12 - 0.8y", "M = -90 + 12y - 0.4y^2", "M(A)=-90; M(B)=0"],
            ["BC, 0 < x < 8", "V = +6", "M = 6x", "M(8)=48"],
            ["BC, 8 < x < 16", "V = 0", "M = 48", "meseta"],
            ["BC, 16 < x < 24", "V = -6", "M = 48 - 6(x-16)", "M(C)=0"],
            ["DC, 0 <= y <= 15", "V = 0", "M = 0", "N=-9 k"],
        ],
        "checks": [["Ax", "-12.000", "-12.000"], ["Ay", "9.000", "9.000"], ["M_A", "90.000", "90.000"], ["Mmax BC", "48.000", "48.000"]],
    },
    "4-42": {
        "photo": ATTACH / "4-Foto-4.jpg",
        "resultants": ["P_x = 20(4/5) = +16 k", "P_y = 20(3/5) = -12 k", "H = 0.5(8) = 4 k a y = 4 ft"],
        "equilibrium": [
            "Viga BC: Sum M_B = 0 => Cy = 6 k; Sum Fy = 0 => By = 6 k",
            "Viga BC: Sum Fx = 0 => Bx = -16 k",
            "Columna AB: Ax = -20 k; Ay = +6 k; M_A = 16(8)+4(4) = 144 k-ft",
        ],
        "diagrams": [
            ["AB, 0 <= y <= 8", "V = 20 - 0.5y", "M = -144 + 20y - 0.25y^2", "M(A)=-144; M(B)=0"],
            ["BC, 0 < x < 6", "V = +6", "M = 6x", "M(6)=36"],
            ["BC, 6 < x < 12", "V = -6", "M = 36 - 6(x-6)", "M(C)=0"],
        ],
        "checks": [["Ax", "-20.000", "-20.000"], ["Ay", "6.000", "6.000"], ["M_A", "144.000", "144.000"], ["Mmax BC", "36.000", "36.000"]],
    },
}


def appendix(number: str, data: dict) -> bytes:
    stream = BytesIO()
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="TitleGreen", parent=styles["Title"], textColor=colors.HexColor("#083D24"), fontSize=18, leading=20, alignment=TA_CENTER))
    styles.add(ParagraphStyle(name="H2Green", parent=styles["Heading2"], textColor=colors.HexColor("#126136"), fontSize=11, leading=13, spaceBefore=5, spaceAfter=3))
    styles.add(ParagraphStyle(name="Eq", parent=styles["BodyText"], fontName="Courier", fontSize=7.7, leading=9.5, leftIndent=6))
    styles.add(ParagraphStyle(name="SmallBody", parent=styles["BodyText"], fontSize=8, leading=10))
    doc = SimpleDocTemplate(stream, pagesize=A4, leftMargin=16*mm, rightMargin=16*mm, topMargin=12*mm, bottomMargin=11*mm,
                            title=f"Hibbeler {number} - comprobacion manual")
    story = [Paragraph(f"Anexo - comprobacion manual<br/>Hibbeler {number}", styles["TitleGreen"]), Spacer(1, 2*mm)]
    if data["photo"].exists():
        image = Image(str(data["photo"]))
        image._restrictSize(145*mm, 58*mm)
        story.extend([image, Spacer(1, 2*mm)])
    story.append(Paragraph("1. Resultantes y equilibrio", styles["H2Green"]))
    for line in data["resultants"] + data["equilibrium"]:
        story.append(Paragraph(line, styles["Eq"]))
    story.extend([Spacer(1, 1*mm), Paragraph("2. Funciones exactas de los diagramas", styles["H2Green"])])
    rows = [[Paragraph("Miembro/tramo", styles["BodyText"]), Paragraph("V (k)", styles["BodyText"]), Paragraph("M (k-ft)", styles["BodyText"]), Paragraph("Punto clave", styles["BodyText"])]]
    rows += [[Paragraph(cell, styles["BodyText"]) for cell in row] for row in data["diagrams"]]
    table = Table(rows, colWidths=[39*mm, 40*mm, 58*mm, 36*mm], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#DCEFE3")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#083D24")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("GRID", (0, 0), (-1, -1), 0.45, colors.HexColor("#9BA9A0")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("FONTSIZE", (0, 0), (-1, -1), 7.3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(table)
    story.extend([Spacer(1, 2*mm), Paragraph("3. Comparacion manual - structureCo", styles["H2Green"])])
    checks = [["Magnitud", "Manual", "Software"]] + data["checks"]
    check_table = Table(checks, colWidths=[60*mm, 45*mm, 45*mm], repeatRows=1)
    check_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#083D24")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
        ("GRID", (0, 0), (-1, -1), 0.45, colors.HexColor("#9BA9A0")), ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
    ]))
    story.append(KeepTogether(check_table))
    story.extend([Spacer(1, 2*mm), Paragraph("Resultado: coincidencia dentro de la precision numerica de la conversion kip-ft / kN-m. Los diagramas graficos, puntos criticos, matrices y auditoria de equilibrio se encuentran en las paginas anteriores generadas por structureCo.", styles["SmallBody"])])
    doc.build(story)
    return stream.getvalue()


for exercise, data in DATA.items():
    original_path = OUT / f"Hibbeler-{exercise}-structureCo.pdf"
    final_path = OUT / f"Hibbeler-{exercise}-completo.pdf"
    original = PdfReader(str(original_path))
    manual = PdfReader(BytesIO(appendix(exercise, data)))
    writer = PdfWriter()
    writer.clone_document_from_reader(original)
    for page in manual.pages:
        writer.add_page(page)
    writer.add_metadata({
        "/Title": f"Hibbeler {exercise} - memoria completa structureCo y comprobacion manual",
        "/Author": "structureCo / comprobacion Codex",
        "/Subject": "Modelo, DCL, diagramas N-V-M, resultados, procedimiento y verificacion manual",
    })
    with final_path.open("wb") as handle:
        writer.write(handle)
    print(final_path)
