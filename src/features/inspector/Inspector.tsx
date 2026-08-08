import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ChevronRight, CircleHelp, MoveDown, Plus, RotateCcw, Sigma, X } from 'lucide-react';
import { fromDisplay, toDisplay, unitLabel, type UnitQuantity } from '../../engine/units';
import { useI18n } from '../../i18n/useI18n';
import { useProject } from '../../store/ProjectContext';
import type { Tool } from '../../types';
import { InspectorNumericField } from './InspectorNumericField';
import { InspectorProperties } from './InspectorProperties';
import { MAX_INSPECTOR_WIDTH, MIN_INSPECTOR_WIDTH, clampInspectorWidth } from '../workspace/useWorkspaceLayoutPreferences';

const NumberField = ({
  label,
  value,
  unit,
  step = 'any',
  resetKey = label,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  unit?: string;
  step?: string;
  resetKey?: string;
  hint?: string;
  onChange: (value: number) => void;
}) => {
  const { language } = useI18n();
  return (
    <InspectorNumericField
      label={label}
      value={value}
      unit={unit}
      step={step}
      resetKey={resetKey}
      hint={hint}
      language={language}
      onCommit={onChange}
    />
  );
};

const Segmented = ({ value, options, onChange }: { value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) => (
  <div className="segmented-control" role="group">
    {options.map((option) => <button type="button" key={option.value} aria-pressed={value === option.value} className={value === option.value ? 'active' : ''} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>
);

const focusableSelector = [
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  'a[href]:not([tabindex="-1"])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const getFocusableElements = (panel: HTMLElement | null) => [
  ...(panel?.querySelectorAll<HTMLElement>(focusableSelector) ?? []),
].filter((element) => {
  if (element.closest('[hidden], [aria-hidden="true"], [inert]')) return false;
  const closedDetails = element.closest('details:not([open])');
  return !closedDetails || element.tagName === 'SUMMARY';
});

export const Inspector = ({
  className = '',
  desktopWidth = 320,
  modal = false,
  onClose,
  onDesktopWidthChange,
}: {
  className?: string;
  desktopWidth?: number;
  modal?: boolean;
  onClose?: () => void;
  onDesktopWidthChange?: (width: number) => void;
}) => {
  const { selection, activeTool, setActiveTool, selectedCombinationId, setSelectedCombinationId } = useProject();
  const { t } = useI18n();
  const [tab, setTab] = useState<'inspector' | 'loads' | 'display'>('inspector');
  const panelRef = useRef<HTMLElement>(null);
  const [resizeOrigin, setResizeOrigin] = useState<{ clientX: number; width: number } | null>(null);

  useEffect(() => {
    if (selection) setTab('inspector');
  }, [selection]);

  useEffect(() => {
    if (!modal) return undefined;
    const panel = panelRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => getFocusableElements(panel)[0]?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = getFocusableElements(panel);
      if (focusable.length === 0) {
        event.preventDefault();
        panel?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [modal, onClose]);

  const chooseLoadTool = (tool: Extract<Tool, 'pointLoad' | 'distributedLoad' | 'moment'>) => {
    setActiveTool(tool);
    onClose?.();
  };

  const resizeFromPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!resizeOrigin || !onDesktopWidthChange) return;
    onDesktopWidthChange(clampInspectorWidth(resizeOrigin.width + resizeOrigin.clientX - event.clientX));
  };

  const resizeFromKeyboard = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!onDesktopWidthChange) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      onDesktopWidthChange(clampInspectorWidth(desktopWidth + (event.shiftKey ? 48 : 16)));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      onDesktopWidthChange(clampInspectorWidth(desktopWidth - (event.shiftKey ? 48 : 16)));
    } else if (event.key === 'Home') {
      event.preventDefault();
      onDesktopWidthChange(MIN_INSPECTOR_WIDTH);
    } else if (event.key === 'End') {
      event.preventDefault();
      onDesktopWidthChange(MAX_INSPECTOR_WIDTH);
    }
  };

  const inspectorTabs = ['inspector', 'loads', 'display'] as const;
  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + inspectorTabs.length) % inspectorTabs.length;
    else if (event.key === 'ArrowRight') nextIndex = (index + 1) % inspectorTabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = inspectorTabs.length - 1;
    else return;
    event.preventDefault();
    const next = inspectorTabs[nextIndex];
    setTab(next);
    panelRef.current?.querySelector<HTMLButtonElement>(`#inspector-tab-${next}`)?.focus();
  };

  return (
    <aside
      ref={panelRef}
      id="workspace-inspector"
      className={`inspector-panel ${className}`.trim()}
      role={modal ? 'dialog' : 'complementary'}
      aria-modal={modal || undefined}
      aria-label={t('inspector.tab')}
      tabIndex={modal ? -1 : undefined}
    >
      {!modal && onDesktopWidthChange ? <button
        type="button"
        className="inspector-resize-handle"
        role="separator"
        aria-label={t('inspector.resize')}
        aria-orientation="vertical"
        aria-valuemin={MIN_INSPECTOR_WIDTH}
        aria-valuemax={MAX_INSPECTOR_WIDTH}
        aria-valuenow={desktopWidth}
        onKeyDown={resizeFromKeyboard}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setResizeOrigin({ clientX: event.clientX, width: desktopWidth });
        }}
        onPointerMove={resizeFromPointer}
        onPointerUp={() => setResizeOrigin(null)}
        onPointerCancel={() => setResizeOrigin(null)}
      /> : null}
      <div className="inspector-tabs" role="tablist" aria-label={t('inspector.tab')}>
        <button id="inspector-tab-inspector" type="button" role="tab" aria-controls="inspector-tabpanel" aria-selected={tab === 'inspector'} tabIndex={tab === 'inspector' ? 0 : -1} className={tab === 'inspector' ? 'active' : ''} onClick={() => setTab('inspector')} onKeyDown={(event) => onTabKeyDown(event, 0)}>{t('inspector.tab')}</button>
        <button id="inspector-tab-loads" type="button" role="tab" aria-controls="inspector-tabpanel" aria-selected={tab === 'loads'} tabIndex={tab === 'loads' ? 0 : -1} className={tab === 'loads' ? 'active' : ''} onClick={() => setTab('loads')} onKeyDown={(event) => onTabKeyDown(event, 1)}>{t('inspector.loadsTab')}</button>
        <button id="inspector-tab-display" type="button" role="tab" aria-controls="inspector-tabpanel" aria-selected={tab === 'display'} tabIndex={tab === 'display' ? 0 : -1} className={tab === 'display' ? 'active' : ''} onClick={() => setTab('display')} onKeyDown={(event) => onTabKeyDown(event, 2)}>{t('inspector.viewTab')}</button>
        <button type="button" className="mobile-inspector-close" aria-label={t('inspector.close')} onClick={onClose}><X size={18} /></button>
      </div>

      <div id="inspector-tabpanel" className="inspector-scroll" role="tabpanel" aria-labelledby={`inspector-tab-${tab}`}>
        {tab === 'inspector' ? <InspectorProperties /> : null}
        {tab === 'loads' ? <LoadsPanel activeTool={activeTool} onChooseTool={chooseLoadTool} selectedCombinationId={selectedCombinationId} setSelectedCombinationId={setSelectedCombinationId} /> : null}
        {tab === 'display' ? <DisplayPanel /> : null}
      </div>
    </aside>
  );
};

