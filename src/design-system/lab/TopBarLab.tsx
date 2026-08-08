import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  Check,
  ChevronDown,
  Circle,
  Download,
  MoreHorizontal,
  Play,
  Redo2,
  Undo2,
} from 'lucide-react';
import { BrandMark } from '../../features/topbar/BrandMark';
import { Button, IconButton, SegmentedControl } from '../components/controls';
import './topBarLab.css';

type Locale = 'es' | 'en';
export type TopBarDirection = 'continuous' | 'layered' | 'compact';

interface TopBarConceptLabProps {
  locale: Locale;
  onEvent?: (message: string) => void;
}

interface LabSelectProps {
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onValueChange: (value: string, label: string) => void;
  prefix?: ReactNode;
  overflow?: boolean;
}

const topbarCopy = {
  es: {
    directionPicker: 'Dirección de TopBar',
    continuous: 'Mesa continua',
    layered: 'Instrumentación estratificada',
    compact: 'Comando compacto',
    continuousSummary: 'Una línea serena con tres zonas estables y separación por superficie.',
    layeredSummary: 'Contexto técnico siempre legible en una segunda banda instrumental.',
    compactSummary: 'Mayor área para el canvas mediante controles densos y jerarquía de comando.',
    recommended: 'Recomendada',
    preview: 'Vista previa de TopBar',
    demoLegend: 'Datos y acciones de demostración. No conectan con el proyecto ni con el motor estructural.',
    projectName: 'Pórtico de ejemplo',
    home: 'Ir al inicio',
    openProjects: 'Abrir proyectos y ejemplos',
    local: 'Local',
    storageDetail: 'Guardado localmente',
    caseLabel: 'Caso o combinación',
    activeCases: 'Casos activos',
    combination: 'Combinación LC-01',
    modeLabel: 'Modo de análisis',
    complete: 'Completo',
    classroom: 'Aula',
    units: 'Unidades',
    undo: 'Deshacer',
    redo: 'Rehacer',
    analysisStatus: 'Estado del análisis',
    ready: 'Listo',
    readyDetail: 'Modelo listo para analizar',
    export: 'Exportar',
    more: 'Más acciones',
    analyze: 'Analizar',
    context: 'Contexto técnico',
    document: 'Documento',
    actions: 'Acciones globales',
    close: 'Cerrar menú',
    visualContext: 'Área de trabajo productiva preservada',
    visualContextDetail: 'La exploración modifica únicamente el chrome superior del laboratorio.',
    eventDirection: 'TopBar',
    eventProject: 'Proyectos y ejemplos',
    eventHome: 'Inicio',
    eventStorage: 'Estado de guardado',
    eventAnalysisStatus: 'Estado de análisis',
  },
  en: {
    directionPicker: 'TopBar direction',
    continuous: 'Continuous desk',
    layered: 'Layered instrumentation',
    compact: 'Compact command',
    continuousSummary: 'A calm single row with three stable zones separated by surface.',
    layeredSummary: 'Technical context remains legible in a second instrument strip.',
    compactSummary: 'More canvas space through dense controls and command hierarchy.',
    recommended: 'Recommended',
    preview: 'TopBar preview',
    demoLegend: 'Demonstration data and actions. They do not connect to the project or structural engine.',
    projectName: 'Example portal frame',
    home: 'Go home',
    openProjects: 'Open projects and examples',
    local: 'Local',
    storageDetail: 'Saved locally',
    caseLabel: 'Case or combination',
    activeCases: 'Active cases',
    combination: 'Combination LC-01',
    modeLabel: 'Analysis mode',
    complete: 'Complete',
    classroom: 'Classroom',
    units: 'Units',
    undo: 'Undo',
    redo: 'Redo',
    analysisStatus: 'Analysis status',
    ready: 'Ready',
    readyDetail: 'Model ready to analyze',
    export: 'Export',
    more: 'More actions',
    analyze: 'Analyze',
    context: 'Technical context',
    document: 'Document',
    actions: 'Global actions',
    close: 'Close menu',
    visualContext: 'Production workspace preserved',
    visualContextDetail: 'This exploration changes only the laboratory top chrome.',
    eventDirection: 'TopBar',
    eventProject: 'Projects and examples',
    eventHome: 'Home',
    eventStorage: 'Save status',
    eventAnalysisStatus: 'Analysis status',
  },
} as const;

