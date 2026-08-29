/**
 * Structure of the redesigned document.
 *
 * Until 0.8.3 the report was two documents in one binding: seven "visual" pages built at
 * absolute coordinates, then an unnumbered annex with its own internal `1.`…`6.` sequence and
 * no running head. The absolute pages also had a hard ceiling — the quantity pages fitted
 * exactly two members and said so, as if it were an editorial choice.
 *
 * What this file guards is the shape that replaced it: one sequence of numbered parts, one
 * chrome, and a flow layout that prints the whole model however large it is.
 */
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

describe('memoria de cálculo: estructura del documento', () => {
  it('abre cada parte numerada en su propia página, en una sola secuencia', async () => {
    const { project, analysis } = fixture();
    const report = await createCalculationReport(project, analysis, { ...fixedOptions, includeEducationTrace: false });
    const inspection = await inspectPdf(report.bytes);

    expect(inspection.kind).toBe('native');

    // Portada e índice son hojas propias; el cuerpo empieza en la tercera.
    const [cover, contents, ...body] = inspection.textByPage;
    expect(cover).toMatch(/Memoria de cálculo estructural/i);
    expect(cover).not.toMatch(/Contenido/i);
    expect(contents).toMatch(/Contenido/i);

    // Cada parte abre su propia página, y ninguna comparte hoja con otra.
    const titles = [
      /01\s+Resumen del análisis/,
      /02\s+Diagrama axial N/,
      /03\s+Diagrama cortante V/,
      /04\s+Diagrama de momento M/,
      /05\s+Unidades, convenciones y alcance/,
      /06\s+Procedimiento y cálculos/,
      /07\s+Materiales y secciones/,
      /08\s+Modelo y acciones/,
      /09\s+Resultados nodales y por miembro/,
    ];
    const indices = titles.map((title) => body.findIndex((text) => title.test(text)));
    expect(indices.every((index) => index >= 0)).toBe(true);
    expect(new Set(indices).size).toBe(titles.length);
    // Y en el orden en que el índice las promete.
    expect([...indices]).toEqual([...indices].sort((a, b) => a - b));
  }, 60_000);

  it('desarrolla cada diagrama con la pendiente medida y los extremos reales', async () => {
    const { project, analysis } = fixture();
    const report = await createCalculationReport(project, analysis, { ...fixedOptions, includeEducationTrace: false });
    const { textByPage } = await inspectPdf(report.bytes);
    // El índice también nombra cada parte, así que la búsqueda empieza detrás de él.
    const body = textByPage.slice(2);
    const page = (pattern: RegExp) => body.find((text) => pattern.test(text)) ?? '';

    const axial = page(/02\s+Diagrama axial N/);
    const shear = page(/03\s+Diagrama cortante V/);
    const moment = page(/04\s+Diagrama de momento M/);

    // La figura va numerada y con pie, no con su título dentro del marco.
    expect(axial).toMatch(/Figura \d+ - Diagrama N/);
    // Y el desarrollo son cifras de este análisis: 32.5 kN en el apoyo, bajando 5 kN por
    // metro bajo la carga de 5 kN/m, 17.5 kN a los 3 m.
    expect(shear).toMatch(/Se parte de V\(0\) = 32\.5 kN\./);
    expect(shear).toMatch(/Se avanza con dV\/ds = -5 kN\/m\./);
    expect(shear).toMatch(/Cierra en V\(3 m\) = 17\.5 kN\./);
    expect(moment).toMatch(/Se parte de M\(0\) = 0 kN·m\./);
    // El punto medio de la unidad sobrevive: `kN·m`, no `kN x m`.
    expect(moment).toMatch(/M máximo \(kN·m\)/);
  }, 60_000);

  it('imprime todos los miembros del modelo, sin recortar la página a los dos primeros', async () => {
    // Ocho vanos consecutivos: la maqueta anterior sólo cabía dos por página de magnitud y
    // anunciaba el recorte como si fuera una decisión editorial.
    const base = createHibbelerStyleDiagramPractice();
    const span = 3;
    const count = 8;
    const project: ProjectModel = {
      ...base,
      id: 'calculation-pdf-many-members',
      nodes: Array.from({ length: count + 1 }, (_, index) => ({
        id: `N${index}`,
        x: index * span,
        y: 0,
        support: index === 0
          ? { type: 'pin' as const }
          : index === count ? { type: 'roller' as const, angleDeg: 90 } : { type: 'none' as const },
      })),
      members: Array.from({ length: count }, (_, index) => ({
        id: `M${index + 1}`,
        i: `N${index}`,
        j: `N${index + 1}`,
        type: 'frame' as const,
        E: 200e6,
        A: 0.01,
        I: 8e-5,
      })),
      nodalLoads: [],
      memberLoads: Array.from({ length: count }, (_, index) => ({
        id: `W${index + 1}`,
        memberId: `M${index + 1}`,
        caseId: 'LC1',
        type: 'distributed' as const,
        coordinateSystem: 'global' as const,
        lengthBasis: 'real' as const,
        start: 0,
        end: 1,
        qxStart: 0,
        qxEnd: 0,
        qyStart: -8,
        qyEnd: -8,
      })),
    };
    const analysis = analyzeProject(project);
    expect(analysis.success).toBe(true);

    const report = await createCalculationReport(project, analysis, { ...fixedOptions, includeEducationTrace: false });
    const text = (await inspectPdf(report.bytes)).text.replace(/\s+/g, ' ');

    for (let index = 1; index <= count; index += 1) {
      expect(text).toContain(`M${index}`);
    }
    // Y el documento ya no se disculpa por lo que no cabía.
    expect(text).not.toMatch(/Se muestran los primeros/i);
  }, 60_000);

  it('escribe la parte 06 con el método elegido, y no toca el documento sin él', async () => {
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

    // Con método elegido, la parte 06 la escribe él: clasificación, redundante y la fila que
    // contrasta su resultado contra el análisis matricial.
    expect(chosenText).toMatch(/Método de la Doble Integración/i);
    expect(chosenText).toMatch(/hiperestática de grado 1/i);
    expect(chosenText).toMatch(/Redundantes elegidas/i);
    expect(chosenText).toMatch(/Verificación contra el análisis matricial/i);
    // La redundante de la empotrada-apoyada es 3qL/8 = 22.5 kN, y la columna del solver tiene
    // que decir lo mismo: el documento enseña que los dos caminos se encontraron.
    expect(chosenText).toMatch(/22\.5\s+22\.5/);
    expect(chosenText).toMatch(/Curva elástica/i);

    // Sin método elegido, la misma parte lleva el recorrido matricial completo.
    expect(plainText).toMatch(/Procedimiento y cálculos/i);
    expect(plainText).toMatch(/Geometría, nodos y ejes/i);
    expect(plainText).not.toMatch(/Doble Integración/i);
  }, 60_000);

  it('sustituye la geometría del procedimiento con los números reales del proyecto', async () => {
    const { project, analysis } = fixture();
    const report = await createCalculationReport(project, analysis, fixedOptions);
    const inspection = await inspectPdf(report.bytes);
    const page = inspection.textByPage.find((text) => /Geometría, nodos y ejes/i.test(text)) ?? '';
    const flat = page.replace(/\s+/g, ' ');
    // Las ecuaciones genéricas del motor (ΔX = Xⱼ − Xᵢ, L = √(ΔX²+ΔY²)…) describen el método
    // y ya no se imprimen: en su lugar van las mismas, sustituidas con las coordenadas reales
    // — A(0,0), B(8,0) en este miembro — más la tabla que las recoge para todos los miembros.
    expect(flat).toMatch(/Miembro AB: de A \(0, 0\) a B \(8, 0\) m/);
    expect(flat).toMatch(/Miembro DeltaX \(m\) DeltaY \(m\) L \(m\) c s AB 8 0 8 1 0/);
    // El paso de cargas no reconstruye su propia tabla: apunta a la parte que ya la lleva.
    const all = inspection.text.replace(/\s+/g, ' ');
    expect(all).toMatch(/están completos en «Modelo y acciones»/i);
  }, 60_000);

  it('deja caer las partes que el lector no pidió, sin dejar hueco en la numeración', async () => {
    const { project, analysis } = fixture();
    const [complete, trimmed] = await Promise.all([
      createCalculationReport(project, analysis, { ...fixedOptions, includeEducationTrace: true }),
      createCalculationReport(project, analysis, { ...fixedOptions, includeDiagrams: false, includeAnnex: false }),
    ]);
    const [full, short] = await Promise.all([inspectPdf(complete.bytes), inspectPdf(trimmed.bytes)]);

    expect(full.text).toMatch(/Traza del sistema resuelto/i);
    expect(full.text).toMatch(/Modelo y acciones/i);
    expect(short.text).not.toMatch(/Traza del sistema resuelto/i);
    expect(short.text).not.toMatch(/Diagrama axial N/i);
    expect(short.pageCount).toBeLessThan(full.pageCount);

    // La numeración se asigna al abrir cada parte, así que una copia corta numera 01, 02, 03
    // sin saltarse un número por las partes ausentes.
    const shortText = short.text.replace(/\s+/g, ' ');
    expect(shortText).toMatch(/01\s+Resumen del análisis/);
    expect(shortText).toMatch(/02\s+Unidades, convenciones y alcance/);
    expect(shortText).toMatch(/03\s+Procedimiento y cálculos/);
    expect(shortText).toMatch(/04\s+Materiales y secciones/);
    expect(shortText).not.toMatch(/\b05\s+/);

    // El expediente adjunto no depende de qué partes se imprimieron.
    expect(trimmed.payload.checksum.value).toBe(complete.payload.checksum.value);
  }, 60_000);
});
