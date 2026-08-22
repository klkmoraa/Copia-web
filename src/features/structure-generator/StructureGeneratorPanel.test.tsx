// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { generateStructure } from '../../data/generators/structureGenerators';
import type { GeneratorWarning } from '../../data/generators/generatorTypes';
import type { UnitSystemId } from '../../types';
import { StructureGeneratorPanel, type StructureGeneratorPanelProps } from './StructureGeneratorPanel';
import {
  DEFAULT_GENERATOR_FORM,
  buildGeneratorParams,
  type GeneratorFormState,
} from './structureGeneratorForm';

afterEach(cleanup);

const UNITS: UnitSystemId = 'kN-m';

/** Sin espera entre pulsaciones: el panel no depende del ritmo de tecleo. */
const setup = () => userEvent.setup({ delay: null });

const prepared = (overrides: Partial<GeneratorFormState> = {}, units: UnitSystemId = UNITS) => {
  const result = buildGeneratorParams({ ...DEFAULT_GENERATOR_FORM, ...overrides }, units);
  if (!result.ok) throw new Error('El fixture debería ser válido.');
  return generateStructure(result.params);
};

/**
 * Monta el panel con estado real de formulario, que es como vive: el borrador es
 * suyo y lo que se prueba es el recorrido completo de teclear a revisar.
 */
const Harness = ({
  initial = {},
  units = UNITS,
  ...props
}: Partial<StructureGeneratorPanelProps> & { initial?: Partial<GeneratorFormState> }) => {
  const [form, setForm] = useState<GeneratorFormState>({ ...DEFAULT_GENERATOR_FORM, ...initial });
  const built = buildGeneratorParams(form, units);
  const structure = built.ok ? generateStructure(built.params) : null;
  return <StructureGeneratorPanel
    form={form}
    onFormChange={setForm}
    errors={built.ok ? {} : built.errors}
    units={units}
    language="es"
    summary={structure?.summary ?? null}
    warnings={structure?.warnings ?? []}
    onGenerate={() => undefined}
    onCancel={() => undefined}
    {...props}
  />;
};

const staticPanel = (props: Partial<StructureGeneratorPanelProps> = {}) => {
  const structure = prepared();
  return render(<StructureGeneratorPanel
    form={DEFAULT_GENERATOR_FORM}
    onFormChange={() => undefined}
    errors={{}}
    units={UNITS}
    language="es"
    summary={structure.summary}
    warnings={structure.warnings}
    onGenerate={() => undefined}
    onCancel={() => undefined}
    {...props}
  />);
};

const summaryValue = (id: string) =>
  document.querySelector(`[data-summary-row="${id}"] strong`)?.textContent;

