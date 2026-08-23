import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Anchor,
  CircleDot,
  Layers3,
  Minus,
  MoveDown,
  MousePointer2,
  Plus,
  RotateCcw,
  Sigma,
  Trash2,
} from 'lucide-react';
import { BulkEditInspectorPanel } from '../bulk-edit/BulkEditInspectorPanel';
import { repairProjectTopology } from '../../data/modelOperations';
import type { StandardMaterial } from '../../data/standardMaterials';
import type { StandardSection } from '../../data/standardSections';
import { fromDisplay, toDisplay, unitLabel, type UnitQuantity } from '../../engine/units';
import { useI18n } from '../../i18n/useI18n';
import { useClassroomSession } from '../../store/ClassroomSessionContext';
import { useProjectAnalysis } from '../../store/ProjectAnalysisContext';
import { useProjectModel } from '../../store/ProjectModelContext';
import { useWorkspaceUI } from '../../store/WorkspaceUIContext';
import type {
  MemberInitialEffect,
  MemberLoad,
  NodalLoad,
  PrescribedDisplacement,
  SupportType,
  UnitSystemId,
  ValidationIssue,
} from '../../types';
import { InspectorNarrativeCard } from './InspectorNarrativeCard';
import { InspectorNumericField } from './InspectorNumericField';
import { InspectorSelectionPreview } from './InspectorSelectionPreview';
import { ModelOverview } from './ModelOverview';
import { readExpandedSections, writeExpandedSections } from './inspectorPreferences';
import { MaterialPresetSelector } from './MaterialPresetSelector';
import { formatInspectorValue } from './numericFormatting';
import { SectionPresetSelector } from './SectionPresetSelector';
import { SectionViewer2D } from './SectionViewer2D';
import {
  InspectorAdvancedProperties,
  InspectorDerivedList,
  InspectorHelper,
  InspectorLockedState,
  InspectorPropertyGroup,
  InspectorSelectionSummary,
  type InspectorSummaryMetric,
} from './InspectorPrimitives';

const usePersistentInspectorSections = () => {
  const [expanded, setExpanded] = useState<string[]>(() => readExpandedSections());
  const updateExpanded = useCallback((next: string[]) => {
    setExpanded(next);
    writeExpandedSections(next);
  }, []);
  return [expanded, updateExpanded] as const;
};

const SelectField = ({
  label,
  value,
  onChange,
  children,
  hint,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  hint?: string;
  disabled?: boolean;
}) => (
  <label className={`select-field${disabled ? ' is-disabled' : ''}`}>
    <span>{label}{hint ? <small>{hint}</small> : null}</span>
    <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{children}</select>
  </label>
);

const PhysicalNumberField = ({
  label,
  value,
  units,
  quantity,
  resetKey,
  onCommit,
  hint,
  validate,
  disabled,
  lockedReason,
}: {
  label: string;
  value: number;
  units: UnitSystemId;
  quantity: UnitQuantity;
  resetKey: string;
  onCommit: (value: number) => void;
  hint?: string;
  validate?: (value: number) => string | undefined;
  disabled?: boolean;
  lockedReason?: string;
}) => {
  const { language } = useI18n();
  return (
    <InspectorNumericField
      label={label}
      value={toDisplay(value, units, quantity)}
      unit={unitLabel(units, quantity)}
      resetKey={`${resetKey}:${units}`}
      hint={hint}
      validate={validate}
      disabled={disabled}
      lockedReason={lockedReason}
      language={language}
      onCommit={(displayValue) => onCommit(fromDisplay(displayValue, units, quantity))}
    />
  );
};

const formatPhysical = (value: number, units: UnitSystemId, quantity: UnitQuantity) => (
  formatInspectorValue(toDisplay(value, units, quantity), unitLabel(units, quantity))
);

const InspectorIssues = ({ issues }: { issues: readonly ValidationIssue[] }) => {
  const { t } = useI18n();
  if (issues.length === 0) return null;
  return <section className="inspector-inline-issues" aria-label={t('inspector.objectValidationRegion')}>
    <h3>{t('inspector.analysisValidationHeading')}</h3>
    {issues.map((issue) => <div key={issue.id} className={`is-${issue.severity}`} role={issue.severity === 'error' ? 'alert' : 'status'}>
      <AlertTriangle size={16} aria-hidden="true" />
      <span><strong>{issue.title}</strong>{issue.message}</span>
    </div>)}
  </section>;
};

