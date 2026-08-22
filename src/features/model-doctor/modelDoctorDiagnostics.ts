import { repairProjectTopology } from '../../data/modelOperations';
import { getEvidentGroundingIssue, validateProject } from '../../engine/solver';
import type { ProjectModel, Tool, ValidationIssue } from '../../types';
import { resolveValidationIssueTarget } from '../workspace/validationIssueTarget';
import type { FocusableSelection } from '../workspace/workspaceCommands';

export type ModelDoctorSeverity = 'critical' | 'warning' | 'suggestion';
export type ModelDoctorCategory = 'geometry' | 'topology' | 'properties' | 'supports' | 'loads' | 'references' | 'configuration';

export interface ModelDoctorAffectedObject {
  id: string;
  kind?: 'node' | 'member' | 'nodalLoad' | 'memberLoad';
}

export interface ModelDoctorFinding {
  id: string;
  sourceIssueId: string;
  severity: ModelDoctorSeverity;
  category: ModelDoctorCategory;
  title: string;
  explanation: string;
  whyItMatters: string;
  affectedObjects: ModelDoctorAffectedObject[];
  suggestedAction: string;
  suggestedTool?: Tool;
  target: FocusableSelection | null;
  canLocate: boolean;
  repair: { kind: 'topology'; available: true } | { kind: 'topology'; available: false; reason: 'ambiguous' } | null;
  canAcknowledge: boolean;
}

export interface ModelDoctorReport {
  findings: ModelDoctorFinding[];
  counts: Record<ModelDoctorSeverity, number>;
  total: number;
}

const severityOf = (severity: ValidationIssue['severity']): ModelDoctorSeverity =>
  severity === 'error' ? 'critical' : severity === 'warning' ? 'warning' : 'suggestion';

const hasAnyPrefix = (id: string, prefixes: readonly string[]): boolean => prefixes.some((prefix) => id.startsWith(prefix));

const categoryOf = (issue: ValidationIssue): ModelDoctorCategory => {
  const { id } = issue;
  if (id.startsWith('combination-factor-')) return 'configuration';
  if (hasAnyPrefix(id, ['near-node-', 'zero-', 'node-coordinate-', 'dup-'])) return 'geometry';
  if (hasAnyPrefix(id, ['node-on-member-', 'isolated-', 'hinge-connectivity-', 'hinge-no-frame-'])) return 'topology';
  if (hasAnyPrefix(id, ['E-', 'A-', 'I-', 'EA-', 'EI-', 'G-', 'As-', 'GAs-', 'density-', 'timoshenko-', 'release-type-', 'rotational-spring-', 'rigid-offset-'])) return 'properties';
  if (hasAnyPrefix(id, ['missing-', 'initial-effect-member-', 'initial-effect-case-', 'prescribed-node-', 'prescribed-case-', 'nodal-node-', 'nodal-case-', 'member-load-member-', 'member-load-case-', 'combination-'])) return 'references';
  if (id === 'no-supports') return 'supports';
  if (hasAnyPrefix(id, ['support-', 'spring-', 'prescribed-', 'prescribed-support-', 'prescribed-component-', 'prescribed-value-'])) return 'supports';
  if (hasAnyPrefix(id, ['nodal-', 'member-load-', 'rigid-load-', 'truss-member-load-', 'distributed-', 'horizontal-basis-', 'vertical-basis-', 'point-', 'free-rotation-moment-', 'hinge-moment-', 'no-loads', 'self-weight-'])) return 'loads';
  if (hasAnyPrefix(id, ['initial-effect-'])) return 'properties';
  return 'configuration';
};

const impactOf = (issue: ValidationIssue, category: ModelDoctorCategory): string => {
  if (issue.id.startsWith('near-node-')) return 'Visualmente pueden parecer una sola unión, pero siguen siendo nodos distintos y pueden transmitir fuerzas de manera diferente.';
  if (issue.id.startsWith('node-on-member-')) return 'El nodo coincide con el dibujo del miembro, pero sin una unión real el apoyo, carga o desplazamiento no participa como parece.';
  if (issue.id.startsWith('zero-')) return 'Una longitud nula no define una dirección ni una rigidez estructural válida.';
  if (issue.id.startsWith('dup-')) return 'Los elementos superpuestos pueden duplicar rigidez y acciones aunque visualmente parezcan un único miembro.';
  if (issue.id.startsWith('isolated-')) return 'Un objeto desconectado no intercambia fuerzas con el resto del modelo y puede cambiar la interpretación de apoyos o cargas.';
  const impacts: Record<ModelDoctorCategory, string> = {
    geometry: 'La geometría define conectividad, longitud y orientación; una inconsistencia puede cambiar el modelo estructural interpretado.',
    topology: 'La conectividad determina por dónde se transfieren fuerzas entre miembros, nodos, apoyos y cargas.',
    properties: 'Las propiedades y conexiones determinan la rigidez y el comportamiento que el análisis asigna al miembro.',
    supports: 'Una restricción incompatible o desconectada no representa el apoyo o movimiento impuesto que el usuario espera.',
    loads: 'Una acción inválida, huérfana o incompatible no puede aplicarse de forma fiable al modelo previsto.',
    references: 'Una referencia rota impide relacionar el dato con el nodo, miembro o caso de carga al que debería pertenecer.',
    configuration: 'Esta configuración impide o limita la interpretación inequívoca del escenario que se quiere revisar.',
  };
  return impacts[category];
};

