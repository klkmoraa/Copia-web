import { useEffect, useState, type ReactNode } from 'react';
import {
  BarChart3,
  BoxSelect,
  CircleDot,
  Component,
  Crosshair,
  Eye,
  Gauge,
  Grid3X3,
  MousePointer2,
  PanelRightOpen,
  Plus,
  Ruler,
  Save,
  Sparkles,
  Trash2,
  Triangle,
  Waves,
} from 'lucide-react';
import { Button, Field, IconButton, SegmentedControl, Select } from '../components/controls';
import { Accordion, Tabs } from '../components/disclosure';
import {
  LayerToggle,
  NumericValue,
  PanelHeader,
  PropertyRow,
  ResultMetric,
  StatusStrip,
  ToolButton,
  ToolGroup,
  UnitField,
} from '../components/editor';
import { Badge, Banner, Divider, EmptyState, Spinner } from '../components/feedback';
import { Dialog, Drawer, Popover, Tooltip } from '../components/overlays';
import { Surface, type SurfaceLevel } from '../components/surface';
import { TopBarConceptLab } from './TopBarLab';
import '../components/ui.css';
import './componentLab.css';

type Theme = 'light' | 'dark';
type Locale = 'es' | 'en';

const copy = {
  es: {
    language: 'Idioma', theme: 'Tema', light: 'Claro', dark: 'Oscuro',
    official: 'Oficial · Brandbook',
    eyebrow: 'Biblioteca visual · Fase 5', title: 'Component Lab',
    intro: 'Primitivos y patrones del editor probados de forma aislada. Esta ruta solo existe en desarrollo y no conecta con el motor de cálculo.',
    ready: 'Biblioteca lista para inspección', readyDetail: 'Estados, temas, teclado y vista móvil disponibles en una sola superficie.',
    foundations: 'Fundamentos cromáticos', foundationsNote: 'Roles semánticos aplicados a los mismos componentes, datos y estados en Día y Noche.',
    typographyTitle: 'Tipografía estructural', typographyNote: 'Una voz editorial, una interfaz de trabajo y una lectura monoespaciada para valores, unidades e IDs.', typographyEditorial: 'Editorial', typographyInterface: 'Interfaz', typographyTechnical: 'Dato técnico',
    loadIdentityTitle: 'Acción aplicada · respuesta estructural', loadIdentityNote: 'Las cargas usan identidad propia y sólida; los resultados conservan N, V, M, deformada y Aula sin depender sólo del color.', loadPoint: 'P · Carga puntual', loadDistributed: 'q · Carga distribuida', loadAppliedMoment: 'Mₐ · Momento aplicado', responseIdentity: 'N · V · M · δ · Aula',
    motionPolicyTitle: 'Movimiento físico y accesible', motionPolicyNote: 'En modo normal, elevar, presionar y superponer se sienten con movimiento visible. Cuando el sistema activa prefers-reduced-motion, se retiran desplazamiento y escala, pero el estado conserva borde, color y profundidad.',
    foundationRoles: 'Mapa semántico', foundationLegend: 'Datos visuales de demostración. No corresponden a un análisis estructural.',
    foundationCurrent: 'Autoridad activa',
    materialLevels: 'Materia · 6 niveles', materialLevelsNote: 'BASE mantiene el dato técnico plano; INSET, RAISED, FLOATING, SHEET y MODAL declaran una relación física distinta.', materialBase: 'Datos técnicos', materialSheet: 'Entra por borde', materialModal: 'Interrupción', materialSurface: 'Materia',
    radiusRoles: 'Radios por rol · V-05', radiusRolesNote: 'La escala del Brandbook: dato 0 · control 10 · tarjeta 18 · panel/hoja 24 · modal 28 · pastilla 999. El reparto es por rol, no por tamaño de caja.',
    radiusData: 'Dato', radiusControl: 'Control', radiusCard: 'Tarjeta', radiusPanel: 'Panel / hoja', radiusModal: 'Modal', radiusPill: 'Pastilla',
    depthSizes: 'Profundidad por tamaño · V-04', depthSizesNote: 'Las tres piezas valen lo mismo y dicen lo mismo. Sólo cambia cuánto ocupan: la profundidad describe física, no prestigio.',
    depthSmall: 'Pieza pequeña', depthMedium: 'Tarjeta', depthLarge: 'Panel flotante', depthEqual: 'Misma importancia',
    flatness: 'Planitud técnica · V-02', flatnessNote: 'Tabla, dato y campo numérico no reciben materia clay: sin sombra, sin canto de volumen, sin celdas redondeadas.',
    flatnessTable: 'Extremos por miembro', flatnessMember: 'Miembro', flatnessValue: 'M máx', flatnessUnit: 'kN·m', flatnessField: 'Longitud',
    pressStates: 'Estados del control', pressStatesNote: 'Reposo, hover, foco, pulsado y deshabilitado sobre la misma pieza. Pulsado invierte la luz y no deja sombra exterior; el foco es un anillo aparte del canto.',
    pressRest: 'Reposo', pressHeld: 'Pulsado (mantenido)', pressDisabled: 'Deshabilitado',
    foundationOfficialSummary: 'La paleta oficial: los tokens vivos de tokens.css y su autoridad, brand/brandbook-clay.html. Sin overrides locales.',
    roleApp: 'Fondo de aplicación', roleCanvas: 'Canvas', roleSurface: 'Superficie', roleBrandFill: 'Brand fill', roleBrandStroke: 'Brand stroke', roleBrandInk: 'Brand ink', roleSelection: 'Selección', roleFocus: 'Foco', roleLoad: 'Carga puntual', roleDistributed: 'Carga distribuida', roleAppliedMoment: 'Momento aplicado', roleAxial: 'Axial N', roleShear: 'Cortante V · stroke', roleShearArea: 'Cortante V · tint', roleInfluence: 'Influencia · edge', roleInfluenceArea: 'Influencia · area', roleMoment: 'Momento M', roleSuccess: 'Success', roleWarning: 'Advertencia', roleError: 'Error', roleAula: 'Mentor Aula',
    authorityDemo: 'Autoridad CRI-12C', brandAnatomy: 'Brand fill · stroke · ink', engineeringAnatomy: 'Ingeniería: V · influencia · deformada', interactionAnatomy: 'Focus + selection', themeAnatomy: 'Materia del tema activo', influenceLabel: 'Influencia · siempre dashed', deformedLabel: 'Deformada · siempre continuous',
    controls: 'Controles', controlsNote: 'Acciones, captura de datos y selección compacta.',
    overlays: 'Capas y divulgación', overlaysNote: 'Contenido contextual con cierre por Escape y retorno de foco.',
    feedback: 'Retroalimentación', feedbackNote: 'Estados comprensibles por color, texto e iconografía.',
    editor: 'Patrones del editor', editorNote: 'Componentes de presentación sin conocimiento del modelo estructural.',
    topbar: 'TopBar', topbarNote: 'Tres jerarquías del chrome global con los mismos datos, acciones y rutas responsive.',
    topbarDemo: 'Documento · Contexto · Acciones',
    buttons: 'Botones y estados', fields: 'Campos', primary: 'Guardar cambios', secondary: 'Duplicar', ghost: 'Vista previa', danger: 'Eliminar',
    disabled: 'Deshabilitado', loading: 'Guardando', add: 'Agregar', iconAction: 'Centrar vista',
    memberName: 'Nombre del miembro', memberHint: 'Usa una etiqueta breve y reconocible.', optional: 'Opcional',
    invalidName: 'Etiqueta de ejemplo inválida', required: 'Escribe al menos 3 caracteres.', material: 'Material', steel: 'Acero estructural', concrete: 'Concreto', timber: 'Madera',
    inputMode: 'Modo de captura', select: 'Seleccionar', draw: 'Dibujar', review: 'Revisar',
    tooltip: 'Centrar todos los elementos', popover: 'Preferencias rápidas', density: 'Densidad visual', comfortable: 'Cómoda', compact: 'Compacta',
    openDialog: 'Abrir diálogo', openDrawer: 'Abrir panel', dialogTitle: 'Confirmar actualización',
    dialogDescription: 'El ejemplo conserva el foco dentro de la capa y lo devuelve al control que la abrió.',
    dialogBody: 'Esta acción solo demuestra la interacción del componente; no modifica un proyecto ni ejecuta cálculos.',
    cancel: 'Cancelar', confirm: 'Confirmar', drawerTitle: 'Propiedades del elemento', drawerDescription: 'Panel adaptable para escritorio y móvil.',
    tabsLabel: 'Vistas del ejemplo', properties: 'Propiedades', notes: 'Notas', history: 'Historial',
    tabProperties: 'Los paneles cambian con flechas, Inicio y Fin. El contenido conserva una jerarquía sencilla.',
    longCopy: 'Esta copia deliberadamente extensa comprueba que títulos, descripciones y acciones sigan siendo legibles cuando la interfaz recibe traducciones o explicaciones técnicas más largas de lo habitual.',
    accordionA: '¿Qué pertenece a la biblioteca?', accordionB: '¿Qué queda fuera?',
    accordionAContent: 'Presentación, estados, accesibilidad y contratos de interacción reutilizables.',
    accordionBContent: 'Ecuaciones, ensamblaje, solución, persistencia y reglas propias del dominio estructural.',
    infoTitle: 'Información disponible', warningTitle: 'Resultados desactualizados', errorTitle: 'No fue posible completar la acción',
    infoBody: 'La selección contiene datos editables.', warningBody: 'Vuelve a analizar para sincronizar la vista.', errorBody: 'Revisa los valores marcados e inténtalo nuevamente.',
    dismiss: 'Cerrar aviso', emptyTitle: 'Aún no hay combinaciones', emptyBody: 'Crea una combinación para comparar resultados en esta vista.', create: 'Crear combinación',
    neutral: 'Neutral', success: 'Correcto', warning: 'Atención', error: 'Error', loadingLabel: 'Cargando ejemplo',
    tools: 'Herramientas', navigation: 'Navegación', structure: 'Estructura', loads: 'Cargas', annotation: 'Anotación',
    pointer: 'Seleccionar', node: 'Nodo', member: 'Miembro', support: 'Apoyo', pointLoad: 'Carga puntual', distributed: 'Carga distribuida', moment: 'Momento', dimension: 'Cota', remove: 'Eliminar',
    panelTitle: 'Propiedades', panelDescription: 'Selección: miembro M-04', reset: 'Restablecer', length: 'Longitud', angle: 'Ángulo', activeLayer: 'Capas visibles',
    loadsLayer: 'Cargas', loadsLayerDetail: 'Puntuales y distribuidas', dimensionsLayer: 'Cotas', dimensionsLayerDetail: 'Medidas de referencia',
    metrics: 'Métricas de resultado', axial: 'Axial máximo', shear: 'Cortante máximo', momentMetric: 'Momento máximo', displacement: 'Desplazamiento',
    updated: 'Análisis actualizado', stale: 'Cambios sin analizar', calculating: 'Calculando combinaciones', failed: 'El análisis requiere atención',
    event: 'Última interacción', noEvent: 'Interactúa con cualquier control para verificar su callback.',
    eventSaved: 'Cambios guardados', eventTheme: 'Tema cambiado', eventLanguage: 'Idioma cambiado', eventTool: 'Herramienta activa', eventLayer: 'Visibilidad de capa actualizada', eventValue: 'Valor de longitud actualizado', eventConfirmed: 'Actualización confirmada',
    devOnly: 'Solo desarrollo', close: 'Cerrar', menu: 'Más opciones', skip: 'Saltar al contenido', sectionNav: 'Secciones de componentes', on: 'visible', off: 'oculta', nodeCode: 'Nodo N-06',
  },
  en: {
    language: 'Language', theme: 'Theme', light: 'Light', dark: 'Dark',
    official: 'Official · Brandbook',
    eyebrow: 'Visual library · Phase 5', title: 'Component Lab',
    intro: 'Primitives and editor patterns tested in isolation. This route only exists in development and never connects to the calculation engine.',
    ready: 'Library ready for inspection', readyDetail: 'States, themes, keyboard behavior, and mobile layouts are available in one surface.',
    foundations: 'Color foundations', foundationsNote: 'Semantic roles applied to the same components, data, and states in Day and Night.',
    typographyTitle: 'Structural typography', typographyNote: 'One editorial voice, one working interface, and one monospaced reading for values, units, and IDs.', typographyEditorial: 'Editorial', typographyInterface: 'Interface', typographyTechnical: 'Technical data',
    loadIdentityTitle: 'Applied action · structural response', loadIdentityNote: 'Loads use their own solid identity; results keep N, V, M, deformation, and Classroom without relying on color alone.', loadPoint: 'P · Point load', loadDistributed: 'q · Distributed load', loadAppliedMoment: 'Mₐ · Applied moment', responseIdentity: 'N · V · M · δ · Classroom',
    motionPolicyTitle: 'Physical and accessible motion', motionPolicyNote: 'In normal mode, lift, press, and overlap use visible motion. When the system enables prefers-reduced-motion, translation and scale stop while border, color, and depth keep the state legible.',
    foundationRoles: 'Semantic map', foundationLegend: 'Visual demonstration data. It does not correspond to a structural analysis.',
    foundationCurrent: 'Active authority',
    materialLevels: 'Material · 6 levels', materialLevelsNote: 'BASE keeps technical data flat; INSET, RAISED, FLOATING, SHEET, and MODAL declare distinct physical relationships.', materialBase: 'Technical data', materialSheet: 'Enters from edge', materialModal: 'Interruption', materialSurface: 'Material',
    radiusRoles: 'Radius by role · V-05', radiusRolesNote: 'The Brandbook scale: data 0 · control 10 · card 18 · panel/sheet 24 · modal 28 · pill 999. Assigned by role, not by box size.',
    radiusData: 'Data', radiusControl: 'Control', radiusCard: 'Card', radiusPanel: 'Panel / sheet', radiusModal: 'Modal', radiusPill: 'Pill',
    depthSizes: 'Depth by size · V-04', depthSizesNote: 'All three pieces matter equally and say the same thing. Only their size changes: depth describes physics, not prestige.',
    depthSmall: 'Small piece', depthMedium: 'Card', depthLarge: 'Floating panel', depthEqual: 'Same importance',
    flatness: 'Technical flatness · V-02', flatnessNote: 'Table, datum, and numeric field take no clay material: no shadow, no volume edge, no rounded cells.',
    flatnessTable: 'Member extrema', flatnessMember: 'Member', flatnessValue: 'M max', flatnessUnit: 'kN·m', flatnessField: 'Length',
    pressStates: 'Control states', pressStatesNote: 'Rest, hover, focus, pressed, and disabled on the same piece. Pressed inverts the light and keeps no outer shadow; focus is a ring separate from the edge.',
    pressRest: 'Rest', pressHeld: 'Pressed (held)', pressDisabled: 'Disabled',
    foundationOfficialSummary: 'The official palette: the live tokens in tokens.css and their authority, brand/brandbook-clay.html. No local overrides.',
    roleApp: 'Application background', roleCanvas: 'Canvas', roleSurface: 'Surface', roleBrandFill: 'Brand fill', roleBrandStroke: 'Brand stroke', roleBrandInk: 'Brand ink', roleSelection: 'Selection', roleFocus: 'Focus', roleLoad: 'Point load', roleDistributed: 'Distributed load', roleAppliedMoment: 'Applied moment', roleAxial: 'Axial N', roleShear: 'Shear V · stroke', roleShearArea: 'Shear V · tint', roleInfluence: 'Influence · edge', roleInfluenceArea: 'Influence · area', roleMoment: 'Moment M', roleSuccess: 'Success', roleWarning: 'Warning', roleError: 'Error', roleAula: 'Classroom mentor',
    authorityDemo: 'CRI-12C authority', brandAnatomy: 'Brand fill · stroke · ink', engineeringAnatomy: 'Engineering: V · influence · deformed', interactionAnatomy: 'Focus + selection', themeAnatomy: 'Active theme material', influenceLabel: 'Influence · always dashed', deformedLabel: 'Deformed · always continuous',
    controls: 'Controls', controlsNote: 'Actions, data entry, and compact selection.',
    overlays: 'Layers and disclosure', overlaysNote: 'Contextual content with Escape dismissal and focus restoration.',
    feedback: 'Feedback', feedbackNote: 'States communicated through color, text, and iconography.',
    editor: 'Editor patterns', editorNote: 'Presentation components with no knowledge of the structural model.',
    topbar: 'TopBar', topbarNote: 'Three global chrome hierarchies with the same data, actions, and responsive routes.',
    topbarDemo: 'Document · Context · Actions',
    buttons: 'Buttons and states', fields: 'Fields', primary: 'Save changes', secondary: 'Duplicate', ghost: 'Preview', danger: 'Delete',
    disabled: 'Disabled', loading: 'Saving', add: 'Add', iconAction: 'Center view',
    memberName: 'Member name', memberHint: 'Use a short, recognizable label.', optional: 'Optional',
    invalidName: 'Invalid example label', required: 'Enter at least 3 characters.', material: 'Material', steel: 'Structural steel', concrete: 'Concrete', timber: 'Timber',
    inputMode: 'Input mode', select: 'Select', draw: 'Draw', review: 'Review',
    tooltip: 'Center all elements', popover: 'Quick preferences', density: 'Visual density', comfortable: 'Comfortable', compact: 'Compact',
    openDialog: 'Open dialog', openDrawer: 'Open panel', dialogTitle: 'Confirm update',
    dialogDescription: 'This example traps focus inside the layer and returns it to the control that opened it.',
    dialogBody: 'This action only demonstrates the component interaction; it does not modify a project or run calculations.',
    cancel: 'Cancel', confirm: 'Confirm', drawerTitle: 'Element properties', drawerDescription: 'Responsive panel for desktop and mobile.',
    tabsLabel: 'Example views', properties: 'Properties', notes: 'Notes', history: 'History',
    tabProperties: 'Panels switch with arrow keys, Home, and End. Content keeps a simple hierarchy.',
    longCopy: 'This deliberately long copy verifies that titles, descriptions, and actions remain readable when the interface receives translations or technical explanations that are longer than usual.',
    accordionA: 'What belongs in the library?', accordionB: 'What stays outside?',
    accordionAContent: 'Presentation, states, accessibility, and reusable interaction contracts.',
    accordionBContent: 'Equations, assembly, solving, persistence, and structural-domain rules.',
    infoTitle: 'Information available', warningTitle: 'Results are out of date', errorTitle: 'The action could not be completed',
    infoBody: 'The selection contains editable data.', warningBody: 'Run analysis again to synchronize this view.', errorBody: 'Review the marked values and try again.',
    dismiss: 'Dismiss notice', emptyTitle: 'No combinations yet', emptyBody: 'Create a combination to compare results in this view.', create: 'Create combination',
    neutral: 'Neutral', success: 'Success', warning: 'Warning', error: 'Error', loadingLabel: 'Loading example',
    tools: 'Tools', navigation: 'Navigation', structure: 'Structure', loads: 'Loads', annotation: 'Annotation',
    pointer: 'Select', node: 'Node', member: 'Member', support: 'Support', pointLoad: 'Point load', distributed: 'Distributed load', moment: 'Moment', dimension: 'Dimension', remove: 'Delete',
    panelTitle: 'Properties', panelDescription: 'Selection: member M-04', reset: 'Reset', length: 'Length', angle: 'Angle', activeLayer: 'Visible layers',
    loadsLayer: 'Loads', loadsLayerDetail: 'Point and distributed', dimensionsLayer: 'Dimensions', dimensionsLayerDetail: 'Reference measurements',
    metrics: 'Result metrics', axial: 'Maximum axial', shear: 'Maximum shear', momentMetric: 'Maximum moment', displacement: 'Displacement',
    updated: 'Analysis updated', stale: 'Unanalyzed changes', calculating: 'Calculating combinations', failed: 'Analysis needs attention',
    event: 'Last interaction', noEvent: 'Use any control to verify its callback.',
    eventSaved: 'Changes saved', eventTheme: 'Theme changed', eventLanguage: 'Language changed', eventTool: 'Active tool', eventLayer: 'Layer visibility updated', eventValue: 'Length value updated', eventConfirmed: 'Update confirmed',
    devOnly: 'Development only', close: 'Close', menu: 'More options', skip: 'Skip to content', sectionNav: 'Component sections', on: 'visible', off: 'hidden', nodeCode: 'Node N-06',
  },
} as const;

