// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type MouseEvent as ReactMouseEvent } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { findStandardSection } from '../../data/standardSections';
import { ClassroomSessionProvider } from '../../store/ClassroomSessionContext';
import { useProjectAnalysis } from '../../store/ProjectAnalysisContext';
import { ProjectProvider } from '../../store/ProjectContext';
import { useProjectModel } from '../../store/ProjectModelContext';
import { useWorkspaceUI } from '../../store/WorkspaceUIContext';
import type { ProjectModel, Selection, UnitSystemId } from '../../types';
import { Inspector } from './Inspector';

const ADVANCED_STORAGE_KEY = 'structureCo.inspector.expanded.v1';

const createInspectorProject = (calculationMode: 'complete' | 'classroom' = 'complete'): ProjectModel => {
  const project = createDefaultProject();
  project.settings = { ...project.settings, calculationMode };
  project.members.push({
    id: 'MR',
    i: 'N1',
    j: 'N2',
    type: 'rigid',
    E: 1,
    A: 1,
    I: 1,
  });
  project.memberLoads.push(
    {
      id: 'ML2',
      memberId: 'M1',
      caseId: 'LC1',
      type: 'point',
      coordinateSystem: 'global',
      lengthBasis: 'real',
      start: 0,
      end: 1,
      position: 0.375,
      px: 5,
      py: -12.5,
    },
    {
      id: 'ML3',
      memberId: 'M3',
      caseId: 'LC1',
      type: 'moment',
      coordinateSystem: 'local',
      lengthBasis: 'real',
      start: 0,
      end: 1,
      position: 0.25,
      moment: 8.75,
    },
  );
  return project;
};

const selections: Array<{ label: string; value: Selection }> = [
  { label: 'Quitar selección', value: null },
  { label: 'Seleccionar nodo N3', value: { kind: 'node', id: 'N3' } },
  { label: 'Seleccionar nodo N4', value: { kind: 'node', id: 'N4' } },
  { label: 'Seleccionar apoyo N1', value: { kind: 'node', id: 'N1' } },
  { label: 'Seleccionar miembro M1', value: { kind: 'member', id: 'M1' } },
  { label: 'Seleccionar miembro M2', value: { kind: 'member', id: 'M2' } },
  { label: 'Seleccionar vínculo rígido MR', value: { kind: 'member', id: 'MR' } },
  { label: 'Seleccionar carga nodal NL1', value: { kind: 'nodalLoad', id: 'NL1' } },
  { label: 'Seleccionar carga distribuida ML1', value: { kind: 'memberLoad', id: 'ML1' } },
  { label: 'Seleccionar carga puntual ML2', value: { kind: 'memberLoad', id: 'ML2' } },
  { label: 'Seleccionar momento ML3', value: { kind: 'memberLoad', id: 'ML3' } },
  {
    label: 'Seleccionar varios objetos',
    value: { kind: 'multi', nodeIds: ['N1', 'N3'], memberIds: ['M1'] },
  },
];

const InspectorHarness = ({ modal = false, onClose, onDesktopWidthChange, desktopWidth, mobileDetent, onMobileDetentChange }: { modal?: boolean; onClose?: () => void; onDesktopWidthChange?: (width: number) => void; desktopWidth?: number; mobileDetent?: 'compact' | 'medium' | 'large'; onMobileDetentChange?: (detent: 'compact' | 'medium' | 'large') => void }) => {
  const { project, canUndo, canRedo, undo, redo, updateProjectView } = useProjectModel();
  const { analysis, analyze } = useProjectAnalysis();
  const { selection, setSelection } = useWorkspaceUI();
  const nodeN3 = project.nodes.find((node) => node.id === 'N3');
  const nodeN4 = project.nodes.find((node) => node.id === 'N4');
  const memberM1 = project.members.find((member) => member.id === 'M1');

  return <ClassroomSessionProvider projectId={project.id}>
    <div>
      <div aria-label="Controles de prueba">
        {selections.map((item) => <button key={item.label} type="button" onClick={() => setSelection(item.value)}>{item.label}</button>)}
        <button type="button" onClick={analyze}>Analizar fixture</button>
        <button type="button" onClick={undo}>Deshacer fixture</button>
        <button type="button" onClick={redo}>Rehacer fixture</button>
        <label>Cambiar unidades fixture<select value={project.settings.units} onChange={(event) => updateProjectView((draft) => {
          draft.settings.units = event.target.value as UnitSystemId;
          return draft;
        })}><option value="kN-m">kN-m</option><option value="N-mm">N-mm</option><option value="kgf-m">kgf-m</option><option value="kip-ft">kip-ft</option></select></label>
      </div>
      <output aria-label="Selección actual">{selection?.kind ?? 'none'}</output>
      <output aria-label="Puede deshacer">{String(canUndo)}</output>
      <output aria-label="Puede rehacer">{String(canRedo)}</output>
      <output aria-label="N3 X almacenada">{String(nodeN3?.x)}</output>
      <output aria-label="N3 Y almacenada">{String(nodeN3?.y)}</output>
      <output aria-label="N4 X almacenada">{String(nodeN4?.x)}</output>
      <output aria-label="Nodos actuales">{project.nodes.map((node) => node.id).join(',')}</output>
      <output aria-label="M1 E almacenado">{String(memberM1?.E)}</output>
      <output aria-label="M1 A almacenada">{String(memberM1?.A)}</output>
      <output aria-label="M1 material ID">{String((memberM1 as unknown as Record<string, unknown>)?.materialId ?? '')}</output>
      <output aria-label="M1 origen material">{String((memberM1 as unknown as Record<string, unknown>)?.materialOrigin ?? '')}</output>
      <output aria-label="M1 sección ID">{String((memberM1 as unknown as Record<string, unknown>)?.sectionId ?? '')}</output>
      <output aria-label="M1 origen sección">{String((memberM1 as unknown as Record<string, unknown>)?.sectionOrigin ?? '')}</output>
      <output aria-label="Issues de análisis">{analysis?.issues.map((issue) => issue.id).join(',') ?? ''}</output>
      <Inspector desktopWidth={desktopWidth} presentation={modal ? 'sheet' : 'dock'} onClose={onClose} onDesktopWidthChange={onDesktopWidthChange} mobileDetent={mobileDetent} onMobileDetentChange={onMobileDetentChange} />
    </div>
  </ClassroomSessionProvider>;
};

