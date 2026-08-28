import { describe, expect, it } from 'vitest';
import { createHibbelerStyleDiagramPractice } from '../data/defaultProject';
import { analyzeProject } from '../engine/solver';
import { createCalculationReport } from './calculationPdf';
import { inspectPdf } from './pdfImport';

const fixture = () => {
  const project = createHibbelerStyleDiagramPractice();
  project.id = 'calculation-pdf-layout-test';
  const analysis = analyzeProject(project);
  expect(analysis.success).toBe(true);
  return { project, analysis };
};

const fixedOptions = {
  generatedAt: '2026-07-16T12:00:00.000Z',
  scenarioName: 'Servicio',
  scenarioFactors: { LC1: 1 },
};

describe('memoria de cálculo visual', () => {
  it('separa DCL y diagramas N-V-M en páginas visuales con operaciones verificables', async () => {
    const { project, analysis } = fixture();
    const report = await createCalculationReport(project, analysis, { ...fixedOptions, includeEducationTrace: false });
    const inspection = await inspectPdf(report.bytes);

    expect(inspection.kind).toBe('native');

    // La página 1 es la portada, y su índice nombra todas las secciones: buscar ahí
    // encontraría los cuatro títulos en la misma página. Las secciones viven detrás.
    const [cover, ...body] = inspection.textByPage;
    expect(cover).toMatch(/MEMORIA DE CÁLCULO ESTRUCTURAL/i);
    expect(cover).toMatch(/CONTENIDO/i);
    expect(cover).toMatch(/DCL global y equilibrio/i);

    const indices = [
      body.findIndex((text) => /DCL global y equilibrio/i.test(text)),
      body.findIndex((text) => /Diagrama axial N/i.test(text)),
      body.findIndex((text) => /Diagrama cortante V/i.test(text)),
      body.findIndex((text) => /Diagrama de momento M/i.test(text)),
    ];
    expect(indices.every((index) => index >= 0)).toBe(true);
    expect(new Set(indices).size).toBe(4);

    const [dclPage, axialPage, shearPage, momentPage] = indices.map((index) => body[index]);
    expect(dclPage).toMatch(/OPERACIONES DE EQUILIBRIO/i);
    expect(dclPage).toMatch(/32\.5 kN/i);
    expect(dclPage).toMatch(/27\.5 kN/i);
    expect(axialPage).toMatch(/OPERACIONES CLARAS/i);
    expect(axialPage.replace(/\s+/g, '')).toMatch(/N\(s\)=0/i);
    expect(axialPage).toMatch(/RELACIÓN FUNDAMENTAL/i);
    expect(axialPage).toMatch(/La carga axial distribuida determina/i);
    expect(shearPage).toMatch(/OPERACIONES CLARAS/i);
    // The derivatives are typeset as stacked fractions, so the slash is geometry now and
    // not a character: `dV` sits above `dx` over a rule. Extraction sees the two operands
    // in reading order, which is the signature this assertion pins.
    expect(shearPage.replace(/\s+/g, '')).toMatch(/dVdx=q\(x\)/i);
    expect(momentPage).toMatch(/OPERACIONES CLARAS/i);
    expect(momentPage.replace(/\s+/g, '')).toMatch(/dMdx=V\(x\)/i);
    expect(momentPage).toMatch(/75 kN\s*x\s*m/i);
    expect(momentPage).toMatch(/@\s*3 m/i);
  }, 60_000);

  it('conserva el informe visual sin matrices y agrega el anexo educativo solo cuando se solicita', async () => {
    const { project, analysis } = fixture();
    const [visualReport, completeReport] = await Promise.all([
      createCalculationReport(project, analysis, { ...fixedOptions, includeEducationTrace: false }),
      createCalculationReport(project, analysis, { ...fixedOptions, includeEducationTrace: true }),
    ]);
    const [visual, complete] = await Promise.all([inspectPdf(visualReport.bytes), inspectPdf(completeReport.bytes)]);

    for (const inspection of [visual, complete]) {
      expect(inspection.kind).toBe('native');
      expect(inspection.text).toMatch(/DCL global y equilibrio/i);
      expect(inspection.text).toMatch(/Diagrama axial N/i);
      expect(inspection.text).toMatch(/Diagrama cortante V/i);
      expect(inspection.text).toMatch(/Diagrama de momento M/i);
      expect(inspection.text).toMatch(/Procedimiento y cálculos/i);
    }
    expect(visual.text).not.toMatch(/Traza educativa y matrices/i);
    expect(visual.text).not.toMatch(/Matriz global K/i);
    expect(complete.text).toMatch(/Traza educativa y matrices/i);
    expect(complete.text).toMatch(/Matriz global K/i);
    expect(complete.pageCount).toBeGreaterThan(visual.pageCount);
    expect(completeReport.payload.checksum.value).toBe(visualReport.payload.checksum.value);
    expect(complete.payload?.analysis).toEqual(visual.payload?.analysis);
  }, 60_000);
});