describe('parámetros por familia', () => {
  it('muestra sólo las separaciones que la familia activa consume', async () => {
    const user = setup();
    render(<Harness />);
    expect(document.querySelector('[data-spacing-field="spans"]')).not.toBeNull();
    expect(document.querySelector('[data-spacing-field="bays"]')).toBeNull();

    await user.click(screen.getByRole('radio', { name: 'Marco multinivel' }));
    expect(document.querySelector('[data-spacing-field="bays"]')).not.toBeNull();
    expect(document.querySelector('[data-spacing-field="stories"]')).not.toBeNull();
    expect(document.querySelector('[data-spacing-field="spans"]')).toBeNull();
  });

  it('ofrece el peralte y la topología sólo en la cercha', async () => {
    const user = setup();
    render(<Harness />);
    expect(screen.queryByLabelText('Peralte')).toBeNull();
    await user.click(screen.getByRole('radio', { name: 'Cercha' }));
    expect(screen.getByLabelText('Peralte')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Pratt' })).toBeTruthy();
  });

  it('sólo deja quitar montantes en la Warren, que es la única que puede prescindir de ellos', async () => {
    const user = setup();
    render(<Harness initial={{ family: 'truss', topology: 'pratt' }} />);
    expect(screen.queryByRole('checkbox', { name: /montantes/i })).toBeNull();
    await user.click(screen.getByRole('radio', { name: 'Warren' }));
    expect(screen.getByRole('checkbox', { name: /montantes/i })).toBeTruthy();
  });

  it('cambiar de familia recalcula el resumen exacto', async () => {
    const user = setup();
    render(<Harness />);
    expect(summaryValue('nodes')).toBe(String(prepared().nodes.length));
    await user.click(screen.getByRole('radio', { name: 'Pórtico' }));
    expect(summaryValue('nodes')).toBe(String(prepared({ family: 'portal-frame' }).nodes.length));
  });
});

describe('separaciones personalizadas', () => {
  it('alterna a lista y genera con separaciones desiguales', async () => {
    const user = setup();
    render(<Harness />);
    const spans = document.querySelector('[data-spacing-field="spans"]') as HTMLElement;
    await user.click(within(spans).getByRole('radio', { name: 'Personalizada' }));
    const list = within(spans).getByLabelText('Claros: separaciones');
    await user.clear(list);
    await user.type(list, '4, 6, 4, 6');
    expect(summaryValue('nodes')).toBe('5');
    expect(within(spans).getByText('4 divisiones')).toBeTruthy();
  });

  it('vuelve a uniforme sin perder lo escrito en la lista', async () => {
    const user = setup();
    render(<Harness />);
    const spans = document.querySelector('[data-spacing-field="spans"]') as HTMLElement;
    await user.click(within(spans).getByRole('radio', { name: 'Personalizada' }));
    await user.type(within(spans).getByLabelText('Claros: separaciones'), '4, 6');
    await user.click(within(spans).getByRole('radio', { name: 'Uniforme' }));
    await user.click(within(spans).getByRole('radio', { name: 'Personalizada' }));
    expect((within(spans).getByLabelText('Claros: separaciones') as HTMLInputElement).value).toBe('4, 6');
  });

  it('señala el error en el campo que lo produjo y retira la vista previa', async () => {
    const user = setup();
    render(<Harness />);
    const spans = document.querySelector('[data-spacing-field="spans"]') as HTMLElement;
    await user.click(within(spans).getByRole('radio', { name: 'Personalizada' }));
    await user.type(within(spans).getByLabelText('Claros: separaciones'), '4, 0');
    expect(within(spans).getByRole('alert').textContent).toContain('2');
    expect(document.querySelector('[data-summary-row="nodes"]')).toBeNull();
    expect((screen.getByRole('button', { name: 'Revisar' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('origen y apoyos', () => {
  it('el origen y el apoyo viven tras una revelación progresiva, no estorbando', async () => {
    const user = setup();
    render(<Harness />);
    const disclosure = screen.getByRole('button', { name: 'Origen de inserción' });
    expect(disclosure.getAttribute('aria-expanded')).toBe('false');
    // Plegado significa fuera del árbol de accesibilidad, no sólo invisible.
    expect(screen.queryByRole('textbox', { name: 'Origen X' })).toBeNull();
    await user.click(disclosure);
    expect(disclosure.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('textbox', { name: 'Origen X' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Ninguno' }).getAttribute('aria-checked')).toBe('true');
  });

  it('traslada la geometría al escribir un origen', async () => {
    const user = setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Origen de inserción' }));
    const originX = screen.getByLabelText('Origen X');
    await user.clear(originX);
    await user.type(originX, '10');
    expect(summaryValue('extent')).toContain('15');
  });

  it('sólo ofrece elegir en el lienzo cuando hay quien lo atienda', async () => {
    const user = setup();
    const onToggleOriginPick = vi.fn();
    const { rerender } = render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Origen de inserción' }));
    expect(screen.queryByRole('button', { name: 'Elegir en el lienzo' })).toBeNull();

    // El pliegue sigue abierto: sólo aparece el control que ahora tiene destino.
    rerender(<Harness onToggleOriginPick={onToggleOriginPick} />);
    await user.click(screen.getByRole('button', { name: 'Elegir en el lienzo' }));
    expect(onToggleOriginPick).toHaveBeenCalledTimes(1);
  });

  it('avisa de que no hay apoyos y deja de avisar cuando se eligen', async () => {
    const user = setup();
    render(<Harness initial={{ family: 'portal-frame' }} />);
    expect(screen.getByText('Sin apoyos')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Origen de inserción' }));
    await user.click(screen.getByRole('radio', { name: 'Empotramiento' }));
    expect(screen.queryByText('Sin apoyos')).toBeNull();
    expect(summaryValue('supports')).toBe('3');
  });
});

describe('propiedades base', () => {
  it('personalizar parte de los números del catálogo activo', async () => {
    const user = setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Propiedades base' }));
    await user.click(screen.getByRole('radio', { name: 'Personalizadas' }));
    expect((screen.getByLabelText('Módulo E') as HTMLInputElement).value).not.toBe('');
    expect((screen.getByLabelText('Área A') as HTMLInputElement).value).not.toBe('');
    // Los mismos números: personalizar no cambia el modelo por sí solo.
    expect(summaryValue('nodes')).toBe(String(prepared().nodes.length));
  });

  it('nombra en el resumen la identidad de catálogo aplicada', async () => {
    const user = setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Propiedades base' }));
    await user.selectOptions(screen.getByLabelText('Material'), 'steel-a36');
    expect(summaryValue('material')).toBe('steel-a36');
  });
});

describe('revisión antes de generar', () => {
  it('no genera desde la pantalla de parámetros: exige revisar primero', async () => {
    const user = setup();
    const onGenerate = vi.fn();
    staticPanel({ onGenerate });
    expect(screen.queryByRole('button', { name: 'Generar' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Revisar' }));
    expect(onGenerate).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Generar' }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it('la revisión enseña el resumen exacto y los avisos', async () => {
    const user = setup();
    staticPanel();
    await user.click(screen.getByRole('button', { name: 'Revisar' }));
    expect(document.querySelector('[data-structure-generator-view]')?.getAttribute('data-structure-generator-view')).toBe('review');
    expect(summaryValue('nodes')).toBe(String(prepared().nodes.length));
    expect(screen.getByText('Sin apoyos')).toBeTruthy();
    expect(screen.getByText(/no toca el modelo/i)).toBeTruthy();
  });

  it('volver conserva el borrador en vez de descartarlo', async () => {
    const user = setup();
    render(<Harness />);
    const spans = document.querySelector('[data-spacing-field="spans"]') as HTMLElement;
    const count = within(spans).getByLabelText('Claros: cantidad');
    await user.clear(count);
    await user.type(count, '6');
    await user.click(screen.getByRole('button', { name: 'Revisar' }));
    await user.click(screen.getByRole('button', { name: 'Volver a los parámetros' }));
    expect((within(document.querySelector('[data-spacing-field="spans"]') as HTMLElement)
      .getByLabelText('Claros: cantidad') as HTMLInputElement).value).toBe('6');
  });

  it('un commit rechazado conserva la revisión, para no rehacer el trabajo', async () => {
    const user = setup();
    staticPanel({ onGenerate: () => false, error: 'La vista previa quedó obsoleta.' });
    await user.click(screen.getByRole('button', { name: 'Revisar' }));
    await user.click(screen.getByRole('button', { name: 'Generar' }));
    expect(document.querySelector('[data-structure-generator-view]')?.getAttribute('data-structure-generator-view')).toBe('review');
    expect(screen.getByRole('alert').textContent).toContain('obsoleta');
  });

  it('no deja confirmar mientras haya un fallo sin resolver', async () => {
    const user = setup();
    staticPanel({ error: 'La vista previa de generación quedó obsoleta porque el proyecto cambió.' });
    await user.click(screen.getByRole('button', { name: 'Revisar' }));
    expect((screen.getByRole('button', { name: 'Generar' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toContain('obsoleta');
  });

  it('unos parámetros que dejan de ser válidos abandonan la revisión abierta', async () => {
    const user = setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Revisar' }));
    expect(screen.getByRole('button', { name: 'Generar' })).toBeTruthy();
    // Sale de la revisión sola: ya no describe nada que se pueda crear.
    const spans = document.querySelector('[data-spacing-field="spans"]');
    expect(spans).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Volver a los parámetros' }));
    const count = within(document.querySelector('[data-spacing-field="spans"]') as HTMLElement)
      .getByLabelText('Claros: cantidad');
    await user.clear(count);
    expect(screen.queryByRole('button', { name: 'Generar' })).toBeNull();
    expect((screen.getByRole('button', { name: 'Revisar' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('cancelar no genera nada', async () => {
    const user = setup();
    const onCancel = vi.fn();
    const onGenerate = vi.fn();
    staticPanel({ onCancel, onGenerate });
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onGenerate).not.toHaveBeenCalled();
  });
});

describe('resumen y avisos', () => {
  it('separa los avisos que piden una decisión de los que sólo informan', () => {
    const warnings: GeneratorWarning[] = [
      { code: 'no-supports', message: 'Sin apoyos.' },
      { code: 'non-uniform-truss-panels', message: 'Paneles desiguales.' },
    ];
    staticPanel({ warnings });
    const items = [...document.querySelectorAll('[data-warning-tone]')];
    expect(items.map((item) => item.getAttribute('data-warning-tone'))).toEqual(['decision', 'info']);
  });

  it('no promete cifras cuando no hay geometría preparada', () => {
    staticPanel({ summary: null, warnings: [] });
    expect(document.querySelector('[data-summary-row="nodes"]')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Corrige los parámetros');
  });

  it('expresa el resumen en las unidades del proyecto', () => {
    const structure = prepared({}, 'kip-ft');
    render(<StructureGeneratorPanel
      form={DEFAULT_GENERATOR_FORM}
      onFormChange={() => undefined}
      errors={{}}
      units="kip-ft"
      language="es"
      summary={structure.summary}
      warnings={[]}
      onGenerate={() => undefined}
      onCancel={() => undefined}
    />);
    expect(summaryValue('totalLength')).toContain('ft');
  });
});
