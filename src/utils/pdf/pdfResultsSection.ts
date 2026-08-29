/**
 * What the solve produced: reactions and displacements at every node, then the governing
 * figures, end forces, critical points and three small diagrams of every member.
 *
 * The exact segment functions used to be repeated here as well, in a table that duplicated
 * the ones the N, V and M parts already print in full. They are printed once now, where the
 * diagram they describe is.
 */
import { drawMemberDiagrams } from './pdfDiagrams';
import { clearCell, clearNumber, displayCell, unitFor } from './pdfFormat';
import type { PdfTableColumn } from './pdfBuilder';
import type { ReportContext } from './reportContext';

const NUMERIC: Pick<PdfTableColumn, 'align'> = { align: 'right' };

export const drawResultsPart = (context: ReportContext): void => {
  const { layout, project, analysis } = context;

  layout.part(
    'Resultados nodales y por miembro',
    'Reacciones, desplazamientos y el detalle completo de cada miembro del modelo.',
  );

  layout.heading('Reacciones y desplazamientos');
  if (!analysis.nodeResults.length) {
    layout.note('El análisis no produjo resultados nodales.');
  } else {
    // Each family collapses against its own governing magnitude across the model, so a
    // displacement of 1e-37 m reads as 0 instead of as a measurable movement.
    const extreme = (pick: (entry: typeof analysis.nodeResults[number]) => number) =>
      Math.max(1e-12, ...analysis.nodeResults.map((entry) => Math.abs(pick(entry))));
    const reactionScale = Math.max(extreme((entry) => entry.rx), extreme((entry) => entry.ry));
    const nodalMomentScale = extreme((entry) => entry.rm);
    const displacementScale = Math.max(extreme((entry) => entry.ux), extreme((entry) => entry.uy));
    const rotationScale = extreme((entry) => entry.rz);
    layout.table(
      [
        { header: 'Nodo', width: 54 },
        { header: `Rx (${unitFor(project, 'force')})`, ...NUMERIC },
        { header: `Ry (${unitFor(project, 'force')})`, ...NUMERIC },
        { header: `M (${unitFor(project, 'moment')})`, ...NUMERIC },
        { header: `Ux (${unitFor(project, 'length')})`, ...NUMERIC },
        { header: `Uy (${unitFor(project, 'length')})`, ...NUMERIC },
        { header: 'Rz (rad)', ...NUMERIC },
      ],
      analysis.nodeResults.map((result) => [
        result.nodeId,
        clearCell(project, result.rx, 'force', reactionScale),
        clearCell(project, result.ry, 'force', reactionScale),
        clearCell(project, result.rm, 'moment', nodalMomentScale),
        clearCell(project, result.ux, 'length', displacementScale),
        clearCell(project, result.uy, 'length', displacementScale),
        clearNumber(result.rz, rotationScale),
      ]),
    );
  }

  if (!analysis.memberResults.length) {
    layout.heading('Detalle por miembro');
    layout.note('El análisis no produjo resultados de miembro.');
    return;
  }

  for (const result of analysis.memberResults) {
    layout.heading(`Miembro ${result.memberId}`);
    // A beam with no axial load once reported "min = 1.53081e-16 kip" here while page 1
    // correctly reported 0. Both collapse against the governing magnitude of the same member
    // now, so the document cannot contradict itself.
    const forceScale = Math.max(
      Math.abs(result.maxShear), Math.abs(result.minShear),
      Math.abs(result.maxAxial), Math.abs(result.minAxial), 1e-12,
    );
    const momentScale = Math.max(Math.abs(result.maxMoment), Math.abs(result.minMoment), 1e-12);
    const forceText = (value: number) => clearCell(project, value, 'force', forceScale);
    const momentText = (value: number) => clearCell(project, value, 'moment', momentScale);

    layout.table(
      [
        { header: 'Magnitud', width: 140 },
        { header: 'Mínimo', ...NUMERIC },
        { header: 'Máximo', ...NUMERIC },
        { header: 'Unidad', width: 70 },
      ],
      [
        ['N axial', forceText(result.minAxial), forceText(result.maxAxial), unitFor(project, 'force')],
        ['V cortante', forceText(result.minShear), forceText(result.maxShear), unitFor(project, 'force')],
        ['M momento', momentText(result.minMoment), momentText(result.maxMoment), unitFor(project, 'moment')],
      ],
    );

    // `localEndForces` is [Fxi, Fyi, Mi, Fxj, Fyj, Mj] in base units. It used to be printed
    // bare, so the same page stated forces in kip on one line and in kN on the next with no
    // label at all. Each component is converted and labelled by its own column.
    layout.heading('Fuerzas de extremo en ejes locales', 3);
    layout.table(
      [
        { header: `Fx_i (${unitFor(project, 'force')})`, ...NUMERIC },
        { header: `Fy_i (${unitFor(project, 'force')})`, ...NUMERIC },
        { header: `M_i (${unitFor(project, 'moment')})`, ...NUMERIC },
        { header: `Fx_j (${unitFor(project, 'force')})`, ...NUMERIC },
        { header: `Fy_j (${unitFor(project, 'force')})`, ...NUMERIC },
        { header: `M_j (${unitFor(project, 'moment')})`, ...NUMERIC },
      ],
      [result.localEndForces.map((entry, position) => position === 2 || position === 5 ? momentText(entry) : forceText(entry))],
    );

    if (result.criticalPoints.length) {
      layout.heading('Puntos críticos localizados', 3);
      layout.table(
        [
          { header: 'Magnitud', width: 96 },
          { header: `x (${unitFor(project, 'length')})`, ...NUMERIC },
          { header: 'Valor', ...NUMERIC },
          { header: 'Unidad', width: 62 },
          { header: 'Tipo', width: 80 },
        ],
        result.criticalPoints.map((point) => [
          point.quantity,
          displayCell(project, point.x, 'length'),
          point.quantity === 'moment' ? momentText(point.value) : forceText(point.value),
          unitFor(project, point.quantity === 'moment' ? 'moment' : 'force'),
          point.kind,
        ]),
      );
    }

    layout.figure(
      96,
      (rect) => drawMemberDiagrams(context, result, rect),
      `Miembro ${result.memberId}: diagramas N, V y M sobre su propia longitud.`,
    );
  }
};
