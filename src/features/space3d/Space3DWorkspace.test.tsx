// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Space3DWorkspace from './Space3DWorkspace';
import type { Space3DViewport } from '../../space3d/view/threeViewport';
import type { Space3DStorageLike } from '../../space3d/data/storage';
import { createBlankProject } from '../../data/defaultProject';

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

class MemoryStorage implements Space3DStorageLike {
  readonly map = new Map<string, string>();
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, value: string) { this.map.set(key, value); }
  removeItem(key: string) { this.map.delete(key); }
}

const stubViewport = (): Space3DViewport => ({
  scene: {} as Space3DViewport['scene'],
  camera: {} as Space3DViewport['camera'],
  controlsTarget: {} as Space3DViewport['controlsTarget'],
  setModel: () => {},
  setLayers: () => {},
  setView: () => {},
  zoomBy: () => {},
  resize: () => {},
  render: () => {},
  requestRender: () => {},
  pickAt: () => null,
  dispose: () => {},
});

beforeAll(() => vi.stubGlobal('ResizeObserver', ResizeObserverMock));
afterEach(() => cleanup());

const renderWorkspace = (language: 'es' | 'en' = 'es') => {
  const storage = new MemoryStorage();
  const view = render(<Space3DWorkspace
    language={language}
    storage={storage}
    createViewport={stubViewport}
    onOpenHome={() => {}}
    onOpen2D={() => {}}
  />);
  return { storage, view };
};

const table = (name: RegExp) => screen.getByRole('table', { name });

