import type { AnalysisResult, ProjectModel, Tool } from '../types';

export type ClassroomProgressStepId = 'geometry' | 'supports' | 'loads' | 'analysis';
export type ClassroomProgressStepState = 'complete' | 'current' | 'pending' | 'attention';

export type ClassroomProgressAction =
  | { kind: 'tool'; tool: Tool; label: string }
  | { kind: 'analyze'; label: string };

export interface ClassroomProgressStep {
  id: ClassroomProgressStepId;
  title: string;
  description: string;
  complete: boolean;
  state: ClassroomProgressStepState;
  action: ClassroomProgressAction;
}

export interface ClassroomProgress {
  steps: ClassroomProgressStep[];
  currentStep: ClassroomProgressStep;
  completedSteps: number;
  completionPercent: number;
  readyToAnalyze: boolean;
  geometry: {
    valid: boolean;
    nodeCount: number;
    memberCount: number;
    validMemberCount: number;
  };
  supports: {
    valid: boolean;
    restraintCount: number;
    restrainsX: boolean;
    restrainsY: boolean;
  };
  loads: {
    valid: boolean;
    actionCount: number;
    activeActionCount: number;
  };
}

const ACTION_TOLERANCE = 1e-12;

const nonZero = (...values: Array<number | undefined>) =>
  values.some((value) => Number.isFinite(value) && Math.abs(value ?? 0) > ACTION_TOLERANCE);

const memberHasAction = (load: ProjectModel['memberLoads'][number]) => {
  if (load.type === 'distributed') {
    return nonZero(load.qxStart, load.qxEnd, load.qyStart, load.qyEnd);
  }
  if (load.type === 'point') return nonZero(load.px, load.py);
  return nonZero(load.moment);
};

const initialEffectHasAction = (effect: NonNullable<ProjectModel['memberInitialEffects']>[number]) => {
  if (effect.type === 'temperature') {
    const alpha = effect.alpha ?? 1.2e-5;
    return nonZero(alpha * (effect.deltaT ?? 0), alpha * (effect.gradient ?? 0));
  }
  return nonZero(effect.axialStrain, effect.curvature);
};

const supportSummary = (project: ProjectModel, connectedNodeIds: Set<string>) => {
  let restraintCount = 0;
  let restrainsX = false;
  let restrainsY = false;

  for (const node of project.nodes) {
    if (!connectedNodeIds.has(node.id)) continue;
    const { support } = node;
    if (support.type === 'fixed') {
      restraintCount += 3;
      restrainsX = true;
      restrainsY = true;
    } else if (support.type === 'pin') {
      restraintCount += 2;
      restrainsX = true;
      restrainsY = true;
    } else if (support.type === 'roller') {
      restraintCount += 1;
      const radians = ((support.angleDeg ?? 90) * Math.PI) / 180;
      restrainsX ||= Math.abs(Math.cos(radians)) > 1e-8;
      restrainsY ||= Math.abs(Math.sin(radians)) > 1e-8;
    } else if (support.type === 'custom') {
      restraintCount += Number(Boolean(support.restrainX));
      restraintCount += Number(Boolean(support.restrainY));
      restraintCount += Number(Boolean(support.restrainR));
      restrainsX ||= Boolean(support.restrainX);
      restrainsY ||= Boolean(support.restrainY);
    }

    const spring = support.spring;
    if ((spring?.kx ?? 0) > 0) {
      restraintCount += 1;
      restrainsX = true;
    }
    if ((spring?.ky ?? 0) > 0) {
      restraintCount += 1;
      restrainsY = true;
    }
    if ((spring?.kr ?? 0) > 0) restraintCount += 1;
    if ((spring?.kNormal ?? 0) > 0) {
      restraintCount += 1;
      const radians = ((spring?.angleDeg ?? support.angleDeg ?? 90) * Math.PI) / 180;
      restrainsX ||= Math.abs(Math.cos(radians)) > 1e-8;
      restrainsY ||= Math.abs(Math.sin(radians)) > 1e-8;
    }
  }

  return { restraintCount, restrainsX, restrainsY };
};

const actionSummary = (project: ProjectModel) => {
  const activeCaseIds = new Set(project.loadCases.filter((loadCase) => loadCase.active).map((loadCase) => loadCase.id));
  let actionCount = 0;
  let activeActionCount = 0;
  const count = (caseId: string, hasAction: boolean) => {
    if (!hasAction) return;
    actionCount += 1;
    if (activeCaseIds.has(caseId)) activeActionCount += 1;
  };

  project.nodalLoads.forEach((load) => count(load.caseId, nonZero(load.fx, load.fy, load.mz)));
  project.memberLoads.forEach((load) => count(load.caseId, memberHasAction(load)));
  (project.prescribedDisplacements ?? []).forEach((item) => count(item.caseId, nonZero(item.value)));
  (project.memberInitialEffects ?? []).forEach((effect) => count(effect.caseId, initialEffectHasAction(effect)));

  for (const loadCase of project.loadCases) {
    const hasSelfWeight = nonZero(loadCase.selfWeightFactor)
      && project.members.some((member) => member.type !== 'rigid' && (member.density ?? 0) > 0 && member.A > 0);
    count(loadCase.id, hasSelfWeight);
  }

  return { actionCount, activeActionCount };
};