const FOUNDATION_ROLES = [
  { id: 'app', labelKey: 'roleApp' },
  { id: 'canvas', labelKey: 'roleCanvas' },
  { id: 'surface', labelKey: 'roleSurface' },
  { id: 'brand-fill', labelKey: 'roleBrandFill' },
  { id: 'brand-stroke', labelKey: 'roleBrandStroke' },
  { id: 'brand-ink', labelKey: 'roleBrandInk' },
  { id: 'selection', labelKey: 'roleSelection' },
  { id: 'focus', labelKey: 'roleFocus' },
    { id: 'load', labelKey: 'roleLoad' },
  { id: 'distributed-load', labelKey: 'roleDistributed' },
  { id: 'applied-moment', labelKey: 'roleAppliedMoment' },
  { id: 'axial', labelKey: 'roleAxial' },
  { id: 'shear', labelKey: 'roleShear' },
  { id: 'shear-area', labelKey: 'roleShearArea' },
  { id: 'influence', labelKey: 'roleInfluence' },
  { id: 'influence-area', labelKey: 'roleInfluenceArea' },
  { id: 'moment', labelKey: 'roleMoment' },
  { id: 'success', labelKey: 'roleSuccess' },
  { id: 'warning', labelKey: 'roleWarning' },
  { id: 'error', labelKey: 'roleError' },
  { id: 'aula', labelKey: 'roleAula' },
] as const;