describe('Space3DWorkspace end to end', () => {
  it('crea un nudo con coordenada Z y lo publica en la tabla', async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole('button', { name: /nuevo nodo/i }));
    await user.clear(screen.getByLabelText(/^x$/i));
    await user.type(screen.getByLabelText(/^x$/i), '1.5');
    await user.clear(screen.getByLabelText(/^z$/i));
    await user.type(screen.getByLabelText(/^z$/i), '3');
    await user.click(screen.getByRole('button', { name: /guardar nodo/i }));

    const row = within(table(/nudos/i)).getByRole('row', { name: /N5/ });
    expect(row).toBeDefined();
    expect(row.textContent).toContain('3');
  });

  it('rechaza un valor vacío o no numérico sin crear la entidad', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole('button', { name: /nuevo nodo/i }));
    await user.clear(screen.getByLabelText(/^y$/i));
    await user.click(screen.getByRole('button', { name: /guardar nodo/i }));
    expect(screen.getAllByText(/escribe un número finito/i).length).toBeGreaterThan(0);
    expect(within(table(/nudos/i)).queryByRole('row', { name: /N5/ })).toBeNull();
  });

  it('crea una barra eligiendo extremos existentes', async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole('button', { name: /nuevo nodo/i }));
    await user.clear(screen.getByLabelText(/^x$/i));
    await user.type(screen.getByLabelText(/^x$/i), '6');
    await user.click(screen.getByRole('button', { name: /guardar nodo/i }));

    await user.click(screen.getByRole('button', { name: /nueva barra/i }));
    await user.selectOptions(screen.getByLabelText(/extremo i/i), 'N4');
    await user.selectOptions(screen.getByLabelText(/extremo j/i), 'N5');
    await user.click(screen.getByRole('button', { name: /guardar barra/i }));

    expect(within(table(/barras/i)).getByRole('row', { name: /M4/ })).toBeDefined();
  });

  it('fija los seis apoyos de un nudo desde el editor', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(within(table(/nudos/i)).getByRole('button', { name: /N4/ }));
    await user.click(screen.getByRole('button', { name: /empotrar/i }));
    for (const dof of ['ux', 'uy', 'uz', 'rx', 'ry', 'rz']) {
      expect((screen.getByLabelText(dof) as HTMLInputElement).checked).toBe(true);
    }
    await user.click(screen.getByRole('button', { name: /guardar nodo/i }));
    expect(within(table(/nudos/i)).getByRole('row', { name: /N4/ }).textContent).toMatch(/6/);
  });

  it('analiza el modelo y publica desplazamientos, reacciones y esfuerzos', async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole('button', { name: /^analizar$/i }));
    await waitFor(() => expect(screen.getByTestId('space3d-analysis-state').textContent).toBe('ready'));

    await user.click(screen.getByRole('tab', { name: /resultados/i }));
    await user.selectOptions(screen.getByRole('combobox', { name: /tablas de resultados/i }), 'Nudos');
    const nodeRow = within(table(/desplazamiento/i)).getByRole('row', { name: /N4/ });
    expect(nodeRow.textContent).toMatch(/-?\d/);

    await user.selectOptions(screen.getByRole('combobox', { name: /tablas de resultados/i }), 'Barras');
    expect(within(table(/acciones de extremo/i)).getByRole('row', { name: /M1/ })).toBeDefined();
  });

  it('marca el resultado como obsoleto al editar y oculta la deformada', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole('button', { name: /^analizar$/i }));
    await waitFor(() => expect(screen.getByTestId('space3d-analysis-state').textContent).toBe('ready'));

    await user.click(screen.getByRole('button', { name: /nuevo nodo/i }));
    await user.click(screen.getByRole('button', { name: /guardar nodo/i }));
    expect(screen.getByTestId('space3d-analysis-state').textContent).toBe('stale');
    expect(screen.getByTestId('space3d-deformed-visible').textContent).toBe('false');
    expect(screen.getAllByText(/obsoleto/i).length).toBeGreaterThan(0);
  });

  it('informa un mecanismo sin perder el modelo', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    for (const id of ['N1', 'N2', 'N3']) {
      await user.click(within(table(/nudos/i)).getByRole('button', { name: new RegExp(id) }));
      await user.click(screen.getByRole('button', { name: /liberar/i }));
      await user.click(screen.getByRole('button', { name: /guardar nodo/i }));
    }
    await user.click(screen.getByRole('button', { name: /^analizar$/i }));
    await waitFor(() => expect(screen.getByTestId('space3d-analysis-state').textContent).toBe('failed'));
    expect(screen.getAllByText(/mecanismo/i).length).toBeGreaterThan(0);
    expect(within(table(/nudos/i)).getAllByRole('row').length).toBeGreaterThan(1);
  });

  it('exporta e importa el proyecto conservando los valores', async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole('button', { name: /^exportar$/i }));
    const portable = (screen.getByLabelText(/proyecto exportado/i) as HTMLTextAreaElement).value;
    expect(portable).toContain('"analysisSpace": "space-3d"');
    await user.click(screen.getByRole('button', { name: /cerrar/i }));

    await user.click(screen.getByRole('button', { name: /proyecto vacío/i }));
    await user.click(screen.getByRole('button', { name: /^reemplazar$/i }));
    expect(within(table(/nudos/i)).queryAllByRole('row')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: /^importar$/i }));
    const field = screen.getByLabelText(/proyecto a importar/i);
    await user.click(field);
    await user.paste(portable);
    await user.click(screen.getByRole('button', { name: /importar proyecto/i }));

    expect(within(table(/nudos/i)).getByRole('row', { name: /N4/ }).textContent).toContain('3.2');
  });

  it('deshace y rehace la última edición', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole('button', { name: /nuevo nodo/i }));
    await user.click(screen.getByRole('button', { name: /guardar nodo/i }));
    expect(within(table(/nudos/i)).getByRole('row', { name: /N5/ })).toBeDefined();

    await user.click(screen.getByRole('button', { name: /deshacer/i }));
    expect(within(table(/nudos/i)).queryByRole('row', { name: /N5/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: /rehacer/i }));
    expect(within(table(/nudos/i)).getByRole('row', { name: /N5/ })).toBeDefined();
  });

  it('persiste el proyecto en su propia clave y lo recupera al remontar', async () => {
    const user = userEvent.setup();
    const { storage, view } = renderWorkspace();
    await user.click(screen.getByRole('button', { name: /nuevo nodo/i }));
    await user.click(screen.getByRole('button', { name: /guardar nodo/i }));
    await waitFor(() => expect(storage.getItem('structureco:space3d:v1')).toContain('N5'));

    view.unmount();
    render(<Space3DWorkspace language="es" storage={storage} createViewport={stubViewport} />);
    expect(within(table(/nudos/i)).getByRole('row', { name: /N5/ })).toBeDefined();
  });

  it('alterna capas de la escena sin romper la superficie', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const grid = screen.getByRole('button', { name: /rejilla/i });
    expect(grid.getAttribute('aria-pressed')).toBe('true');
    await user.click(grid);
    expect(screen.getByRole('button', { name: /rejilla/i }).getAttribute('aria-pressed')).toBe('false');
  });

  it('traduce la superficie completa al inglés', () => {
    renderWorkspace('en');
    expect(screen.getByRole('button', { name: /new node/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^analyse$/i })).toBeDefined();
    expect(screen.getByRole('table', { name: /nodes/i })).toBeDefined();
    expect(screen.queryByText(/Nuevo nodo/)).toBeNull();
  });

  it('expone destinos de navegación accesibles', async () => {
    const user = userEvent.setup();
    const home = vi.fn();
    const editor = vi.fn();
    render(<Space3DWorkspace
      language="es"
      storage={new MemoryStorage()}
      createViewport={stubViewport}
      onOpenHome={home}
      onOpen2D={editor}
    />);
    await user.click(screen.getByRole('button', { name: /inicio/i }));
    await user.click(screen.getByRole('button', { name: /editor 2d/i }));
    expect(home).toHaveBeenCalled();
    expect(editor).toHaveBeenCalled();
  });
});