export const InspectorProperties = () => {
  const { project, executeProjectCommand, updateProject } = useProjectModel();
  const { analysis } = useProjectAnalysis();
  const { selection, setSelection } = useWorkspaceUI();
  const { language, t } = useI18n();
  const { resultsVisible } = useClassroomSession();
  const [expandedSections, setExpandedSections] = usePersistentInspectorSections();
  const units = project.settings.units;
  const classroomMode = project.settings.calculationMode === 'classroom';
  const nonNegative = useCallback(
    (value: number) => value >= 0 ? undefined : t('inspector.nonNegativeValidation'),
    [t],
  );
  const normalizedPosition = useCallback(
    (value: number) => value >= 0 && value <= 1 ? undefined : t('inspector.normalizedPositionValidation'),
    [t],
  );
  const supportNames: Record<SupportType, string> = {
    none: t('inspector.free'),
    pin: t('inspector.pin'),
    roller: t('inspector.roller'),
    fixed: t('inspector.fixed'),
    custom: t('inspector.custom'),
  };

  const selectedNode = selection?.kind === 'node' ? project.nodes.find((node) => node.id === selection.id) : null;
  const selectedMember = selection?.kind === 'member' ? project.members.find((member) => member.id === selection.id) : null;
  const selectedNodalLoad = selection?.kind === 'nodalLoad' ? project.nodalLoads.find((load) => load.id === selection.id) : null;
  const selectedMemberLoad = selection?.kind === 'memberLoad' ? project.memberLoads.find((load) => load.id === selection.id) : null;
  const selectedNodePrescribed = selectedNode ? (project.prescribedDisplacements ?? []).filter((item) => item.nodeId === selectedNode.id) : [];
  const selectedMemberEffects = selectedMember ? (project.memberInitialEffects ?? []).filter((effect) => effect.memberId === selectedMember.id) : [];
  const nodeMap = useMemo(() => new Map(project.nodes.map((node) => [node.id, node])), [project.nodes]);
  const nodeResult = selectedNode && analysis?.success ? analysis.nodeResults.find((result) => result.nodeId === selectedNode.id) : null;
  const memberResult = selectedMember && analysis?.success ? analysis.memberResults.find((result) => result.memberId === selectedMember.id) : null;
  const multiCount = selection?.kind === 'multi' ? selection.nodeIds.length + selection.memberIds.length : 0;
  const selectionKey = selection === null
    ? 'none'
    : selection.kind === 'multi'
      ? `multi:${selection.nodeIds.join(',')}:${selection.memberIds.join(',')}`
      : `${selection.kind}:${selection.id}`;

  const updateNode = (key: string, value: unknown) => {
    let resultingNodeId = selectedNode?.id ?? '';
    updateProject((draft) => {
      const node = draft.nodes.find((item) => item.id === selectedNode?.id);
      if (!node) return draft;
      if (key === 'x' || key === 'y') node[key] = Number(value);
      else if (key === 'internalHinge') node.internalHinge = Boolean(value);
      else if (key === 'supportType') {
        const type = value as SupportType;
        const spring = node.support.spring;
        node.support = type === 'roller'
          ? { type, angleDeg: node.support.angleDeg ?? 90, spring }
          : type === 'custom'
            ? { type, restrainX: false, restrainY: false, restrainR: false, spring }
            : { type, spring };
      } else if (key === 'supportAngle') node.support.angleDeg = Number(value);
      else if (key === 'restrainX' || key === 'restrainY' || key === 'restrainR') node.support[key] = Boolean(value);
      else if (key.startsWith('spring.')) {
        node.support.spring ??= {};
        const springKey = key.split('.')[1] as 'kx' | 'ky' | 'kr' | 'kNormal';
        node.support.spring[springKey] = Number(value);
      } else if (key.startsWith('prescribed.')) {
        node.support.prescribed ??= {};
        const component = key.split('.')[1] as 'ux' | 'uy' | 'rz' | 'normal';
        node.support.prescribed[component] = Number(value);
      }
      const repair = repairProjectTopology(draft);
      const merge = repair.mergedNodes.find((item) => item.removedNodeId === resultingNodeId);
      if (merge) resultingNodeId = merge.keptNodeId;
      return draft;
    });
    if (resultingNodeId && resultingNodeId !== selectedNode?.id) setSelection({ kind: 'node', id: resultingNodeId });
  };

  const updateMember = (key: string, value: unknown) => {
    if (!selectedMember) return;
    const member = structuredClone(selectedMember);
    if (key === 'type') member.type = value as typeof member.type;
    else if (key === 'E') member.E = Number(value);
    else if (key === 'A' || key === 'I' || key === 'density' || key === 'G' || key === 'shearArea' || key === 'rotationalSpringI' || key === 'rotationalSpringJ') member[key] = Number(value);
    else if (key === 'beamTheory') member.beamTheory = value as 'euler-bernoulli' | 'timoshenko';
    else if (key === 'useRotationalSpringI' || key === 'useRotationalSpringJ') {
      const property = key === 'useRotationalSpringI' ? 'rotationalSpringI' : 'rotationalSpringJ';
      if (value) member[property] ??= 1e6;
      else delete member[property];
    } else if (key === 'rigidOffsetI' || key === 'rigidOffsetJ') member[key] = Math.max(0, Number(value));
    else if (key === 'iMoment' || key === 'jMoment') {
      member.releases ??= {};
      member.releases[key] = Boolean(value);
    }
    void executeProjectCommand({
      kind: 'member.update', description: `Editar miembro ${member.id}`, memberId: member.id, changes: member,
    });
  };

  const applyMaterialPreset = (material: StandardMaterial) => {
    if (!selectedMember) return;
    void executeProjectCommand({
      kind: 'member.material.apply',
      description: `Aplicar material a ${selectedMember.id}`,
      memberId: selectedMember.id,
      materialId: material.id,
      properties: { E: material.elasticModulus, G: material.shearModulus, density: material.density },
    });
  };

  const applySectionPreset = (section: StandardSection) => {
    if (!selectedMember) return;
    void executeProjectCommand({
      kind: 'member.section.apply',
      description: `Aplicar sección a ${selectedMember.id}`,
      memberId: selectedMember.id,
      sectionId: section.id,
      properties: { A: section.area, I: section.inertiaX },
    });
  };

  const updateNodalLoad = (key: keyof NodalLoad, value: string | number) => updateProject((draft) => {
    const load = draft.nodalLoads.find((item) => item.id === selectedNodalLoad?.id);
    if (load) (load as unknown as Record<string, string | number>)[key] = value;
    return draft;
  });

  const updateMemberLoad = (key: keyof MemberLoad, value: string | number) => updateProject((draft) => {
    const load = draft.memberLoads.find((item) => item.id === selectedMemberLoad?.id);
    if (load) (load as unknown as Record<string, string | number>)[key] = value;
    return draft;
  });

  const deleteLoad = (kind: 'nodal' | 'member', id: string) => updateProject((draft) => {
    if (kind === 'nodal') draft.nodalLoads = draft.nodalLoads.filter((load) => load.id !== id);
    else draft.memberLoads = draft.memberLoads.filter((load) => load.id !== id);
    return draft;
  });

  const updatePrescribed = (id: string, key: keyof PrescribedDisplacement, value: string | number) => updateProject((draft) => {
    const item = (draft.prescribedDisplacements ?? []).find((candidate) => candidate.id === id);
    if (item) (item as unknown as Record<string, string | number>)[key] = value;
    return draft;
  });

  const updateInitialEffect = (id: string, key: keyof MemberInitialEffect, value: string | number) => updateProject((draft) => {
    const item = (draft.memberInitialEffects ?? []).find((candidate) => candidate.id === id);
    if (item) (item as unknown as Record<string, string | number>)[key] = value;
    return draft;
  });

  const selectedId = selectedNode?.id ?? selectedMember?.id ?? selectedNodalLoad?.id ?? selectedMemberLoad?.id;
  const selectedIssues = selectedId ? (analysis?.issues ?? []).filter((issue) => issue.objectId === selectedId) : [];

  let summaryType = t('inspector.noneSelected');
  let summaryId = '—';
  let summaryDescription = t('inspector.selectObjectProperties');
  let SummaryIcon = MousePointer2;
  let summaryMetrics: InspectorSummaryMetric[] = [];

  if (selectedNode) {
    const hasSupport = selectedNode.support.type !== 'none';
    summaryType = hasSupport ? t('inspector.support') : t('inspector.node');
    summaryId = selectedNode.id;
    summaryDescription = hasSupport
      ? t('inspector.supportNodeSummary', { support: supportNames[selectedNode.support.type] })
      : t('inspector.freeNodeSummary');
    SummaryIcon = hasSupport ? Anchor : CircleDot;
    if (nodeResult && (!classroomMode || resultsVisible)) summaryMetrics = [
      { label: 'Rx', value: formatPhysical(nodeResult.rx, units, 'force') },
      { label: 'Ry', value: formatPhysical(nodeResult.ry, units, 'force') },
      { label: 'M', value: formatPhysical(nodeResult.rm, units, 'moment'), tone: 'moment' },
    ];
  } else if (selectedMember) {
    summaryType = t('inspector.member');
    summaryId = selectedMember.id;
    summaryDescription = `${selectedMember.type === 'frame' ? t('inspector.frame') : selectedMember.type === 'truss' ? t('inspector.truss') : t('inspector.rigid')} · ${selectedMember.i} → ${selectedMember.j}`;
    SummaryIcon = Minus;
    if (memberResult && (!classroomMode || resultsVisible)) summaryMetrics = [
      { label: t('inspector.maxAxial'), value: formatPhysical(memberResult.maxAxial, units, 'force'), tone: 'axial' },
      { label: t('inspector.maxShear'), value: formatPhysical(memberResult.maxShear, units, 'force'), tone: 'shear' },
      { label: t('inspector.maxMoment'), value: formatPhysical(memberResult.maxMoment, units, 'moment'), tone: 'moment' },
    ];
  } else if (selectedNodalLoad) {
    const hasForce = Math.hypot(selectedNodalLoad.fx, selectedNodalLoad.fy) !== 0;
    const hasMoment = selectedNodalLoad.mz !== 0;
    summaryType = hasForce && hasMoment
      ? t('inspector.mixedNodalLoad')
      : hasMoment
        ? t('inspector.moment')
        : t('inspector.pointLoad');
    summaryId = selectedNodalLoad.id;
    summaryDescription = t('inspector.nodeLoadSummary', {
      nodeId: selectedNodalLoad.nodeId,
      caseId: selectedNodalLoad.caseId,
    });
    SummaryIcon = hasMoment && !hasForce ? RotateCcw : MoveDown;
  } else if (selectedMemberLoad) {
    summaryType = selectedMemberLoad.type === 'distributed'
      ? t('inspector.distributedLoad')
      : selectedMemberLoad.type === 'point'
        ? t('inspector.pointLoad')
        : t('inspector.moment');
    summaryId = selectedMemberLoad.id;
    summaryDescription = t('inspector.memberLoadSummary', {
      memberId: selectedMemberLoad.memberId,
      caseId: selectedMemberLoad.caseId,
    });
    SummaryIcon = selectedMemberLoad.type === 'distributed' ? Sigma : selectedMemberLoad.type === 'point' ? MoveDown : RotateCcw;
  } else if (selection?.kind === 'multi') {
    summaryType = t('inspector.multiple');
    summaryId = t('inspector.objectCount', { count: multiCount });
    summaryDescription = t('inspector.selectionCounts', {
      nodes: selection.nodeIds.length,
      members: selection.memberIds.length,
    });
    SummaryIcon = Layers3;
  }

  const renderNodeAdvanced = selectedNode ? <>
    <InspectorPropertyGroup title={t('inspector.connection')} description={t('inspector.nodeRotationDescription')}>
      <label className="toggle-row">
        <span>{t('inspector.internalHinge')}<small>{t('inspector.internalHingeHelp')}</small></span>
        <input type="checkbox" checked={selectedNode.internalHinge ?? false} onChange={(event) => updateNode('internalHinge', event.target.checked)} />
      </label>
    </InspectorPropertyGroup>

    {!classroomMode ? <InspectorPropertyGroup title={t('inspector.springs')} description={t('inspector.optionalSupportStiffnesses')}>
      <PhysicalNumberField label="kx" value={selectedNode.support.spring?.kx ?? 0} units={units} quantity="translationalStiffness" resetKey={`${selectionKey}:spring-kx`} validate={nonNegative} onCommit={(value) => updateNode('spring.kx', value)} />
      <PhysicalNumberField label="ky" value={selectedNode.support.spring?.ky ?? 0} units={units} quantity="translationalStiffness" resetKey={`${selectionKey}:spring-ky`} validate={nonNegative} onCommit={(value) => updateNode('spring.ky', value)} />
      <PhysicalNumberField label="kθ" value={selectedNode.support.spring?.kr ?? 0} units={units} quantity="rotationalStiffness" resetKey={`${selectionKey}:spring-kr`} validate={nonNegative} onCommit={(value) => updateNode('spring.kr', value)} />
      <PhysicalNumberField label={t('inspector.kNormal')} value={selectedNode.support.spring?.kNormal ?? 0} units={units} quantity="translationalStiffness" resetKey={`${selectionKey}:spring-normal`} validate={nonNegative} onCommit={(value) => updateNode('spring.kNormal', value)} />
    </InspectorPropertyGroup> : <InspectorLockedState title={t('inspector.springsLockedClassroom')}>{t('inspector.springsLockedClassroomBody')}</InspectorLockedState>}

    {!classroomMode && selectedNode.support.type !== 'none' ? <InspectorPropertyGroup title={t('inspector.settlementsByCase')} description={t('inspector.settlementsDescription')}>
      <div className="section-heading">
        <span className="section-description">{selectedNodePrescribed.length > 0 ? t('inspector.definedCount', { count: selectedNodePrescribed.length }) : t('inspector.noSettlements')}</span>
        <button type="button" className="mini-button" aria-label={t('inspector.addPrescribedDisplacement')} onClick={() => updateProject((draft) => {
          draft.prescribedDisplacements ??= [];
          let index = 1;
          while (draft.prescribedDisplacements.some((item) => item.id === `PD${index}`)) index += 1;
          const node = draft.nodes.find((item) => item.id === selectedNode.id);
          const component: PrescribedDisplacement['component'] = node?.support.type === 'roller' ? 'normal' : node?.support.type === 'custom' && !node.support.restrainX && node.support.restrainY ? 'uy' : node?.support.type === 'custom' && !node.support.restrainX && !node.support.restrainY ? 'rz' : 'ux';
          draft.prescribedDisplacements.push({ id: `PD${index}`, nodeId: selectedNode.id, caseId: draft.loadCases[0]?.id ?? 'LC1', component, value: 0 });
          return draft;
        })}><Plus size={16} /></button>
      </div>
      <div className="effect-list">{selectedNodePrescribed.map((item) => <div className="effect-card" key={item.id}>
        <SelectField label={t('inspector.case')} value={item.caseId} onChange={(value) => updatePrescribed(item.id, 'caseId', value)}>{project.loadCases.map((loadCase) => <option key={loadCase.id} value={loadCase.id}>{loadCase.name}</option>)}</SelectField>
        <SelectField label={t('inspector.component')} value={item.component} onChange={(value) => updatePrescribed(item.id, 'component', value)}>
          {selectedNode.support.type === 'roller' ? <option value="normal">{t('inspector.normal')}</option> : <>
            <option value="ux">Ux</option><option value="uy">Uy</option>
            {selectedNode.support.type === 'fixed' || selectedNode.support.type === 'custom' ? <option value="rz">Rz</option> : null}
          </>}
        </SelectField>
        {item.component === 'rz' ? <InspectorNumericField label={t('inspector.value')} value={item.value} unit="rad" resetKey={`${selectionKey}:${item.id}:value`} language={language} onCommit={(value) => updatePrescribed(item.id, 'value', value)} /> : <PhysicalNumberField label={t('inspector.value')} value={item.value} units={units} quantity="length" resetKey={`${selectionKey}:${item.id}:value`} onCommit={(value) => updatePrescribed(item.id, 'value', value)} />}
        <button type="button" className="icon-danger-button" aria-label={t('inspector.deleteItem', { id: item.id })} onClick={() => updateProject((draft) => {
          draft.prescribedDisplacements = (draft.prescribedDisplacements ?? []).filter((candidate) => candidate.id !== item.id);
          return draft;
        })}><Trash2 size={14} /> {t('inspector.delete')}</button>
      </div>)}</div>
      <InspectorHelper>{t('inspector.settlementFactorHelp')}</InspectorHelper>
    </InspectorPropertyGroup> : null}
    {!classroomMode && selectedNode.support.type === 'none' ? <InspectorLockedState title={t('inspector.settlementsUnavailable')}>{t('inspector.settlementsUnavailableBody')}</InspectorLockedState> : null}
    {classroomMode ? <InspectorLockedState title={t('inspector.settlementsLockedClassroom')}>{t('inspector.settlementsLockedClassroomBody')}</InspectorLockedState> : null}
  </> : null;

  const renderMemberAdvanced = selectedMember ? <>
    {selectedMember.type === 'rigid' ? <InspectorLockedState title={t('inspector.mechanicalPropertiesLocked')}>{t('inspector.rigidHelp')}</InspectorLockedState> : <>
      {!classroomMode ? <InspectorPropertyGroup title={t('inspector.complementaryMaterial')} description={t('inspector.lessFrequentMemberProperties')}>
        <PhysicalNumberField label="ρ" value={selectedMember.density ?? 0} units={units} quantity="density" resetKey={`${selectionKey}:density`} validate={nonNegative} hint={selectedMember.density === undefined ? t('inspector.explicitValueSaveHint') : undefined} onCommit={(value) => updateMember('density', value)} />
      </InspectorPropertyGroup> : null}

      {selectedMember.type === 'frame' && !classroomMode ? <InspectorPropertyGroup title={t('inspector.beamTheory')} description={t('inspector.memberDeformationModel')}>
        <SelectField label={t('inspector.theory')} value={selectedMember.beamTheory ?? 'euler-bernoulli'} onChange={(value) => updateMember('beamTheory', value)}>
          <option value="euler-bernoulli">{t('inspector.eulerBernoulli')}</option><option value="timoshenko">{t('inspector.timoshenko')}</option>
        </SelectField>
        {selectedMember.beamTheory === 'timoshenko' ? <>
          <PhysicalNumberField label="G" value={selectedMember.G ?? selectedMember.E / 2.6} units={units} quantity="elasticModulus" resetKey={`${selectionKey}:G`} hint={selectedMember.G === undefined ? t('inspector.suggestedValueSaveHint') : undefined} onCommit={(value) => updateMember('G', value)} />
          <PhysicalNumberField label={t('inspector.effectiveShearArea')} value={selectedMember.shearArea ?? selectedMember.A * 5 / 6} units={units} quantity="area" resetKey={`${selectionKey}:As`} hint={selectedMember.shearArea === undefined ? t('inspector.suggestedValueSaveHint') : t('inspector.shearCorrectionHint')} onCommit={(value) => updateMember('shearArea', value)} />
        </> : null}
      </InspectorPropertyGroup> : null}

      {!classroomMode ? <InspectorPropertyGroup title={t('inspector.temperatureInitialStrain')} description={t('inspector.loadCaseDependentEffects')}>
        <div className="section-heading">
          <span className="section-description">{selectedMemberEffects.length > 0 ? t('inspector.definedCount', { count: selectedMemberEffects.length }) : t('inspector.noInitialEffects')}</span>
          <button type="button" className="mini-button" aria-label={t('inspector.addInitialEffect')} onClick={() => updateProject((draft) => {
            draft.memberInitialEffects ??= [];
            let index = 1;
            while (draft.memberInitialEffects.some((item) => item.id === `IE${index}`)) index += 1;
            draft.memberInitialEffects.push({ id: `IE${index}`, memberId: selectedMember.id, caseId: draft.loadCases[0]?.id ?? 'LC1', type: 'temperature', alpha: 1.2e-5, deltaT: 0, gradient: 0 });
            return draft;
        })}><Plus size={16} /></button>
        </div>
        <div className="effect-list">{selectedMemberEffects.map((effect) => <div className="effect-card" key={effect.id}>
          <SelectField label={t('inspector.type')} value={effect.type} onChange={(value) => updateInitialEffect(effect.id, 'type', value)}><option value="temperature">{t('inspector.temperature')}</option><option value="initial-strain">{t('inspector.initialStrain')}</option></SelectField>
          <SelectField label={t('inspector.case')} value={effect.caseId} onChange={(value) => updateInitialEffect(effect.id, 'caseId', value)}>{project.loadCases.map((loadCase) => <option key={loadCase.id} value={loadCase.id}>{loadCase.name}</option>)}</SelectField>
          {effect.type === 'temperature' ? <>
            <InspectorNumericField label="α" value={effect.alpha ?? 1.2e-5} unit="1/°C" resetKey={`${selectionKey}:${effect.id}:alpha`} language={language} validate={nonNegative} onCommit={(value) => updateInitialEffect(effect.id, 'alpha', Math.max(0, value))} />
            <InspectorNumericField label={t('inspector.uniformDeltaT')} value={effect.deltaT ?? 0} unit="°C" resetKey={`${selectionKey}:${effect.id}:delta-t`} language={language} onCommit={(value) => updateInitialEffect(effect.id, 'deltaT', value)} />
            {selectedMember.type === 'frame' ? <InspectorNumericField label={t('inspector.localYGradient')} value={effect.gradient ?? 0} unit="°C/m" resetKey={`${selectionKey}:${effect.id}:gradient`} language={language} onCommit={(value) => updateInitialEffect(effect.id, 'gradient', value)} /> : null}
          </> : <>
            <InspectorNumericField label={t('inspector.axialInitialStrain')} value={effect.axialStrain ?? 0} unit="" resetKey={`${selectionKey}:${effect.id}:strain`} language={language} onCommit={(value) => updateInitialEffect(effect.id, 'axialStrain', value)} />
            {selectedMember.type === 'frame' ? <InspectorNumericField label="κ₀" value={effect.curvature ?? 0} unit="1/m" resetKey={`${selectionKey}:${effect.id}:curvature`} language={language} onCommit={(value) => updateInitialEffect(effect.id, 'curvature', value)} /> : null}
          </>}
          <button type="button" className="icon-danger-button" aria-label={t('inspector.deleteItem', { id: effect.id })} onClick={() => updateProject((draft) => {
            draft.memberInitialEffects = (draft.memberInitialEffects ?? []).filter((candidate) => candidate.id !== effect.id);
            return draft;
          })}><Trash2 size={14} /> {t('inspector.delete')}</button>
        </div>)}</div>
        <InspectorHelper>{t('inspector.initialEffectsSignHelp')}</InspectorHelper>
      </InspectorPropertyGroup> : <InspectorLockedState title={t('inspector.advancedLockedClassroom')}>{t('inspector.advancedLockedClassroomBody')}</InspectorLockedState>}

      {selectedMember.type === 'frame' ? <InspectorPropertyGroup title={t('inspector.connections')} description={t('inspector.endConnectionsDescription')}>
        {!classroomMode ? <>
          <h4 className="subsection-title">{t('inspector.semiRigidConnections')}</h4>
          <label className="toggle-row"><span>{t('inspector.enableAtI')}</span><input type="checkbox" checked={selectedMember.rotationalSpringI !== undefined} onChange={(event) => updateMember('useRotationalSpringI', event.target.checked)} /></label>
          {selectedMember.rotationalSpringI !== undefined ? <PhysicalNumberField label={t('inspector.rotationalSpringEndI')} value={selectedMember.rotationalSpringI} units={units} quantity="rotationalStiffness" resetKey={`${selectionKey}:rot-spring-i`} validate={nonNegative} onCommit={(value) => updateMember('rotationalSpringI', value)} /> : null}
          <label className="toggle-row"><span>{t('inspector.enableAtJ')}</span><input type="checkbox" checked={selectedMember.rotationalSpringJ !== undefined} onChange={(event) => updateMember('useRotationalSpringJ', event.target.checked)} /></label>
          {selectedMember.rotationalSpringJ !== undefined ? <PhysicalNumberField label={t('inspector.rotationalSpringEndJ')} value={selectedMember.rotationalSpringJ} units={units} quantity="rotationalStiffness" resetKey={`${selectionKey}:rot-spring-j`} validate={nonNegative} onCommit={(value) => updateMember('rotationalSpringJ', value)} /> : null}
          <InspectorHelper>{t('inspector.rotationalSpringHelp')}</InspectorHelper>
          <h4 className="subsection-title">{t('inspector.rigidZones')}</h4>
          <PhysicalNumberField label={t('inspector.offsetI')} value={selectedMember.rigidOffsetI ?? 0} units={units} quantity="length" resetKey={`${selectionKey}:offset-i`} validate={nonNegative} onCommit={(value) => updateMember('rigidOffsetI', Math.max(0, value))} />
          <PhysicalNumberField label={t('inspector.offsetJ')} value={selectedMember.rigidOffsetJ ?? 0} units={units} quantity="length" resetKey={`${selectionKey}:offset-j`} validate={nonNegative} onCommit={(value) => updateMember('rigidOffsetJ', Math.max(0, value))} />
          <InspectorHelper>{t('inspector.flexibleLengthHelp')}</InspectorHelper>
        </> : <InspectorLockedState title={t('inspector.semirigidityLocked')}>{t('inspector.semirigidityLockedBody')}</InspectorLockedState>}
      </InspectorPropertyGroup> : null}
    </>}
  </> : null;

  /**
   * Sin seleccion —o con una que ya no apunta a nada—, el panel enseña el
   * Panorama del modelo.
   *
   * Antes gastaba sus 320 px en DOS tarjetas que dicen lo mismo: el resumen de
   * seleccion en su estado vacio («Nada seleccionado» + una raya) y, debajo,
   * una ayuda explicando el mecanismo que el usuario descubre al primer clic.
   * Ninguna de las dos informa de nada, asi que las dos se retiran: un resumen
   * de seleccion sin seleccion no es un resumen.
   *
   * Una seleccion colgada —un id de un objeto que ya se borro— entra por aqui
   * tambien. Era el otro caso que caia en ese estado vacio, y tratarlo igual es
   * lo honesto: no hay nada que inspeccionar.
   */
  const dangling = selection !== null && selection.kind !== 'multi' && !selectedId;
  if (selection === null || dangling) return <div className="inspector-properties"><ModelOverview /></div>;

  return <div className="inspector-properties">
    <div className="inspector-selection-header">
      <InspectorSelectionSummary
        icon={SummaryIcon}
        type={summaryType}
        id={summaryId}
        description={summaryDescription}
        metrics={summaryMetrics}
      />
      {selection.kind !== 'multi' ? <InspectorSelectionPreview
        project={project}
        selection={selection}
        label={t('inspector.selectionPreview')}
        caption={t('inspector.selectionPreviewCaption')}
      /> : null}
    </div>

    {selection?.kind === 'multi' ? <>
      <InspectorPropertyGroup title={t('inspector.selectionSummary')} mode="derived" description={t('inspector.multipleSelectionDescription')}>
        <InspectorDerivedList rows={[
          { label: t('inspector.nodes'), value: selection.nodeIds.length, description: selection.nodeIds.join(', ') || t('inspector.none') },
          { label: t('inspector.members'), value: selection.memberIds.length, description: selection.memberIds.join(', ') || t('inspector.none') },
          { label: t('inspector.total'), value: multiCount },
        ]} />
      </InspectorPropertyGroup>
      <BulkEditInspectorPanel selection={selection} />
    </> : null}

    {selectedNode ? <>
      <InspectorPropertyGroup title={t('inspector.frequentProperties')} description={t('inspector.nodeFrequentDescription')}>
        <PhysicalNumberField label="X" value={selectedNode.x} units={units} quantity="length" resetKey={`${selectionKey}:x`} onCommit={(value) => updateNode('x', value)} />
        <PhysicalNumberField label="Y" value={selectedNode.y} units={units} quantity="length" resetKey={`${selectionKey}:y`} onCommit={(value) => updateNode('y', value)} />
        <SelectField label={t('inspector.support')} value={selectedNode.support.type} onChange={(value) => updateNode('supportType', value)}>
          <option value="none">{t('inspector.free')}</option><option value="pin">{t('inspector.pin')}</option><option value="roller">{t('inspector.roller')}</option><option value="fixed">{t('inspector.fixed')}</option><option value="custom">{t('inspector.custom')}</option>
        </SelectField>
        {selectedNode.support.type === 'roller' ? <InspectorNumericField label={t('inspector.normal')} value={selectedNode.support.angleDeg ?? 90} unit="°" resetKey={`${selectionKey}:support-angle`} language={language} formatOptions={{ maximumFractionDigits: 2 }} hint={t('inspector.rollerNormalHint')} onCommit={(value) => updateNode('supportAngle', value)} /> : null}
        {selectedNode.support.type === 'custom' ? <div className="checkbox-grid" role="group" aria-label={t('inspector.restrictedDegreesOfFreedom')}>
          <label><input type="checkbox" checked={selectedNode.support.restrainX ?? false} onChange={(event) => updateNode('restrainX', event.target.checked)} /> Ux</label>
          <label><input type="checkbox" checked={selectedNode.support.restrainY ?? false} onChange={(event) => updateNode('restrainY', event.target.checked)} /> Uy</label>
          <label><input type="checkbox" checked={selectedNode.support.restrainR ?? false} onChange={(event) => updateNode('restrainR', event.target.checked)} /> Rz</label>
        </div> : null}
      </InspectorPropertyGroup>
      <InspectorPropertyGroup title={t('inspector.derivedValues')} mode="derived" description={t('inspector.derivedReadOnlyDescription')}>
        <InspectorDerivedList rows={[
          { label: 'ID', value: selectedNode.id, description: t('inspector.modelIdentifier') },
          ...(nodeResult && (!classroomMode || resultsVisible) ? [
            ...(!classroomMode ? [
              { label: 'Ux', value: formatPhysical(nodeResult.ux, units, 'length') },
              { label: 'Uy', value: formatPhysical(nodeResult.uy, units, 'length') },
              { label: 'Rz', value: formatInspectorValue(nodeResult.rz, 'rad') },
            ] : []),
            { label: 'Rx', value: formatPhysical(nodeResult.rx, units, 'force') },
            { label: 'Ry', value: formatPhysical(nodeResult.ry, units, 'force') },
            { label: 'M', value: formatPhysical(nodeResult.rm, units, 'moment') },
          ] : []),
        ]} />
      </InspectorPropertyGroup>
      <InspectorAdvancedProperties id="advanced-node" expanded={expandedSections} onExpandedChange={setExpandedSections}>{renderNodeAdvanced}</InspectorAdvancedProperties>
      <InspectorIssues issues={selectedIssues} />
    </> : null}

    {selectedMember ? (() => {
      const ni = nodeMap.get(selectedMember.i);
      const nj = nodeMap.get(selectedMember.j);
      const length = ni && nj ? Math.hypot(nj.x - ni.x, nj.y - ni.y) : Number.NaN;
      const angle = ni && nj ? Math.atan2(nj.y - ni.y, nj.x - ni.x) * 180 / Math.PI : Number.NaN;
      return <>
        <InspectorPropertyGroup title={t('inspector.frequentProperties')} description={t('inspector.memberFrequentDescription')}>
          <SelectField label={t('inspector.element')} value={selectedMember.type} onChange={(value) => updateMember('type', value)}>
            <option value="frame">{t('inspector.frame')}</option><option value="truss">{t('inspector.truss')}</option><option value="rigid">{t('inspector.rigid')}</option>
          </SelectField>
          {selectedMember.type !== 'rigid' && !classroomMode ? <>
            <MaterialPresetSelector units={units} selectedId={selectedMember.materialId} origin={selectedMember.materialOrigin} onSelect={applyMaterialPreset} />
            <SectionPresetSelector units={units} selectedId={selectedMember.sectionId} origin={selectedMember.sectionOrigin} onSelect={applySectionPreset} />
            <PhysicalNumberField label="E" value={selectedMember.E} units={units} quantity="elasticModulus" resetKey={`${selectionKey}:E`} hint={t('inspector.domainValidatesE')} onCommit={(value) => updateMember('E', value)} />
            <PhysicalNumberField label="A" value={selectedMember.A} units={units} quantity="area" resetKey={`${selectionKey}:A`} hint={t('inspector.domainValidatesA')} onCommit={(value) => updateMember('A', value)} />
            <PhysicalNumberField label="I" value={selectedMember.I} units={units} quantity="inertia" resetKey={`${selectionKey}:I`} hint={selectedMember.type === 'frame' ? t('inspector.domainValidatesI') : t('inspector.inertiaCompatibilityHint')} onCommit={(value) => updateMember('I', value)} />
          </> : null}
          {selectedMember.type !== 'rigid' && classroomMode ? <InspectorLockedState title={t('inspector.materialLockedClassroom')}>{t('inspector.materialLockedClassroomBody')}</InspectorLockedState> : null}
          {selectedMember.type === 'rigid' ? <InspectorLockedState title={t('inspector.noEditableStiffness')}>{t('inspector.noEditableStiffnessBody')}</InspectorLockedState> : null}
          {selectedMember.type === 'frame' ? <div className="checkbox-grid" role="group" aria-label={t('inspector.momentReleases')}>
            <label><input type="checkbox" checked={selectedMember.releases?.iMoment ?? false} onChange={(event) => updateMember('iMoment', event.target.checked)} /> {t('inspector.momentI')}</label>
            <label><input type="checkbox" checked={selectedMember.releases?.jMoment ?? false} onChange={(event) => updateMember('jMoment', event.target.checked)} /> {t('inspector.momentJ')}</label>
          </div> : null}
        </InspectorPropertyGroup>
        {selectedMember.type !== 'rigid' && selectedMember.A > 0 && selectedMember.I > 0 ? <SectionViewer2D
          area={selectedMember.A}
          inertia={selectedMember.I}
          sectionId={selectedMember.sectionId}
          sectionOrigin={selectedMember.sectionOrigin}
          units={units}
          axialForce={memberResult && (!classroomMode || resultsVisible) ? memberResult.maxAxial : 0}
          bendingMoment={memberResult && (!classroomMode || resultsVisible) ? memberResult.maxMoment : 0}
        /> : null}
        {memberResult && (!classroomMode || resultsVisible) ? <InspectorNarrativeCard
          member={selectedMember}
          result={memberResult}
          analysis={analysis}
          units={units}
        /> : null}
        <InspectorPropertyGroup title={t('inspector.derivedValues')} mode="derived" description={t('inspector.memberDerivedDescription')}>
          <InspectorDerivedList rows={[
            { label: t('inspector.nodeI'), value: selectedMember.i },
            { label: t('inspector.nodeJ'), value: selectedMember.j },
            { label: t('inspector.length'), value: formatPhysical(length, units, 'length') },
            { label: t('inspector.angle'), value: formatInspectorValue(angle, '°', { maximumFractionDigits: 2 }) },
            ...(memberResult && (!classroomMode || resultsVisible) ? [
              { label: t('inspector.maxAxial'), value: formatPhysical(memberResult.maxAxial, units, 'force') },
              { label: t('inspector.maxShear'), value: formatPhysical(memberResult.maxShear, units, 'force') },
              { label: t('inspector.maxMoment'), value: formatPhysical(memberResult.maxMoment, units, 'moment') },
            ] : []),
          ]} />
        </InspectorPropertyGroup>
        <InspectorAdvancedProperties id="advanced-member" expanded={expandedSections} onExpandedChange={setExpandedSections}>{renderMemberAdvanced}</InspectorAdvancedProperties>
        <InspectorIssues issues={selectedIssues} />
      </>;
    })() : null}

    {selectedNodalLoad ? <>
      <InspectorPropertyGroup title={t('inspector.frequentProperties')} description={t('inspector.nodalLoadFrequentDescription')}>
        <SelectField label={t('inspector.case')} value={selectedNodalLoad.caseId} onChange={(value) => updateNodalLoad('caseId', value)}>{project.loadCases.map((loadCase) => <option key={loadCase.id} value={loadCase.id}>{loadCase.name}</option>)}</SelectField>
        <InspectorHelper>{t('inspector.loadCaseHelp')}</InspectorHelper>
        <PhysicalNumberField label={t('inspector.horizontalFx')} value={selectedNodalLoad.fx} units={units} quantity="force" resetKey={`${selectionKey}:fx`} onCommit={(value) => updateNodalLoad('fx', value)} />
        <PhysicalNumberField label={t('inspector.verticalFy')} value={selectedNodalLoad.fy} units={units} quantity="force" resetKey={`${selectionKey}:fy`} onCommit={(value) => updateNodalLoad('fy', value)} />
        <PhysicalNumberField label={t('inspector.momentMz')} value={selectedNodalLoad.mz} units={units} quantity="moment" resetKey={`${selectionKey}:mz`} onCommit={(value) => updateNodalLoad('mz', value)} />
        <InspectorHelper>{t('inspector.nodalLoadSignHelp')}</InspectorHelper>
      </InspectorPropertyGroup>
      <InspectorPropertyGroup title={t('inspector.derivedValues')} mode="derived"><InspectorDerivedList rows={[{ label: 'ID', value: selectedNodalLoad.id }, { label: t('inspector.node'), value: selectedNodalLoad.nodeId }]} /></InspectorPropertyGroup>
      <InspectorAdvancedProperties id="advanced-nodal-load" expanded={expandedSections} onExpandedChange={setExpandedSections}>
        <InspectorLockedState title={t('inspector.modelRelationship')}>{t('inspector.modelRelationshipBody')}</InspectorLockedState>
      </InspectorAdvancedProperties>
      <InspectorIssues issues={selectedIssues} />
      <button type="button" className="danger-button" onClick={() => deleteLoad('nodal', selectedNodalLoad.id)}><Trash2 size={16} /> {t('inspector.deleteLoad')}</button>
    </> : null}

    {selectedMemberLoad ? <>
      <InspectorPropertyGroup title={t('inspector.frequentProperties')} description={t('inspector.memberLoadFrequentDescription')}>
        <SelectField label={t('inspector.type')} value={selectedMemberLoad.type} onChange={(value) => updateMemberLoad('type', value)}><option value="distributed">{t('inspector.distributed')}</option><option value="point">{t('inspector.point')}</option><option value="moment">{t('inspector.moment')}</option></SelectField>
        <SelectField label={t('inspector.case')} value={selectedMemberLoad.caseId} onChange={(value) => updateMemberLoad('caseId', value)}>{project.loadCases.map((loadCase) => <option key={loadCase.id} value={loadCase.id}>{loadCase.name}</option>)}</SelectField>
        <InspectorHelper>{t('inspector.loadCaseHelp')}</InspectorHelper>
        <div className="segmented-control" role="group" aria-label={t('inspector.coordinateSystem')}>
          {[{ value: 'global', label: t('inspector.global') }, { value: 'local', label: t('inspector.local') }].map((option) => <button type="button" key={option.value} aria-pressed={selectedMemberLoad.coordinateSystem === option.value} className={selectedMemberLoad.coordinateSystem === option.value ? 'active' : ''} onClick={() => updateMemberLoad('coordinateSystem', option.value)}>{option.label}</button>)}
        </div>
        {selectedMemberLoad.type === 'distributed' ? <SelectField label={t('inspector.base')} value={selectedMemberLoad.lengthBasis} onChange={(value) => updateMemberLoad('lengthBasis', value)}><option value="real">{t('inspector.realLength')}</option><option value="horizontal">{t('inspector.horizontalProjection')}</option><option value="vertical">{t('inspector.verticalProjection')}</option></SelectField> : null}
        {selectedMemberLoad.type === 'distributed' ? <>
          <InspectorNumericField label={t('inspector.from')} value={selectedMemberLoad.start} unit="x/L" resetKey={`${selectionKey}:start`} language={language} hint={t('inspector.normalizedBeforeEndHint')} validate={normalizedPosition} onCommit={(value) => updateMemberLoad('start', Math.max(0, Math.min(1, value)))} />
          <InspectorNumericField label={t('inspector.to')} value={selectedMemberLoad.end} unit="x/L" resetKey={`${selectionKey}:end`} language={language} hint={t('inspector.normalizedAfterStartHint')} validate={normalizedPosition} onCommit={(value) => updateMemberLoad('end', Math.max(0, Math.min(1, value)))} />
          <PhysicalNumberField label={t('inspector.qxStart')} value={selectedMemberLoad.qxStart ?? 0} units={units} quantity="distributedForce" resetKey={`${selectionKey}:qx-start`} onCommit={(value) => updateMemberLoad('qxStart', value)} />
          <PhysicalNumberField label={t('inspector.qxEnd')} value={selectedMemberLoad.qxEnd ?? 0} units={units} quantity="distributedForce" resetKey={`${selectionKey}:qx-end`} onCommit={(value) => updateMemberLoad('qxEnd', value)} />
          <PhysicalNumberField label={t('inspector.qyStart')} value={selectedMemberLoad.qyStart ?? 0} units={units} quantity="distributedForce" resetKey={`${selectionKey}:qy-start`} onCommit={(value) => updateMemberLoad('qyStart', value)} />
          <PhysicalNumberField label={t('inspector.qyEnd')} value={selectedMemberLoad.qyEnd ?? 0} units={units} quantity="distributedForce" resetKey={`${selectionKey}:qy-end`} onCommit={(value) => updateMemberLoad('qyEnd', value)} />
        </> : null}
        {selectedMemberLoad.type === 'point' ? <>
          <InspectorNumericField label={t('inspector.position')} value={selectedMemberLoad.position ?? 0.5} unit="x/L" resetKey={`${selectionKey}:position`} language={language} validate={normalizedPosition} onCommit={(value) => updateMemberLoad('position', Math.max(0, Math.min(1, value)))} />
          <PhysicalNumberField label={t('inspector.forceX')} value={selectedMemberLoad.px ?? 0} units={units} quantity="force" resetKey={`${selectionKey}:px`} onCommit={(value) => updateMemberLoad('px', value)} />
          <PhysicalNumberField label={t('inspector.forceY')} value={selectedMemberLoad.py ?? 0} units={units} quantity="force" resetKey={`${selectionKey}:py`} onCommit={(value) => updateMemberLoad('py', value)} />
        </> : null}
        {selectedMemberLoad.type === 'moment' ? <>
          <InspectorNumericField label={t('inspector.position')} value={selectedMemberLoad.position ?? 0.5} unit="x/L" resetKey={`${selectionKey}:position`} language={language} validate={normalizedPosition} onCommit={(value) => updateMemberLoad('position', Math.max(0, Math.min(1, value)))} />
          <PhysicalNumberField label="M" value={selectedMemberLoad.moment ?? 0} units={units} quantity="moment" resetKey={`${selectionKey}:moment`} onCommit={(value) => updateMemberLoad('moment', value)} />
        </> : null}
      </InspectorPropertyGroup>
      <InspectorPropertyGroup title={t('inspector.derivedValues')} mode="derived"><InspectorDerivedList rows={[{ label: 'ID', value: selectedMemberLoad.id }, { label: t('inspector.member'), value: selectedMemberLoad.memberId }]} /></InspectorPropertyGroup>
      <InspectorAdvancedProperties id="advanced-member-load" expanded={expandedSections} onExpandedChange={setExpandedSections}>
        <InspectorPropertyGroup title={t('inspector.interpretation')} description={t('inspector.loadGeometryConvention')}>
          <InspectorHelper tone="warning">{t('inspector.loadBasisConversionHelp')}</InspectorHelper>
        </InspectorPropertyGroup>
      </InspectorAdvancedProperties>
      <InspectorIssues issues={selectedIssues} />
      <button type="button" className="danger-button" onClick={() => deleteLoad('member', selectedMemberLoad.id)}><Trash2 size={16} /> {t('inspector.deleteLoad')}</button>
    </> : null}
  </div>;
};
