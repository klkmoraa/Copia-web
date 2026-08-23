// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { ProjectProvider, useProject } from '../../store/ProjectContext';
import type { BucklingResult, ModeShapeNode } from '../../engine/buckling';
import type { ModalResult } from '../../engine/modal';
import type { ModelStudiesState } from '../../engine/useModelStudies';
import { StabilityView } from './StabilityView';

afterEach(cleanup);

const shape = (value: number): ModeShapeNode[] => [
  { nodeId: 'N1', ux: 0, uy: 0, rz: 0 },
  { nodeId: 'N3', ux: value, uy: 0, rz: 0.01 },
];

const buckling = (factors: number[]): BucklingResult => ({
  success: true,
  modes: factors.map((criticalLoadFactor, index) => ({ criticalLoadFactor, shape: shape(1 - index * 0.1) })),
  criticalLoadFactor: factors[0],
  converged: true,
  residual: 4.2e-10,
  issues: [],
  reason: 'ok',
  referenceAxialForces: { M1: -12 },
  freeDegreesOfFreedom: 7,
});

const modal = (): ModalResult => ({
  success: true,
  modes: [
    { angularFrequency: 138.4, frequency: 22.03, period: 0.0454, participatingMassRatioX: 0.02, participatingMassRatioY: 0.81, shape: shape(1) },
    { angularFrequency: 553.6, frequency: 88.1, period: 0.0114, participatingMassRatioX: 0.01, participatingMassRatioY: 0.09, shape: shape(0.5) },
  ],
  cumulativeMassRatioX: 0.03,
  cumulativeMassRatioY: 0.9,
  totalMass: 1.234,
  formulation: 'consistent',
  converged: true,
  residual: 7e-11,
  issues: [],
  reason: 'ok',
  freeDegreesOfFreedom: 7,
});

const studiesStub = (overrides: Partial<ModelStudiesState> = {}): ModelStudiesState => ({
  buckling: null, modal: null, certificate: null, busy: null, error: null,
  run: vi.fn(), clear: vi.fn(), ...overrides,
});

/** Publica el estado del lienzo para poder afirmar sobre él sin montar el lienzo. */
const ModeShapeProbe = () => {
  const { modeShapeState } = useProject();
  return <output aria-label="Modo en el lienzo">
    {modeShapeState ? `${modeShapeState.kind}:${modeShapeState.index}:${modeShapeState.label}` : 'ninguno'}
  </output>;
};

const renderView = (kind: 'buckling' | 'modal', studies: ModelStudiesState) => {
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
  return render(<ProjectProvider>
    <ModeShapeProbe />
    <StabilityView kind={kind} studies={studies} />
  </ProjectProvider>);
};

/** El botón sólo se habilita con un análisis válido, así que hay que pedirlo. */
const analyzeFirst = async (user: ReturnType<typeof userEvent.setup>) => {
  await waitFor(() => expect(screen.getByRole('button', { name: /Calcular|Recalcular/ })).toBeTruthy());
  void user;
};

