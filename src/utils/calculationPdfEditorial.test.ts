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
  it('produce un documento A4 paginado, con cabecera y pie en cada página', async () => {
    const { pages } = await buildReport();
    expect(pages.length).toBeGreaterThanOrEqual(9);
    for (const page of pages) {
      expect(Math.abs(page.width - A4_WIDTH)).toBeLessThan(1);
      expect(Math.abs(page.height - A4_HEIGHT)).toBeLessThan(1);
      expect(page.text).not.toBe('');
      expect(page.text).toMatch(/structureCo/);
      expect(page.text).toMatch(new RegExp(`página ${page.number} de ${pages.length}`));
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
    expect(all).toMatch(/Unidades de presentacion/);
    expect(all).toMatch(/Longitud y desplazamiento: ft/);
    expect(all).toMatch(/Fuerza y reacción: kip/);
    expect(all).toMatch(/Momento: kip x ft/);
    expect(all).toMatch(/Convenciones de signo/);
    expect(all).toMatch(/N axial: positivo en traccion/);
    expect(all).toMatch(/Alcance del análisis/);
    expect(all).toMatch(/Limitaciones declaradas/);
    expect(all).toMatch(/P-Delta/);
    expect(all).toMatch(/no reporta verificaciones normativas|no se aplica ninguna norma|No se aplica ninguna norma/i);
    expect(all).toMatch(/Advertencias del análisis/);
  }, 60_000);

  it('comunica calidad numérica sin convertir success en aprobación estructural', async () => {
    const { pages } = await buildReport();
    const all = pages.map((page) => page.text).join('\n');
    expect(all).toMatch(/CALIDAD NUMÉRICA/);
    expect(all).toMatch(/ESTABLE/);
    expect(all).toMatch(/condición k1/i);
    expect(all).toMatch(/no evalúa seguridad estructural/i);
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
    expect(all).toMatch(/Equilibrio\s+Fx=0, Fy=0, M=0/);
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
    expect(all).toMatch(/M_i \(kip x ft\)/);
    expect(all).toMatch(/M_j \(kip x ft\)/);
    // And the values under them stay converted: this beam's end shear is 2.5 kip, the same
    // figure the cover reports, not the 11.1 kN the engine holds internally.
    expect(all).toMatch(/M_j \(kip x ft\)\s+0\s+2\.5\s+0/);
    expect(all).toMatch(/REACCIÓN MAX\. 2\.5 kip/);
    // Reactions and displacements likewise declare their unit once, in the header.
    expect(all).toMatch(/Rx \(kip\)\s+Ry \(kip\)\s+M \(kip x ft\)/);
    expect(all).toMatch(/Ux \(ft\)\s+Uy \(ft\)\s+Rz \(rad\)/);
  }, 60_000);

  it('adjunta el expediente reimportable y su checksum', async () => {
    const { pages, report } = await buildReport();
    const all = pages.map((page) => page.text).join('\n');
    expect(report.payload.checksum.value).toMatch(/^[a-f0-9]{64}$/);
    expect(all).toContain(report.payload.checksum.value);
  }, 60_000);
});
