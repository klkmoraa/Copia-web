import { memo, useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ChevronRight, CircleHelp, MoveDown, Plus, RotateCcw, Sigma, X } from 'lucide-react';
import { fromDisplay, toDisplay, unitLabel, type UnitQuantity } from '../../engine/units';
import { useI18n } from '../../i18n/useI18n';
import { useProjectAnalysis } from '../../store/ProjectAnalysisContext';
import { useProjectModel } from '../../store/ProjectModelContext';
import { useWorkspaceUI } from '../../store/WorkspaceUIContext';
import type { Tool } from '../../types';
import { InspectorNumericField } from './InspectorNumericField';
import { InspectorProperties } from './InspectorProperties';
import { readCanvasViewSettings, withCanvasViewSettings } from '../view/canvasViewSettings';
import { MAX_INSPECTOR_WIDTH, MIN_INSPECTOR_WIDTH, clampInspectorWidth, type InspectorDetent } from '../workspace/useWorkspaceLayoutPreferences';
import type { SurfacePresentation, SurfaceStatus } from '../workspace/surfacePresentation';
import { INSPECTOR_SEGMENTS, INSPECTOR_SEGMENT_LABEL_KEY, type InspectorSegment } from './inspectorSegments';
import { ViewFavoritesPanel } from '../library/ViewFavoritesPanel';

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

type InspectorProps = {
  className?: string;
  desktopWidth?: number;
  presentation?: Extract<SurfacePresentation, 'dock' | 'inset' | 'sheet'>;
  status?: SurfaceStatus;
  onClose?: () => void;
  onDesktopWidthChange?: (width: number) => void;
  mobileDetent?: InspectorDetent;
  onMobileDetentChange?: (detent: InspectorDetent) => void;
  /**
   * Segmento visible. Workspace lo gobierna para que un comando pueda abrir el
   * panel directamente donde el usuario pidio; sin `segment` el panel se
   * gobierna solo, que es como lo usan las pruebas y el laboratorio.
   */
  segment?: InspectorSegment;
  onSegmentChange?: (segment: InspectorSegment) => void;
};

/**
 * Unico suscriptor de la seleccion dentro del panel. Renderiza `null`.
 *
 * Con tres superficies, la independencia de Cargas y Vista frente a la
 * seleccion la daba montar dos copias memoizadas del panel
 * (`SelectionIndependentInspector`). Con un solo panel esa suscripcion tiene
 * que bajar hasta donde de verdad se usa: aqui, una hoja que no pinta nada y
 * cuyo unico efecto es traer el foco al segmento de detalle. El cuerpo del
 * panel no lee la seleccion —`InspectorProperties` la lee por su cuenta—, asi
 * que seleccionar en el lienzo ya no re-renderiza Cargas ni Vista.
 */
const SelectionSegmentSync = ({ onSelected }: { onSelected: () => void }) => {
  const { selection } = useWorkspaceUI();
  useEffect(() => {
    if (selection) onSelected();
  }, [onSelected, selection]);
  return null;
};