const LoadsPanel = ({ activeTool, onChooseTool, selectedCombinationId, setSelectedCombinationId }: {
  activeTool: Tool;
  onChooseTool: (tool: Extract<Tool, 'pointLoad' | 'distributedLoad' | 'moment'>) => void;
  selectedCombinationId: string;
  setSelectedCombinationId: (id: string) => void;
}) => {
  const { project, updateProject } = useProject();
  const { t } = useI18n();
  const loadToolOptions: Array<{ tool: Extract<Tool, 'pointLoad' | 'distributedLoad' | 'moment'>; label: string; detail: string; icon: typeof MoveDown }> = [
    { tool: 'pointLoad', label: t('inspector.point'), detail: t('toolbar.pointLoadDetail'), icon: MoveDown },
    { tool: 'distributedLoad', label: t('inspector.distributed'), detail: t('toolbar.distributedLoadDetail'), icon: Sigma },
    { tool: 'moment', label: t('results.moment'), detail: t('toolbar.momentDetail'), icon: RotateCcw },
  ];
  return <>
    <section className="inspector-section load-starter">
      <h3>{t('inspector.addLoadTitle')}</h3>
      <p>{t('inspector.addLoadDescription')}</p>
      <div className="load-tool-grid">
        {loadToolOptions.map(({ tool, label, detail, icon: Icon }) => <button type="button" key={tool} aria-pressed={activeTool === tool} className={`tool-${tool}${activeTool === tool ? ' active' : ''}`} onClick={() => onChooseTool(tool)}><Icon size={18} /><strong>{label}</strong><small>{detail}</small></button>)}
      </div>
    </section>
    <section className="inspector-section">
      <div className="section-heading"><h3>{t('inspector.loadCases')}</h3><button type="button" className="mini-button" aria-label={t('inspector.addLoadCase')} onClick={() => updateProject((draft) => {
        let index = 1;
        while (draft.loadCases.some((item) => item.id === `LC${index}`)) index += 1;
        const id = `LC${index}`;
        draft.loadCases.push({ id, name: t('inspector.defaultLoadCaseName', { index }), category: 'other', active: true });
        return draft;
      })}><Plus size={15} /></button></div>
      <div className="load-case-list">{project.loadCases.map((loadCase) => <div className="load-case-row" key={loadCase.id}>
        <input aria-label={t('inspector.activateLoadCase', { name: loadCase.name })} type="checkbox" checked={loadCase.active} onChange={(event) => updateProject((draft) => {
          const item = draft.loadCases.find((candidate) => candidate.id === loadCase.id);
          if (item) item.active = event.target.checked;
          return draft;
        })} />
        <div><input aria-label={t('inspector.loadCaseName', { id: loadCase.id })} value={loadCase.name} onChange={(event) => updateProject((draft) => {
          const item = draft.loadCases.find((candidate) => candidate.id === loadCase.id);
          if (item) item.name = event.target.value;
          return draft;
        })} /><small>{loadCase.category}</small></div>
        <ChevronRight size={15} aria-hidden="true" />
      </div>)}</div>
    </section>
    <section className="inspector-section">
      <div className="section-heading"><h3>{t('inspector.combinations')}</h3><button type="button" className="mini-button" aria-label={t('inspector.addCombination')} onClick={() => updateProject((draft) => {
        let index = 1;
        while (draft.combinations.some((item) => item.id === `COMB${index}`)) index += 1;
        const id = `COMB${index}`;
        draft.combinations.push({ id, name: t('inspector.defaultCombinationName', { index }), factors: Object.fromEntries(draft.loadCases.map((item) => [item.id, 1])) });
        return draft;
      })}><Plus size={15} /></button></div>
      <label className="select-field"><span>{t('inspector.analyze')}</span><select value={selectedCombinationId} onChange={(event) => setSelectedCombinationId(event.target.value)}><option value="">{t('analysis.activeCases')}</option>{project.combinations.map((combination) => <option key={combination.id} value={combination.id}>{combination.name}</option>)}</select></label>
      {project.combinations.map((combination) => <details className="combination-card" key={combination.id} open={combination.id === selectedCombinationId}>
        <summary>{combination.name}</summary>
        {project.loadCases.map((loadCase) => <NumberField key={loadCase.id} resetKey={`${combination.id}:${loadCase.id}`} label={loadCase.name} value={combination.factors[loadCase.id] ?? 0} onChange={(value) => updateProject((draft) => {
          const item = draft.combinations.find((candidate) => candidate.id === combination.id);
          if (item) item.factors[loadCase.id] = value;
          return draft;
        })} />)}
        {combination.source ? <div className="norm-source"><strong>{combination.jurisdiction} · {combination.edition}</strong><span>{combination.source}</span><small>{t('inspector.editableTemplateNote')}</small></div> : null}
      </details>)}
    </section>
    <div className="inspector-note"><CircleHelp size={17} /> {t('inspector.fullEffectsNote')}</div>
  </>;
};