const MATERIAL_LEVELS: SurfaceLevel[] = ['flat', 'inset', 'raised', 'floating', 'sheet', 'modal'];

/**
 * CRI-105 · el reparto de radios por rol (V-05), tal y como lo fija el
 * Brandbook. Cada muestra nombra el token, no un literal: si alguien mueve la
 * escala, esta vitrina se mueve con ella.
 */
const RADIUS_ROLES = [
  { id: 'data', token: '--sc-radius-data', value: '0' },
  { id: 'control', token: '--sc-radius-control', value: '10px' },
  { id: 'card', token: '--sc-radius-card', value: '18px' },
  { id: 'panel', token: '--sc-radius-panel', value: '24px' },
  { id: 'modal', token: '--sc-radius-modal', value: '28px' },
  { id: 'pill', token: '--sc-radius-pill', value: '999px' },
] as const;

/**
 * CRI-105 · la profundidad escala con el TAMAÑO de la pieza, nunca con su
 * importancia. Las tres muestras dicen lo mismo y valen lo mismo: lo único que
 * cambia entre ellas es cuánto ocupan.
 */
const DEPTH_SIZES = [
  { id: 'sm', token: '--sc-shadow-clay-xs', radius: '--sc-radius-control' },
  { id: 'md', token: '--sc-shadow-clay-md', radius: '--sc-radius-card' },
  { id: 'lg', token: '--sc-shadow-clay-lg', radius: '--sc-radius-panel' },
] as const;