export const Inspector = ({
  className = '',
  desktopWidth = 320,
  presentation = 'dock',
  status = 'active',
  onClose,
  onDesktopWidthChange,
  mobileDetent = 'medium',
  onMobileDetentChange,
  segment,
  onSegmentChange,
}: InspectorProps) => {
  const { t } = useI18n();
  const [ownSegment, setOwnSegment] = useState<InspectorSegment>('detail');
  const panelRef = useRef<HTMLElement>(null);
  const sheet = presentation === 'sheet';
  const [resizeOrigin, setResizeOrigin] = useState<{ clientX: number; width: number } | null>(null);

  const activeSegment = segment ?? ownSegment;
  const setSegment = useCallback((next: InspectorSegment) => {
    setOwnSegment(next);
    onSegmentChange?.(next);
  }, [onSegmentChange]);
  const focusDetail = useCallback(() => setSegment('detail'), [setSegment]);

  /**
   * Un segmento visitado se queda montado y se oculta con `hidden`, no se
   * desmonta. Cargas tiene borradores numericos sin publicar —los factores de
   * una combinacion— y Vista no tiene ninguno, pero la regla es la misma para
   * los tres: cambiar de segmento no puede tirar lo que el usuario estaba
   * escribiendo. Montarlos los tres de entrada costaria render en cada apertura
   * del panel; montar solo el visitado y conservarlo cuesta una vez.
   */
  const [visited, setVisited] = useState<ReadonlySet<InspectorSegment>>(() => new Set([activeSegment]));
  useEffect(() => {
    setVisited((current) => (current.has(activeSegment) ? current : new Set([...current, activeSegment])));
  }, [activeSegment]);

  useEffect(() => {
    if (!sheet || status !== 'active') return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== 'Escape') return;
      event.preventDefault();
      onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, sheet, status]);

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

  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + INSPECTOR_SEGMENTS.length) % INSPECTOR_SEGMENTS.length;
    else if (event.key === 'ArrowRight') nextIndex = (index + 1) % INSPECTOR_SEGMENTS.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = INSPECTOR_SEGMENTS.length - 1;
    else return;
    event.preventDefault();
    const next = INSPECTOR_SEGMENTS[nextIndex];
    setSegment(next);
    panelRef.current?.querySelector<HTMLButtonElement>(`#inspector-tab-${next}`)?.focus();
  };

  return (
    <aside
      ref={panelRef}
      id="workspace-detail"
      className={`inspector-panel ${className}`.trim()}
      role={sheet ? 'dialog' : 'complementary'}
      aria-label={t('inspector.tab')}
      tabIndex={sheet ? -1 : undefined}
      data-workspace-surface="detail"
      data-inspector-segment={activeSegment}
      data-surface-presentation={presentation}
      data-surface-status={status}
      hidden={status !== 'active'}
      data-mobile-detent={sheet ? mobileDetent : undefined}
    >
      <SelectionSegmentSync onSelected={focusDetail} />
      {presentation === 'dock' && onDesktopWidthChange ? <button
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
      {sheet && onMobileDetentChange ? <div className="inspector-detent-control" role="group" aria-label={t('inspector.detentGroup')}>
        {(['compact', 'medium', 'large'] as const).map((detent) => <button
          key={detent}
          type="button"
          aria-pressed={mobileDetent === detent}
          onClick={() => onMobileDetentChange(detent)}
        >{detent === 'compact' ? t('inspector.detentCompact') : detent === 'medium' ? t('inspector.detentMedium') : t('inspector.detentLarge')}</button>)}
      </div> : null}
      <div className="inspector-tabs" role="tablist" aria-label={t('inspector.tab')}>
        {INSPECTOR_SEGMENTS.map((id, index) => <button
          key={id}
          id={`inspector-tab-${id}`}
          type="button"
          role="tab"
          aria-controls={`inspector-tabpanel-${id}`}
          aria-selected={activeSegment === id}
          tabIndex={activeSegment === id ? 0 : -1}
          className={activeSegment === id ? 'active' : ''}
          onClick={() => setSegment(id)}
          onKeyDown={(event) => onTabKeyDown(event, index)}
        >{t(INSPECTOR_SEGMENT_LABEL_KEY[id])}</button>)}
        {onClose ? <button type="button" className="mobile-inspector-close" aria-label={t('inspector.close')} onClick={onClose}><X size={18} /></button> : null}
      </div>

      <div className="inspector-scroll">
        {INSPECTOR_SEGMENTS.map((id) => (visited.has(id) ? <div
          key={id}
          id={`inspector-tabpanel-${id}`}
          role="tabpanel"
          aria-labelledby={`inspector-tab-${id}`}
          hidden={activeSegment !== id}
        >
          {id === 'detail' ? <InspectorProperties /> : null}
          {id === 'loads' ? <AnalysisSetupPanel onToolChosen={sheet ? onClose : undefined} /> : null}
          {id === 'view' ? <DisplayPanel includeCalculationMode={false} /> : null}
        </div> : null))}
      </div>
    </aside>
  );
};

const AnalysisModePanel = () => {
  const { project, updateProjectView } = useProjectModel();
  const { t } = useI18n();
  const setCalculationMode = (value: string) => updateProjectView((draft) => ({ ...draft, settings: { ...draft.settings, calculationMode: value as 'classroom' | 'complete' } }));
  return <section className="inspector-section calculation-mode-section">
    <h3>{t('inspector.calculationExperience')}</h3>
    <Segmented value={project.settings.calculationMode ?? 'complete'} options={[{ value: 'classroom', label: t('analysis.modeClassroom') }, { value: 'complete', label: t('analysis.modeComplete') }]} onChange={setCalculationMode} />
    {project.settings.calculationMode === 'classroom'
      ? <div className="classroom-mode-card"><strong>{t('inspector.classroomEssentials')}</strong><span>{t('inspector.classroomEssentialsBody')}</span><small>{t('inspector.classroomRigidityWarning')}</small></div>
      : <div className="inspector-note"><CircleHelp size={16} /> {t('inspector.completeModeDescription')}</div>}
  </section>;
};

/**
 * Cargas es el unico segmento que necesita la herramienta activa, asi que la
 * suscripcion a `useWorkspaceUI` vive aqui y no en el panel: el cuerpo del
 * panel no puede suscribirse sin re-renderizarse entero con cada seleccion.
 */