describe('vista de estabilidad · antes de calcular', () => {
  it('explica por qué hay un botón en vez de dejar un vacío mudo', () => {
    renderView('buckling', studiesStub());
    expect(screen.getByText(/Este estudio se pide/)).toBeTruthy();
  });

  it('no deja pedir el estudio sin un análisis válido', async () => {
    renderView('buckling', studiesStub());
    await analyzeFirst(userEvent.setup());
    // El proyecto recién cargado aún no se ha analizado.
    expect((screen.getByRole('button', { name: 'Calcular pandeo' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Analiza la estructura antes/)).toBeTruthy();
  });

  it('el límite de lo que el número significa está desde el principio, no tras calcular', () => {
    renderView('buckling', studiesStub());
    expect(screen.getByText(/no es una verificación normativa/i)).toBeTruthy();
    cleanup();
    renderView('modal', studiesStub());
    expect(screen.getByText(/no es un análisis sísmico/i)).toBeTruthy();
  });
});

describe('vista de estabilidad · pandeo calculado', () => {
  it('lista los modos en orden y enseña el factor crítico', () => {
    renderView('buckling', studiesStub({ buckling: buckling([3.482, 9.14]) }));
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0].textContent).toContain('3.482');
    expect(options[0].getAttribute('aria-selected')).toBe('true');
    // Cada modo lleva su propia aclaración de unidad; hay tantas como modos.
    expect(screen.getAllByText('× la combinación aplicada')).toHaveLength(2);
  });

  it('cambiar de modo cambia las métricas', async () => {
    const user = userEvent.setup();
    renderView('buckling', studiesStub({ buckling: buckling([3.482, 9.14]) }));
    await user.click(screen.getAllByRole('option')[1]);
    await waitFor(() => expect(screen.getAllByRole('option')[1].getAttribute('aria-selected')).toBe('true'));
    expect(screen.getByText('9.1400')).toBeTruthy();
  });

  it('pinta las incidencias del estudio en vez de descartarlas', () => {
    const result = buckling([0.4]);
    result.issues = [{ id: 'buckling-below-applied-load', severity: 'warning', title: 'x', message: 'La carga aplicada supera la crítica.' }];
    renderView('buckling', studiesStub({ buckling: result }));
    expect(screen.getByText('La carga aplicada supera la crítica.')).toBeTruthy();
  });

  it('cuando el estudio se niega, dice por qué', () => {
    const refused: BucklingResult = {
      success: false, modes: [], converged: false, residual: Number.NaN,
      issues: [], reason: 'Ningún miembro está comprimido bajo esta combinación.',
      referenceAxialForces: {}, freeDegreesOfFreedom: 0,
    };
    renderView('buckling', studiesStub({ buckling: refused }));
    expect(screen.getByText(/Ningún miembro está comprimido/)).toBeTruthy();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });
});

describe('vista de estabilidad · modos de vibración', () => {
  it('publica periodo, frecuencia y masa participante', () => {
    renderView('modal', studiesStub({ modal: modal() }));
    expect(screen.getByText('22.030 Hz')).toBeTruthy();
    expect(screen.getByText('81.0 %')).toBeTruthy();
    expect(screen.getByText('1.234 Mg')).toBeTruthy();
  });

  it('dice de dónde sale la masa, que es la pregunta que sigue', () => {
    renderView('modal', studiesStub({ modal: modal() }));
    expect(screen.getByText(/La masa sale de la densidad y el área/)).toBeTruthy();
  });
});

describe('vista de estabilidad · el modo en el lienzo', () => {
  const canvasProbe = () => screen.getByLabelText('Modo en el lienzo').textContent;

  it('no dibuja nada hasta que se pide', () => {
    renderView('buckling', studiesStub({ buckling: buckling([3.482]) }));
    expect(canvasProbe()).toBe('ninguno');
  });

  it('publica el modo elegido, con su etiqueta ya traducida', async () => {
    const user = userEvent.setup();
    renderView('buckling', studiesStub({ buckling: buckling([3.482, 9.14]) }));
    await user.click(screen.getByRole('button', { name: 'Ver en el lienzo' }));
    await waitFor(() => expect(canvasProbe()).toBe('buckling:0:Modo 1'));
  });

  it('quitarlo lo retira del lienzo', async () => {
    const user = userEvent.setup();
    renderView('buckling', studiesStub({ buckling: buckling([3.482]) }));
    await user.click(screen.getByRole('button', { name: 'Ver en el lienzo' }));
    await waitFor(() => expect(canvasProbe()).toBe('buckling:0:Modo 1'));
    await user.click(screen.getByRole('button', { name: 'Quitar del lienzo' }));
    await waitFor(() => expect(canvasProbe()).toBe('ninguno'));
  });

  it('elegir otro modo con uno dibujado deja de anunciar el viejo como dibujado', async () => {
    const user = userEvent.setup();
    renderView('buckling', studiesStub({ buckling: buckling([3.482, 9.14]) }));
    await user.click(screen.getByRole('button', { name: 'Ver en el lienzo' }));
    await waitFor(() => expect(canvasProbe()).toBe('buckling:0:Modo 1'));
    await user.click(screen.getAllByRole('option')[1]);
    // El botón vuelve a ofrecer «ver»: lo dibujado ya no es lo seleccionado.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ver en el lienzo' })).toBeTruthy());
    await user.click(screen.getByRole('button', { name: 'Ver en el lienzo' }));
    await waitFor(() => expect(canvasProbe()).toBe('buckling:1:Modo 2'));
  });
});
