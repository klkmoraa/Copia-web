import { describe, expect, it } from 'vitest';
import { createHibbelerStyleDiagramPractice } from '../data/defaultProject';
import type { ProjectModel } from '../types';
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
    // `N(s) = 0` is drawn by `drawMathFormula`, which since the MathJax vector rewrite is
    // real SVG path geometry, not PDF text — `pdfjs` text extraction can no longer see it.
    // The label around it is still drawn with `page.drawText`, so that's what this pins now.
    expect(axialPage).toMatch(/MIEMBRO AB \| FUNCIÓN DEL TRAMO/i);
    expect(axialPage).toMatch(/RELACIÓN FUNDAMENTAL/i);
    expect(axialPage).toMatch(/La carga axial distribuida determina/i);
    expect(shearPage).toMatch(/OPERACIONES CLARAS/i);
    // `dV/dx = q(x)` is the formula card's own relation — also vector geometry now, so this
    // checks the surrounding label/explanation text instead of the formula's characters.
    expect(shearPage).toMatch(/MIEMBRO AB \| FUNCIÓN DEL TRAMO/i);
    expect(momentPage).toMatch(/OPERACIONES CLARAS/i);
    expect(momentPage).toMatch(/MIEMBRO AB \| FUNCIÓN DEL TRAMO/i);
    expect(momentPage).toMatch(/75 kN\s*x\s*m/i);
    expect(momentPage).toMatch(/@\s*3 m/i);
  }, 60_000);

  it('escribe la sección 5 con el método elegido, y no toca el documento sin él', async () => {
    const beam: ProjectModel = {
      ...createHibbelerStyleDiagramPractice(),
      id: 'method-section-test',
      nodes: [
        { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
        { id: 'B', x: 6, y: 0, support: { type: 'roller', angleDeg: 90 } },
      ],
      members: [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.01, I: 8e-5 }],
      nodalLoads: [],
      memberLoads: [{
        id: 'W', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global',
        lengthBasis: 'real', start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -10, qyEnd: -10,
      }],
    };
    const analysis = analyzeProject(beam);
    expect(analysis.success).toBe(true);

    const withMethod = { ...beam, settings: { ...beam.settings, solutionMethod: 'double-integration' as const } };
    const [chosen, plain] = await Promise.all([
      createCalculationReport(withMethod, analysis, fixedOptions),
      createCalculationReport(beam, analysis, fixedOptions),
    ]);
    const [chosenText, plainText] = await Promise.all([
      inspectPdf(chosen.bytes).then((inspection) => inspection.text.replace(/\s+/g, ' ')),
      inspectPdf(plain.bytes).then((inspection) => inspection.text.replace(/\s+/g, ' ')),
    ]);

    // Con método elegido, la sección 5 la escribe él: clasificación, redundante y la fila
    // que contrasta su resultado contra el análisis matricial.
    expect(chosenText).toMatch(/Método de la Doble Integración/i);
    expect(chosenText).toMatch(/hiperestática de grado 1/i);
    expect(chosenText).toMatch(/Redundantes elegidas/i);
    expect(chosenText).toMatch(/Verificación contra el análisis matricial/i);
    // La redundante de la empotrada-apoyada es 3qL/8 = 22.5 kN, y la columna del solver
    // tiene que decir lo mismo: el documento enseña que los dos caminos se encontraron.
    expect(chosenText).toMatch(/22\.5\s+22\.5/);
    expect(chosenText).toMatch(/Curva elástica/i);

    // Sin método elegido el documento es el de siempre, con el procedimiento genérico.
    expect(plainText).toMatch(/Procedimiento y cálculos/i);
    expect(plainText).not.toMatch(/Doble Integración/i);
  }, 60_000);

  it('sustituye la geometría del procedimiento con los números reales del proyecto', async () => {
    const { project, analysis } = fixture();
    const report = await createCalculationReport(project, analysis, fixedOptions);
    const inspection = await inspectPdf(report.bytes);
    const page = inspection.textByPage.find((text) => /Geometría, nodos y ejes/i.test(text)) ?? '';
    const flat = page.replace(/\s+/g, ' ');
    // Las ecuaciones genéricas del motor (ΔX = Xⱼ − Xᵢ, L = √(ΔX²+ΔY²)…) describen el
    // método; la tabla que sigue las instancia con las coordenadas reales del proyecto —
    // A(0,0), B(8,0) en este miembro — sin tocar el motor: se calcula con `memberAxis`
    // sobre `project.nodes`, que no es frontera protegida.
    expect(flat).toMatch(/Miembro DeltaX \(m\) DeltaY \(m\) L \(m\) c s AB 8 0 8 1 0/);
    // El paso de cargas no reconstruye su propia tabla: apunta a la que ya existe.
    expect(flat).toMatch(/Cargas de miembro.*Cargas nodales.*sección 2/i);
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
