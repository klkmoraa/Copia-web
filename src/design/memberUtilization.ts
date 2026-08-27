import type { AnalysisResult, ProjectModel } from '../types';
import { evaluateAiscMember } from './aisc360';
import { evaluateEurocodeMember } from './eurocode3';
import { designNtcSteelTensionMember } from './ntcSteel2023';
import type {
  DesignResult,
  DesignStandardId,
  MemberUtilization,
  StructureDesignSummary,
  UtilizationStatus,
} from './types';

export const resolveUtilizationStatus = (ratio: number): UtilizationStatus => {
  if (!Number.isFinite(ratio) || ratio < 0) return 'unavailable';
  if (ratio > 1.0) return 'critical';
  if (ratio >= 0.90) return 'warning';
  if (ratio >= 0.70) return 'optimal';
  return 'safe';
};

export const STANDARD_TITLES: Record<DesignStandardId, string> = {
  'aisc-360-16-lrfd': 'AISC 360-16 (LRFD)',
  'aisc-360-16-asd': 'AISC 360-16 (ASD)',
  'eurocode-3': 'Eurocódigo 3 (EN 1993-1-1)',
  'ntc-2023': 'NTC Acero CDMX 2023',
};

/**
 * Evalúa el aprovechamiento normativo de un miembro individual según la norma seleccionada.
 */
export const evaluateMemberUtilization = (
  project: ProjectModel,
  analysis: AnalysisResult | null | undefined,
  combinationId: string,
  memberId: string,
  standardId: DesignStandardId = 'aisc-360-16-lrfd',
): MemberUtilization => {
  if (!analysis?.success || !analysis.memberResults?.length) {
    return {
      memberId,
      standardId,
      governingRatio: 0,
      status: 'unavailable',
      governingCheck: null,
      checks: [],
      evaluated: false,
      reason: 'No hay resultados de análisis válidos.',
    };
  }

  let checks: readonly DesignResult[] = [];

  if (standardId === 'aisc-360-16-lrfd') {
    checks = evaluateAiscMember(project, analysis, combinationId, memberId, 'LRFD');
  } else if (standardId === 'aisc-360-16-asd') {
    checks = evaluateAiscMember(project, analysis, combinationId, memberId, 'ASD');
  } else if (standardId === 'eurocode-3') {
    checks = evaluateEurocodeMember(project, analysis, combinationId, memberId);
  } else if (standardId === 'ntc-2023') {
    const outcome = designNtcSteelTensionMember({
      project,
      analysis,
      combinationId,
      memberId,
    });
    if (outcome.status === 'available') {
      checks = [outcome.result];
    }
  }

  if (!checks.length) {
    return {
      memberId,
      standardId,
      governingRatio: 0,
      status: 'unavailable',
      governingCheck: null,
      checks: [],
      evaluated: false,
      reason: 'Miembro sin comprobaciones aplicables para la combinación y norma seleccionadas.',
    };
  }

  // Encontrar el check con el mayor ratio D/C (modo de falla gobernante)
  let governingCheck: DesignResult = checks[0];
  for (let i = 1; i < checks.length; i++) {
    if (checks[i].ratio.value > governingCheck.ratio.value) {
      governingCheck = checks[i];
    }
  }

  const governingRatio = governingCheck.ratio.value;
  const status = resolveUtilizationStatus(governingRatio);

  return {
    memberId,
    standardId,
    governingRatio,
    status,
    governingCheck,
    checks,
    evaluated: true,
  };
};

/**
 * Evalúa toda la estructura y genera el resumen de diseño normativo global.
 */
export const summarizeStructureDesign = (
  project: ProjectModel,
  analysis: AnalysisResult | null | undefined,
  combinationId: string,
  standardId: DesignStandardId = 'aisc-360-16-lrfd',
): StructureDesignSummary => {
  const memberUtilizations = project.members.map((m) =>
    evaluateMemberUtilization(project, analysis, combinationId, m.id, standardId),
  );

  let maxRatio = 0;
  let criticalCount = 0;
  let warningCount = 0;
  let optimalCount = 0;
  let safeCount = 0;
  let evaluatedMembers = 0;
  let governingMemberId: string | null = null;

  for (const util of memberUtilizations) {
    if (util.evaluated) {
      evaluatedMembers++;
      if (util.governingRatio > maxRatio) {
        maxRatio = util.governingRatio;
        governingMemberId = util.memberId;
      }
      if (util.status === 'critical') criticalCount++;
      else if (util.status === 'warning') warningCount++;
      else if (util.status === 'optimal') optimalCount++;
      else if (util.status === 'safe') safeCount++;
    }
  }

  return {
    standardId,
    standardTitle: STANDARD_TITLES[standardId],
    totalMembers: project.members.length,
    evaluatedMembers,
    maxRatio,
    criticalCount,
    warningCount,
    optimalCount,
    safeCount,
    governingMemberId,
    memberUtilizations,
    timestamp: new Date().toISOString(),
  };
};
