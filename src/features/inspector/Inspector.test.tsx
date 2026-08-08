// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { findStandardSection } from '../../data/standardSections';
import { ClassroomSessionProvider } from '../../store/ClassroomSessionContext';
import { ProjectProvider, useProject } from '../../store/ProjectContext';
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

const InspectorHarness = ({ modal = false, onClose, onDesktopWidthChange, desktopWidth }: { modal?: boolean; onClose?: () => void; onDesktopWidthChange?: (width: number) => void; desktopWidth?: number }) => {
  const {
    project,
    analysis,
    selection,
    setSelection,
    analyze,
    canUndo,
    canRedo,
    undo,
    redo,
    updateProjectView,
  } = useProject();
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
      <output aria-label="M1 E almacenado">{String(memberM1?.E)}</output>
      <output aria-label="Issues de análisis">{analysis?.issues.map((issue) => issue.id).join(',') ?? ''}</output>
      <Inspector desktopWidth={desktopWidth} modal={modal} onClose={onClose} onDesktopWidthChange={onDesktopWidthChange} />
    </div>
  </ClassroomSessionProvider>;
};

const renderInspector = (
  project: ProjectModel = createInspectorProject(),
  props: { modal?: boolean; onClose?: () => void; onDesktopWidthChange?: (width: number) => void; desktopWidth?: number } = {},
) => {
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
  return render(<ProjectProvider><InspectorHarness {...props} /></ProjectProvider>);
};

const storedNumber = (label: string) => Number(screen.getByLabelText(label).textContent);

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

    const summary = selectionSummary();
    expect(within(summary).getByText('Nada seleccionado')).toBeTruthy();
    expect(within(summary).getByText('—')).toBeTruthy();
    expect(screen.getByText('Selecciona un objeto para ver sus propiedades, unidades y resultados derivados.')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Propiedades frecuentes' })).toBeNull();
  });

  it('localizes Inspector chrome, load tools, and display controls in English without changing technical values', async () => {
    const user = userEvent.setup();
    const project = createInspectorProject();
    project.settings = { ...project.settings, language: 'en' };
    const firstLoadCase = project.loadCases[0];
    renderInspector(project);

    expect(screen.getByRole('complementary', { name: 'Inspector' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Selection summary' })).toBeTruthy();
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

    await user.click(screen.getByRole('tab', { name: 'View' }));
    expect(screen.getByRole('heading', { name: 'Calculation experience' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Complete' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'CAD precision' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Selection filters' })).toBeTruthy();
    const spacing = screen.getByRole('textbox', { name: 'Spacing' });
    expectDescribedUnit(spacing, 'm');

    await user.click(screen.getByRole('tab', { name: 'Inspector' }));
    await user.click(screen.getByRole('button', { name: 'Seleccionar nodo N3' }));
    expect(screen.getAllByText('Editable').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Calculated').length).toBeGreaterThan(0);
    expect(screen.queryByText('Add a load')).toBeNull();
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

  it('makes multiple selection read-only and explains why bulk editing is locked', async () => {
    const user = userEvent.setup();
    renderInspector();

    await user.click(screen.getByRole('button', { name: 'Seleccionar varios objetos' }));
    const summary = selectionSummary();
    expect(within(summary).getByText('Selección múltiple')).toBeTruthy();
    expect(within(summary).getByText('3 objetos')).toBeTruthy();
    expect(screen.getByText('2 nodos · 1 miembros')).toBeTruthy();
    expect(screen.getByText('Edición masiva bloqueada')).toBeTruthy();
    expect(screen.getByText(/evitar cambios físicos ambiguos/)).toBeTruthy();
    expect(screen.getAllByText('Calculado').length).toBeGreaterThan(0);
    const panel = screen.getByRole('tabpanel', { name: 'Inspector' });
    expect(within(panel).queryByRole('textbox')).toBeNull();
    expect(within(panel).queryByRole('combobox')).toBeNull();
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
    expect(materialSelect().value).toBe('steel-a992');
    expect(storedNumber('M1 E almacenado')).toBe(200e6);

    await user.selectOptions(sectionSelect(), 'w12x26');
    expect(sectionSelect().value).toBe('w12x26');
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

  it('uses dialog semantics, traps keyboard focus, and closes safely with Escape in modal mode', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderInspector(createInspectorProject(), { modal: true, onClose });

    expect(screen.getByRole('dialog', { name: 'Inspector' }).getAttribute('aria-modal')).toBe('true');
    const first = screen.getByRole('tab', { name: 'Inspector' });
    const last = screen.getByRole('button', { name: 'Cerrar inspector' });
    await waitFor(() => expect(document.activeElement).toBe(first));

    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(last);
    await user.tab();
    expect(document.activeElement).toBe(first);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('traps focus against the active tab and ignores controls inside closed details', async () => {
    const user = userEvent.setup();
    renderInspector(createInspectorProject(), { modal: true, onClose: vi.fn() });

    const inspectorTab = screen.getByRole('tab', { name: 'Inspector' });
    await waitFor(() => expect(document.activeElement).toBe(inspectorTab));
    await user.keyboard('{ArrowRight}');

    const loadsTab = screen.getByRole('tab', { name: 'Cargas' });
    await waitFor(() => expect(document.activeElement).toBe(loadsTab));
    expect(loadsTab.getAttribute('aria-selected')).toBe('true');
    const closedDetails = [...document.querySelectorAll<HTMLDetailsElement>('details:not([open])')];
    expect(closedDetails.length).toBeGreaterThan(0);
    const lastSummary = closedDetails.at(-1)?.querySelector('summary');
    expect(lastSummary).toBeTruthy();

    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(lastSummary);
    await user.tab();
    expect(document.activeElement).toBe(loadsTab);
  });

  it('includes controls inside an open details element in the modal focus loop', async () => {
    const user = userEvent.setup();
    renderInspector(createInspectorProject(), { modal: true, onClose: vi.fn() });

    const inspectorTab = screen.getByRole('tab', { name: 'Inspector' });
    await waitFor(() => expect(document.activeElement).toBe(inspectorTab));
    await user.keyboard('{ArrowRight}');
    const loadsTab = screen.getByRole('tab', { name: 'Cargas' });
    const details = [...document.querySelectorAll<HTMLDetailsElement>('details')].at(-1);
    const summary = details?.querySelector<HTMLElement>('summary');
    expect(details).toBeTruthy();
    expect(summary).toBeTruthy();
    await user.click(summary as HTMLElement);
    expect(details?.open).toBe(true);
    const lastInput = [...(details?.querySelectorAll<HTMLElement>('input:not([disabled])') ?? [])].at(-1);
    expect(lastInput).toBeTruthy();

    loadsTab.focus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(lastInput);
    await user.tab();
    expect(document.activeElement).toBe(loadsTab);
  });
});
