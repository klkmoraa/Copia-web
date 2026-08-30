// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ProjectProvider } from '../../store/ProjectContext';
import type { SupportDefinition } from '../../types';
import { SupportPicker } from './SupportPicker';
import { applySupportPreset } from './supportCatalog';

/**
 * El arnés replica exactamente lo que hace el Inspector: recibe la entrada y
 * deja que `applySupportPreset` decida el apoyo resultante. Probar el selector
 * contra otra regla de aplicación probaría un producto que no existe.
 */
const Harness = ({ initial, classroomMode = false, settlementCount = 0 }: {
  initial: SupportDefinition;
  classroomMode?: boolean;
  settlementCount?: number;
}) => {
  const [support, setSupport] = useState<SupportDefinition>(initial);
  return <>
    <SupportPicker
      support={support}
      selectionKey="node:N1"
      units="kN-m"
      classroomMode={classroomMode}
      settlementCount={settlementCount}
      onApplyPreset={(entry) => setSupport((current) => applySupportPreset(current, entry))}
      onAngleChange={(angleDeg) => setSupport((current) => ({ ...current, angleDeg }))}
      onVisualAngleChange={(angleDeg) => setSupport((current) => {
        const next = { ...current };
        if (angleDeg === null) delete next.angleDeg; else next.angleDeg = angleDeg;
        return next;
      })}
      onRestraintChange={(key, value) => setSupport((current) => ({ ...current, [key]: value }))}
      onSpringChange={(key, value) => setSupport((current) => ({ ...current, spring: { ...current.spring, [key]: value } }))}
    />
    <pre data-testid="model">{JSON.stringify(support)}</pre>
  </>;
};

const renderPicker = (initial: SupportDefinition = { type: 'none' }, props: {
  classroomMode?: boolean;
  settlementCount?: number;
} = {}) => render(<ProjectProvider><Harness initial={initial} {...props} /></ProjectProvider>);