const AnalysisSetupPanel = memo(({ onToolChosen }: { onToolChosen?: () => void }) => {
  const { activeTool, setActiveTool } = useWorkspaceUI();
  const { selectedCombinationId, setSelectedCombinationId } = useProjectAnalysis();
  const { project, updateProject } = useProjectModel();
  const { t } = useI18n();
  const onChooseTool = (tool: Extract<Tool, 'pointLoad' | 'distributedLoad' | 'moment'>) => {
    setActiveTool(tool);
    onToolChosen?.();
  };
  const loadToolOptions: Array<{ tool: Extract<Tool, 'pointLoad' | 'distributedLoad' | 'moment'>; label: string; detail: string; icon: typeof MoveDown }> = [
    { tool: 'pointLoad', label: t('inspector.point'), detail: t('toolbar.pointLoadDetail'), icon: MoveDown },
    { tool: 'distributedLoad', label: t('inspector.distributed'), detail: t('toolbar.distributedLoadDetail'), icon: Sigma },
    { tool: 'moment', label: t('results.moment'), detail: t('toolbar.momentDetail'), icon: RotateCcw },
  ];
  return <><AnalysisModePanel />
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
      })}><Plus size={16} /></button></div>
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
        <ChevronRight size={16} aria-hidden="true" />
      </div>)}</div>
    </section>
    <section className="inspector-section">
      <div className="section-heading"><h3>{t('inspector.combinations')}</h3><button type="button" className="mini-button" aria-label={t('inspector.addCombination')} onClick={() => updateProject((draft) => {
        let index = 1;
        while (draft.combinations.some((item) => item.id === `COMB${index}`)) index += 1;
        const id = `COMB${index}`;
        draft.combinations.push({ id, name: t('inspector.defaultCombinationName', { index }), factors: Object.fromEntries(draft.loadCases.map((item) => [item.id, 1])) });
        return draft;
      })}><Plus size={16} /></button></div>
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
    <div className="inspector-note"><CircleHelp size={16} /> {t('inspector.fullEffectsNote')}</div>
  </>;
});