describe('Space3DWorkspace discard confirmation', () => {
  it('pide confirmación antes de cargar el ejemplo o vaciar un modelo con contenido', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    expect(within(table(/nudos/i)).getAllByRole('row')).toHaveLength(5);

    await user.click(screen.getByRole('button', { name: /proyecto vacío/i }));
    expect(screen.getByRole('dialog', { name: /vaciar el proyecto/i })).toBeDefined();
    // Cancelar no toca el modelo.
    await user.click(screen.getByRole('button', { name: /^cancelar$/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(table(/nudos/i)).getAllByRole('row')).toHaveLength(5);

    await user.click(screen.getByRole('button', { name: /proyecto vacío/i }));
    await user.click(screen.getByRole('button', { name: /^reemplazar$/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(table(/nudos/i)).queryAllByRole('row')).toHaveLength(1);

    // Sin nada que perder, "Cargar ejemplo" no necesita confirmación.
    await user.click(screen.getByRole('button', { name: /cargar ejemplo/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(table(/nudos/i)).getAllByRole('row')).toHaveLength(5);
  });

  it('pide confirmación distinta para cargar el ejemplo con contenido existente', async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole('button', { name: /cargar ejemplo/i }));
    expect(screen.getByRole('dialog', { name: /cargar el ejemplo/i })).toBeDefined();
    await user.click(screen.getByRole('button', { name: /^reemplazar$/i }));
    // El resultado es indistinguible del ejemplo original, pero el diálogo se cerró
    // y el comando se ejecutó una sola vez: la geometría sigue teniendo 4 nudos.
    expect(within(table(/nudos/i)).getAllByRole('row')).toHaveLength(5);
  });

  it('deshacer recupera el modelo reemplazado por confirmación', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole('button', { name: /proyecto vacío/i }));
    await user.click(screen.getByRole('button', { name: /^reemplazar$/i }));
    expect(within(table(/nudos/i)).queryAllByRole('row')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: /deshacer/i }));
    expect(within(table(/nudos/i)).getAllByRole('row')).toHaveLength(5);
  });
});