const DisplayPanel = () => {
  const { project, updateProjectView } = useProject();
  const { t } = useI18n();
  const units = project.settings.units;
  const display = (value: number, quantity: UnitQuantity) => toDisplay(value, units, quantity);
  const base = (value: number, quantity: UnitQuantity) => fromDisplay(value, units, quantity);
  const setSetting = (key: keyof typeof project.settings, value: unknown) => updateProjectView((draft) => ({ ...draft, settings: { ...draft.settings, [key]: value } }));
  return <>
    <section className="inspector-section calculation-mode-section">
      <h3>{t('inspector.calculationExperience')}</h3>
      <Segmented value={project.settings.calculationMode ?? 'complete'} options={[{ value: 'classroom', label: t('analysis.modeClassroom') }, { value: 'complete', label: t('analysis.modeComplete') }]} onChange={(value) => setSetting('calculationMode', value)} />
      {project.settings.calculationMode === 'classroom'
        ? <div className="classroom-mode-card"><strong>{t('inspector.classroomEssentials')}</strong><span>{t('inspector.classroomEssentialsBody')}</span><small>{t('inspector.classroomRigidityWarning')}</small></div>
        : <div className="inspector-note"><CircleHelp size={17} /> {t('inspector.completeModeDescription')}</div>}
    </section>
    <section className="inspector-section">
      <h3>{t('inspector.canvas')}</h3>
      <label className="toggle-row"><span>{t('inspector.grid')}</span><input type="checkbox" checked={project.settings.showGrid} onChange={(event) => setSetting('showGrid', event.target.checked)} /></label>
      <label className="toggle-row"><span>{t('inspector.snap')}</span><input type="checkbox" checked={project.settings.snap} onChange={(event) => setSetting('snap', event.target.checked)} /></label>
      <NumberField label={t('inspector.spacing')} value={display(project.settings.gridSize, 'length')} unit={unitLabel(units, 'length')} resetKey={`grid-size:${units}`} onChange={(value) => setSetting('gridSize', Math.max(1e-6, base(value, 'length')))} />
      <label className="toggle-row"><span>{t('inspector.nodeLabels')}</span><input type="checkbox" checked={project.settings.showNodeLabels} onChange={(event) => setSetting('showNodeLabels', event.target.checked)} /></label>
      <label className="toggle-row"><span>{t('inspector.memberLabels')}</span><input type="checkbox" checked={project.settings.showMemberLabels} onChange={(event) => setSetting('showMemberLabels', event.target.checked)} /></label>
      <label className="toggle-row"><span>{t('inspector.localAxes')}</span><input type="checkbox" checked={project.settings.showLocalAxes} onChange={(event) => setSetting('showLocalAxes', event.target.checked)} /></label>
      <label className="toggle-row"><span>{t('inspector.dimensions')}</span><input type="checkbox" checked={project.settings.showDimensions} onChange={(event) => setSetting('showDimensions', event.target.checked)} /></label>
      <label className="toggle-row"><span>{t('inspector.loadsTab')}</span><input type="checkbox" checked={project.settings.showLoads} onChange={(event) => setSetting('showLoads', event.target.checked)} /></label>
      <label className="toggle-row"><span>{t('inspector.criticalValues')}</span><input type="checkbox" checked={project.settings.showResultValues} onChange={(event) => setSetting('showResultValues', event.target.checked)} /></label>
    </section>
    <section className="inspector-section">
      <h3>{t('inspector.cadPrecision')}</h3>
      <p className="section-description">{t('inspector.cadPrecisionDescription')}</p>
      <div className="compact-toggle-grid">
        <label><input type="checkbox" checked={project.settings.snapTargets?.grid ?? true} onChange={(event) => setSetting('snapTargets', { ...project.settings.snapTargets, grid: event.target.checked })} /><span>{t('inspector.grid')}</span></label>
        <label><input type="checkbox" checked={project.settings.snapTargets?.nodes ?? true} onChange={(event) => setSetting('snapTargets', { ...project.settings.snapTargets, nodes: event.target.checked })} /><span>{t('inspector.nodes')}</span></label>
        <label><input type="checkbox" checked={project.settings.snapTargets?.midpoints ?? true} onChange={(event) => setSetting('snapTargets', { ...project.settings.snapTargets, midpoints: event.target.checked })} /><span>{t('inspector.midpoints')}</span></label>
        <label><input type="checkbox" checked={project.settings.snapTargets?.intersections ?? true} onChange={(event) => setSetting('snapTargets', { ...project.settings.snapTargets, intersections: event.target.checked })} /><span>{t('inspector.intersections')}</span></label>
        <label><input type="checkbox" checked={project.settings.snapTargets?.perpendicular ?? true} onChange={(event) => setSetting('snapTargets', { ...project.settings.snapTargets, perpendicular: event.target.checked })} /><span>{t('inspector.perpendicular')}</span></label>
      </div>
      <small className="field-help">{t('inspector.selectionDragHelp')}</small>
      <div className="filter-chip-row" role="group" aria-label={t('inspector.selectionFilters')}>
        <button type="button" aria-pressed={project.settings.selectionFilter?.nodes ?? true} onClick={() => setSetting('selectionFilter', { ...(project.settings.selectionFilter ?? { nodes: true, members: true, loads: true }), nodes: !(project.settings.selectionFilter?.nodes ?? true) })}>{t('inspector.nodes')}</button>
        <button type="button" aria-pressed={project.settings.selectionFilter?.members ?? true} onClick={() => setSetting('selectionFilter', { ...(project.settings.selectionFilter ?? { nodes: true, members: true, loads: true }), members: !(project.settings.selectionFilter?.members ?? true) })}>{t('inspector.members')}</button>
        <button type="button" aria-pressed={project.settings.selectionFilter?.loads ?? true} onClick={() => setSetting('selectionFilter', { ...(project.settings.selectionFilter ?? { nodes: true, members: true, loads: true }), loads: !(project.settings.selectionFilter?.loads ?? true) })}>{t('inspector.loadsTab')}</button>
      </div>
    </section>
    <section className="inspector-section">
      <h3>{t('inspector.results')}</h3>
      <label className="toggle-row"><span>{t('inspector.resultOverlay')}</span><input type="checkbox" checked={project.settings.showResultOverlay ?? true} onChange={(event) => setSetting('showResultOverlay', event.target.checked)} /></label>
      <Segmented value={project.settings.diagramScaleMode ?? 'common'} options={[{ value: 'common', label: t('inspector.commonScale') }, { value: 'individual', label: t('inspector.perMemberScale') }]} onChange={(value) => setSetting('diagramScaleMode', value)} />
      <NumberField label={t('inspector.visualFactor')} value={project.settings.diagramScale} resetKey="diagram-scale" onChange={(value) => setSetting('diagramScale', Math.max(0.1, value))} />
      <NumberField label={t('inspector.deformedScale')} value={project.settings.deformedScale} resetKey="deformed-scale" onChange={(value) => setSetting('deformedScale', Math.max(1, value))} />
      <Segmented value={project.settings.diagramSide} options={[{ value: 'positive', label: t('inspector.positiveLocalSide') }, { value: 'negative', label: t('inspector.negativeLocalSide') }]} onChange={(value) => setSetting('diagramSide', value)} />
    </section>
    <section className="inspector-section"><h3>{t('inspector.semanticColors')}</h3><div className="legend-list"><span><i className="legend-dot axial" /> {t('inspector.axialForce')}</span><span><i className="legend-dot shear" /> {t('inspector.shearForce')}</span><span><i className="legend-dot moment" /> {t('inspector.bendingMoment')}</span><span><i className="legend-dot force" /> {t('inspector.loadsTab')}</span><span><i className="legend-dot dimension" /> {t('inspector.dimensions')}</span><span><i className="legend-dot axis" /> {t('inspector.axesCuts')}</span></div></section>
  </>;
};