export const deriveClassroomProgress = (
  project: ProjectModel,
  analysis: AnalysisResult | null = null,
): ClassroomProgress => {
  const nodeMap = new Map(project.nodes.map((node) => [node.id, node]));
  const finiteNodes = project.nodes.filter((node) => Number.isFinite(node.x) && Number.isFinite(node.y));
  const xs = finiteNodes.map((node) => node.x);
  const ys = finiteNodes.map((node) => node.y);
  const referenceLength = Math.max(
    1,
    xs.length ? Math.max(...xs) - Math.min(...xs) : 0,
    ys.length ? Math.max(...ys) - Math.min(...ys) : 0,
  );
  const geometryTolerance = referenceLength * 1e-9;
  const connectedNodeIds = new Set<string>();
  let validMemberCount = 0;
  for (const member of project.members) {
    const nodeI = nodeMap.get(member.i);
    const nodeJ = nodeMap.get(member.j);
    if (!nodeI || !nodeJ || member.i === member.j) continue;
    if (!Number.isFinite(nodeI.x) || !Number.isFinite(nodeI.y) || !Number.isFinite(nodeJ.x) || !Number.isFinite(nodeJ.y)) continue;
    if (Math.hypot(nodeJ.x - nodeI.x, nodeJ.y - nodeI.y) <= geometryTolerance) continue;
    validMemberCount += 1;
    connectedNodeIds.add(member.i);
    connectedNodeIds.add(member.j);
  }
  const geometryValid = finiteNodes.length >= 2
    && project.members.length > 0
    && validMemberCount === project.members.length;

  const supports = supportSummary(project, connectedNodeIds);
  const supportsValid = geometryValid
    && supports.restraintCount >= 3
    && supports.restrainsX
    && supports.restrainsY;
  const loads = actionSummary(project);
  const loadsValid = loads.activeActionCount > 0;
  const readyToAnalyze = geometryValid && supportsValid && loadsValid;
  const analysisComplete = analysis?.success === true;

  const geometryDescription = !finiteNodes.length
    ? 'Coloca al menos dos nodos para definir la geometría.'
    : validMemberCount === 0
      ? 'Conecta dos nodos con un miembro.'
      : geometryValid
        ? `${finiteNodes.length} nodos y ${validMemberCount} miembros válidos.`
        : 'Corrige miembros sin extremos válidos o con longitud nula.';
  const supportDescription = supportsValid
    ? `${supports.restraintCount} restricciones iniciales; la estabilidad final se verifica al analizar.`
    : geometryValid
      ? 'Agrega apoyos que restrinjan las traslaciones X e Y y eviten el movimiento rígido.'
      : 'Disponible cuando la geometría básica esté lista.';
  const loadDescription = loadsValid
    ? `${loads.activeActionCount} acciones distintas de cero en casos activos.`
    : loads.actionCount > 0
      ? 'Hay cargas, pero pertenecen a casos inactivos. Activa el caso correspondiente.'
      : supportsValid
        ? 'Aplica una carga puntual, distribuida o un momento.'
        : 'Disponible después de definir los apoyos.';
  const analysisDescription = analysisComplete
    ? 'El modelo se resolvió correctamente; ya puedes explorar sus resultados.'
    : analysis
      ? 'El análisis encontró aspectos por corregir. Abre Avisos para continuar.'
      : readyToAnalyze
        ? 'El modelo contiene lo esencial. Analiza para comprobar estabilidad y equilibrio.'
        : 'Completa los pasos anteriores o analiza ahora para recibir ayuda.';

  const definitions: Array<Omit<ClassroomProgressStep, 'state'>> = [
    {
      id: 'geometry',
      title: 'Geometría',
      description: geometryDescription,
      complete: geometryValid,
      action: finiteNodes.length < 2
        ? { kind: 'tool', tool: 'node', label: 'Crear nodos' }
        : { kind: 'tool', tool: 'member', label: 'Conectar miembros' },
    },
    {
      id: 'supports',
      title: 'Apoyos',
      description: supportDescription,
      complete: supportsValid,
      action: { kind: 'tool', tool: 'support', label: 'Agregar apoyo' },
    },
    {
      id: 'loads',
      title: 'Cargas',
      description: loadDescription,
      complete: loadsValid,
      action: { kind: 'tool', tool: 'pointLoad', label: 'Aplicar carga' },
    },
    {
      id: 'analysis',
      title: 'Analizar',
      description: analysisDescription,
      complete: analysisComplete,
      action: { kind: 'analyze', label: analysis ? 'Analizar de nuevo' : 'Analizar estructura' },
    },
  ];

  const firstIncompleteIndex = Math.max(0, definitions.findIndex((step) => !step.complete));
  const steps = definitions.map<ClassroomProgressStep>((step, index) => ({
    ...step,
    state: step.complete
      ? 'complete'
      : step.id === 'analysis' && analysis?.success === false
        ? 'attention'
        : index === firstIncompleteIndex
          ? 'current'
          : 'pending',
  }));
  const currentStep = steps.find((step) => step.state === 'attention' || step.state === 'current') ?? steps[steps.length - 1];
  const completedSteps = steps.filter((step) => step.complete).length;

  return {
    steps,
    currentStep,
    completedSteps,
    completionPercent: (completedSteps / steps.length) * 100,
    readyToAnalyze,
    geometry: {
      valid: geometryValid,
      nodeCount: finiteNodes.length,
      memberCount: project.members.length,
      validMemberCount,
    },
    supports: { valid: supportsValid, ...supports },
    loads: { valid: loadsValid, ...loads },
  };
};