describe('Space3DWorkspace derived from a 2D project', () => {
  const planar = () => {
    const source = createBlankProject();
    source.name = 'Pórtico A-04';
    source.nodes = [
      { id: 'N1', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'N2', x: 0, y: 3, support: { type: 'none' } },
      { id: 'N3', x: 4, y: 3, support: { type: 'none' } },
      { id: 'N4', x: 4, y: 0, support: { type: 'fixed' } },
    ];
    source.members = [
      { id: 'M1', i: 'N1', j: 'N2', type: 'frame', E: 2e8, A: 0.01, I: 8e-5, G: 7.7e7 },
      { id: 'M2', i: 'N2', j: 'N3', type: 'frame', E: 2e8, A: 0.01, I: 8e-5, G: 7.7e7 },
      { id: 'M3', i: 'N3', j: 'N4', type: 'frame', E: 2e8, A: 0.01, I: 8e-5, G: 7.7e7 },
    ];
    source.nodalLoads = [{ id: 'L1', nodeId: 'N2', caseId: source.loadCases[0].id, fx: 12, fy: -30, mz: 0 }];
    return source;
  };

  const renderDerived = (source = planar(), storage = new MemoryStorage()) => {
    const view = render(<Space3DWorkspace
      language="es"
      storage={storage}
      sourceProject={source}
      createViewport={stubViewport}
    />);
    return { view, storage, source };
  };

  it('abre el proyecto 2D actual, no el ejemplo ni uno vacío', () => {
    const { source } = renderDerived();
    expect(screen.getByText(/Pórtico A-04/)).toBeDefined();
    const rows = within(table(/nudos/i)).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.querySelector('th')!.textContent)).toEqual(source.nodes.map((node) => node.id));
    // Todo nudo derivado vive en z = 0: el modelo plano se levanta, no se inventa.
    rows.forEach((row) => expect([...row.querySelectorAll('td')][2].textContent).toBe('0'));
  });

  it('no deja analizar mientras el puente tenga datos sin resolver', () => {
    renderDerived();
    expect((screen.getByRole('button', { name: /^analizar$/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/no se ha inventado ningún valor/i)).toBeDefined();
    expect(screen.getByText(/inercia del eje débil/i)).toBeDefined();
    expect(screen.getByText(/restringe uz/i)).toBeDefined();
  });

  it('desbloquea el análisis cuando el usuario completa lo que faltaba', async () => {
    const user = userEvent.setup();
    renderDerived();

    for (const id of ['M1', 'M2', 'M3']) {
      await user.click(within(table(/barras/i)).getByRole('button', { name: new RegExp(id) }));
      await user.clear(screen.getByLabelText(/inercia iy/i));
      await user.type(screen.getByLabelText(/inercia iy/i), '0.00003');
      await user.clear(screen.getByLabelText(/torsión j/i));
      await user.type(screen.getByLabelText(/torsión j/i), '0.00002');
      await user.click(screen.getByRole('button', { name: /guardar barra/i }));
    }
    for (const id of ['N1', 'N4']) {
      await user.click(within(table(/nudos/i)).getByRole('button', { name: new RegExp(id) }));
      await user.click(screen.getByRole('button', { name: /empotrar/i }));
      await user.click(screen.getByRole('button', { name: /guardar nodo/i }));
    }

    expect((screen.getByRole('button', { name: /^analizar$/i }) as HTMLButtonElement).disabled).toBe(false);
    await user.click(screen.getByRole('button', { name: /^analizar$/i }));
    await waitFor(() => expect(screen.getByTestId('space3d-analysis-state').textContent).toBe('ready'));
  }, 30_000);

  it('reabre el modelo derivado en lugar de duplicarlo', async () => {
    const user = userEvent.setup();
    const source = planar();
    const storage = new MemoryStorage();
    const { view } = renderDerived(source, storage);

    await user.click(screen.getByRole('button', { name: /nuevo nodo/i }));
    await user.click(screen.getByRole('button', { name: /guardar nodo/i }));
    await waitFor(() => expect(storage.map.size).toBeGreaterThan(0));
    view.unmount();

    render(<Space3DWorkspace language="es" storage={storage} sourceProject={source} createViewport={stubViewport} />);
    expect(within(table(/nudos/i)).getAllByRole('row')).toHaveLength(6);
    expect([...storage.map.keys()].filter((key) => !key.endsWith(':backup'))).toHaveLength(1);
  });

  it('ofrece re-derivar sólo cuando el proyecto 2D cambió, sin sobrescribir sola', async () => {
    const user = userEvent.setup();
    const source = planar();
    const storage = new MemoryStorage();
    const { view } = renderDerived(source, storage);
    expect(screen.queryByRole('button', { name: /re-derivar/i })).toBeNull();
    view.unmount();

    const moved = { ...source, nodes: source.nodes.map((node, index) => (index === 2 ? { ...node, x: 6 } : node)) };
    render(<Space3DWorkspace language="es" storage={storage} sourceProject={moved} createViewport={stubViewport} />);
    expect(screen.getByText(/cambió desde que se derivó/i)).toBeDefined();
    // El modelo espacial sigue siendo el guardado hasta que el usuario decide.
    expect(within(table(/nudos/i)).getByRole('row', { name: /N3/ }).textContent).toContain('4');

    await user.click(screen.getByRole('button', { name: /re-derivar/i }));
    expect(within(table(/nudos/i)).getByRole('row', { name: /N3/ }).textContent).toContain('6');
  });

  it('no toca el almacenamiento del Space 3D independiente', async () => {
    const storage = new MemoryStorage();
    render(<Space3DWorkspace language="es" storage={storage} createViewport={stubViewport} />);
    await waitFor(() => expect(storage.getItem('structureco:space3d:v1')).toBeTruthy());
    const standalone = storage.getItem('structureco:space3d:v1');
    cleanup();

    render(<Space3DWorkspace language="es" storage={storage} sourceProject={planar()} createViewport={stubViewport} />);
    await waitFor(() => expect([...storage.map.keys()].some((key) => key.includes(':src:'))).toBe(true));
    expect(storage.getItem('structureco:space3d:v1')).toBe(standalone);
  });
});

