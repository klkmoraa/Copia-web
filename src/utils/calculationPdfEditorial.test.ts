/// <reference types="node" />

/**
 * Editorial regression for the calculation report.
 *
 * These are the properties an engineering memoir cannot lose: it states its units and
 * sign conventions, it declares what the analysis does not cover, it never contradicts
 * itself about a value, and it never claims a provenance it does not have.
 */
import { describe, expect, it } from 'vitest';
import { createHibbelerTributaryBeam } from '../data/defaultProject';
import { analyzeProject } from '../engine/solver';
import { APP_VERSION } from '../appVersion';
import { createCalculationReport } from './calculationPdf';

interface PdfPage {
  number: number;
  width: number;
  height: number;
  text: string;
}

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

const readPages = async (bytes: Uint8Array): Promise<PdfPage[]> => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document_ = await pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true }).promise;
  const pages: PdfPage[] = [];
  for (let number = 1; number <= document_.numPages; number += 1) {
    const page = await document_.getPage(number);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    pages.push({
      number,
      width: viewport.width,
      height: viewport.height,
      text: content.items
        .map((item) => 'str' in item ? item.str : '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    });
    page.cleanup();
  }
  await document_.cleanup();
  return pages;
};

const buildReport = async () => {
  const project = createHibbelerTributaryBeam();
  const analysis = analyzeProject(project);
  expect(analysis.success).toBe(true);
  const report = await createCalculationReport(project, analysis, {
    generatedAt: '2026-08-02T12:00:00.000Z',
    scenarioName: 'Servicio',
    includeEducationTrace: true,
  });
  return { project, analysis, report, pages: await readPages(report.bytes) };
};

describe('memoria de cálculo: calidad editorial', () => {
  it('abre con una portada de identidad y un índice en su propia página', async () => {
    const { report, pages } = await buildReport();
    // Desde el rediseño la portada no comparte hoja con el índice: la primera identifica el
    // documento, la segunda lo indexa sin tope de entradas.
    const cover = pages[0].text;
    expect(cover).toMatch(/Memoria de cálculo estructural/);
    expect(cover).toMatch(/ESCENARIO/);
    expect(cover).toMatch(/INTEGRIDAD SHA-256/);
    // El aviso profesional vive donde de verdad se lee: la primera página de lo que
    // alguien va a firmar.
    expect(cover).toMatch(/no sustituye la revisión/i);

    const contents = pages[1].text;
    expect(contents).toMatch(/Contenido/);
    // Una sola secuencia de partes numeradas, y cada folio apunta a una página real que no
    // es ni la portada ni el propio índice.
    expect(contents).toMatch(/01\s+Resumen del análisis/);
    expect(contents).toMatch(/Traza del sistema resuelto/);
    const numbers = [...contents.matchAll(/(?:análisis|axial N|alcance)\s+(\d+)/g)].map((match) => Number(match[1]));
    expect(numbers.length).toBeGreaterThan(0);
    for (const number of numbers) {
      expect(number).toBeGreaterThan(2);
      expect(number).toBeLessThanOrEqual(pages.length);
    }
    expect(report.bytes.byteLength).toBeGreaterThan(0);
  }, 60_000);

  it('lleva marcadores navegables y metadatos completos', async () => {
    const { report } = await buildReport();
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const document_ = await pdfjs.getDocument({ data: report.bytes.slice(), useSystemFonts: true }).promise;
    const outline = await document_.getOutline();
    expect(outline?.map((entry) => entry.title)).toContain('Resumen del análisis');
    expect(outline?.map((entry) => entry.title)).toContain('Traza del sistema resuelto');
    const info = (await document_.getMetadata()).info as Record<string, string>;
    expect(info.Producer).toMatch(/^structureCo /);
    expect(info.Creator).toBe('structureCo');
    expect(info.Language).toBe('es');
    // La fecha sale del `generatedAt` declarado, no del reloj: es lo que hace el archivo
    // reproducible y lo que permite comparar dos exportaciones byte a byte. El desfase se
    // escribe explícito (`+00'00'`), que es la forma que ISO 32000 §7.9.4 da para UTC.
    expect(info.CreationDate).toBe("D:20260802120000+00'00'");
    expect(info.ModDate).toBe(info.CreationDate);
    await document_.cleanup();
  }, 60_000);

  it('compone los símbolos del motor en vez de deletrearlos', async () => {
    const { pages } = await buildReport();
    const all = pages.map((page) => page.text).join('\n');
    // Since the MathJax vector rewrite, every fórmula — `L = √(ΔX² + ΔY²)`, `ΣFx`, `κ₁`
    // included — is drawn as real SVG path geometry (`drawFormula` in `mathVector.ts`),
    // not PDF text runs. `pdfjs` text extraction can no longer see any of a formula's own
    // characters, spelled-out or symbolic, so this can no longer assert the symbols are
    // *present* in the extracted text — that composition is what `mathLatex.test.ts` and
    // `pdfMath.test.ts` verify instead, at the LaTeX-translation and geometry level.
    // What extraction can still confirm here: no formula ever regresses to a spelled-out
    // ASCII fallback (there simply is no text where a formula sits), and the equation-number
    // tags, which are drawn with `pdfText`/`page.drawText` and so remain real text, survive.
    expect(all).not.toMatch(/sqrt\(/);
    expect(all).not.toMatch(/SumF/);
    expect(all).not.toMatch(/kappa_?1/);
    // Cada ecuación destacada del anexo lleva su número, continuo en todo el documento.
    expect(all).toMatch(/\(1\)/);
  }, 60_000);

  it('produce bytes idénticos para el mismo modelo y el mismo instante declarado', async () => {
    const project = createHibbelerTributaryBeam();
    const analysis = analyzeProject(project);
    const options = { generatedAt: '2026-08-02T12:00:00.000Z', scenarioName: 'Servicio', includeEducationTrace: true };
    const [first, second] = await Promise.all([
      createCalculationReport(project, analysis, options),
      createCalculationReport(project, analysis, options),
    ]);
    // Las fechas del documento salían del reloj, así que dos exportaciones del mismo modelo
    // nunca coincidían y el checksum del payload describía el contenido pero no el archivo.
    expect(Buffer.from(second.bytes)).toEqual(Buffer.from(first.bytes));
  }, 60_000);

  it('produce un documento A4 con el mismo cromo en toda la parte de cuerpo', async () => {
    const { project, pages } = await buildReport();
    expect(pages.length).toBeGreaterThanOrEqual(9);
    for (const page of pages) {
      expect(Math.abs(page.width - A4_WIDTH)).toBeLessThan(1);
      expect(Math.abs(page.height - A4_HEIGHT)).toBeLessThan(1);
      expect(page.text).not.toBe('');
    }
    // El anexo era un segundo documento pegado al primero: sin cabecera, sin pie y sin
    // número de página. Ahora toda hoja de cuerpo lleva el proyecto arriba, el título del
    // documento abajo y su folio — desde la primera parte hasta la última matriz.
    // El nombre viaja por `pdfText`, que pliega el guion largo del título sobre el de WinAnsi.
    const runningName = project.name.replace(/[–—]/g, '-');
    for (const page of pages.slice(2)) {
      expect(page.text).toContain(runningName);
      expect(page.text).toMatch(/Memoria de cálculo estructural/);
      expect(page.text).toMatch(new RegExp(`página ${page.number} de ${pages.length}`));
    }
    // La portada y el índice son portada e índice: no llevan folio ni cabecera corriente.
    for (const page of pages.slice(0, 2)) {
      expect(page.text).not.toMatch(/página \d+ de \d+/);
    }
  }, 60_000);

  it('conserva texto seleccionable en lugar de imagenes de la interfaz', async () => {
    const { pages } = await buildReport();
    const total = pages.reduce((sum, page) => sum + page.text.length, 0);
    expect(total).toBeGreaterThan(10_000);
  }, 60_000);

  it('no pierde glifos al transliterar la notación de ingenieria', async () => {
    const { pages } = await buildReport();
    const all = pages.map((page) => page.text).join('\n');
    expect(all).not.toMatch(/�/);
  }, 60_000);

  it('declara unidades, convenciones de signo, alcance y limitaciones', async () => {
    const { pages } = await buildReport();
    const all = pages.map((page) => page.text).join('\n');
    expect(all).toMatch(/Unidades de presentación/);
    expect(all).toMatch(/Longitud y desplazamiento\s+ft/);
    expect(all).toMatch(/Fuerza y reacción\s+kip/);
    // El punto medio es WinAnsi y se conserva: `kip·ft`, no `kip x ft`.
    expect(all).toMatch(/Momento\s+kip·ft/);
    expect(all).toMatch(/Convenciones de signo/);
    expect(all).toMatch(/N axial\s+positivo en tracción/);
    expect(all).toMatch(/Alcance del análisis/);
    expect(all).toMatch(/Limitaciones declaradas/);
    expect(all).toMatch(/P-Delta/);
    expect(all).toMatch(/no reporta verificaciones normativas|no se aplica ninguna norma|No se aplica ninguna norma/i);
    expect(all).toMatch(/Advertencias del análisis/);
  }, 60_000);

  it('comunica calidad numérica sin convertir success en aprobación estructural', async () => {
    const { pages } = await buildReport();
    const all = pages.map((page) => page.text).join('\n');
    expect(all).toMatch(/CALIDAD NUMÉRICA: ESTABLE/);
    expect(all).toMatch(/Número de condición estimado/);
    expect(all).toMatch(/no si la estructura es segura/i);
    expect(all).not.toMatch(/EQUILIBRIO APROBADO/);
  }, 60_000);

  it('declara la versión real de la aplicación, no una constante olvidada', async () => {
    const { pages, report } = await buildReport();
    const all = pages.map((page) => page.text).join('\n');
    expect(report.payload.provenance.appVersion).toBe(APP_VERSION);
    expect(all).toMatch(new RegExp(`app ${APP_VERSION.replace(/\./g, '\\.')}`));
    expect(all).not.toMatch(/app 0\.7\.0/);
  }, 60_000);

  it('presenta como cero el ruido numérico que la portada ya presenta como cero', async () => {
    // A beam with no axial load reported "min=1.53081e-16 kip" in the annex while page 1
    // said "|N| MAX. 0 kip". The document must not contradict itself.
    const { pages } = await buildReport();
    const all = pages.map((page) => page.text).join('\n');
    // The annex sets these as table rows since AG-014, so the cells arrive separated by the
    // column gap rather than by "min=/max=" labels. What is guarded is unchanged: both
    // extremes read as an exact 0.
    expect(all).toMatch(/N axial\s+0\s+0\s+kip/);
    expect(all).toMatch(/Residuo normalizado del cierre\s+0/);
    // Only one context may legitimately carry a value that small: the solver's own
    // precisión figures, where the exponent *is* the information.
    //
    // The narrative and the pre-rendered equation vectors used to be exceptions here,
    // because they are produced inside `src/engine/**`. They were fixed at the source
    // under explicit authorization, so the allowance is gone and this assertion now
    // covers the whole document.
    const allowed = /residuo|precisión|error|condición/i;
    const unexplained: string[] = [];
    for (const match of all.matchAll(/-?\d(?:\.\d+)?e-(?:1[2-9]|[2-9]\d)/g)) {
      const context = all.slice(Math.max(0, match.index - 90), match.index);
      if (!allowed.test(context)) unexplained.push(`${context.slice(-60)}»${match[0]}`);
    }
    expect(unexplained).toEqual([]);
  }, 60_000);

  it('acompana cada cifra de una unidad, sin mezclar unidades base y de presentacion', async () => {
    const { pages } = await buildReport();
    const all = pages.map((page) => page.text).join('\n');
    // Local end forces used to print bare base-unit numbers next to a table in kip. Each
    // component now owns a column whose header carries the unit, so a force column and a
    // moment column cannot end up sharing one.
    expect(all).toMatch(/Fx_i \(kip\)/);
    expect(all).toMatch(/M_i \(kip·ft\)/);
    expect(all).toMatch(/M_j \(kip·ft\)/);
    // And the values under them stay converted: this beam's end shear is 2.5 kip, the same
    // figure the summary reports, not the 11.1 kN the engine holds internally.
    expect(all).toMatch(/M_j \(kip·ft\)\s+0\s+2\.5\s+0/);
    expect(all).toMatch(/REACCIÓN MÁXIMA\s+2\.5 kip/);
    // Reactions and displacements likewise declare their unit once, in the header.
    expect(all).toMatch(/Rx \(kip\)\s+Ry \(kip\)\s+M \(kip·ft\)/);
    expect(all).toMatch(/Ux \(ft\)\s+Uy \(ft\)\s+Rz \(rad\)/);
  }, 60_000);

  it('adjunta el expediente reimportable y su checksum', async () => {
    const { pages, report } = await buildReport();
    const all = pages.map((page) => page.text).join('\n');
    expect(report.payload.checksum.value).toMatch(/^[a-f0-9]{64}$/);
    expect(all).toContain(report.payload.checksum.value);
  }, 60_000);
});