interface LabSectionProps {
  id: string;
  title: string;
  note: string;
  children: ReactNode;
}

const LabSection = ({ id, title, note, children }: LabSectionProps) => (
  <section id={id} className="component-lab__section" aria-labelledby={`${id}-title`}>
    <header className="component-lab__section-header">
      <div><span>{id.padStart(2, '0')}</span><h2 id={`${id}-title`}>{title}</h2></div>
      <p>{note}</p>
    </header>
    <div className="component-lab__section-body">{children}</div>
  </section>
);

interface DemoBlockProps {
  title: string;
  wide?: boolean;
  children: ReactNode;
}

const DemoBlock = ({ title, wide = false, children }: DemoBlockProps) => (
  <section className={`component-lab__demo${wide ? ' component-lab__demo--wide' : ''}`}>
    <h3>{title}</h3>
    <div className="component-lab__demo-content">{children}</div>
  </section>
);

export function ComponentLab() {
  const [theme, setTheme] = useState<Theme>('light');
  const [locale, setLocale] = useState<Locale>('es');
  const [eventMessage, setEventMessage] = useState('');
  const [mode, setMode] = useState('select');
  const [material, setMaterial] = useState('steel');
  const [density, setDensity] = useState('comfortable');
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tab, setTab] = useState('properties');
  const [expanded, setExpanded] = useState<string[]>(['included']);
  const [noticeVisible, setNoticeVisible] = useState(true);
  const [activeTool, setActiveTool] = useState('select');
  const [loadsVisible, setLoadsVisible] = useState(true);
  const [dimensionsVisible, setDimensionsVisible] = useState(false);
  const [length, setLength] = useState('4.50');
  const t = copy[locale];

  useEffect(() => {
    const previousTheme = document.documentElement.dataset.theme;
    const previousLanguage = document.documentElement.lang;
    const previousTitle = document.title;
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = locale;
    document.title = 'structureCo · Component Lab';
    return () => {
      if (previousTheme) document.documentElement.dataset.theme = previousTheme;
      else delete document.documentElement.dataset.theme;
      document.documentElement.lang = previousLanguage;
      document.title = previousTitle;
    };
  }, [locale, theme]);

  const record = (message: string) => setEventMessage(message);
  const chooseTool = (tool: string, label: string) => {
    setActiveTool(tool);
    record(`${t.eventTool}: ${label}`);
  };

  return <div className="component-lab">
    <a className="component-lab__skip" href="#component-lab-main">{t.skip}</a>
    <header className="component-lab__topbar">
      <a className="component-lab__brand" href="#component-lab-main" aria-label="structureCo Component Lab">
        <span aria-hidden="true"><Component size={20} /></span>
        <strong>structureCo</strong>
        <Badge tone="info">{t.devOnly}</Badge>
      </a>
      <div className="component-lab__preferences">
        <SegmentedControl
          label={t.theme}
          size="sm"
          value={theme}
          options={[{ value: 'light', label: t.light }, { value: 'dark', label: t.dark }]}
          onValueChange={(value) => {
            setTheme(value as Theme);
            record(`${t.eventTheme}: ${value === 'dark' ? t.dark : t.light}`);
          }}
        />
        <SegmentedControl
          label={t.language}
          size="sm"
          value={locale}
          options={[{ value: 'es', label: 'ES' }, { value: 'en', label: 'EN' }]}
          onValueChange={(value) => {
            setLocale(value as Locale);
            record(`${copy[value as Locale].eventLanguage}: ${value.toUpperCase()}`);
          }}
        />
      </div>
    </header>

    <main id="component-lab-main">
      <section className="component-lab__hero">
        <div>
          <p className="component-lab__eyebrow"><Sparkles size={15} aria-hidden="true" />{t.eyebrow}</p>
          <h1>{t.title}</h1>
          <p>{t.intro}</p>
        </div>
        <nav aria-label={t.sectionNav}>
          <a href="#00">00 · {t.foundations}</a>
          <a href="#01">01 · {t.controls}</a>
          <a href="#02">02 · {t.overlays}</a>
          <a href="#03">03 · {t.feedback}</a>
          <a href="#04">04 · {t.editor}</a>
          <a href="#05">05 · {t.topbar}</a>
        </nav>
      </section>

      <div className="component-lab__ready">
        <StatusStrip status="ready" title={t.ready} detail={t.readyDetail} />
      </div>

      <LabSection id="00" title={t.foundations} note={t.foundationsNote}>
        <DemoBlock title={t.foundationRoles} wide>
          <p className="component-lab__demo-legend">{t.foundationLegend}</p>
          <div className="component-lab__foundation-summary">
            <span>{t.foundationCurrent}</span>
            <strong>{t.official}</strong>
            <p>{t.foundationOfficialSummary}</p>
          </div>
          <div className="component-lab__swatches">
            {FOUNDATION_ROLES.map((role) => <div className="component-lab__swatch" key={role.id}>
              <span className={`component-lab__swatch-color is-${role.id}`} aria-hidden="true" />
              <strong>{t[role.labelKey]}</strong>
            </div>)}
          </div>
        </DemoBlock>

        <DemoBlock title={t.typographyTitle} wide>
          <p className="component-lab__material-note">{t.typographyNote}</p>
          <div className="component-lab__type-specimens">
            <Surface level="raised" className="component-lab__type-specimen component-lab__type-specimen--display">
              <span>{t.typographyEditorial}</span><strong>StructureCo</strong><code>DM Serif Display</code>
            </Surface>
            <Surface level="inset" className="component-lab__type-specimen component-lab__type-specimen--ui">
              <span>{t.typographyInterface}</span><strong>Modela con claridad</strong><code>Manrope</code>
            </Surface>
            <Surface level="flat" className="component-lab__type-specimen component-lab__type-specimen--mono">
              <span>{t.typographyTechnical}</span><strong>+24.36 kN·m</strong><code>JetBrains Mono</code>
            </Surface>
          </div>
        </DemoBlock>

        <DemoBlock title={t.loadIdentityTitle} wide>
          <p className="component-lab__material-note">{t.loadIdentityNote}</p>
          <div className="component-lab__load-identities">
            <Surface level="raised" className="component-lab__load-identity is-point"><strong>{t.loadPoint}</strong><code>--sc-color-load-point</code></Surface>
            <Surface level="raised" className="component-lab__load-identity is-distributed"><strong>{t.loadDistributed}</strong><code>--sc-color-load-distributed</code></Surface>
            <Surface level="raised" className="component-lab__load-identity is-applied-moment"><strong>{t.loadAppliedMoment}</strong><code>--sc-color-load-moment-applied</code></Surface>
          </div>
          <div className="component-lab__response-identities" aria-label={t.responseIdentity}>
            <span className="is-axial">N</span><span className="is-shear">V</span><span className="is-moment">M</span><span className="is-deformed">δ</span><span className="is-aula">Aula</span><strong>{t.responseIdentity}</strong>
          </div>
        </DemoBlock>

        <DemoBlock title={t.authorityDemo} wide>
          <div className="component-lab__authority-grid">
            <article className="component-lab__authority-card">
              <h4>{t.brandAnatomy}</h4>
              <div className="component-lab__brand-anatomy" aria-label={t.brandAnatomy}>
                <span className="is-fill">Fill <code>#1AA57A</code></span>
                <span className="is-stroke">Stroke <code>#087E5C</code></span>
                <span className="is-ink">Ink <code>#02140F</code></span>
              </div>
            </article>

            <article className="component-lab__authority-card component-lab__authority-card--engineering">
              <h4>{t.engineeringAnatomy}</h4>
              <svg viewBox="0 0 520 260" role="img" aria-label={`${t.shear}; ${t.influenceLabel}; ${t.deformedLabel}`}>
                <path className="component-lab__beam" d="M40 70H480" />
                <path className="component-lab__shear-area" d="M48 70L180 18L310 132L472 70Z" />
                <path className="component-lab__influence-area" d="M48 174C145 105 286 114 472 208L472 174Z" />
                <path className="component-lab__deformed-line" d="M48 222C170 178 306 250 472 214" />
                <path className="component-lab__moment-line" d="M48 148C178 82 330 88 472 146" />
                <text x="52" y="38" className="component-lab__shear-label">V · lime</text>
                <text x="52" y="168" className="component-lab__influence-label">IL · dashed</text>
                <text x="328" y="244" className="component-lab__deformed-label">δ · continuous</text>
              </svg>
            </article>

            <article className="component-lab__authority-card">
              <h4>{t.interactionAnatomy}</h4>
              <button type="button" className="component-lab__focus-evidence">:focus-visible</button>
              <div className="component-lab__selection-evidence" aria-label={t.roleSelection}>
                <span>{t.roleSelection}</span>
              </div>
            </article>

            <article className="component-lab__authority-card">
              <h4>{t.themeAnatomy} · {theme === 'dark' ? t.dark : t.light}</h4>
              <div className="component-lab__theme-levels" aria-label={t.themeAnatomy}>
                <span className="is-app">App</span>
                <span className="is-canvas">Canvas</span>
                <span className="is-surface">Surface</span>
                <span className="is-raised">Raised</span>
              </div>
            </article>
          </div>
        </DemoBlock>

        <DemoBlock title={t.materialLevels} wide>
          <p className="component-lab__material-note">{t.materialLevelsNote}</p>
          <div className="component-lab__material-levels" aria-label={t.materialLevels}>
            {MATERIAL_LEVELS.map((level) => (
              <Surface key={level} level={level} className={`component-lab__material-level component-lab__material-level--${level}`}>
                <strong>{level.toUpperCase()}</strong>
                <span>{level === 'flat' ? t.materialBase : level === 'sheet' ? t.materialSheet : level === 'modal' ? t.materialModal : t.materialSurface}</span>
              </Surface>
            ))}
          </div>
        </DemoBlock>

        {/* CRI-105 · V-05. Cada muestra dibuja su esquina con el token de su rol,
            así que la vitrina no puede desviarse de la escala sin que se vea. */}
        <DemoBlock title={t.radiusRoles} wide>
          <p className="component-lab__material-note">{t.radiusRolesNote}</p>
          <div className="component-lab__radius-roles" aria-label={t.radiusRoles}>
            {RADIUS_ROLES.map(({ id, token, value }) => (
              <div key={id} className={`component-lab__radius-role component-lab__radius-role--${id}`}>
                <span className="component-lab__radius-sample" aria-hidden="true" />
                <strong>{t[`radius${id[0].toUpperCase()}${id.slice(1)}` as keyof typeof t]}</strong>
                <code>{token}</code>
                <small>{value}</small>
              </div>
            ))}
          </div>
        </DemoBlock>

        {/* CRI-105 · V-04. Las tres dicen lo mismo y valen lo mismo: si la
            profundidad comunicara importancia, no podrían compartir etiqueta. */}
        <DemoBlock title={t.depthSizes} wide>
          <p className="component-lab__material-note">{t.depthSizesNote}</p>
          <div className="component-lab__depth-sizes" aria-label={t.depthSizes}>
            {DEPTH_SIZES.map(({ id, token, radius }) => (
              <div key={id} className={`component-lab__depth-size component-lab__depth-size--${id}`}>
                <strong>{id === 'sm' ? t.depthSmall : id === 'md' ? t.depthMedium : t.depthLarge}</strong>
                <span>{t.depthEqual}</span>
                <code>{token}</code>
                <code>{radius}</code>
              </div>
            ))}
          </div>
        </DemoBlock>

        {/* CRI-105 · V-02. La contraprueba: lo que NO recibe materia. */}
        <DemoBlock title={t.flatness} wide>
          <p className="component-lab__material-note">{t.flatnessNote}</p>
          <div className="component-lab__flatness">
            <table className="component-lab__flat-table">
              <caption>{t.flatnessTable}</caption>
              <thead><tr><th scope="col">{t.flatnessMember}</th><th scope="col">{t.flatnessValue}</th></tr></thead>
              <tbody>
                {[['M-01', 24.36], ['M-02', 18.02], ['M-03', 31.47], ['M-04', 12.8]].map(([member, value]) => (
                  <tr key={member as string}>
                    <th scope="row">{member}</th>
                    <td><NumericValue value={value as number} unit={t.flatnessUnit} locale={locale} maximumFractionDigits={2} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="component-lab__flat-field">
              <UnitField label={t.flatnessField} unit="m" value={4.25} onValueChange={() => undefined} />
              <ResultMetric label={t.momentMetric} value={<NumericValue value={31.47} locale={locale} maximumFractionDigits={2} />} unit={t.flatnessUnit} tone="moment" />
            </div>
          </div>
        </DemoBlock>

        {/* CRI-105 · los cinco estados del mismo control, uno al lado del otro.
            `pressHeld` no depende de que alguien mantenga el ratón: la muestra
            declara `data-pressed` para que el estado sea fotografiable. */}
        <DemoBlock title={t.pressStates} wide>
          <p className="component-lab__material-note">{t.pressStatesNote}</p>
          <div className="component-lab__press-states">
            <Button variant="secondary">{t.pressRest}</Button>
            <Surface as="div" level="raised" pressed className="component-lab__press-sample">{t.pressHeld}</Surface>
            <Button variant="secondary" disabled>{t.pressDisabled}</Button>
          </div>
          <Surface level="inset" className="component-lab__motion-policy">
            <strong>{t.motionPolicyTitle}</strong><p>{t.motionPolicyNote}</p>
          </Surface>
        </DemoBlock>
      </LabSection>

      <LabSection id="01" title={t.controls} note={t.controlsNote}>
        <DemoBlock title={t.buttons} wide>
          <div className="component-lab__row">
            <Button variant="primary" leadingIcon={<Save size={16} />} onClick={() => record(t.eventSaved)}>{t.primary}</Button>
            <Button variant="secondary" leadingIcon={<Plus size={16} />} onClick={() => record(t.secondary)}>{t.secondary}</Button>
            <Button variant="ghost" leadingIcon={<Eye size={16} />} onClick={() => record(t.ghost)}>{t.ghost}</Button>
            <Button variant="danger" leadingIcon={<Trash2 size={16} />} onClick={() => record(t.danger)}>{t.danger}</Button>
          </div>
          <div className="component-lab__row">
            <Button disabled>{t.disabled}</Button>
            <Button loading loadingLabel={t.loadingLabel}>{t.loading}</Button>
            <Button size="sm">{t.add}</Button>
            <Button size="touch">44 px</Button>
            <Tooltip content={t.tooltip} placement="bottom">
              <IconButton label={t.iconAction} variant="secondary"><Crosshair size={18} /></IconButton>
            </Tooltip>
            <IconButton label={t.menu} loading loadingLabel={t.loadingLabel}><Sparkles size={18} /></IconButton>
          </div>
        </DemoBlock>

        <DemoBlock title={t.fields} wide>
          <div className="component-lab__field-grid">
            <Field label={t.memberName} hint={t.memberHint} defaultValue="M-04" />
            <Field label={t.invalidName} error={t.required} defaultValue="M" />
            <Field label={t.memberName} optionalLabel={t.optional} placeholder="M-05" disabled />
            <Select label={t.material} value={material} onChange={(event) => {
              setMaterial(event.target.value);
              record(`${t.material}: ${event.target.selectedOptions[0]?.text ?? event.target.value}`);
            }}>
              <option value="steel">{t.steel}</option>
              <option value="concrete">{t.concrete}</option>
              <option value="timber">{t.timber}</option>
            </Select>
          </div>
          <SegmentedControl
            label={t.inputMode}
            value={mode}
            options={[{ value: 'select', label: t.select }, { value: 'draw', label: t.draw }, { value: 'review', label: t.review }, { value: 'locked', label: t.disabled, disabled: true }]}
            onValueChange={(value) => { setMode(value); record(`${t.inputMode}: ${value}`); }}
          />
        </DemoBlock>
      </LabSection>

      <LabSection id="02" title={t.overlays} note={t.overlaysNote}>
        <DemoBlock title={t.popover}>
          <div className="component-lab__row">
            <Popover
              label={t.popover}
              open={popoverOpen}
              onOpenChange={setPopoverOpen}
              trigger={<><Grid3X3 size={17} aria-hidden="true" /><span>{t.popover}</span></>}
            >
              <div className="component-lab__popover-content">
                <strong>{t.density}</strong>
                <SegmentedControl
                  label={t.density}
                  size="sm"
                  value={density}
                  options={[{ value: 'comfortable', label: t.comfortable }, { value: 'compact', label: t.compact }]}
                  onValueChange={(value) => { setDensity(value); record(`${t.density}: ${value}`); }}
                />
              </div>
            </Popover>
            <Button variant="secondary" leadingIcon={<BoxSelect size={16} />} onClick={() => setDialogOpen(true)}>{t.openDialog}</Button>
            <Button variant="secondary" leadingIcon={<PanelRightOpen size={16} />} onClick={() => setDrawerOpen(true)}>{t.openDrawer}</Button>
          </div>
        </DemoBlock>

        <DemoBlock title={t.tabsLabel} wide>
          <Tabs
            label={t.tabsLabel}
            value={tab}
            onValueChange={(value) => { setTab(value); record(`${t.tabsLabel}: ${value}`); }}
            items={[
              { id: 'properties', label: t.properties, content: <p>{t.tabProperties}</p> },
              { id: 'notes', label: t.notes, content: <p>{t.longCopy}</p> },
              { id: 'history', label: t.history, content: <EmptyState compact title={t.emptyTitle} description={t.emptyBody} /> },
            ]}
          />
        </DemoBlock>

        <DemoBlock title="Accordion" wide>
          <Accordion
            multiple
            expanded={expanded}
            onExpandedChange={setExpanded}
            items={[
              { id: 'included', title: t.accordionA, content: <p>{t.accordionAContent}</p> },
              { id: 'excluded', title: t.accordionB, content: <p>{t.accordionBContent}</p> },
            ]}
          />
        </DemoBlock>
      </LabSection>

      <LabSection id="03" title={t.feedback} note={t.feedbackNote}>
        <DemoBlock title="Badge · Banner" wide>
          <div className="component-lab__row">
            <Badge dot>{t.neutral}</Badge><Badge dot tone="success">{t.success}</Badge><Badge dot tone="warning">{t.warning}</Badge><Badge dot tone="error">{t.error}</Badge>
          </div>
          <div className="component-lab__stack">
            <Banner tone="info" title={t.infoTitle} icon={<CircleDot size={18} />}>{t.infoBody}</Banner>
            {noticeVisible ? <Banner tone="warning" title={t.warningTitle} icon={<Triangle size={18} />} onDismiss={() => setNoticeVisible(false)} dismissLabel={t.dismiss}>{t.warningBody}</Banner> : <Button size="sm" onClick={() => setNoticeVisible(true)}>{t.warningTitle}</Button>}
            <Banner tone="error" title={t.errorTitle} icon={<Triangle size={18} />} actions={<Button size="sm" variant="secondary">{t.review}</Button>}>{t.errorBody}</Banner>
          </div>
        </DemoBlock>

        <DemoBlock title="EmptyState · Spinner · Divider" wide>
          <EmptyState title={t.emptyTitle} description={t.emptyBody} icon={<BarChart3 size={22} />} action={<Button size="sm" leadingIcon={<Plus size={15} />}>{t.create}</Button>} />
          <Divider label="async" />
          <div className="component-lab__row component-lab__row--center">
            <Spinner size="sm" label={t.loadingLabel} /><Spinner label={t.loadingLabel} /><Spinner size="lg" label={t.loadingLabel} />
          </div>
        </DemoBlock>
      </LabSection>

      <LabSection id="04" title={t.editor} note={t.editorNote}>
        <DemoBlock title={t.tools}>
          <div className="component-lab__tool-rail">
            <ToolGroup title={t.navigation}>
              <ToolButton label={t.pointer} icon={<MousePointer2 size={20} />} shortcut="V" tone="navigation" active={activeTool === 'select'} onClick={() => chooseTool('select', t.pointer)} />
            </ToolGroup>
            <ToolGroup title={t.structure}>
              <ToolButton label={t.node} icon={<CircleDot size={20} />} shortcut="N" tone="structure" active={activeTool === 'node'} onClick={() => chooseTool('node', t.node)} />
              <ToolButton label={t.member} icon={<Waves size={20} />} shortcut="M" tone="structure" active={activeTool === 'member'} onClick={() => chooseTool('member', t.member)} />
              <ToolButton label={t.support} icon={<Triangle size={20} />} shortcut="A" tone="structure" active={activeTool === 'support'} onClick={() => chooseTool('support', t.support)} />
            </ToolGroup>
            <ToolGroup title={t.loads}>
              <ToolButton label={t.pointLoad} icon={<Plus size={20} />} shortcut="P" tone="load" active={activeTool === 'point'} onClick={() => chooseTool('point', t.pointLoad)} />
              <ToolButton label={t.distributed} icon={<Waves size={20} />} shortcut="D" tone="distributed" active={activeTool === 'distributed'} onClick={() => chooseTool('distributed', t.distributed)} />
              <ToolButton label={t.moment} icon={<Gauge size={20} />} shortcut="O" tone="moment" active={activeTool === 'moment'} onClick={() => chooseTool('moment', t.moment)} />
            </ToolGroup>
            <ToolGroup title={t.annotation}>
              <ToolButton label={t.dimension} icon={<Ruler size={20} />} shortcut="C" tone="dimension" active={activeTool === 'dimension'} onClick={() => chooseTool('dimension', t.dimension)} />
              <ToolButton label={t.remove} icon={<Trash2 size={20} />} shortcut="Del" tone="destructive" active={activeTool === 'delete'} onClick={() => chooseTool('delete', t.remove)} />
            </ToolGroup>
          </div>
        </DemoBlock>

        <DemoBlock title={t.panelTitle}>
          <div className="component-lab__panel">
            <PanelHeader title={t.panelTitle} description={t.panelDescription} actions={<IconButton size="sm" label={t.reset}><Sparkles size={16} /></IconButton>} />
            <PropertyRow label={t.length} description="L">
              <UnitField
                label={t.length}
                aria-label={t.length}
                value={length}
                unit="m"
                onValueChange={(value) => { setLength(value); record(`${t.eventValue}: ${value} m`); }}
              />
            </PropertyRow>
            <PropertyRow label={t.angle} description="θ">
              <NumericValue value={32.5} unit="°" minimumFractionDigits={1} />
            </PropertyRow>
            <Divider />
            <strong className="component-lab__subheading">{t.activeLayer}</strong>
            <LayerToggle label={t.loadsLayer} description={t.loadsLayerDetail} icon={<Waves size={18} />} checked={loadsVisible} onCheckedChange={(checked) => {
              setLoadsVisible(checked);
              record(`${t.eventLayer}: ${t.loadsLayer} ${checked ? t.on : t.off}`);
            }} />
            <LayerToggle label={t.dimensionsLayer} description={t.dimensionsLayerDetail} icon={<Ruler size={18} />} checked={dimensionsVisible} onCheckedChange={(checked) => {
              setDimensionsVisible(checked);
              record(`${t.eventLayer}: ${t.dimensionsLayer} ${checked ? t.on : t.off}`);
            }} />
          </div>
        </DemoBlock>

        <DemoBlock title={t.metrics} wide>
          <div className="component-lab__metrics">
            <ResultMetric label={t.axial} value={<NumericValue value={-128.45} maximumFractionDigits={2} />} unit="kN" tone="axial" detail="LC-03" />
            <ResultMetric label={t.shear} value={<NumericValue value={42.8} maximumFractionDigits={1} />} unit="kN" tone="shear" detail="LC-02" />
            <ResultMetric label={t.momentMetric} value={<NumericValue value={86.24} maximumFractionDigits={2} />} unit="kN·m" tone="moment" detail="LC-04" />
            <ResultMetric label={t.displacement} value={<NumericValue value={12.6} maximumFractionDigits={1} />} unit="mm" tone="deformed" detail={t.nodeCode} />
          </div>
          <div className="component-lab__status-grid">
            <StatusStrip status="success" title={t.updated} detail="14:32" />
            <StatusStrip status="stale" title={t.stale} detail="2" />
            <StatusStrip status="loading" title={t.calculating} detail="4 / 8" />
            <StatusStrip status="error" title={t.failed} detail={t.required} />
          </div>
        </DemoBlock>
      </LabSection>

      <LabSection id="05" title={t.topbar} note={t.topbarNote}>
        <DemoBlock title={t.topbarDemo} wide>
          <TopBarConceptLab locale={locale} onEvent={record} />
        </DemoBlock>
      </LabSection>
    </main>

    <aside className="component-lab__event" role="status" aria-live="polite" aria-atomic="true">
      <span>{t.event}</span><strong>{eventMessage || t.noEvent}</strong>
    </aside>

    <Dialog
      open={dialogOpen}
      onOpenChange={setDialogOpen}
      title={t.dialogTitle}
      description={t.dialogDescription}
      closeLabel={t.close}
      footer={<><Button variant="ghost" onClick={() => setDialogOpen(false)}>{t.cancel}</Button><Button variant="primary" onClick={() => { setDialogOpen(false); record(t.eventConfirmed); }}>{t.confirm}</Button></>}
    >
      <p>{t.dialogBody}</p>
      <Field label={t.memberName} defaultValue="M-04" />
    </Dialog>

    <Drawer
      open={drawerOpen}
      onOpenChange={setDrawerOpen}
      title={t.drawerTitle}
      description={t.drawerDescription}
      closeLabel={t.close}
      footer={<Button variant="primary" fullWidth onClick={() => { setDrawerOpen(false); record(t.eventSaved); }}>{t.primary}</Button>}
    >
      <div className="component-lab__stack">
        <UnitField label={t.length} value={length} unit="m" onValueChange={setLength} />
        <Select label={t.material} value={material} onChange={(event) => setMaterial(event.target.value)}>
          <option value="steel">{t.steel}</option><option value="concrete">{t.concrete}</option><option value="timber">{t.timber}</option>
        </Select>
      </div>
    </Drawer>
  </div>;
}
