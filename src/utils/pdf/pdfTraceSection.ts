/**
 * The assembled algebra: degrees of freedom, the global stiffness and constraint matrices, and
 * every element's transformation, local stiffness and end forces.
 *
 * This is the part a reader opens to check the solver rather than the structure, so nothing
 * here is rounded for looks: the entries are printed at the precision the matrix carries, and
 * a matrix too wide for the page says so and points at the attached file instead of quietly
 * cropping itself.
 */
import { clearNumber, number } from './pdfFormat';
import type { PdfTableColumn } from './pdfBuilder';
import type { MatrixTrace } from '../../types';
import type { ReportContext } from './reportContext';

/** Widest matrix that still fits the content width at a legible size. */
const MATRIX_LIMIT = 8;

const NUMERIC: Pick<PdfTableColumn, 'align'> = { align: 'right' };

export const drawTracePart = (context: ReportContext): void => {
  const { layout, analysis } = context;
  const trace = analysis.educationTrace;
  if (!trace) return;

  layout.part(
    'Traza del sistema resuelto',
    'Grados de libertad, matrices ensambladas y la contribución de cada elemento.',
  );

  const matrix = (label: string, entry: MatrixTrace): void => {
    const rows = Math.min(entry.rows, MATRIX_LIMIT);
    const columns = Math.min(entry.columns, MATRIX_LIMIT);
    const values = new Map(entry.entries.map((cell) => [`${cell.row}:${cell.column}`, cell.value]));
    // A stiffness matrix assembled from terms of order 1e5 carries entries of order 1e-13 that
    // are float residue, not stiffness. Collapsing against the matrix's own governing entry
    // keeps that promise at any scale, and matches how the rest of the document reads a number.
    const scale = Math.max(1e-12, ...entry.entries.map((cell) => Math.abs(cell.value)));
    layout.heading(label, 2);
    if (entry.rows > rows || entry.columns > columns) {
      layout.note(
        `Vista parcial ${rows} × ${columns} de una matriz ${entry.rows} × ${entry.columns}; `
        + 'el adjunto JSON conserva todas las entradas.',
      );
    }
    layout.table(
      [{ header: 'GDL', width: 48 }, ...entry.columnLabels.slice(0, columns).map((header) => ({ header, ...NUMERIC }))],
      entry.rowLabels.slice(0, rows).map((rowLabel, row) => [
        rowLabel,
        ...Array.from({ length: columns }, (_, column) => {
          const value = values.get(`${row}:${column}`) ?? 0;
          return value === 0 ? '0' : clearNumber(value, scale, 4);
        }),
      ]),
      { size: 6.6 },
    );
  };

  layout.keyValues([
    ['Esquema de la traza', `v${trace.schemaVersion} · ${trace.formulation}`],
    ['Grados de libertad', `${trace.dofs.length}, de los cuales ${trace.dofs.filter((dof) => dof.constrained).length} restringidos`],
    ['Energía de deformación', number(trace.assembly.strainEnergy)],
    ['Detalle de matrices', trace.assembly.matrixDetail === 'full' ? 'completo' : 'resumido'],
  ]);

  matrix('Matriz global de rigidez K', trace.assembly.stiffness);
  matrix('Matriz de restricciones C', trace.assembly.constraintMatrix);

  for (const element of trace.elements) {
    layout.heading(`Elemento ${element.memberId}`);
    layout.keyValues([
      ['Longitud', `${number(element.length)} (bruta ${number(element.grossLength)})`],
      ['Cosenos directores', `c = ${number(element.c, 6)}   s = ${number(element.s, 6)}`],
      ['Grados de libertad', element.dofLabels.join(', ')],
      ['Liberaciones locales', element.releasedLocalDofs.length ? element.releasedLocalDofs.join(', ') : 'ninguna'],
    ]);
    matrix('Transformación T', element.transformation);
    matrix('Rigidez local efectiva', element.localStiffnessEffective);
    matrix('Contribución al K global', element.globalStiffnessContribution);
  }
};
