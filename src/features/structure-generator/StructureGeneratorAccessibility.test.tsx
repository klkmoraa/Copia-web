// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { generateStructure } from '../../data/generators/structureGenerators';
import type { UnitSystemId } from '../../types';
import { StructureGeneratorPanel } from './StructureGeneratorPanel';
import { DEFAULT_GENERATOR_FORM, buildGeneratorParams, type GeneratorFormState } from './structureGeneratorForm';

/**
 * Accesibilidad de «Generar estructura».
 *
 * Lo que se comprueba aquí no es que existan atributos, sino que alguien que
 * navega con teclado o con lector de pantalla pueda hacer el recorrido entero:
 * elegir familia, corregir un error que se le señala, revisar y confirmar, sin
 * que el foco se pierda ni un cambio ocurra en silencio.
 */

afterEach(cleanup);

const UNITS: UnitSystemId = 'kN-m';
const setup = () => userEvent.setup({ delay: null });

const defaultStructure = () => {
  const built = buildGeneratorParams(DEFAULT_GENERATOR_FORM, UNITS);
  if (!built.ok) throw new Error('El formulario inicial debería ser válido.');
  return generateStructure(built.params);
};

const Harness = ({ initial = {} }: { initial?: Partial<GeneratorFormState> }) => {
  const [form, setForm] = useState<GeneratorFormState>({ ...DEFAULT_GENERATOR_FORM, ...initial });
  const built = buildGeneratorParams(form, UNITS);
  const structure = built.ok ? generateStructure(built.params) : null;
  return <StructureGeneratorPanel
    form={form}
    onFormChange={setForm}
    errors={built.ok ? {} : built.errors}
    units={UNITS}
    language="es"
    summary={structure?.summary ?? null}
    warnings={structure?.warnings ?? []}
    onGenerate={() => undefined}
    onCancel={() => undefined}
  />;
};

