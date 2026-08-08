/**
 * Verifiable technical annex: project summary, model and actions, reactions and
 * displacements, exact N-V-M functions, procedure and — on request — the educational trace
 * with the assembled matrices.
 *
 * This is the part of the document the reviewer audits, so every figure states its unit and
 * collapses numeric noise against the governing magnitude of its own family.
 *
 * Everything that is a list of comparable records is set as a ruled table (AG-014): the unit
 * moves once into the column header, numbers are right-aligned so orders of magnitude line
 * up, and the header repeats after a page break. Prose stays prose — a paragraph forced into
 * a two-column grid reads worse, not better.
 */
import { drawGlobalDcl, drawMemberDiagrams } from './pdfDiagrams';
import {
  clearCell,
  clearNumber,
  displayCell,
  formatPolynomial,
  memberLoadDescription,
  number,
  unitFor,
} from './pdfFormat';
import type { PdfTableColumn } from './pdfBuilder';
import type { ReportContext } from './reportContext';
import type { MatrixTrace } from '../../types';

/** Widest matrix that still fits the content width at a legible size. */
const MATRIX_LIMIT = 8;

const NUMERIC: Pick<PdfTableColumn, 'align'> = { align: 'right' };

export const drawTechnicalAnnex = (context: ReportContext): void => {
  const { layout, project, analysis, payload, options, scenarioFactors, index } = context;
  const { rgb, fonts } = layout;

  /** `label | value` grid: the summary rows keep their alignment without pretending to be data. */
  const summary = (entries: readonly (readonly [string, string])[]): void => {
    layout.table(
      [{ header: 'Concepto', width: 132 }, { header: 'Valor' }],
      entries.map(([label, value]) => [label, value]),
      { size: 8 },
    );
  };

  const matrix = (label: string, trace: MatrixTrace): void => {
    const rows = Math.min(trace.rows, MATRIX_LIMIT);
    const columns = Math.min(trace.columns, MATRIX_LIMIT);
    const values = new Map(trace.entries.map((entry) => [`${entry.row}:${entry.column}`, entry.value]));
    // A stiffness matrix assembled from terms of order 1e5 carries entries of order 1e-13
    // that are float residue, not stiffness. `matrixSummary` used to drop them with a fixed
    // 1e-12 cut; collapsing against the matrix's own governing entry instead keeps the same
    // promise at any scale, and matches how the rest of the annex reads a number.
    const scale = Math.max(1e-12, ...trace.entries.map((entry) => Math.abs(entry.value)));
    layout.heading(label, 2);
    if (trace.rows > rows || trace.columns > columns) {
      layout.text(`Vista parcial ${rows} x ${columns} de una matriz ${trace.rows} x ${trace.columns}; el adjunto JSON conserva todas las entradas.`, 7.8, fonts.regular, rgb(0.36, 0.40, 0.45), 8);
    }
    layout.table(
      [{ header: 'GDL', width: 44 }, ...trace.columnLabels.slice(0, columns).map((header) => ({ header, ...NUMERIC }))],
      trace.rowLabels.slice(0, rows).map((rowLabel, row) => [
        rowLabel,
        ...Array.from({ length: columns }, (_, column) => {
          const value = values.get(`${row}:${column}`) ?? 0;
          return value === 0 ? '0' : clearNumber(value, scale, 4);
        }),
      ]),
      { size: 6.6 },
    );
  };

  layout.newPage();
  layout.heading('Anexo tecnico verificable');
  layout.text(`Expediente portable v${payload.formatVersion} - app ${payload.provenance.appVersion}. Integridad SHA-256: ${payload.checksum.value}`, 8.3);
  layout.text('Este anexo conserva el proyecto, las operaciones completas y los resultados exactos. El adjunto JSON permite reimportar el expediente sin OCR.', 8.3);

  layout.heading('1. Resumen del proyecto');
  // These sums are meant to close at zero. Printing one of them as `0` and the next as
  // `-1.06581e-14` says nothing about the structure, only about which float happened to
  // land exactly on zero. They collapse against the applied load; the normalized residual
  // right after keeps the audit trail at full precision.
  const equilibriumScale = Math.max(
    Math.abs(analysis.loadAudit?.source.fx ?? 0),
    Math.abs(analysis.loadAudit?.source.fy ?? 0),
    1,
  );
  const equilibriumMomentScale = Math.max(Math.abs(analysis.loadAudit?.source.mz ?? 0), 1);
  summary([
    ['Estado del analisis', analysis.success ? 'resuelto' : 'con errores'],
    ['Modelo', `${project.nodes.length} nodos, ${project.members.length} miembros`],
    ['Cargas', `${payload.metadata.loadCount} acciones; ${project.loadCases.length} casos; ${project.combinations.length} combinaciones`],
    ['Factores del escenario', project.loadCases.map((loadCase) => `${loadCase.id}=${number(scenarioFactors[loadCase.id] ?? 0)}`).join(', ') || 'sin casos'],
    ['Formulacion', analysis.educationTrace?.formulation ?? 'analisis estatico lineal 2D'],
    ['Norma residual', number(analysis.residualNorm)],
    ['Estimacion de condicion', number(analysis.conditionEstimate)],
    ['Equilibrio', `Fx=${clearNumber(analysis.equilibrium.sumFx, equilibriumScale)}, Fy=${clearNumber(analysis.equilibrium.sumFy, equilibriumScale)}, M=${clearNumber(analysis.equilibrium.sumM, equilibriumMomentScale)}; residuo=${number(analysis.equilibrium.normalizedResidual)}`],
  ]);

  if (analysis.loadAudit) {
    const audit = analysis.loadAudit;
    const reference = audit.referencePoint;
    const critical = audit.memberAudits.reduce<typeof audit.memberAudits[number] | undefined>(
      (best, entry) => !best || entry.normalizedResidual > best.normalizedResidual ? entry : best,
      undefined,
    );
    const auditForce = (value: number) => clearNumber(value, equilibriumScale);
    const auditMoment = (value: number) => clearNumber(value, equilibriumMomentScale);
    layout.heading('Auditoria independiente de cargas', 2);
    layout.table(
      [
        { header: 'Origen', width: 96 },
        { header: `Fx (${unitFor(project, 'force')})`, ...NUMERIC },
        { header: `Fy (${unitFor(project, 'force')})`, ...NUMERIC },
        { header: `M_O (${unitFor(project, 'moment')})`, ...NUMERIC },
      ],
      [
        ['Fuente', auditForce(audit.source.fx), auditForce(audit.source.fy), auditMoment(audit.source.mz)],
        ['Ensamblaje', auditForce(audit.assembled.fx), auditForce(audit.assembled.fy), auditMoment(audit.assembled.mz)],
      ],
      { size: 8, zebra: false },
    );
    layout.text(`Punto de reduccion O=${reference ? `(${number(reference.x)}, ${number(reference.y)})` : 'no disponible'}; residuo global=${number(audit.resultantResidual)}; residuo maximo=${number(audit.normalizedResidual)}${critical ? ` en ${critical.memberId}` : ''}.`, 8, fonts.regular, undefined, 8);
  }

  if (analysis.issues.length) {
    layout.heading('Incidencias', 2);
    layout.table(
      [{ header: 'Severidad', width: 62 }, { header: 'Titulo', width: 120 }, { header: 'Detalle' }],
      analysis.issues.map((issue) => [issue.severity.toUpperCase(), issue.title, issue.message]),
      { size: 7.8 },
    );
  }

  layout.heading('2. DCL, geometria y acciones');
  drawGlobalDcl(context);

  layout.heading('Nodos y apoyos', 2);
  layout.table(
    [
      { header: 'Nodo', width: 58 },
      { header: `x (${unitFor(project, 'length')})`, ...NUMERIC },
      { header: `y (${unitFor(project, 'length')})`, ...NUMERIC },
      { header: 'Apoyo', flex: 1.4 },
      { header: 'Articulacion interna', flex: 1.2 },
    ],
    project.nodes.map((node) => [
      node.id,
      displayCell(project, node.x, 'length'),
      displayCell(project, node.y, 'length'),
      node.support.type,
      node.internalHinge ? 'si' : '-',
    ]),
  );

  layout.heading('Miembros', 2);
  layout.table(
    [
      { header: 'Miembro', width: 58 },
      { header: 'Conexion', width: 74 },
      { header: 'Tipo', width: 52 },
      { header: 'E (kN/m^2)', ...NUMERIC },
      { header: 'A (m^2)', ...NUMERIC },
      { header: 'I (m^4)', ...NUMERIC },
    ],
    project.members.map((member) => [
      member.id,
      `${member.i} -> ${member.j}`,
      member.type,
      number(member.E),
      number(member.A),
      number(member.I),
    ]),
  );

  layout.heading('Cargas nodales', 2);
  if (!project.nodalLoads.length) layout.text('Sin cargas nodales.', 8.7, fonts.regular, undefined, 8);
  else {
    layout.table(
      [
        { header: 'Carga', width: 56 },
        { header: 'Nodo', width: 46 },
        { header: 'Caso', width: 52 },
        { header: 'Factor', ...NUMERIC, width: 44 },
        { header: `Fx (${unitFor(project, 'force')})`, ...NUMERIC },
        { header: `Fy (${unitFor(project, 'force')})`, ...NUMERIC },
        { header: `Mz (${unitFor(project, 'moment')})`, ...NUMERIC },
      ],
      project.nodalLoads.map((load) => [
        load.id,
        load.nodeId,
        load.caseId,
        number(scenarioFactors[load.caseId] ?? 0),
        displayCell(project, load.fx, 'force'),
        displayCell(project, load.fy, 'force'),
        displayCell(project, load.mz, 'moment'),
      ]),
    );
  }

  layout.heading('Cargas de miembro', 2);
  if (!project.memberLoads.length) layout.text('Sin cargas de miembro.', 8.7, fonts.regular, undefined, 8);
  else {
    layout.table(
      [
        { header: 'Carga', width: 52 },
        { header: 'Miembro', width: 50 },
        { header: 'Tipo', width: 56 },
        { header: 'Caso', width: 46 },
        { header: 'Factor', ...NUMERIC, width: 40 },
        { header: 'Ejes', width: 44 },
        { header: 'Descripcion', flex: 3.4 },
      ],
      project.memberLoads.map((load) => [
        load.id,
        load.memberId,
        load.type,
        load.caseId,
        number(scenarioFactors[load.caseId] ?? 0),
        load.coordinateSystem,
        memberLoadDescription(project, index, load),
      ]),
      { size: 7.2 },
    );
  }

  if (analysis.loadAudit?.memberAudits.length) {
    layout.heading('Auditoria por trabajo virtual', 2);
    layout.text('Cada vector local [Fxi, Fyi, Mi, Fxj, Fyj, Mj] se reintegra desde las cargas fuente con funciones cerradas independientes, antes de liberaciones o condensacion.', 8, fonts.regular, undefined, 8);
    layout.table(
      [
        { header: 'Miembro', width: 62 },
        { header: 'L fuente', ...NUMERIC },
        { header: 'L ensamblada', ...NUMERIC },
        { header: 'Residuo mecanico', ...NUMERIC },
        { header: 'Residuo inicial', ...NUMERIC },
        { header: 'Residuo total', ...NUMERIC },
      ],
      analysis.loadAudit.memberAudits.map((audit) => [
        audit.memberId,
        number(audit.flexibleLength.source),
        number(audit.flexibleLength.assembled),
        number(audit.mechanical.normalizedResidual),
        number(audit.initial.normalizedResidual),
        number(audit.normalizedResidual),
      ]),
    );
  }

  layout.heading('3. Reacciones y desplazamientos');
  if (!analysis.nodeResults.length) layout.text('No hay resultados nodales.', 8.7, fonts.regular, undefined, 8);
  else {
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
        { header: 'Nodo', width: 50 },
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
      { size: 7.4 },
    );
  }

  layout.heading('4. Diagramas N, V y M');
  layout.text('Los extremos se obtienen de los segmentos polinomicos exactos y puntos criticos del motor; el attachment conserva todas las funciones, saltos y muestras.', 8.7);
  if (!analysis.memberResults.length) layout.text('No hay resultados de miembros.', 8.7, fonts.regular, undefined, 8);
  for (const result of analysis.memberResults) {
    layout.ensure(160);
    layout.heading(`Miembro ${result.memberId}`, 2);
    // The annex used raw `display`, so a beam with no axial load reported
    // "min=1.53081e-16 kip" while page 1 correctly reported 0. Both now collapse against
    // the governing magnitude of the same member, so the document does not contradict itself.
    const forceScale = Math.max(
      Math.abs(result.maxShear), Math.abs(result.minShear),
      Math.abs(result.maxAxial), Math.abs(result.minAxial), 1e-12,
    );
    const momentScale = Math.max(Math.abs(result.maxMoment), Math.abs(result.minMoment), 1e-12);
    const forceText = (value: number) => clearCell(project, value, 'force', forceScale);
    const momentText = (value: number) => clearCell(project, value, 'moment', momentScale);
    layout.table(
      [
        { header: 'Magnitud', width: 128 },
        { header: 'Minimo', ...NUMERIC },
        { header: 'Maximo', ...NUMERIC },
        { header: 'Unidad', width: 62 },
      ],
      [
        ['N axial', forceText(result.minAxial), forceText(result.maxAxial), unitFor(project, 'force')],
        ['V cortante', forceText(result.minShear), forceText(result.maxShear), unitFor(project, 'force')],
        ['M momento', momentText(result.minMoment), momentText(result.maxMoment), unitFor(project, 'moment')],
      ],
      { size: 8, zebra: false },
    );
    // `localEndForces` is [Fxi, Fyi, Mi, Fxj, Fyj, Mj] in base units. It used to be printed
    // bare, so the same page stated forces in kip on one line and in kN on the next with no
    // label at all. Each component is now converted and labelled by its own column.
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
      { size: 7.6, zebra: false },
    );
    if (result.criticalPoints.length) {
      layout.table(
        [
          { header: 'Punto critico', width: 92 },
          { header: `x (${unitFor(project, 'length')})`, ...NUMERIC },
          { header: 'Valor', ...NUMERIC },
          { header: 'Unidad', width: 58 },
          { header: 'Tipo', width: 74 },
        ],
        result.criticalPoints.slice(0, 18).map((point) => [
          point.quantity,
          displayCell(project, point.x, 'length'),
          point.quantity === 'moment' ? momentText(point.value) : forceText(point.value),
          unitFor(project, point.quantity === 'moment' ? 'moment' : 'force'),
          point.kind,
        ]),
        { size: 7.4 },
      );
    }
    layout.table(
      [
        { header: 'Tramo', width: 40 },
        { header: 'Estacion', width: 96 },
        { header: 'Funcion', width: 44 },
        { header: 'Expresion (s = x - x0)', flex: 3 },
      ],
      result.diagramSegments.flatMap((segment, segmentIndex) => {
        const station = `${displayCell(project, segment.x0, 'length')} -> ${displayCell(project, segment.x1, 'length')} ${unitFor(project, 'length')}`;
        return [
          [String(segmentIndex + 1), station, 'N(s)', formatPolynomial(project, 'axial', segment.axial)],
          ['', '', 'V(s)', formatPolynomial(project, 'shear', segment.shear)],
          ['', '', 'M(s)', formatPolynomial(project, 'moment', segment.moment)],
        ];
      }),
      { size: 7.2 },
    );
    drawMemberDiagrams(context, result);
  }

  layout.heading('5. Procedimiento y calculos');
  if (!analysis.explanation.length) layout.text('El analisis no incluyo pasos explicativos.', 8.7, fonts.regular, undefined, 8);
  for (const [stepIndex, step] of analysis.explanation.entries()) {
    layout.heading(`${stepIndex + 1}. ${step.title.replace(/^\d+\.\s*/, '')}`, 2);
    layout.text(step.summary, 8.7, fonts.regular, undefined, 8);
    for (const equation of step.equations) layout.text(`- ${equation}`, 8.3, fonts.regular, rgb(0.24, 0.28, 0.34), 16);
    // The values come from the engine, but the formatting is ours. Within one step,
    // entries sharing a unit are comparable, so each collapses against the largest of its
    // own family: an equilibrium sum of -1.06581e-14 kN beside a load of 22 kN is zero.
    const quantities = (title: string, entries: readonly { label: string; value: number; unit: string }[]): void => {
      if (!entries.length) return;
      const scaleByUnit = new Map<string, number>();
      for (const entry of entries) {
        scaleByUnit.set(entry.unit, Math.max(scaleByUnit.get(entry.unit) ?? 1e-12, Math.abs(entry.value)));
      }
      layout.table(
        [{ header: title, width: 150 }, { header: 'Valor', ...NUMERIC }, { header: 'Unidad', width: 74 }],
        entries.map((entry) => [entry.label, clearNumber(entry.value, scaleByUnit.get(entry.unit) ?? 1), entry.unit]),
        { size: 7.8 },
      );
    };
    quantities('Entradas', step.inputs ?? []);
    quantities('Resultados', step.outputs ?? []);
  }

  if (options.includeEducationTrace !== false && analysis.educationTrace) {
    const trace = analysis.educationTrace;
    layout.heading('6. Traza educativa y matrices');
    summary([
      ['Esquema', `v${trace.schemaVersion}; ${trace.formulation}`],
      ['Grados de libertad', `${trace.dofs.length}; ${trace.dofs.filter((dof) => dof.constrained).length} restringidos`],
      ['Energia de deformacion', number(trace.assembly.strainEnergy)],
    ]);
    matrix('Matriz global K', trace.assembly.stiffness);
    matrix('Matriz de restricciones C', trace.assembly.constraintMatrix);
    for (const element of trace.elements) {
      layout.ensure(150);
      layout.heading(`Elemento ${element.memberId}`, 2);
      layout.text(`L=${number(element.length)} m, c=${number(element.c)}, s=${number(element.s)}.`, 8, fonts.regular, undefined, 8);
      matrix('Transformacion T', element.transformation);
      matrix('Rigidez local efectiva', element.localStiffnessEffective);
      matrix('Contribucion global', element.globalStiffnessContribution);
    }
  }
};
