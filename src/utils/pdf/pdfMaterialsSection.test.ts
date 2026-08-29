/**
 * What the specification part is allowed to claim.
 *
 * The rule it must not break is the product's own: a real profile — its name, its standard, its
 * drawing — belongs only to a member that *declares* a catalogue identity. Two different
 * sections can share `A` and `I`, so naming one from those two numbers would put an identity in
 * a signed document that the model never held.
 */
import { describe, expect, it } from 'vitest';
import { createHibbelerStyleDiagramPractice } from '../../data/defaultProject';
import { analyzeProject } from '../../engine/solver';
import { createCalculationReport } from '../calculationPdf';
import { inspectPdf } from '../pdfImport';
import type { ProjectModel } from '../../types';

const FRAME = { type: 'frame' as const, E: 200e6, A: 0.01, I: 8e-5 };

const uniform = (memberId: string, q: number): ProjectModel['memberLoads'][number] => ({
  id: `W-${memberId}`, memberId, caseId: 'LC1', type: 'distributed', coordinateSystem: 'global',
  lengthBasis: 'real', start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: q, qyEnd: q,
});

const twoSpanBeam = (): ProjectModel => ({
  ...createHibbelerStyleDiagramPractice(),
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'B', x: 6, y: 0, support: { type: 'roller', angleDeg: 90 } },
    { id: 'C', x: 12, y: 0, support: { type: 'roller', angleDeg: 90 } },
  ],
  members: [{ id: 'AB', i: 'A', j: 'B', ...FRAME }, { id: 'BC', i: 'B', j: 'C', ...FRAME }],
  memberLoads: [uniform('AB', -10), uniform('BC', -10)],
  nodalLoads: [],
});

/** The same beam with both members declaring a catalogue steel and a catalogue profile. */
const catalogued = (): ProjectModel => {
  const base = twoSpanBeam();
  return {
    ...base,
    members: [
      {
        ...base.members[0], materialId: 'steel-a992', materialOrigin: 'catalog',
        sectionId: 'ipe-300', sectionOrigin: 'catalog', E: 200e6, A: 0.00538, I: 0.0000836,
      },
      {
        ...base.members[1], materialId: 'steel-a36', materialOrigin: 'catalog',
        sectionId: 'heb-200', sectionOrigin: 'catalog', E: 200e6, A: 0.00781, I: 0.000057,
      },
    ],
  };
};

const fixedOptions = { generatedAt: '2026-08-29T12:00:00.000Z', scenarioName: 'Servicio', scenarioFactors: { LC1: 1 } };

const reportText = async (project: ProjectModel): Promise<string> => {
  const analysis = analyzeProject(project);
  expect(analysis.success).toBe(true);
  const report = await createCalculationReport(project, analysis, fixedOptions);
  const inspection = await inspectPdf(report.bytes);
  return inspection.textByPage.join(' ');
};

describe('parte de materiales y secciones', () => {
  it('nombra el material y el perfil con su ficha completa cuando el modelo los declara', async () => {
    const text = await reportText(catalogued());
    // Material: the standard's own name, and the figures a reader would look up.
    expect(text).toContain('Acero estructural ASTM A992/A992M / ASTM A572 Gr. 50');
    expect(text).toContain('Acero estructural ASTM A36/A36M');
    expect(text).toMatch(/345 MPa/);
    expect(text).toMatch(/250 MPa/);
    // Section: the profile, its standard, and the properties the catalogue carries beyond A and I.
    expect(text).toContain('IPE 300');
    expect(text).toContain('HEB 200');
    expect(text).toMatch(/Módulo plástico/);
    expect(text).toMatch(/Radio de giro/);
    expect(text).toMatch(/Espesor de alma/);
  }, 60_000);

  it('agrupa un perfil repetido en una sola ficha y lista los miembros que lo llevan', async () => {
    const base = catalogued();
    const project: ProjectModel = {
      ...base,
      // Both members now carry the same profile: the sheet must appear once, not twice.
      members: base.members.map((member) => ({
        ...member, materialId: 'steel-a992', materialOrigin: 'catalog' as const,
        sectionId: 'ipe-300', sectionOrigin: 'catalog' as const, A: 0.00538, I: 0.0000836,
      })),
    };
    const text = await reportText(project);
    const sheets = text.match(/IPE 300 - perfil doble T \(EUROCODE\)/g) ?? [];
    expect(sheets).toHaveLength(1);
    expect(text).toContain('Asignada a: AB, BC.');
  }, 60_000);

  it('no inventa un perfil comercial a partir de A e I', async () => {
    // The default beam declares no catalogue identity at all. The part must say so rather than
    // pick whichever profile happens to match those two numbers.
    const text = await reportText(twoSpanBeam());
    expect(text).toContain('Ningún miembro declara una sección de catálogo');
    expect(text).toContain('Ningún miembro declara un material de catálogo');
    expect(text).not.toMatch(/IPE \d/);
    expect(text).not.toMatch(/HEB \d/);
  }, 60_000);

  it('declara el identificador que el catálogo no reconoce, en vez de rotularlo como personalizado', async () => {
    const base = catalogued();
    const project: ProjectModel = {
      ...base,
      members: [{ ...base.members[0], sectionId: 'perfil-que-ya-no-existe' }, base.members[1]],
    };
    const text = await reportText(project);
    expect(text).toContain('perfil-que-ya-no-existe (no está en el catálogo)');
  }, 60_000);

  it('se puede dejar fuera del documento sin abrir un hueco en la numeración', async () => {
    const project = catalogued();
    const analysis = analyzeProject(project);
    const report = await createCalculationReport(project, analysis, { ...fixedOptions, includeMaterials: false });
    const inspection = await inspectPdf(report.bytes);
    const text = inspection.textByPage.join(' ');
    expect(text).not.toContain('Materiales y secciones');
    // The part that followed it takes its number, exactly as every other droppable part does.
    expect(text).toMatch(/07\s+Modelo y acciones/);
  }, 60_000);
});