const renderInspector = (
  project: ProjectModel = createInspectorProject(),
  props: { modal?: boolean; onClose?: () => void; onDesktopWidthChange?: (width: number) => void; desktopWidth?: number; mobileDetent?: 'compact' | 'medium' | 'large'; onMobileDetentChange?: (detent: 'compact' | 'medium' | 'large') => void } = {},
) => {
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
  return render(<ProjectProvider><InspectorHarness {...props} /></ProjectProvider>);
};

const storedNumber = (label: string) => Number(screen.getByLabelText(label).textContent);

const SplitSurfaceHarness = () => {
  const [presentation, setPresentation] = useState<'dock' | 'inset' | 'sheet'>('dock');
  const { selection, setSelection } = useWorkspaceUI();
  const { project } = useProjectModel();
  const member = project.members.find((item) => item.id === 'M1');
  const migrate = (next: 'dock' | 'inset' | 'sheet') => (event: ReactMouseEvent<HTMLButtonElement>) => {
    // A shell recomposition does not move focus to a launcher. Preserve that
    // browser behavior in this focused draft regression.
    event.preventDefault();
    setPresentation(next);
  };
  return <ClassroomSessionProvider projectId={project.id}>
    <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setSelection({ kind: 'member', id: 'M1' })}>seleccionar miembro dividido</button>
    <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setSelection({ kind: 'node', id: 'N3' })}>seleccionar nodo dividido</button>
    <button type="button" onMouseDown={migrate('inset')} onClick={migrate('inset')}>migrar M1</button>
    <button type="button" onMouseDown={migrate('sheet')} onClick={migrate('sheet')}>migrar K0</button>
    <button type="button" onMouseDown={migrate('dock')} onClick={migrate('dock')}>migrar X2</button>
    <output aria-label="selección dividida">{selection?.kind ?? 'none'}</output>
    <output aria-label="E dividida almacenada">{String(member?.E)}</output>
    <Inspector presentation={presentation} />
  </ClassroomSessionProvider>;
};

const renderSplitSurface = (project = createInspectorProject()) => {
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
  return render(<ProjectProvider><SplitSurfaceHarness /></ProjectProvider>);
};

const expectDescribedUnit = (input: HTMLElement, expectedUnit: string) => {
  const describedBy = input.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? [];
  expect(describedBy.some((id) => document.getElementById(id)?.textContent === expectedUnit)).toBe(true);
};

const selectionSummary = () => screen.getByRole('region', { name: 'Resumen de selección' });

