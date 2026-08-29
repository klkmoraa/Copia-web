/**
 * The model as it was analysed: what the solver was actually handed.
 *
 * This and the two parts that follow it used to be one 500-line "anexo técnico" with its own
 * internal numbering (`1.`…`6.`) running alongside the numbered bands of the visual pages, so
 * the document had two things called section 5 and no chrome at all after page 7. They are
 * ordinary numbered parts now, in the document's single sequence.
 *
 * Everything a reviewer needs to reproduce the run is here: the scenario factors that scaled
 * each case, the geometry, the sections, every load with its real interval and intensity, and
 * the independent audit that reconciles the source actions against the assembled load vector.
 */
import { drawGlobalDcl } from './pdfDiagrams';
import { clearNumber, displayCell, memberLoadDescription, number, unitFor } from './pdfFormat';
import { dimensionalUnit } from './pdfSubstitution';
import type { PdfTableColumn } from './pdfBuilder';
import type { ReportContext } from './reportContext';

const NUMERIC: Pick<PdfTableColumn, 'align'> = { align: 'right' };

export const drawModelPart = (context: ReportContext): void => {
  const { layout, project, analysis, payload, scenarioFactors, index } = context;

  layout.part(
    'Modelo y acciones',
    'La entrada exacta del análisis: geometría, secciones, apoyos, cargas y su auditoría.',
  );

  // These sums are meant to close at zero. Printing one of them as `0` and the next as
  // `-1.06581e-14` says nothing about the structure, only about which float happened to land
  // exactly on zero. They collapse against the applied load; the normalized residual right
  // after keeps the audit trail at full precision.
  const forceScale = Math.max(
    Math.abs(analysis.loadAudit?.source.fx ?? 0),
    Math.abs(analysis.loadAudit?.source.fy ?? 0),
    1,
  );
  const momentScale = Math.max(Math.abs(analysis.loadAudit?.source.mz ?? 0), 1);

  layout.keyValues([
    ['Estado del análisis', analysis.success ? 'resuelto' : 'con errores'],
    ['Modelo', `${project.nodes.length} nodos · ${project.members.length} miembros`],
    ['Acciones', `${payload.metadata.loadCount} cargas · ${project.loadCases.length} casos · ${project.combinations.length} combinaciones`],
    ['Factores del escenario', project.loadCases.map((loadCase) => `${loadCase.id} = ${number(scenarioFactors[loadCase.id] ?? 0)}`).join('   ') || 'sin casos'],
    ['Formulación', analysis.educationTrace?.formulation ?? 'análisis estático lineal 2D'],
    ['Expediente adjunto', `v${payload.formatVersion} · app ${payload.provenance.appVersion}`],
    ['Integridad SHA-256', payload.checksum.value],
  ]);

  layout.figure(
    182,
    (rect) => drawGlobalDcl(context, rect),
    'Geometría, apoyos y acciones aplicadas, tal como el solver las recibió.',
  );

  layout.heading('Nodos y apoyos');
  layout.table(
    [
      { header: 'Nodo', width: 62 },
      { header: `x (${unitFor(project, 'length')})`, ...NUMERIC },
      { header: `y (${unitFor(project, 'length')})`, ...NUMERIC },
      { header: 'Apoyo', flex: 1.4 },
      { header: 'Articulación interna', flex: 1.2 },
    ],
    project.nodes.map((node) => [
      node.id,
      displayCell(project, node.x, 'length'),
      displayCell(project, node.y, 'length'),
      node.support.type,
      node.internalHinge ? 'sí' : '—',
    ]),
  );

  layout.heading('Miembros y secciones');
  layout.table(
    [
      { header: 'Miembro', width: 62 },
      { header: 'Conexión', width: 78 },
      { header: 'Tipo', width: 56 },
      { header: `E (${dimensionalUnit(project, 1, -2)})`, ...NUMERIC },
      { header: `A (${dimensionalUnit(project, 0, 2)})`, ...NUMERIC },
      { header: `I (${dimensionalUnit(project, 0, 4)})`, ...NUMERIC },
    ],
    project.members.map((member) => [
      member.id,
      `${member.i} → ${member.j}`,
      member.type,
      number(member.E),
      number(member.A),
      number(member.I),
    ]),
  );

  layout.heading('Cargas nodales');
  if (!project.nodalLoads.length) {
    layout.note('El modelo no lleva cargas nodales.');
  } else {
    layout.table(
      [
        { header: 'Carga', width: 58 },
        { header: 'Nodo', width: 48 },
        { header: 'Caso', width: 54 },
        { header: 'Factor', ...NUMERIC, width: 46 },
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

  layout.heading('Cargas de miembro');
  if (!project.memberLoads.length) {
    layout.note('El modelo no lleva cargas de miembro.');
  } else {
    layout.table(
      [
        { header: 'Carga', width: 54 },
        { header: 'Miembro', width: 52 },
        { header: 'Tipo', width: 58 },
        { header: 'Caso', width: 48 },
        { header: 'Factor', ...NUMERIC, width: 42 },
        { header: 'Ejes', width: 46 },
        { header: 'Intervalo e intensidad reales', flex: 3.4 },
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
      { size: 7 },
    );
  }

  const audit = analysis.loadAudit;
  if (audit) {
    layout.heading('Auditoría independiente de cargas');
    layout.text(
      'Las acciones se reintegran por dos rutas que no comparten código: la estática global de '
      + 'las cargas fuente y el vector nodal que el ensamblaje produjo. Las dos filas tienen que '
      + 'dar lo mismo.',
    );
    layout.table(
      [
        { header: 'Ruta', width: 110 },
        { header: `Fx (${unitFor(project, 'force')})`, ...NUMERIC },
        { header: `Fy (${unitFor(project, 'force')})`, ...NUMERIC },
        { header: `M_O (${unitFor(project, 'moment')})`, ...NUMERIC },
      ],
      [
        ['Cargas fuente', clearNumber(audit.source.fx, forceScale), clearNumber(audit.source.fy, forceScale), clearNumber(audit.source.mz, momentScale)],
        ['Vector ensamblado', clearNumber(audit.assembled.fx, forceScale), clearNumber(audit.assembled.fy, forceScale), clearNumber(audit.assembled.mz, momentScale)],
      ],
    );
    const reference = audit.referencePoint;
    const critical = audit.memberAudits.reduce<typeof audit.memberAudits[number] | undefined>(
      (best, entry) => !best || entry.normalizedResidual > best.normalizedResidual ? entry : best,
      undefined,
    );
    layout.keyValues([
      ['Punto de reducción O', reference ? `(${number(reference.x)}, ${number(reference.y)})` : 'no disponible'],
      ['Residuo de resultantes', number(audit.resultantResidual)],
      ['Residuo máximo', `${number(audit.normalizedResidual)}${critical ? ` · en ${critical.memberId}` : ''}`],
    ]);

    if (audit.memberAudits.length) {
      layout.heading('Reintegración por trabajo virtual, miembro a miembro', 2);
      layout.text(
        'Cada vector local [Fxi, Fyi, Mi, Fxj, Fyj, Mj] se reintegra desde las cargas fuente con '
        + 'funciones cerradas independientes, antes de liberaciones o condensación.',
      );
      layout.table(
        [
          { header: 'Miembro', width: 66 },
          { header: 'L fuente', ...NUMERIC },
          { header: 'L ensamblada', ...NUMERIC },
          { header: 'Residuo mecánico', ...NUMERIC },
          { header: 'Residuo inicial', ...NUMERIC },
          { header: 'Residuo total', ...NUMERIC },
        ],
        audit.memberAudits.map((entry) => [
          entry.memberId,
          number(entry.flexibleLength.source),
          number(entry.flexibleLength.assembled),
          number(entry.mechanical.normalizedResidual),
          number(entry.initial.normalizedResidual),
          number(entry.normalizedResidual),
        ]),
      );
    }
  }

  if (analysis.issues.length) {
    layout.heading('Incidencias registradas');
    layout.table(
      [{ header: 'Severidad', width: 70 }, { header: 'Título', width: 130 }, { header: 'Detalle', flex: 3 }],
      analysis.issues.map((issue) => [issue.severity.toUpperCase(), issue.title, issue.message]),
    );
  }
};