describe('Space3DWorkspace analysis target and deformation scale', () => {
  it('deja elegir caso o combinación y analiza el objetivo seleccionado', async () => {
    const user = userEvent.setup();
    renderWorkspace();

    const target = screen.getByLabelText(/objetivo de análisis/i) as HTMLSelectElement;
    expect([...target.options].map((option) => option.value)).toEqual(['LC1', 'CO1']);
    expect(target.value).toBe('LC1');
    // Un caso y una combinación son objetos distintos del dominio: agrupados,
    // no una lista plana que los confunde.
    const groups = [...target.querySelectorAll('optgroup')].map((group) => group.getAttribute('label'));
    expect(groups).toEqual(['Caso de carga', 'Combinación']);

    await user.click(screen.getByRole('button', { name: /^analizar$/i }));
    await waitFor(() => expect(screen.getByTestId('space3d-analysis-state').textContent).toBe('ready'));
    await user.click(screen.getByRole('tab', { name: /resultados/i }));
    await user.selectOptions(screen.getByRole('combobox', { name: /tablas de resultados/i }), 'Nudos');
    const single = within(table(/desplazamiento/i)).getByRole('row', { name: /N4/ }).textContent;

    await user.selectOptions(screen.getByLabelText(/objetivo de análisis/i), 'CO1');
    // Cambiar de objetivo deja obsoleto el resultado anterior: describe otra carga.
    expect(screen.getByTestId('space3d-analysis-state').textContent).toBe('stale');

    await user.click(screen.getByRole('button', { name: /^analizar$/i }));
    await waitFor(() => expect(screen.getByTestId('space3d-analysis-state').textContent).toBe('ready'));
    expect(within(table(/desplazamiento/i)).getByRole('row', { name: /N4/ }).textContent).toBe(single);
  }, 30_000);

  it('permite amplificar la deformada sin tocar el modelo', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole('button', { name: /^analizar$/i }));
    await waitFor(() => expect(screen.getByTestId('space3d-analysis-state').textContent).toBe('ready'));

    const automatic = screen.getByTestId('space3d-deformation-scale').textContent;
    expect(Number(automatic)).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /duplicar la escala/i }));
    expect(Number(screen.getByTestId('space3d-deformation-scale').textContent)).toBeCloseTo(Number(automatic) * 2, 6);
    expect(screen.getByTestId('space3d-analysis-state').textContent).toBe('ready');

    // El texto de escala se anuncia como región viva: quien usa lector de
    // pantalla se entera del cambio sin tener que volver a enfocarlo.
    const readout = screen.getByTestId('space3d-deformation-scale').closest('[role="status"]');
    expect(readout?.getAttribute('aria-live')).toBe('polite');

    await user.click(screen.getByRole('button', { name: /escala automática/i }));
    expect(screen.getByTestId('space3d-deformation-scale').textContent).toBe(automatic);
  }, 30_000);

  it('acota la escala manual para que no se vuelva absurda ni inútil', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole('button', { name: /^analizar$/i }));
    await waitFor(() => expect(screen.getByTestId('space3d-analysis-state').textContent).toBe('ready'));

    const doubleButton = screen.getByRole('button', { name: /duplicar la escala/i });
    const halveButton = screen.getByRole('button', { name: /reducir la escala a la mitad/i });

    for (let click = 0; click < 10; click += 1) await user.click(doubleButton);
    expect((doubleButton as HTMLButtonElement).disabled).toBe(true);
    const capped = Number(screen.getByTestId('space3d-deformation-scale').textContent);

    await user.click(doubleButton);
    expect(Number(screen.getByTestId('space3d-deformation-scale').textContent)).toBe(capped);

    await user.click(screen.getByRole('button', { name: /escala automática/i }));
    for (let click = 0; click < 10; click += 1) await user.click(halveButton);
    expect((halveButton as HTMLButtonElement).disabled).toBe(true);
    const floored = Number(screen.getByTestId('space3d-deformation-scale').textContent);

    await user.click(halveButton);
    expect(Number(screen.getByTestId('space3d-deformation-scale').textContent)).toBe(floored);
  }, 30_000);
});