const directionKeys = [
  { value: 'continuous', labelKey: 'continuous' },
  { value: 'layered', labelKey: 'layered' },
  { value: 'compact', labelKey: 'compact' },
] as const;

const LabSelect = ({ label, value, options, onValueChange, prefix, overflow = false }: LabSelectProps) => (
  <label className={`topbar-lab__field${overflow ? ' topbar-lab__field--overflow' : ''}`}>
    <span className="topbar-lab__field-label">{label}</span>
    <span className="topbar-lab__field-control">
      {prefix ? <span className="topbar-lab__field-prefix" aria-hidden="true">{prefix}</span> : null}
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onValueChange(event.target.value, event.target.selectedOptions[0]?.text ?? event.target.value)}
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <ChevronDown size={14} aria-hidden="true" />
    </span>
  </label>
);

export function TopBarConceptLab({ locale, onEvent }: TopBarConceptLabProps) {
  const t = topbarCopy[locale];
  const [direction, setDirection] = useState<TopBarDirection>('continuous');
  const [caseValue, setCaseValue] = useState('active');
  const [mode, setMode] = useState('complete');
  const [units, setUnits] = useState('kN-m');
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowButtonRef = useRef<HTMLButtonElement>(null);

  const emit = (message: string) => onEvent?.(message);
  const directionLabel = directionKeys.find((item) => item.value === direction)?.labelKey ?? 'continuous';
  const summary = direction === 'continuous'
    ? t.continuousSummary
    : direction === 'layered'
      ? t.layeredSummary
      : t.compactSummary;

  const caseOptions = [
    { value: 'active', label: t.activeCases },
    { value: 'combination', label: t.combination },
  ];
  const modeOptions = [
    { value: 'complete', label: t.complete },
    { value: 'classroom', label: t.classroom },
  ];
  const unitOptions = [
    { value: 'kN-m', label: 'kN · m' },
    { value: 'N-mm', label: 'N · mm' },
    { value: 'kgf-m', label: 'kgf · m' },
    { value: 'kip-ft', label: 'kip · ft' },
  ];

  const setContextValue = (
    setter: (value: string) => void,
    label: string,
    value: string,
    selectedLabel: string,
  ) => {
    setter(value);
    emit(`${label}: ${selectedLabel}`);
  };

  const closeOverflow = () => {
    setOverflowOpen(false);
    window.requestAnimationFrame(() => overflowButtonRef.current?.focus());
  };

  const handleOverflowKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    closeOverflow();
  };

  return <div className="topbar-concepts">
    <div className="topbar-concepts__controls">
      <SegmentedControl
        label={t.directionPicker}
        value={direction}
        options={directionKeys.map((item) => ({ value: item.value, label: t[item.labelKey] }))}
        onValueChange={(value) => {
          const next = value as TopBarDirection;
          setDirection(next);
          const nextLabel = directionKeys.find((item) => item.value === next)?.labelKey ?? 'continuous';
          emit(`${t.eventDirection}: ${t[nextLabel]}`);
        }}
      />
      <div className="topbar-concepts__summary" aria-live="polite">
        <span>{t[directionLabel]}{direction === 'continuous' ? ` · ${t.recommended}` : ''}</span>
        <p>{summary}</p>
      </div>
    </div>

    <p className="topbar-concepts__legend">{t.demoLegend}</p>

    <section
      className="topbar-lab__viewport"
      role="region"
      aria-label={t.preview}
      data-direction={direction}
    >
      <header className={`topbar-lab topbar-lab--${direction}`}>
        <div className="topbar-lab__document topbar-lab__zone" role="group" aria-label={t.document}>
          <IconButton className="topbar-lab__brand-button" label={t.home} onClick={() => emit(t.eventHome)}>
            <BrandMark size={32} />
          </IconButton>
          <span className="topbar-lab__divider" aria-hidden="true" />
          <div className="topbar-lab__identity">
            <span className="topbar-lab__brand-name">structureCo</span>
            <button className="topbar-lab__project" type="button" aria-label={t.openProjects} onClick={() => emit(t.eventProject)}>
              <strong>{t.projectName}</strong><ChevronDown size={15} aria-hidden="true" />
            </button>
          </div>
          <button className="topbar-lab__storage" type="button" aria-label={`${t.local}. ${t.storageDetail}`} onClick={() => emit(t.eventStorage)}>
            <Check size={14} aria-hidden="true" /><span>{t.local}</span>
          </button>
        </div>

        <div className="topbar-lab__context topbar-lab__zone" role="group" aria-label={t.context}>
          <LabSelect
            label={t.caseLabel}
            value={caseValue}
            options={caseOptions}
            onValueChange={(value, selectedLabel) => setContextValue(setCaseValue, t.caseLabel, value, selectedLabel)}
          />
          <LabSelect
            label={t.modeLabel}
            value={mode}
            options={modeOptions}
            onValueChange={(value, selectedLabel) => setContextValue(setMode, t.modeLabel, value, selectedLabel)}
          />
          <LabSelect
            label={t.units}
            value={units}
            options={unitOptions}
            onValueChange={(value, selectedLabel) => setContextValue(setUnits, t.units, value, selectedLabel)}
          />
        </div>

        <div className="topbar-lab__actions topbar-lab__zone" role="group" aria-label={t.actions}>
          <div className="topbar-lab__history" role="group" aria-label={t.undo}>
            <IconButton label={t.undo} onClick={() => emit(t.undo)}><Undo2 size={18} /></IconButton>
            <IconButton label={t.redo} onClick={() => emit(t.redo)}><Redo2 size={18} /></IconButton>
          </div>
          <button
            className="topbar-lab__analysis-status"
            type="button"
            aria-label={`${t.analysisStatus}: ${t.ready}`}
            onClick={() => emit(t.eventAnalysisStatus)}
          >
            <Circle size={16} aria-hidden="true" />
            <span><strong>{t.ready}</strong><small>{t.readyDetail}</small></span>
          </button>
          <IconButton className="topbar-lab__export" label={t.export} onClick={() => emit(t.export)}><Download size={18} /></IconButton>
          <div className="topbar-lab__overflow" onKeyDown={handleOverflowKeyDown}>
            <IconButton
              ref={overflowButtonRef}
              className="topbar-lab__more"
              label={t.more}
              aria-haspopup="dialog"
              aria-expanded={overflowOpen}
              onClick={() => setOverflowOpen((open) => !open)}
            ><MoreHorizontal size={19} /></IconButton>
            {overflowOpen ? <div className="topbar-lab__overflow-menu" role="dialog" aria-label={t.more}>
              <div className="topbar-lab__overflow-context">
                <LabSelect
                  overflow
                  label={t.caseLabel}
                  value={caseValue}
                  options={caseOptions}
                  onValueChange={(value, selectedLabel) => setContextValue(setCaseValue, t.caseLabel, value, selectedLabel)}
                />
                <LabSelect
                  overflow
                  label={t.modeLabel}
                  value={mode}
                  options={modeOptions}
                  onValueChange={(value, selectedLabel) => setContextValue(setMode, t.modeLabel, value, selectedLabel)}
                />
                <LabSelect
                  overflow
                  label={t.units}
                  value={units}
                  options={unitOptions}
                  onValueChange={(value, selectedLabel) => setContextValue(setUnits, t.units, value, selectedLabel)}
                />
              </div>
              <button type="button" onClick={() => emit(t.undo)}><Undo2 size={16} />{t.undo}</button>
              <button type="button" onClick={() => emit(t.redo)}><Redo2 size={16} />{t.redo}</button>
              <button type="button" onClick={() => emit(t.export)}><Download size={16} />{t.export}</button>
              <button type="button" onClick={closeOverflow}>{t.close}</button>
            </div> : null}
          </div>
          <Button className="topbar-lab__analyze" variant="primary" size="touch" aria-label={t.analyze} leadingIcon={<Play size={17} fill="currentColor" />} onClick={() => emit(t.analyze)}>
            {t.analyze}
          </Button>
        </div>
      </header>

      <div className="topbar-lab__workspace-context" aria-hidden="true">
        <span className="topbar-lab__workspace-axis" />
        <div><strong>{t.visualContext}</strong><small>{t.visualContextDetail}</small></div>
      </div>
    </section>
  </div>;
}
