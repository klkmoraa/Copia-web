import { translate, type Language, type TranslationKey } from '../../i18n/catalogs';
import type { ModelDoctorCategory, ModelDoctorSeverity } from './modelDoctorDiagnostics';

export interface ModelDoctorCopy {
  description: string;
  close: string;
  restore: string;
  summary: (critical: number, warning: number, suggestion: number) => string;
  healthLabel: string;
  filtersLabel: string;
  all: string;
  critical: string;
  warning: string;
  suggestion: string;
  severity: Record<ModelDoctorSeverity, string>;
  allClearTitle: string;
  allClearBody: string;
  explain: string;
  collapse: string;
  detected: string;
  why: string;
  action: string;
  affected: string;
  locate: string;
  unavailableLocation: string;
  useTool: string;
  acknowledge: string;
  acknowledged: string;
  unacknowledge: string;
  noFiltered: string;
  ambiguousRepair: string;
  loading: string;
  previewAction: string;
  previewTitle: string;
  previewDescription: string;
  previewMerge: string;
  previewSplit: string;
  previewReferences: string;
  previewPrescribed: string;
  previewInitialEffect: string;
  previewMembers: string;
  previewNodes: string;
  previewSkipped: string;
  previewUnresolved: string;
  previewUnresolvedAction: string;
  previewSkippedPair: (first: string, second: string) => string;
  previewMemberChange: (id: string, before: string, after: string) => string;
  previewKeepRemove: (kept: string, removed: string) => string;
  previewSplitResult: (member: string, results: string, nodes: string) => string;
  previewLoadChange: (kind: string, id: string, before: string, after: string) => string;
  previewCreated: string;
  previewRemoved: string;
  previewSupport: string;
  previewInternalHingePreserved: string;
  previewRelease: (member: string, end: 'i' | 'j') => string;
  previewOffset: (member: string, end: 'i' | 'j', value: number) => string;
  previewDisposition: Record<'created' | 'removed' | 'remapped' | 'preserved', string>;
  previewField: Record<'support' | 'internalHinge' | 'releases' | 'rotationalSpringI' | 'rotationalSpringJ' | 'rigidOffsetI' | 'rigidOffsetJ', string>;
  previewNone: string;
  previewStaleTitle: string;
  previewStaleBody: string;
  previewRegenerate: string;
  previewApply: string;
  previewApplying: string;
  previewCancel: string;
  repairApplied: string;
  category: Record<ModelDoctorCategory, string>;
  objectKind: Record<'node' | 'member' | 'nodalLoad' | 'memberLoad', string>;
}

const key = (language: Language, name: TranslationKey) => translate(language, name);

