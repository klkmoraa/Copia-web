/**
 * How the result was reached, step by step, with the arithmetic each step performed.
 *
 * Two things used to occupy this ground: a five-panel "procedimiento" page that clipped every
 * summary at two lines, and section 5 of the annex, which walked the same steps properly.
 * They said the same thing at different fidelities, so the lossy one is gone and this is the
 * walk — one part, in the document's own numbering, that a reviewer can follow end to end.
 *
 * When the project selects a classical solution method, that method writes this part instead:
 * the same place in the document, developed the way a textbook develops it, and always with
 * this structure's own numbers.
 */
import { drawMethodSection } from './pdfMethodSection';
import { memberAxis } from '../../graphics/structureGeometry';
import { clearNumber, displayCell, number, unitFor } from './pdfFormat';
import { stepSubstitutions, type SubstitutionBlock } from './pdfSubstitution';
import { TYPE } from './pdfTheme';
import type { PdfTableColumn } from './pdfBuilder';
import type { ReportContext } from './reportContext';

const NUMERIC: Pick<PdfTableColumn, 'align'> = { align: 'right' };

/**
 * Draws one step's substituted relations: a caption naming what the arithmetic belongs to,
 * then the numbered display equations themselves.
 */
const drawSubstitutions = (context: ReportContext, blocks: readonly SubstitutionBlock[]): void => {
  const { layout } = context;
  for (const block of blocks) {
    if (block.caption) layout.text(block.caption, TYPE.small, layout.fonts.bold, layout.palette.ink, 12);
    for (const equation of block.equations) {
      layout.ensure(layout.measureMathBlock(equation, TYPE.body, 16));
      layout.y -= layout.drawMathBlockAt(equation, TYPE.body, 16, layout.palette.ink, `(${layout.nextEquationNumber()})`);
    }
  }
};

/**
 * The geometry step, instantiated per member from the project's own node coordinates via
 * `memberAxis` — the same helper the canvas and the solver's axis resolution use. This reads
 * project data; it does not touch `src/engine`.
 */
const drawGeometryTable = (context: ReportContext): void => {
  const { layout, project, index } = context;
  if (!project.members.length) return;
  layout.table(
    [
      { header: 'Miembro', width: 62 },
      { header: `ΔX (${unitFor(project, 'length')})`, ...NUMERIC },
      { header: `ΔY (${unitFor(project, 'length')})`, ...NUMERIC },
      { header: `L (${unitFor(project, 'length')})`, ...NUMERIC },
      { header: 'c', ...NUMERIC },
      { header: 's', ...NUMERIC },
    ],
    project.members.map((member) => {
      const ni = index.node(member.i);
      const nj = index.node(member.j);
      if (!ni || !nj) return [member.id, 'n/d', 'n/d', 'n/d', 'n/d', 'n/d'];
      const axis = memberAxis(member, ni, nj);
      return [
        member.id,
        displayCell(project, axis.dx, 'length'),
        displayCell(project, axis.dy, 'length'),
        displayCell(project, axis.length, 'length'),
        number(axis.c, 4),
        number(axis.s, 4),
      ];
    }),
  );
};

const drawGenericProcedure = (context: ReportContext): void => {
  const { layout, analysis, options } = context;
  // A pointer to a part this copy does not carry is worse than no pointer: the reader turns
  // to a section that is not there. Both cross-references below are gated on the toggles that
  // decide whether their target was drawn at all.
  const hasModelPart = options.includeAnnex !== false;
  const hasTracePart = hasModelPart && options.includeEducationTrace !== false && Boolean(analysis.educationTrace);

  if (!analysis.explanation.length) {
    layout.note('El análisis no registró pasos explicativos.');
    return;
  }

  for (const [stepIndex, step] of analysis.explanation.entries()) {
    layout.heading(`${stepIndex + 1}. ${step.title.replace(/^\d+\.\s*/, '')}`);
    layout.text(step.summary);
    layout.gap();
    // The solver publishes each step's relation symbolically — `L = √(ΔX² + ΔY²)`,
    // `dθ/dx = M/EI`. Those state the method and say nothing about this structure, so what
    // gets printed is the same relation already carried out, operand by operand, with this
    // project's numbers. A step with nothing to substitute prints no equation at all.
    drawSubstitutions(context, stepSubstitutions(context, step.id));

    if (step.id === 'geometry') drawGeometryTable(context);
    if ((step.id === 'loads' || step.id === 'equivalent-loads') && hasModelPart) {
      layout.note('El intervalo, la intensidad y la resultante de cada carga están completos en «Modelo y acciones».', 12);
    }
    // K and C are sums over every member and a whole system: substituting them here would
    // rebuild the engine's linear algebra in the drawing layer, with the risk of getting a
    // number wrong in a document somebody signs. The pointer only appears when this copy
    // actually carries them.
    if ((step.id === 'stiffness' || step.id === 'transform') && hasTracePart) {
      layout.note('K y C, ya ensambladas con los valores reales del proyecto, están en «Traza del sistema resuelto».', 12);
    }
    if (step.id === 'diagrams' && options.includeDiagrams !== false) {
      layout.note('Las funciones N(s), V(s) y M(s) de cada tramo están completas en las partes de diagramas.', 12);
    }

    // The values come from the engine, but the formatting is ours. Within one step, entries
    // sharing a unit are comparable, so each collapses against the largest of its own family:
    // an equilibrium sum of -1.06581e-14 kN beside a load of 22 kN is zero.
    const quantities = (title: string, entries: readonly { label: string; value: number; unit: string }[]): void => {
      if (!entries.length) return;
      const scaleByUnit = new Map<string, number>();
      for (const entry of entries) {
        scaleByUnit.set(entry.unit, Math.max(scaleByUnit.get(entry.unit) ?? 1e-12, Math.abs(entry.value)));
      }
      layout.table(
        // The engine labels these with symbols (`ΣFx`, `κ₁`), so the column is typeset as
        // maths rather than prose, which is what turned them into `SumFx` and `kappa_1`.
        [{ header: title, width: 168, math: true }, { header: 'Valor', ...NUMERIC }, { header: 'Unidad', width: 78 }],
        entries.map((entry) => [entry.label, clearNumber(entry.value, scaleByUnit.get(entry.unit) ?? 1), entry.unit]),
      );
    };
    quantities('Datos de este paso', step.inputs ?? []);
    quantities('Resultados de este paso', step.outputs ?? []);
    layout.gap(2);
  }
};

export const drawProcedurePart = (context: ReportContext): void => {
  const { layout, project } = context;
  const method = project.settings.solutionMethod;
  layout.part(
    'Procedimiento y cálculos',
    method && method !== 'matrix-stiffness'
      ? 'El método elegido, desarrollado con los números de esta estructura.'
      : 'Cada paso del análisis matricial, con la operación que realmente se hizo.',
  );
  // A chosen method writes this part with this project's numbers. Without one — or when the
  // chosen one does not apply to this structure — the matrix walk stays: the document is never
  // left without its procedure.
  if (!drawMethodSection(context)) drawGenericProcedure(context);
};