beforeAll(() => {
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0);
    window.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);
  }
});

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Inspector selection variants', () => {
  it('renders the empty selection and Inspector navigation with accessible semantics', () => {
    renderInspector();

    expect(screen.getByRole('complementary', { name: 'Inspector' })).toBeTruthy();
    const inspectorTab = screen.getByRole('tab', { name: 'Inspector' });
    expect(inspectorTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Cargas' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Vista' })).toBeTruthy();

    /**
     * Sin seleccion el panel enseña el Panorama del modelo, no dos tarjetas
     * que dicen lo mismo. Lo que se comprueba es que informa: el censo del
     * modelo, que no enseña ninguna otra superficie del producto.
     */
    const overview = screen.getByRole('region', { name: 'Panorama del modelo' });
    expect(within(overview).getByText('Nodos')).toBeTruthy();
    expect(within(overview).getByText('Miembros')).toBeTruthy();
    expect(within(overview).getByText('Apoyos')).toBeTruthy();

    // Y que lo retirado se fue de verdad: un resumen de seleccion sin
    // seleccion no es un resumen.
    expect(screen.queryByRole('region', { name: 'Resumen de selección' })).toBeNull();
    expect(screen.queryByText('Nada seleccionado')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Propiedades frecuentes' })).toBeNull();
  });

  it('localizes Inspector chrome, load tools, and display controls in English without changing technical values', async () => {
    const user = userEvent.setup();
    const project = createInspectorProject();
    project.settings = { ...project.settings, language: 'en' };
    const firstLoadCase = project.loadCases[0];
    renderInspector(project);

    expect(screen.getByRole('complementary', { name: 'Inspector' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Model overview' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Loads' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'View' })).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: 'Loads' }));
    expect(screen.getByRole('heading', { name: 'Add a load' })).toBeTruthy();
    expect(screen.getByText('Choose a type, then tap the node or member on the canvas.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Point.*Force at a node or point on a member/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Distributed.*Uniform or varying load along a member/ })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Add load case' }));
    expect((screen.getByRole('textbox', { name: 'Load case name LC2' }) as HTMLInputElement).value).toBe('Case 2');
    await user.click(screen.getByRole('button', { name: 'Add combination' }));
    expect(screen.getByRole('option', { name: 'Combination 2' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: `Activate ${firstLoadCase.name}` })).toBeTruthy();
    const loadCaseName = screen.getByRole('textbox', { name: `Load case name ${firstLoadCase.id}` }) as HTMLInputElement;
    expect(loadCaseName.value).toBe(firstLoadCase.name);

    await user.click(screen.getByRole('tab', { name: 'Loads' }));
    expect(screen.getByRole('heading', { name: 'Calculation experience' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Complete' })).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: 'View' }));
    expect(screen.queryByRole('heading', { name: 'Calculation experience' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'CAD precision' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Selection filters' })).toBeTruthy();
    const spacing = screen.getByRole('textbox', { name: 'Spacing' });
    expectDescribedUnit(spacing, 'm');

    await user.click(screen.getByRole('tab', { name: 'Inspector' }));
    await user.click(screen.getByRole('button', { name: 'Seleccionar nodo N3' }));
    expect(screen.getAllByText('Editable').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Calculated').length).toBeGreaterThan(0);
    // El segmento visitado se conserva montado y oculto —asi sobrevive un
    // borrador sin publicar—, asi que lo que se comprueba es que no esta
    // EXPUESTO: una consulta por rol no ve lo que `hidden` saca del arbol de
    // accesibilidad, que es exactamente la pregunta.
    expect(screen.queryByRole('heading', { name: 'Add a load' })).toBeNull();
  });

  it('localizes representative Inspector property copy and presentational labels in English', async () => {
    const user = userEvent.setup();
    const project = createInspectorProject();
    project.settings = { ...project.settings, language: 'en' };
    renderInspector(project);

    await user.click(screen.getByRole('button', { name: 'Seleccionar nodo N3' }));
    const nodeProperties = document.querySelector('.inspector-properties');
    expect(nodeProperties?.textContent).not.toMatch(/Nodo libre|Propiedades frecuentes|Valores derivados|Identificador del modelo/);
    expect(screen.getByText('Free node · editable coordinates')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Frequently used properties' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Derived values' })).toBeTruthy();
    expect(screen.getByText('Model identifier')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Advanced properties' }));
    expect(screen.getByRole('heading', { name: 'Springs' })).toBeTruthy();
    expect(screen.getByText('Optional elastic support stiffnesses.')).toBeTruthy();
    expect(screen.getByText('Settlements unavailable')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Seleccionar vínculo rígido MR' }));
    expect(screen.getByText('No editable stiffness properties')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Advanced properties' }));
    expect(screen.getByText('Mechanical properties locked')).toBeTruthy();
    expect(screen.getByText(/exact kinematic compatibility/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Seleccionar carga distribuida ML1' }));
    const loadProperties = document.querySelector('.inspector-properties');
    expect(loadProperties?.textContent).not.toMatch(/Carga distribuida|Magnitud y posición|Eliminar carga/);
    expect(screen.getByText('Distributed load')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Type' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Distributed' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Coordinate system' })).toBeTruthy();
    expectDescribedUnit(screen.getByRole('textbox', { name: 'From' }), 'x/L');
    expect(screen.getByRole('button', { name: 'Delete load' })).toBeTruthy();
  });

  it('distinguishes a free node from a support and exposes units plus calculated values', async () => {
    const user = userEvent.setup();
    renderInspector();

    await user.click(screen.getByRole('button', { name: 'Seleccionar nodo N3' }));
    let summary = selectionSummary();
    expect(within(summary).getByText('Nodo')).toBeTruthy();
    expect(within(summary).getByText('N3')).toBeTruthy();
    expect(within(summary).getByText('Nodo libre · coordenadas editables')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Propiedades frecuentes' })).toBeTruthy();
    expect((screen.getByRole('combobox', { name: 'Apoyo' }) as HTMLSelectElement).value).toBe('none');
    expectDescribedUnit(screen.getByRole('textbox', { name: 'X' }), 'm');
    expectDescribedUnit(screen.getByRole('textbox', { name: 'Y' }), 'm');
    expect(screen.getAllByText('Calculado').length).toBeGreaterThan(0);
    expect(screen.getByText('Identificador del modelo')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Seleccionar apoyo N1' }));
    summary = selectionSummary();
    expect(within(summary).getByText('Apoyo')).toBeTruthy();
    expect(within(summary).getByText('N1')).toBeTruthy();
    expect(within(summary).getByText('Articulado · nodo estructural')).toBeTruthy();
    expect((screen.getByRole('combobox', { name: 'Apoyo' }) as HTMLSelectElement).value).toBe('pin');
  });

  it('covers roller, custom, and fixed support presentation through the existing handler', async () => {
    const user = userEvent.setup();
    const project = createInspectorProject();
    const node = project.nodes.find((item) => item.id === 'N1');
    if (node) node.support = { type: 'roller', angleDeg: 37.125 };
    renderInspector(project);

    await user.click(screen.getByRole('button', { name: 'Seleccionar apoyo N1' }));
    const support = screen.getByRole('combobox', { name: 'Apoyo' });
    expect((support as HTMLSelectElement).value).toBe('roller');
    expect((screen.getByRole('textbox', { name: 'Normal' }) as HTMLInputElement).value).toBe('37.13');
    expectDescribedUnit(screen.getByRole('textbox', { name: 'Normal' }), '°');

    await user.selectOptions(support, 'custom');
    const restraints = screen.getByRole('group', { name: 'Grados de libertad restringidos' });
    const ux = within(restraints).getByRole('checkbox', { name: 'Ux' });
    expect((ux as HTMLInputElement).checked).toBe(false);
    await user.click(ux);
    expect((ux as HTMLInputElement).checked).toBe(true);

    await user.selectOptions(support, 'fixed');
    expect(screen.queryByRole('group', { name: 'Grados de libertad restringidos' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Normal' })).toBeNull();
  });

  it('renders editable and derived member properties, and clearly locks a rigid link', async () => {
    const user = userEvent.setup();
    renderInspector();

    await user.click(screen.getByRole('button', { name: 'Seleccionar miembro M1' }));
    expect(within(selectionSummary()).getByText('Miembro')).toBeTruthy();
    expect(within(selectionSummary()).getByText('M1')).toBeTruthy();
    expect((screen.getByRole('combobox', { name: 'Elemento' }) as HTMLSelectElement).value).toBe('frame');
    expectDescribedUnit(screen.getByRole('textbox', { name: 'E' }), 'MPa');
    expectDescribedUnit(screen.getByRole('textbox', { name: 'A' }), 'm²');
    expectDescribedUnit(screen.getByRole('textbox', { name: 'I' }), 'm⁴');
    expect(screen.getByText('Longitud')).toBeTruthy();
    expect(screen.getByText('Ángulo')).toBeTruthy();
    expect(screen.getAllByText('Calculado').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Seleccionar vínculo rígido MR' }));
    expect(within(selectionSummary()).getByText('Vínculo rígido · N1 → N2')).toBeTruthy();
    expect((screen.getByRole('combobox', { name: 'Elemento' }) as HTMLSelectElement).value).toBe('rigid');
    expect(screen.queryByRole('textbox', { name: 'E' })).toBeNull();
    expect(screen.getByText('Sin propiedades de rigidez editables')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Propiedades avanzadas' }));
    expect(screen.getByText('Propiedades mecánicas bloqueadas')).toBeTruthy();
    expect(screen.getByText(/compatibilidad cinemática exacta/)).toBeTruthy();
  });

  it('covers nodal, distributed, point, and moment load property variants with visible units', async () => {
    const user = userEvent.setup();
    renderInspector();

    await user.click(screen.getByRole('button', { name: 'Seleccionar carga nodal NL1' }));
    expect(within(selectionSummary()).getByText('Carga puntual')).toBeTruthy();
    expect(within(selectionSummary()).getByText('NL1')).toBeTruthy();
    expectDescribedUnit(screen.getByRole('textbox', { name: 'Horizontal Fx' }), 'kN');
    expectDescribedUnit(screen.getByRole('textbox', { name: 'Vertical Fy' }), 'kN');
    expectDescribedUnit(screen.getByRole('textbox', { name: 'Momento Mz' }), 'kN·m');
    expect(screen.getAllByText('Calculado').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Seleccionar carga distribuida ML1' }));
    expect(within(selectionSummary()).getByText('Carga distribuida')).toBeTruthy();
    expect(within(selectionSummary()).getByText('ML1')).toBeTruthy();
    expectDescribedUnit(screen.getByRole('textbox', { name: 'Desde' }), 'x/L');
    expectDescribedUnit(screen.getByRole('textbox', { name: 'Hasta' }), 'x/L');
    expectDescribedUnit(screen.getByRole('textbox', { name: 'qy al inicio' }), 'kN/m');
    expectDescribedUnit(screen.getByRole('textbox', { name: 'qy al final' }), 'kN/m');

    await user.click(screen.getByRole('button', { name: 'Seleccionar carga puntual ML2' }));
    expect(within(selectionSummary()).getByText('Carga puntual')).toBeTruthy();
    expect(within(selectionSummary()).getByText('ML2')).toBeTruthy();
    expectDescribedUnit(screen.getByRole('textbox', { name: 'Posición' }), 'x/L');
    expectDescribedUnit(screen.getByRole('textbox', { name: 'Fuerza X' }), 'kN');
    expectDescribedUnit(screen.getByRole('textbox', { name: 'Fuerza Y' }), 'kN');

    await user.click(screen.getByRole('button', { name: 'Seleccionar momento ML3' }));
    expect(within(selectionSummary()).getByText('Momento')).toBeTruthy();
    expect(within(selectionSummary()).getByText('ML3')).toBeTruthy();
    expectDescribedUnit(screen.getByRole('textbox', { name: 'Posición' }), 'x/L');
    expectDescribedUnit(screen.getByRole('textbox', { name: 'M' }), 'kN·m');
  });

  it('identifies a mixed nodal load without changing its force or moment contracts', async () => {
    const user = userEvent.setup();
    const project = createInspectorProject();
    const load = project.nodalLoads.find((item) => item.id === 'NL1');
    if (load) {
      load.fx = 4.25;
      load.mz = 3.5;
    }
    renderInspector(project);

    await user.click(screen.getByRole('button', { name: 'Seleccionar carga nodal NL1' }));
    expect(within(selectionSummary()).getByText('Carga nodal mixta')).toBeTruthy();
    expect((screen.getByRole('textbox', { name: 'Horizontal Fx' }) as HTMLInputElement).value).toBe('4.25');
    expect((screen.getByRole('textbox', { name: 'Momento Mz' }) as HTMLInputElement).value).toBe('3.5');
    expectDescribedUnit(screen.getByRole('textbox', { name: 'Horizontal Fx' }), 'kN');
    expectDescribedUnit(screen.getByRole('textbox', { name: 'Momento Mz' }), 'kN·m');
  });

  it('offers bulk editing for a multiple selection instead of locking it', async () => {
    const user = userEvent.setup();
    renderInspector();

    await user.click(screen.getByRole('button', { name: 'Seleccionar varios objetos' }));
    const summary = selectionSummary();
    expect(within(summary).getByText('Selección múltiple')).toBeTruthy();
    expect(within(summary).getByText('3 objetos')).toBeTruthy();
    expect(screen.getByText('2 nodos · 1 miembros')).toBeTruthy();
    expect(screen.getAllByText('Calculado').length).toBeGreaterThan(0);

    // La multiselección dejó de ser de sólo lectura: aparece el panel de
    // edición múltiple y arranca sin ningún cambio preparado.
    const panel = screen.getByRole('region', { name: 'Edición múltiple' });
    expect(within(panel).getByText('3 objetos seleccionados')).toBeTruthy();
    expect(screen.getByTestId('bulk-changes-count').textContent).toBe('Ningún cambio preparado');
    // Sin nada preparado no se puede ni abrir la revisión, así que tampoco
    // llegar a la confirmación.
    expect((screen.getByRole('button', { name: 'Revisar cambios' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('single Inspector panel', () => {
  it('keeps a focused numeric detail draft through X2, M1, K0, and back without publishing it', async () => {
    const user = userEvent.setup();
    renderSplitSurface();
    await user.click(screen.getByRole('button', { name: 'seleccionar miembro dividido' }));
    const field = screen.getByRole('textbox', { name: 'E' }) as HTMLInputElement;
    const original = screen.getByLabelText('E dividida almacenada').textContent;
    field.focus();
    await user.clear(field);
    await user.type(field, '123456');

    await user.click(screen.getByRole('button', { name: 'migrar M1' }));
    expect(field.value).toBe('123456');
    expect(screen.getByLabelText('E dividida almacenada').textContent).toBe(original);
    expect(document.activeElement).toBe(field);

    await user.click(screen.getByRole('button', { name: 'migrar K0' }));
    expect(screen.getByRole('dialog', { name: 'Inspector' })).toBeTruthy();
    expect(field.value).toBe('123456');
    expect(screen.getByLabelText('E dividida almacenada').textContent).toBe(original);

    await user.click(screen.getByRole('button', { name: 'migrar X2' }));
    expect(field.value).toBe('123456');
    expect(screen.getByLabelText('E dividida almacenada').textContent).toBe(original);
  });

  it('keeps detail open while its selection authority changes', async () => {
    const user = userEvent.setup();
    renderSplitSurface();
    await user.click(screen.getByRole('button', { name: 'seleccionar miembro dividido' }));
    await user.click(screen.getByRole('button', { name: 'migrar K0' }));
    await user.click(screen.getByRole('button', { name: 'seleccionar nodo dividido' }));
    expect(screen.getByLabelText('selección dividida').textContent).toBe('node');
    expect(screen.getByRole('dialog', { name: 'Inspector' }).getAttribute('data-workspace-surface')).toBe('detail');
  });

  /**
   * El panel es UNO con tres segmentos, no tres superficies. Fundirlos pone en
   * riesgo dos cosas que las tres copias daban gratis, y esta prueba las fija:
   *
   * 1. Un borrador numérico sin publicar en Cargas tiene que sobrevivir a ir a
   *    otro segmento y volver — por eso un segmento visitado se oculta con
   *    `hidden` en vez de desmontarse.
   * 2. Seleccionar en el lienzo trae el panel al segmento de detalle, que es
   *    lo que el tablist llevaba escrito desde el principio y nadie ejecutaba.
   */
  it('brings the panel back to detail on selection and keeps an unpublished loads draft across segments', async () => {
    const user = userEvent.setup();
    renderSplitSurface();

    const serviceCombination = () => screen
      .getByText('Servicio', { selector: 'summary' })
      .closest('details') as HTMLElement;

    await user.click(screen.getByRole('tab', { name: 'Cargas' }));
    await user.click(within(serviceCombination()).getByText('Servicio'));
    const factor = within(serviceCombination()).getByRole('textbox', { name: 'Carga de servicio' }) as HTMLInputElement;
    await user.clear(factor);
    await user.type(factor, '1.75');
    expect(factor.value).toBe('1.75');

    await user.click(screen.getByRole('button', { name: 'seleccionar miembro dividido' }));
    expect(screen.getByRole('tab', { name: 'Inspector' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Cargas' }).getAttribute('aria-selected')).toBe('false');

    await user.click(screen.getByRole('tab', { name: 'Cargas' }));
    expect((within(serviceCombination()).getByRole('textbox', { name: 'Carga de servicio' }) as HTMLInputElement).value).toBe('1.75');
  });
});

describe('Inspector preset selectors and load-case guidance', () => {
  const materialSelect = () => screen.getByRole('combobox', { name: /Material estándar|Standard material/ }) as HTMLSelectElement;
  const sectionSelect = () => screen.getByRole('combobox', { name: /Perfil comercial|Commercial section/ }) as HTMLSelectElement;

  it('keeps the chosen material and commercial section visible after applying them', async () => {
    const user = userEvent.setup();
    renderInspector();
    await user.click(screen.getByRole('button', { name: 'Seleccionar miembro M1' }));

    expect(materialSelect().value).toBe('');
    await user.selectOptions(materialSelect(), 'steel-a992');
    await waitFor(() => {
      expect(materialSelect().value).toBe('steel-a992');
      expect(storedNumber('M1 E almacenado')).toBe(200e6);
      expect(screen.getByLabelText('M1 material ID').textContent).toBe('steel-a992');
      expect(screen.getByLabelText('M1 origen material').textContent).toBe('catalog');
    });

    await user.selectOptions(sectionSelect(), 'w12x26');
    const section = findStandardSection('w12x26');
    expect(section).toBeDefined();
    await waitFor(() => {
      expect(sectionSelect().value).toBe('w12x26');
      expect(storedNumber('M1 A almacenada')).toBe(section?.area);
      expect(screen.getByLabelText('M1 sección ID').textContent).toBe('w12x26');
      expect(screen.getByLabelText('M1 origen sección').textContent).toBe('catalog');
    });
  });

  it('resolves both selectors from explicit IDs, including numerically indistinguishable steel presets', async () => {
    const user = userEvent.setup();
    const project = createInspectorProject();
    const member = project.members.find((item) => item.id === 'M1')!;
    const section = findStandardSection('ipe-300')!;
    Object.assign(member as object, {
      E: 200e6, G: 76_923_076.9231, density: 7850,
      materialId: 'steel-a992', materialOrigin: 'catalog',
      A: section.area, I: section.inertiaX,
      sectionId: section.id, sectionOrigin: 'catalog',
    });
    renderInspector(project);

    await user.click(screen.getByRole('button', { name: 'Seleccionar miembro M1' }));

    expect(materialSelect().value).toBe('steel-a992');
    expect(sectionSelect().value).toBe('ipe-300');
  });

  it('does not carry the chosen preset over to another member with identical properties', async () => {
    const user = userEvent.setup();
    const project = createInspectorProject();
    const section = findStandardSection('w12x26');
    const twin = project.members.find((member) => member.id === 'M2');
    if (section && twin) {
      twin.A = section.area;
      twin.I = section.inertiaX;
    }
    renderInspector(project);

    await user.click(screen.getByRole('button', { name: 'Seleccionar miembro M1' }));
    await user.selectOptions(sectionSelect(), 'w12x26');
    expect(sectionSelect().value).toBe('w12x26');

    await user.click(screen.getByRole('button', { name: 'Seleccionar miembro M2' }));
    expect(sectionSelect().value).toBe('');
  });

  it('drops the preset label once the member stops matching the catalog values', async () => {
    const user = userEvent.setup();
    renderInspector();
    await user.click(screen.getByRole('button', { name: 'Seleccionar miembro M1' }));
    await user.selectOptions(sectionSelect(), 'w12x26');

    const area = screen.getByRole('textbox', { name: 'A' });
    await user.clear(area);
    await user.type(area, '0.02');
    await user.keyboard('{Enter}');

    expect(sectionSelect().value).toBe('');
    expect(screen.getByLabelText('M1 sección ID').textContent).toBe('');
    expect(screen.getByLabelText('M1 origen sección').textContent).toBe('custom');

    await user.click(screen.getByRole('button', { name: 'Deshacer fixture' }));
    await user.click(screen.getByRole('button', { name: 'Seleccionar miembro M1' }));
    expect(sectionSelect().value).toBe('w12x26');
    expect(screen.getByLabelText('M1 origen sección').textContent).toBe('catalog');

    await user.click(screen.getByRole('button', { name: 'Rehacer fixture' }));
    await user.click(screen.getByRole('button', { name: 'Seleccionar miembro M1' }));
    expect(sectionSelect().value).toBe('');
    expect(screen.getByLabelText('M1 origen sección').textContent).toBe('custom');
  });

  it('does not recover section identity when exact preset floats are typed back manually', async () => {
    const user = userEvent.setup();
    renderInspector();
    await user.click(screen.getByRole('button', { name: 'Seleccionar miembro M1' }));
    await user.selectOptions(sectionSelect(), 'w12x26');
    const section = findStandardSection('w12x26')!;
    const area = screen.getByRole('textbox', { name: 'A' });

    await user.clear(area);
    await user.type(area, '0.02');
    await user.keyboard('{Enter}');
    await user.clear(area);
    await user.type(area, String(section.area));
    await user.keyboard('{Enter}');

    expect(storedNumber('M1 A almacenada')).toBe(section.area);
    expect(sectionSelect().value).toBe('');
    expect(screen.getByLabelText('M1 sección ID').textContent).toBe('');
    expect(screen.getByLabelText('M1 origen sección').textContent).toBe('custom');
  });

  it('lists compact preset labels translated to the project language', async () => {
    const user = userEvent.setup();
    const project = createInspectorProject();
    project.settings = { ...project.settings, language: 'en' };
    renderInspector(project);
    await user.click(screen.getByRole('button', { name: 'Seleccionar miembro M1' }));

    expect(materialSelect().textContent).toContain('ASTM A992');
    expect(materialSelect().textContent).not.toContain('Acero estructural');
    expect(sectionSelect().textContent).toContain('Concrete beam 20×30 cm');
    expect(sectionSelect().textContent).not.toContain('Viga Concreto');
  });

  it('explains what a load case is in the nodal and member load forms', async () => {
    const user = userEvent.setup();
    renderInspector();

    await user.click(screen.getByRole('button', { name: 'Seleccionar carga nodal NL1' }));
    expect(screen.getByText(/¿Qué es un caso de carga\?/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Seleccionar carga distribuida ML1' }));
    expect(screen.getByText(/¿Qué es un caso de carga\?/)).toBeTruthy();
  });
});

describe('Inspector editing safety and history', () => {
  it('does not mutate the project or create undo history on focus and blur alone', async () => {
    const user = userEvent.setup();
    renderInspector();
    await user.click(screen.getByRole('button', { name: 'Seleccionar nodo N3' }));

    const input = screen.getByRole('textbox', { name: 'Y' });
    fireEvent.focus(input);
    fireEvent.blur(input);

    expect(storedNumber('N3 Y almacenada')).toBe(4);
    expect(screen.getByLabelText('Puede deshacer').textContent).toBe('false');
  });

  it('changes all visible unit systems without changing stored precision or undo history', async () => {
    const user = userEvent.setup();
    renderInspector();
    await user.click(screen.getByRole('button', { name: 'Seleccionar nodo N3' }));
    const unitSelector = screen.getByRole('combobox', { name: 'Cambiar unidades fixture' });
    const cases: Array<[UnitSystemId, string, string]> = [
      ['N-mm', '4000', 'mm'],
      ['kgf-m', '4', 'm'],
      ['kip-ft', '13.1234', 'ft'],
      ['kN-m', '4', 'm'],
    ];

    for (const [system, displayValue, unit] of cases) {
      await user.selectOptions(unitSelector, system);
      const input = screen.getByRole('textbox', { name: 'Y' }) as HTMLInputElement;
      await waitFor(() => expect(input.value).toBe(displayValue));
      expectDescribedUnit(input, unit);
      expect(storedNumber('N3 Y almacenada')).toBe(4);
      expect(screen.getByLabelText('Puede deshacer').textContent).toBe('false');
    }
  });

  it('keeps blank and malformed drafts inline without coercing stored state to zero', async () => {
    const user = userEvent.setup();
    renderInspector();
    await user.click(screen.getByRole('button', { name: 'Seleccionar nodo N3' }));
    const input = screen.getByRole('textbox', { name: 'Y' }) as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(storedNumber('N3 Y almacenada')).toBe(4);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-errormessage')).toBe(`${input.id}-error`);
    expect(screen.getByRole('alert').textContent).toBe('Este campo no puede quedar vacío.');
    expect(screen.getByLabelText('Puede deshacer').textContent).toBe('false');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);
    expect(storedNumber('N3 Y almacenada')).toBe(4);
    expect(screen.getByRole('alert').textContent).toBe('Ingresa un número válido.');
    expect(screen.getByLabelText('Puede deshacer').textContent).toBe('false');
  });

  it('drops an uncommitted draft when selection changes instead of leaking stale data', async () => {
    const user = userEvent.setup();
    renderInspector();
    await user.click(screen.getByRole('button', { name: 'Seleccionar nodo N3' }));
    const input = screen.getByRole('textbox', { name: 'X' }) as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar nodo N4' }));

    await waitFor(() => expect((screen.getByRole('textbox', { name: 'X' }) as HTMLInputElement).value).toBe('6'));
    expect(storedNumber('N3 X almacenada')).toBe(0);
    expect(storedNumber('N4 X almacenada')).toBe(6);
    expect(screen.getByLabelText('Puede deshacer').textContent).toBe('false');
  });

  it('commits exact valid input once and preserves it through undo and redo', async () => {
    const user = userEvent.setup();
    renderInspector();
    await user.click(screen.getByRole('button', { name: 'Seleccionar nodo N3' }));
    const input = screen.getByRole('textbox', { name: 'Y' }) as HTMLInputElement;
    const exact = 4.123456789012345;

    await user.click(input);
    await user.clear(input);
    await user.type(input, String(exact));
    await user.keyboard('{Enter}');

    expect(storedNumber('N3 Y almacenada')).toBe(exact);
    expect(input.value).toBe('4.12346');
    expect(screen.getByLabelText('Puede deshacer').textContent).toBe('true');

    await user.click(screen.getByRole('button', { name: 'Deshacer fixture' }));
    expect(storedNumber('N3 Y almacenada')).toBe(4);
    expect(screen.getByLabelText('Puede rehacer').textContent).toBe('true');

    await user.click(screen.getByRole('button', { name: 'Rehacer fixture' }));
    expect(storedNumber('N3 Y almacenada')).toBe(exact);
  });

  it('remaps the selected node after its coordinate edit repairs coincident topology', async () => {
    const user = userEvent.setup();
    const project = createInspectorProject();
    const nodeN1 = project.nodes.find((node) => node.id === 'N1');
    project.members = project.members.filter((member) => member.id !== 'MR');
    if (nodeN1) nodeN1.y = 4;
    renderInspector(project);

    await user.click(screen.getByRole('button', { name: 'Seleccionar apoyo N1' }));
    const x = screen.getByRole('textbox', { name: 'X' });
    await user.clear(x);
    await user.type(x, '6');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(within(selectionSummary()).getByText('N4')).toBeTruthy());
    expect(screen.getByLabelText('Nodos actuales').textContent).toBe('N2,N3,N4');
    expect(screen.getByLabelText('Puede deshacer').textContent).toBe('true');
  });
});

describe('Inspector advanced, locked, and validation states', () => {
  it('persists advanced-property accordion state in localStorage across remounts', async () => {
    const user = userEvent.setup();
    const first = renderInspector();
    await user.click(screen.getByRole('button', { name: 'Seleccionar miembro M1' }));
    let advanced = screen.getByRole('button', { name: 'Propiedades avanzadas' });
    expect(advanced.getAttribute('aria-expanded')).toBe('false');
    const controlledPanelId = advanced.getAttribute('aria-controls');
    expect(controlledPanelId).toBeTruthy();
    expect(document.getElementById(controlledPanelId ?? '')?.hidden).toBe(true);

    await user.click(advanced);
    expect(advanced.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(controlledPanelId ?? '')?.hidden).toBe(false);
    expect(JSON.parse(localStorage.getItem(ADVANCED_STORAGE_KEY) ?? '[]')).toContain('advanced-member');

    first.unmount();
    renderInspector();
    await user.click(screen.getByRole('button', { name: 'Seleccionar miembro M1' }));
    advanced = screen.getByRole('button', { name: 'Propiedades avanzadas' });
    expect(advanced.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(advanced.getAttribute('aria-controls') ?? '')?.hidden).toBe(false);
  });

  it('locks material and advanced mechanics in classroom mode without hiding stored values', async () => {
    const user = userEvent.setup();
    renderInspector(createInspectorProject('classroom'));
    await user.click(screen.getByRole('button', { name: 'Seleccionar miembro M1' }));

    expect(screen.getByText('Material bloqueado en modo Aula')).toBeTruthy();
    expect(screen.getByText(/E, A e I conservan los valores actuales/)).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'E' })).toBeNull();
    expect(storedNumber('M1 E almacenado')).toBe(200e6);

    await user.click(screen.getByRole('button', { name: 'Propiedades avanzadas' }));
    expect(screen.getByText('Propiedades avanzadas bloqueadas en modo Aula')).toBeTruthy();
    expect(screen.getByText('Semirrigidez y offsets bloqueados')).toBeTruthy();
  });

  it('surfaces existing domain validation issues for the selected object with ARIA alerts', async () => {
    const user = userEvent.setup();
    const project = createInspectorProject();
    const member = project.members.find((item) => item.id === 'M1');
    if (member) member.E = 0;
    renderInspector(project);
    await user.click(screen.getByRole('button', { name: 'Seleccionar miembro M1' }));
    await user.click(screen.getByRole('button', { name: 'Analizar fixture' }));

    const issues = await screen.findByRole('region', { name: 'Validaciones del objeto' }, { timeout: 5000 });
    expect(within(issues).getByRole('heading', { name: 'Validación del análisis' })).toBeTruthy();
    const alert = within(issues).getByRole('alert');
    expect(alert.textContent).toContain('Módulo elástico inválido');
    expect(alert.textContent).toContain('E del miembro M1 debe ser mayor que cero.');
  });

  it('projects the existing distributed-load interval validation without duplicating it in the form', async () => {
    const user = userEvent.setup();
    renderInspector();

    await user.click(screen.getByRole('button', { name: 'Seleccionar carga distribuida ML1' }));
    const start = screen.getByRole('textbox', { name: 'Desde' });
    const end = screen.getByRole('textbox', { name: 'Hasta' });
    await user.clear(start);
    await user.type(start, '0.8');
    await user.keyboard('{Enter}');
    await user.clear(end);
    await user.type(end, '0.2');
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('region', { name: 'Validaciones del objeto' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Analizar fixture' }));
    await waitFor(() => expect(screen.getByLabelText('Issues de análisis').textContent).toContain('distributed-domain-ML1'), { timeout: 5000 });

    const issues = await screen.findByRole('region', { name: 'Validaciones del objeto' }, { timeout: 5000 });
    const alert = within(issues).getByRole('alert');
    expect(alert.textContent).toContain('Dominio de carga inválido');
    expect(alert.textContent).toContain('0 ≤ inicio < fin ≤ 1');
  }, 10_000);

  it('resizes the persistent desktop inspector by keyboard without touching project history', async () => {
    const user = userEvent.setup();
    const onDesktopWidthChange = vi.fn();
    renderInspector(createInspectorProject(), { desktopWidth: 320, onDesktopWidthChange });

    const handle = screen.getByRole('separator', { name: 'Redimensionar inspector' });
    expect(handle.getAttribute('aria-valuenow')).toBe('320');
    handle.focus();
    await user.keyboard('{ArrowLeft}');
    expect(onDesktopWidthChange).toHaveBeenLastCalledWith(336);
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
    expect(onDesktopWidthChange).toHaveBeenLastCalledWith(280);
    await user.keyboard('{End}');
    expect(onDesktopWidthChange).toHaveBeenLastCalledWith(480);
    expect(screen.getByLabelText('Puede deshacer').textContent).toBe('false');
  });

  it('uses non-modal sheet semantics, lets focus leave, and closes safely with Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderInspector(createInspectorProject(), { modal: true, onClose });

    expect(screen.getByRole('dialog', { name: 'Inspector' }).hasAttribute('aria-modal')).toBe(false);
    const last = screen.getByRole('button', { name: 'Cerrar inspector' });
    last.focus();
    await user.tab();
    expect(document.activeElement).toBe(document.body);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('exposes three mutually exclusive phone heights without mutating the model', async () => {
    const user = userEvent.setup();
    const onMobileDetentChange = vi.fn();
    renderInspector(createInspectorProject(), { modal: true, mobileDetent: 'medium', onMobileDetentChange });

    const group = screen.getByRole('group', { name: 'Altura del Inspector' });
    expect(within(group).getByRole('button', { name: 'Compacta' }).getAttribute('aria-pressed')).toBe('false');
    expect(within(group).getByRole('button', { name: 'Media' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(group).getByRole('button', { name: 'Casi completa' }).getAttribute('aria-pressed')).toBe('false');

    await user.click(within(group).getByRole('button', { name: 'Casi completa' }));
    expect(onMobileDetentChange).toHaveBeenCalledWith('large');
    expect(screen.getByLabelText('Puede deshacer').textContent).toBe('false');
  });

  it('keeps native tab order through closed details because a sheet is not a focus trap', async () => {
    const user = userEvent.setup();
    renderInspector(createInspectorProject(), { modal: true, onClose: vi.fn() });

    const inspectorTab = screen.getByRole('tab', { name: 'Inspector' });
    inspectorTab.focus();
    await user.keyboard('{ArrowRight}');

    const loadsTab = screen.getByRole('tab', { name: 'Cargas' });
    expect(loadsTab.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).not.toBe(loadsTab);
  });
});