export const getModelDoctorCopy = (requested: Language | undefined): ModelDoctorCopy => {
  const language = requested === 'en' ? 'en' : 'es';
  const word = (value: number, singularEs: string, pluralEs: string, singularEn: string, pluralEn: string) =>
    language === 'en' ? (value === 1 ? singularEn : pluralEn) : (value === 1 ? singularEs : pluralEs);
  return {
    description: key(language, 'modelDoctor.description'),
    close: key(language, 'modelDoctor.close'),
    restore: key(language, 'modelDoctor.restore'),
    summary: (critical, warning, suggestion) => `${critical} ${word(critical, 'crítico', 'críticos', 'critical', 'critical')} · ${warning} ${word(warning, 'advertencia', 'advertencias', 'warning', 'warnings')} · ${suggestion} ${word(suggestion, 'sugerencia', 'sugerencias', 'suggestion', 'suggestions')}`,
    healthLabel: key(language, 'modelDoctor.healthLabel'),
    filtersLabel: key(language, 'modelDoctor.filtersLabel'),
    all: key(language, 'modelDoctor.all'),
    critical: key(language, 'modelDoctor.critical'),
    warning: key(language, 'modelDoctor.warning'),
    suggestion: key(language, 'modelDoctor.suggestion'),
    severity: {
      critical: key(language, 'modelDoctor.severity.critical'),
      warning: key(language, 'modelDoctor.severity.warning'),
      suggestion: key(language, 'modelDoctor.severity.suggestion'),
    },
    allClearTitle: key(language, 'modelDoctor.allClearTitle'),
    allClearBody: key(language, 'modelDoctor.allClearBody'),
    explain: key(language, 'modelDoctor.explain'),
    collapse: key(language, 'modelDoctor.collapse'),
    detected: key(language, 'modelDoctor.detected'),
    why: key(language, 'modelDoctor.why'),
    action: key(language, 'modelDoctor.action'),
    affected: key(language, 'modelDoctor.affected'),
    locate: key(language, 'modelDoctor.locate'),
    unavailableLocation: key(language, 'modelDoctor.unavailableLocation'),
    useTool: key(language, 'modelDoctor.useTool'),
    acknowledge: key(language, 'modelDoctor.acknowledge'),
    acknowledged: key(language, 'modelDoctor.acknowledged'),
    unacknowledge: key(language, 'modelDoctor.unacknowledge'),
    noFiltered: key(language, 'modelDoctor.noFiltered'),
    ambiguousRepair: key(language, 'modelDoctor.ambiguousRepair'),
    loading: key(language, 'modelDoctor.loading'),
    previewAction: key(language, 'modelDoctor.previewAction'),
    previewTitle: key(language, 'modelDoctor.previewTitle'),
    previewDescription: key(language, 'modelDoctor.previewDescription'),
    previewMerge: key(language, 'modelDoctor.previewMerge'),
    previewSplit: key(language, 'modelDoctor.previewSplit'),
    previewReferences: key(language, 'modelDoctor.previewReferences'),
    previewPrescribed: key(language, 'modelDoctor.previewPrescribed'),
    previewInitialEffect: key(language, 'modelDoctor.previewInitialEffect'),
    previewMembers: key(language, 'modelDoctor.previewMembers'),
    previewNodes: key(language, 'modelDoctor.previewNodes'),
    previewSkipped: key(language, 'modelDoctor.previewSkipped'),
    previewUnresolved: key(language, 'modelDoctor.previewUnresolved'),
    previewUnresolvedAction: key(language, 'modelDoctor.previewUnresolvedAction'),
    previewSkippedPair: (first, second) => translate(language, 'modelDoctor.previewSkippedPair', { first, second }),
    previewMemberChange: (id, before, after) => translate(language, 'modelDoctor.previewMemberChange', { id, before, after }),
    previewKeepRemove: (kept, removed) => translate(language, 'modelDoctor.previewKeepRemove', { kept, removed }),
    previewSplitResult: (member, results, nodes) => translate(language, 'modelDoctor.previewSplitResult', { member, results, nodes }),
    previewLoadChange: (kind, id, before, after) => translate(language, 'modelDoctor.previewLoadChange', { kind, id, before, after }),
    previewCreated: key(language, 'modelDoctor.previewCreated'),
    previewRemoved: key(language, 'modelDoctor.previewRemoved'),
    previewSupport: key(language, 'modelDoctor.previewSupport'),
    previewInternalHingePreserved: key(language, 'modelDoctor.previewInternalHingePreserved'),
    previewRelease: (member, end) => translate(language, 'modelDoctor.previewRelease', { member, end }),
    previewOffset: (member, end, value) => translate(language, 'modelDoctor.previewOffset', { member, end, value }),
    previewDisposition: {
      created: key(language, 'modelDoctor.previewDisposition.created'),
      removed: key(language, 'modelDoctor.previewDisposition.removed'),
      remapped: key(language, 'modelDoctor.previewDisposition.remapped'),
      preserved: key(language, 'modelDoctor.previewDisposition.preserved'),
    },
    previewField: {
      support: key(language, 'modelDoctor.previewField.support'),
      internalHinge: key(language, 'modelDoctor.previewField.internalHinge'),
      releases: key(language, 'modelDoctor.previewField.releases'),
      rotationalSpringI: key(language, 'modelDoctor.previewField.rotationalSpringI'),
      rotationalSpringJ: key(language, 'modelDoctor.previewField.rotationalSpringJ'),
      rigidOffsetI: key(language, 'modelDoctor.previewField.rigidOffsetI'),
      rigidOffsetJ: key(language, 'modelDoctor.previewField.rigidOffsetJ'),
    },
    previewNone: key(language, 'modelDoctor.previewNone'),
    previewStaleTitle: key(language, 'modelDoctor.previewStaleTitle'),
    previewStaleBody: key(language, 'modelDoctor.previewStaleBody'),
    previewRegenerate: key(language, 'modelDoctor.previewRegenerate'),
    previewApply: key(language, 'modelDoctor.previewApply'),
    previewApplying: key(language, 'modelDoctor.previewApplying'),
    previewCancel: key(language, 'modelDoctor.previewCancel'),
    repairApplied: key(language, 'modelDoctor.repairApplied'),
    category: {
      geometry: key(language, 'modelDoctor.category.geometry'),
      topology: key(language, 'modelDoctor.category.topology'),
      properties: key(language, 'modelDoctor.category.properties'),
      supports: key(language, 'modelDoctor.category.supports'),
      loads: key(language, 'modelDoctor.category.loads'),
      references: key(language, 'modelDoctor.category.references'),
      configuration: key(language, 'modelDoctor.category.configuration'),
    },
    objectKind: {
      node: key(language, 'modelDoctor.object.node'),
      member: key(language, 'modelDoctor.object.member'),
      nodalLoad: key(language, 'modelDoctor.object.nodalLoad'),
      memberLoad: key(language, 'modelDoctor.object.memberLoad'),
    },
  };
};