const defaultAction: Record<ModelDoctorCategory, string> = {
  geometry: 'Revisa la geometría indicada antes de analizar.',
  topology: 'Revisa y conecta explícitamente los objetos indicados.',
  properties: 'Corrige la propiedad o conexión indicada con valores físicamente coherentes.',
  supports: 'Revisa el apoyo y conserva sólo restricciones compatibles.',
  loads: 'Corrige la carga o asígnala a un objeto compatible.',
  references: 'Vuelve a asignar la referencia a un objeto existente.',
  configuration: 'Revisa la configuración indicada antes de continuar.',
};

const relatedObjects = (project: ProjectModel, issues: ValidationIssue[]): Map<string, ModelDoctorAffectedObject[]> => {
  const related = new Map<string, ModelDoctorAffectedObject[]>();
  project.nodes.forEach((node, index) => {
    for (let otherIndex = index + 1; otherIndex < project.nodes.length; otherIndex += 1) {
      const other = project.nodes[otherIndex];
      related.set(`near-node-${node.id}-${other.id}`, [{ kind: 'node', id: node.id }, { kind: 'node', id: other.id }]);
    }
    for (const member of project.members) {
      related.set(`node-on-member-${node.id}-${member.id}`, [{ kind: 'node', id: node.id }, { kind: 'member', id: member.id }]);
    }
  });
  for (const issue of issues) {
    if (!related.has(issue.id) && issue.objectId) related.set(issue.id, [{ kind: issue.objectKind, id: issue.objectId }]);
  }
  return related;
};

const topologyRepairState = (project: ProjectModel, originalIssues: ValidationIssue[]) => {
  const draft = structuredClone(project);
  const report = repairProjectTopology(draft);
  const repairable = new Set<string>();
  const ambiguous = new Set<string>();
  for (const merge of report.mergedNodes) {
    repairable.add(`near-node-${merge.keptNodeId}-${merge.removedNodeId}`);
    repairable.add(`near-node-${merge.removedNodeId}-${merge.keptNodeId}`);
  }
  for (const split of report.splitMembers) repairable.add(`node-on-member-${split.nodeId}-${split.originalMemberId}`);
  for (const pair of report.skippedCoincidentPairs) {
    ambiguous.add(`near-node-${pair.firstNodeId}-${pair.secondNodeId}`);
    ambiguous.add(`near-node-${pair.secondNodeId}-${pair.firstNodeId}`);
  }
  if (report.mergedNodes.length || report.splitMembers.length) {
    const remainingIds = new Set(validateProject(draft).map((issue) => issue.id));
    for (const issue of originalIssues) {
      if ((issue.id.startsWith('near-node-') || issue.id.startsWith('node-on-member-')) && !remainingIds.has(issue.id)) {
        repairable.add(issue.id);
      }
    }
  }
  return { repairable, ambiguous };
};

export const buildModelDoctorReport = (project: ProjectModel): ModelDoctorReport => {
  const groundingIssue = getEvidentGroundingIssue(project);
  const issues = [...validateProject(project), ...(groundingIssue ? [groundingIssue] : [])];
  const occurrence = new Map<string, number>();
  const related = relatedObjects(project, issues);
  const repairState = topologyRepairState(project, issues);
  const findings = issues.map<ModelDoctorFinding>((issue) => {
    const count = (occurrence.get(issue.id) ?? 0) + 1;
    occurrence.set(issue.id, count);
    // A serialized tuple gives each occurrence an injective identity without
    // reserving any characters from domain IDs or depending on other findings.
    const findingId = `finding:${JSON.stringify([issue.id, count])}`;
    const severity = severityOf(issue.severity);
    const category = categoryOf(issue);
    const target = resolveValidationIssueTarget(project, issue);
    const repair = repairState.repairable.has(issue.id)
      ? { kind: 'topology' as const, available: true as const }
      : repairState.ambiguous.has(issue.id)
        ? { kind: 'topology' as const, available: false as const, reason: 'ambiguous' as const }
        : null;
    return {
      id: findingId,
      sourceIssueId: issue.id,
      severity,
      category,
      title: issue.title,
      explanation: issue.message,
      whyItMatters: impactOf(issue, category),
      affectedObjects: related.get(issue.id) ?? [],
      suggestedAction: issue.suggestedFix ?? defaultAction[category],
      suggestedTool: issue.suggestedTool,
      target,
      canLocate: target !== null,
      repair,
      canAcknowledge: severity !== 'critical',
    };
  });
  const counts = findings.reduce<Record<ModelDoctorSeverity, number>>(
    (total, finding) => ({ ...total, [finding.severity]: total[finding.severity] + 1 }),
    { critical: 0, warning: 0, suggestion: 0 },
  );
  return { findings, counts, total: findings.length };
};