const DisplayPanel = memo(({ includeCalculationMode = true }: { includeCalculationMode?: boolean }) => {
  const { project, updateProjectView } = useProjectModel();
  const { language, t } = useI18n();
  const { theme, setTheme } = useWorkspaceUI();
  const units = project.settings.units;
  const view = readCanvasViewSettings(project);
  const display = (value: number, quantity: UnitQuantity) => toDisplay(value, units, quantity);
  const base = (value: number, quantity: UnitQuantity) => fromDisplay(value, units, quantity);
  const setView = (patch: Partial<typeof view>) => updateProjectView((draft) => withCanvasViewSettings(draft, patch));
  return <>
    {includeCalculationMode ? <section className="inspector-section calculation-mode-section">
      <h3>{t('inspector.calculationExperience')}</h3>
      <Segmented value={project.settings.calculationMode ?? 'complete'} options={[{ value: 'classroom', label: t('analysis.modeClassroom') }, { value: 'complete', label: t('analysis.modeComplete') }]} onChange={(value) => updateProjectView((draft) => ({ ...draft, settings: { ...draft.settings, calculationMode: value as 'classroom' | 'complete' } }))} />
      {project.settings.calculationMode === 'classroom'
        ? <div className="classroom-mode-card"><strong>{t('inspector.classroomEssentials')}</strong><span>{t('inspector.classroomEssentialsBody')}</span><small>{t('inspector.classroomRigidityWarning')}</small></div>
        : <div className="inspector-note"><CircleHelp size={16} /> {t('inspector.completeModeDescription')}</div>}
    </section> : null}
    <ViewFavoritesPanel
      language={language}
      units={units}
      theme={theme}
      view={view}
      onApply={(favorite) => {
        setTheme(favorite.theme);
        updateProjectView((draft) => withCanvasViewSettings(draft, favorite.view));
      }}
    />
    <section className="inspector-section">
      <h3>{t('inspector.canvas')}</h3>
      <NumberField label={t('inspector.spacing')} value={display(view.gridSize, 'length')} unit={unitLabel(units, 'length')} resetKey={`grid-size:${units}`} onChange={(value) => setView({ gridSize: Math.max(1e-6, base(value, 'length')) })} />
      <label className="toggle-row"><span>{t('inspector.nodeLabels')}</span><input type="checkbox" checked={view.showNodeLabels} onChange={(event) => setView({ showNodeLabels: event.target.checked })} /></label>
      <label className="toggle-row"><span>{t('inspector.memberLabels')}</span><input type="checkbox" checked={view.showMemberLabels} onChange={(event) => setView({ showMemberLabels: event.target.checked })} /></label>
      <label className="toggle-row"><span>{t('inspector.localAxes')}</span><input type="checkbox" checked={view.showLocalAxes} onChange={(event) => setView({ showLocalAxes: event.target.checked })} /></label>
      <label className="toggle-row"><span>{t('inspector.dimensions')}</span><input type="checkbox" checked={view.showDimensions} onChange={(event) => setView({ showDimensions: event.target.checked })} /></label>
      <label className="toggle-row"><span>{t('inspector.loadsTab')}</span><input type="checkbox" checked={view.showLoads} onChange={(event) => setView({ showLoads: event.target.checked })} /></label>
      <label className="toggle-row"><span>{t('inspector.criticalValues')}</span><input type="checkbox" checked={view.showResultValues} onChange={(event) => setView({ showResultValues: event.target.checked })} /></label>
    </section>
    <section className="inspector-section">
      <h3>{t('inspector.cadPrecision')}</h3>
      <p className="section-description">{t('inspector.cadPrecisionDescription')}</p>
      <div className="compact-toggle-grid">
        <label><input type="checkbox" checked={view.snapTargets.grid} onChange={(event) => setView({ snapTargets: { ...view.snapTargets, grid: event.target.checked } })} /><span>{t('inspector.grid')}</span></label>
        <label><input type="checkbox" checked={view.snapTargets.nodes} onChange={(event) => setView({ snapTargets: { ...view.snapTargets, nodes: event.target.checked } })} /><span>{t('inspector.nodes')}</span></label>
        <label><input type="checkbox" checked={view.snapTargets.midpoints} onChange={(event) => setView({ snapTargets: { ...view.snapTargets, midpoints: event.target.checked } })} /><span>{t('inspector.midpoints')}</span></label>
        <label><input type="checkbox" checked={view.snapTargets.intersections} onChange={(event) => setView({ snapTargets: { ...view.snapTargets, intersections: event.target.checked } })} /><span>{t('inspector.intersections')}</span></label>
        <label><input type="checkbox" checked={view.snapTargets.perpendicular} onChange={(event) => setView({ snapTargets: { ...view.snapTargets, perpendicular: event.target.checked } })} /><span>{t('inspector.perpendicular')}</span></label>
      </div>
      <small className="field-help">{t('inspector.selectionDragHelp')}</small>
      <div className="filter-chip-row" role="group" aria-label={t('inspector.selectionFilters')}>
        <button type="button" aria-pressed={view.selectionFilter.nodes} onClick={() => setView({ selectionFilter: { ...view.selectionFilter, nodes: !view.selectionFilter.nodes } })}>{t('inspector.nodes')}</button>
        <button type="button" aria-pressed={view.selectionFilter.members} onClick={() => setView({ selectionFilter: { ...view.selectionFilter, members: !view.selectionFilter.members } })}>{t('inspector.members')}</button>
        <button type="button" aria-pressed={view.selectionFilter.loads} onClick={() => setView({ selectionFilter: { ...view.selectionFilter, loads: !view.selectionFilter.loads } })}>{t('inspector.loadsTab')}</button>
      </div>
    </section>
    <section className="inspector-section">
      <h3>{t('inspector.results')}</h3>
      <label className="toggle-row"><span>{t('inspector.resultOverlay')}</span><input type="checkbox" checked={view.showResultOverlay} onChange={(event) => setView({ showResultOverlay: event.target.checked })} /></label>
      <Segmented value={view.diagramScaleMode} options={[{ value: 'common', label: t('inspector.commonScale') }, { value: 'individual', label: t('inspector.perMemberScale') }]} onChange={(value) => setView({ diagramScaleMode: value as 'common' | 'individual' })} />
      <NumberField label={t('inspector.visualFactor')} value={view.diagramScale} resetKey="diagram-scale" onChange={(value) => setView({ diagramScale: Math.max(0.1, value) })} />
      <NumberField label={t('inspector.deformedScale')} value={view.deformedScale} resetKey="deformed-scale" onChange={(value) => setView({ deformedScale: Math.max(1, value) })} />
      <Segmented value={view.diagramSide} options={[{ value: 'positive', label: t('inspector.positiveLocalSide') }, { value: 'negative', label: t('inspector.negativeLocalSide') }]} onChange={(value) => setView({ diagramSide: value as 'positive' | 'negative' })} />
    </section>
    <section className="inspector-section"><h3>{t('inspector.semanticColors')}</h3><div className="legend-list"><span><i className="legend-dot axial" /> {t('inspector.axialForce')}</span><span><i className="legend-dot shear" /> {t('inspector.shearForce')}</span><span><i className="legend-dot moment" /> {t('inspector.bendingMoment')}</span><span><i className="legend-dot force" /> {t('inspector.loadsTab')}</span><span><i className="legend-dot dimension" /> {t('inspector.dimensions')}</span><span><i className="legend-dot axis" /> {t('inspector.axesCuts')}</span></div></section>
  </>;
});