describe('estructura semántica', () => {
  it('la superficie se anuncia por su nombre y no se hace pasar por un diálogo modal', () => {
    render(<Harness />);
    const surface = screen.getByRole('region', { name: 'Generar estructura' });
    // No es modal: el lienzo de detrás sigue siendo del usuario mientras ajusta.
    expect(surface.getAttribute('aria-modal')).toBeNull();
    // `region` es el rol implícito de una `section` con nombre, no un `role`
    // pegado encima: la semántica viene del elemento correcto.
    expect(surface.tagName).toBe('SECTION');
  });

  it('cada grupo de opciones es un radiogroup con nombre, no botones sueltos', () => {
    render(<Harness />);
    expect(screen.getByRole('radiogroup', { name: 'Familia' })).toBeTruthy();
    const spans = document.querySelector('[data-spacing-field="spans"]') as HTMLElement;
    expect(within(spans).getByRole('radiogroup', { name: 'Separación de Claros' })).toBeTruthy();
  });

  it('el resumen y los avisos son regiones nombradas, alcanzables por lector', () => {
    render(<Harness />);
    expect(screen.getByRole('region', { name: 'Se crearían' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Antes de confirmar' })).toBeTruthy();
  });

  it('las secciones plegadas quedan fuera del árbol de accesibilidad', () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Propiedades base' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('combobox', { name: 'Material' })).toBeNull();
  });
});

describe('teclado', () => {
  it('recorre familia, geometría y acciones sin trampas de foco', async () => {
    const user = setup();
    render(<Harness />);
    await user.tab();
    // El primer control es el cierre; desde ahí se llega a la familia.
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Cerrar generador');
    await user.tab();
    expect(document.activeElement?.getAttribute('role')).toBe('radio');
  });

  it('las flechas mueven entre familias y cambian la geometría, como un radiogroup real', async () => {
    const user = setup();
    render(<Harness />);
    const beam = screen.getByRole('radio', { name: 'Viga continua' });
    beam.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Pórtico' }).getAttribute('aria-checked')).toBe('true');
  });

  it('Escape en los parámetros cancela y en la revisión sólo vuelve atrás', async () => {
    const user = setup();
    let cancelled = 0;
    const structure = defaultStructure();
    render(<StructureGeneratorPanel
      form={DEFAULT_GENERATOR_FORM}
      onFormChange={() => undefined}
      errors={{}}
      units={UNITS}
      language="es"
      summary={structure.summary}
      warnings={structure.warnings}
      onGenerate={() => undefined}
      onCancel={() => { cancelled += 1; }}
    />);

    await user.click(screen.getByRole('button', { name: 'Revisar' }));
    await user.keyboard('{Escape}');
    expect(cancelled).toBe(0);
    expect(screen.getByRole('button', { name: 'Revisar' })).toBeTruthy();

    await user.keyboard('{Escape}');
    expect(cancelled).toBe(1);
  });
});

describe('foco', () => {
  it('al abrir, el foco entra en la superficie y Escape la alcanza', async () => {
    const user = setup();
    render(<>
      <button type="button">lanzador</button>
      <Harness />
    </>);
    // Sin esto, Escape se lo queda quien abrió el panel y cerrar con teclado
    // exige tabular a ciegas hasta dentro.
    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Generar estructura' }));
    await user.tab();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Cerrar generador');
  });

  it('al cerrarse, el foco vuelve a quien la abrió y no cae en el cuerpo', async () => {
    const user = setup();
    const Container = () => {
      const [open, setOpen] = useState(true);
      return <>
        <button type="button" onClick={() => setOpen(true)}>lanzador</button>
        {open ? <StructureGeneratorPanel
          form={DEFAULT_GENERATOR_FORM}
          onFormChange={() => undefined}
          errors={{}}
          units={UNITS}
          language="es"
          summary={defaultStructure().summary}
          warnings={[]}
          onGenerate={() => undefined}
          onCancel={() => setOpen(false)}
        /> : null}
      </>;
    };
    const launcher = document.createElement('button');
    document.body.append(launcher);
    launcher.focus();
    render(<Container />);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(document.activeElement).toBe(launcher);
    launcher.remove();
  });

  it('al abrir la revisión el foco va a su encabezado, no al cuerpo', async () => {
    const user = setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Revisar' }));
    expect(document.activeElement?.textContent).toBe('Revisa antes de generar');
    expect(document.activeElement).not.toBe(document.body);
  });

  it('al volver, el foco regresa al control que abrió la revisión', async () => {
    const user = setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Revisar' }));
    await user.click(screen.getByRole('button', { name: 'Volver a los parámetros' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Revisar' }));
  });
});

describe('errores y estado', () => {
  it('un campo inválido se marca y su mensaje queda asociado al control', async () => {
    const user = setup();
    render(<Harness />);
    const spans = document.querySelector('[data-spacing-field="spans"]') as HTMLElement;
    await user.click(within(spans).getByRole('radio', { name: 'Personalizada' }));
    const list = within(spans).getByRole('textbox', { name: 'Claros: separaciones' });
    await user.type(list, '4, 0');

    expect(list.getAttribute('aria-invalid')).toBe('true');
    const messageId = list.getAttribute('aria-errormessage');
    expect(messageId).toBeTruthy();
    const message = document.getElementById(messageId!);
    expect(message?.getAttribute('role')).toBe('alert');
    expect(list.getAttribute('aria-describedby')).toContain(messageId!);
  });

  it('la razón por la que no se puede revisar es texto anunciado, no un botón mudo', async () => {
    const user = setup();
    render(<Harness />);
    const spans = document.querySelector('[data-spacing-field="spans"]') as HTMLElement;
    await user.clear(within(spans).getByRole('spinbutton', { name: 'Claros: cantidad' }));
    // Un botón deshabilitado no recibe foco ni puntero: el motivo va aparte.
    expect(screen.getByRole('status').textContent).toContain('Corrige los parámetros');
    expect((screen.getByRole('button', { name: 'Revisar' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('el aviso de que no hay apoyos se lee, no sólo se colorea', () => {
    render(<Harness />);
    const warnings = screen.getByRole('region', { name: 'Antes de confirmar' });
    expect(within(warnings).getByText('Sin apoyos')).toBeTruthy();
    expect(within(warnings).getByText(/Añádelos antes de analizar/)).toBeTruthy();
  });
});