const storedSupport = (): SupportDefinition => JSON.parse(screen.getByTestId('model').textContent ?? '{}');
const tile = (name: RegExp) => screen.getByRole('button', { name });
const openTab = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(screen.getByRole('tab', { name }));
};

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('selector de apoyos', () => {
  it('reparte el catálogo en cuatro familias y abre la del apoyo vigente', () => {
    renderPicker({ type: 'custom', restrainY: true, restrainR: true });
    expect(screen.getByRole('tab', { name: 'Básicos' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Guiados' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Elásticos' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Avanzado' })).toBeTruthy();
    /* El nudo es una guía, así que la pestaña abierta es la suya. */
    expect(screen.getByRole('tab', { name: 'Guiados' }).getAttribute('aria-selected')).toBe('true');
    expect(tile(/Guía horizontal/).getAttribute('aria-pressed')).toBe('true');
  });

  /**
   * La regla del prototipo: una tarjeta no se interpreta por el dibujo. El
   * nombre y la línea de grados de libertad van siempre, en la notación de la
   * leyenda.
   */
  it('cada mosaico lleva su nombre y su línea de grados de libertad', () => {
    renderPicker({ type: 'pin' });
    expect(tile(/Empotramiento/).textContent).toContain('Ux ✕ · Uy ✕ · Rz ✕');
    expect(tile(/Rodillo suelo/).textContent).toContain('Normal 90° · Rz ✓');
    expect(tile(/Rodillo muro/).textContent).toContain('Normal 0° · Rz ✓');
  });

  it('cambiar de condición de borde reescribe el apoyo y la lectura', async () => {
    const user = userEvent.setup();
    renderPicker({ type: 'none' });
    await user.click(tile(/Empotramiento/));
    expect(storedSupport().type).toBe('fixed');
    expect(screen.getByText('Ecuaciones de apoyo en este nodo: 3')).toBeTruthy();
    expect(screen.getByText('Ux restringido · Uy restringido · Rz restringido')).toBeTruthy();
  });

  /**
   * LA DISTINCIÓN QUE EL PROTOTIPO PIDE EXPLÍCITAMENTE. En un rodillo el ángulo
   * es la normal que el solver restringe; en un empotramiento sólo gira el
   * dibujo. Son dos controles distintos porque son dos cosas distintas.
   */
  it('ofrece normal física al rodillo y orientación visual al empotramiento', async () => {
    const user = userEvent.setup();
    renderPicker({ type: 'roller', angleDeg: 90 });

    expect(screen.getByRole('heading', { name: 'Normal del rodillo' })).toBeTruthy();
    expect((screen.getByRole('textbox', { name: 'Normal' }) as HTMLInputElement).value).toBe('90');
    expect(screen.queryByRole('group', { name: 'Orientación visual' })).toBeNull();

    await user.click(tile(/Empotramiento/));
    expect(screen.queryByRole('textbox', { name: 'Normal' })).toBeNull();
    const orientation = screen.getByRole('group', { name: 'Orientación visual' });
    expect((within(orientation).getByRole('button', { name: 'Auto' })).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('El giro sólo cambia el símbolo. La restricción sigue siendo Ux, Uy y Rz.')).toBeTruthy();

    await user.click(within(orientation).getByRole('button', { name: '180°' }));
    expect(storedSupport()).toMatchObject({ type: 'fixed', angleDeg: 180 });
    /* Y girar el símbolo no toca ni una restricción. */
    expect(screen.getByText('Ecuaciones de apoyo en este nodo: 3')).toBeTruthy();

    await user.click(within(orientation).getByRole('button', { name: 'Auto' }));
    expect(storedSupport().angleDeg).toBeUndefined();
  });

  it('un ángulo propio de rodillo se conserva y se declara como propio', () => {
    renderPicker({ type: 'roller', angleDeg: 37.125 });
    expect(tile(/Rodillo inclinado/).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/Ángulo propio: 37.13°/)).toBeTruthy();
  });

  it('las guías restringen el giro y la matriz manual lo refleja', async () => {
    const user = userEvent.setup();
    renderPicker({ type: 'none' });
    await openTab(user, 'Guiados');
    await user.click(tile(/Guía vertical/));
    expect(storedSupport()).toMatchObject({ type: 'custom', restrainX: true, restrainY: false, restrainR: true });

    const matrix = screen.getByRole('group', { name: 'Grados de libertad restringidos' });
    expect((within(matrix).getByRole('checkbox', { name: 'Rz' }) as HTMLInputElement).checked).toBe(true);

    /* Soltar el giro deja de ser una guía: ninguna tarjeta debe quedarse
       marcada mintiendo, y la que describe el estado pasa a ser Personalizado. */
    await user.click(within(matrix).getByRole('checkbox', { name: 'Rz' }));
    expect(tile(/Guía vertical/).getAttribute('aria-pressed')).toBe('false');
    expect(tile(/Personalizado/).getAttribute('aria-pressed')).toBe('true');
  });

  /** Una rigidez no es una condición de borde: vive en su familia y no toca el tipo. */
  it('un resorte abre su campo sin cambiar el tipo de apoyo', async () => {
    const user = userEvent.setup();
    renderPicker({ type: 'pin' });
    await openTab(user, 'Elásticos');
    await user.click(tile(/Resorte Y/));

    expect(storedSupport().type).toBe('pin');
    const field = screen.getByRole('textbox', { name: 'ky' });
    expect((field as HTMLInputElement).value).toBe('0');
    expect(screen.getByText('No se asignan rigideces automáticas: el valor tiene que ser un dato físico.')).toBeTruthy();

    await user.clear(field);
    await user.type(field, '900');
    await user.tab();
    expect(storedSupport().spring).toMatchObject({ ky: 900 });
    expect(tile(/Resorte Y/).getAttribute('aria-pressed')).toBe('true');

    /* Y al volver a Básicos el nudo sigue siendo el articulado que era: una
       rigidez se suma a la condición de borde, no la sustituye. */
    await openTab(user, 'Básicos');
    expect(tile(/Articulado/).getAttribute('aria-pressed')).toBe('true');
  });

  it('el resorte normal expone su dirección y avisa cuando discrepa del rodillo', async () => {
    const user = userEvent.setup();
    renderPicker({ type: 'roller', angleDeg: 30, spring: { kNormal: 800 } });
    await openTab(user, 'Elásticos');
    await user.click(tile(/Resorte normal/));

    const direction = screen.getByRole('textbox', { name: 'Dirección de kn' });
    expect((direction as HTMLInputElement).value).toBe('90');
    expect(screen.getByText(/El resorte normal actúa a 90.00° y la normal del rodillo está a 30.00°/)).toBeTruthy();

    await user.clear(direction);
    await user.type(direction, '30');
    await user.tab();
    expect(screen.queryByText(/El resorte normal actúa a/)).toBeNull();
  });

  it('bloquea la familia elástica en modo Aula, sin perder los valores', async () => {
    const user = userEvent.setup();
    renderPicker({ type: 'pin', spring: { ky: 900 } }, { classroomMode: true });
    await openTab(user, 'Elásticos');
    await user.click(tile(/Resorte Y/));
    expect(screen.getByText('Resortes bloqueados en modo Aula')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'ky' })).toBeNull();
    expect(storedSupport().spring).toMatchObject({ ky: 900 });
  });

  /**
   * LA HONESTIDAD, EN LA INTERFAZ. Las cuatro condiciones de contacto se
   * enseñan porque explican dónde está el límite, pero no se pueden pulsar:
   * este motor no las resuelve y una tarjeta que promete lo que no hay es peor
   * que su ausencia.
   */
  it('enseña las condiciones que el motor no tiene, sin dejar aplicarlas', async () => {
    const user = userEvent.setup();
    renderPicker({ type: 'pin' });
    await openTab(user, 'Avanzado');

    const friction = tile(/Fricción/);
    expect(friction.getAttribute('aria-disabled')).toBe('true');
    await user.click(friction);
    expect(storedSupport()).toEqual({ type: 'pin' });
    expect(screen.queryByText(/Este motor no resuelve contacto no lineal/)).toBeNull();

    /* El asiento impuesto sí existe, y dice dónde se edita. */
    await user.click(tile(/Asiento impuesto/));
    expect(screen.getByText('Los asientos se editan por caso de carga en Propiedades avanzadas.')).toBeTruthy();
  });

  it('abre la biblioteca completa, con las conexiones y la regla de orientación', async () => {
    const user = userEvent.setup();
    renderPicker({ type: 'pin' });
    await user.click(screen.getByRole('button', { name: 'Ver todos los apoyos y restricciones' }));

    const library = screen.getByRole('dialog', { name: /Sistema de apoyos/ });
    expect(within(library).getByRole('heading', { name: 'Conexiones · no son apoyos externos' })).toBeTruthy();
    expect(within(library).getByText('Articulación interna')).toBeTruthy();
    expect(within(library).getByText('Semirrígida')).toBeTruthy();
    expect(within(library).getAllByText('No disponible en este motor')).toHaveLength(4);
    expect(within(library).getByRole('heading', { name: 'Regla de orientación' })).toBeTruthy();
    expect(within(library).getByText('El ángulo es la normal física de la restricción, y el análisis la usa.')).toBeTruthy();
  });
});
