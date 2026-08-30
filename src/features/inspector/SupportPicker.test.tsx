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
 * El arnés replica exactamente lo que hace el Inspector: recibe el preset y
 * deja que `applySupportPreset` decida el apoyo resultante. Probar el selector
 * contra otra regla de aplicación probaría un producto que no existe.
 */
const Harness = ({ initial }: { initial: SupportDefinition }) => {
  const [support, setSupport] = useState<SupportDefinition>(initial);
  return <>
    <SupportPicker
      support={support}
      selectionKey="node:N1"
      onApplyPreset={(preset) => setSupport((current) => applySupportPreset(current, preset))}
      onAngleChange={(angleDeg) => setSupport((current) => ({ ...current, angleDeg }))}
      onRestraintChange={(key, value) => setSupport((current) => ({ ...current, [key]: value }))}
    />
    <pre data-testid="model">{JSON.stringify(support)}</pre>
  </>;
};

const renderPicker = (initial: SupportDefinition = { type: 'none' }) =>
  render(<ProjectProvider><Harness initial={initial} /></ProjectProvider>);

const storedSupport = (): SupportDefinition => JSON.parse(screen.getByTestId('model').textContent ?? '{}');

const baseGroup = () => screen.getByRole('group', { name: /Condición de borde/ });
const readout = () => screen.getByRole('status');

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('selector de apoyos', () => {
  it('enseña las cinco condiciones de borde y marca la vigente', () => {
    renderPicker({ type: 'pin' });
    const group = baseGroup();
    expect(within(group).getAllByRole('radio')).toHaveLength(5);
    expect((within(group).getByRole('radio', { name: /Articulado/ }) as HTMLInputElement).checked).toBe(true);
    expect((within(group).getByRole('radio', { name: /Libre/ }) as HTMLInputElement).checked).toBe(false);
  });

  /**
   * La regla de accesibilidad del prototipo: una tarjeta no se interpreta por
   * el dibujo. Cada radio lleva su campo del modelo y sus grados de libertad en
   * la descripción, así que el lector de pantalla dice lo mismo que el símbolo.
   */
  it('cada tarjeta declara su campo del modelo y sus grados de libertad', () => {
    renderPicker({ type: 'pin' });
    const fixed = within(baseGroup()).getByRole('radio', { name: /Empotramiento/ });
    const description = document.getElementById(fixed.getAttribute('aria-describedby') ?? '');
    expect(description?.textContent).toContain('type = fixed');
    expect(description?.textContent).toContain('Ux restringido · Uy restringido · Rz restringido');
  });

  it('cambiar de condición de borde reescribe el apoyo', async () => {
    const user = userEvent.setup();
    renderPicker({ type: 'none' });
    await user.click(within(baseGroup()).getByRole('radio', { name: /Empotramiento/ }));
    expect(storedSupport().type).toBe('fixed');
    expect(within(readout()).getByText('Ecuaciones de apoyo en este nodo: 3')).toBeTruthy();
  });

  /** La capa 02 no existe para un empotramiento: no hay nada que orientar. */
  it('no ofrece dirección ni grados de libertad donde el tipo no los admite', () => {
    renderPicker({ type: 'fixed' });
    expect(screen.queryByRole('group', { name: /Dirección del rodillo/ })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Grados de libertad restringidos' })).toBeNull();
  });

  it('el rodillo abre sus tres presets de orientación y el ángulo sigue editable', async () => {
    const user = userEvent.setup();
    renderPicker({ type: 'roller', angleDeg: 90 });

    const direction = screen.getByRole('group', { name: /Dirección del rodillo/ });
    expect(within(direction).getAllByRole('radio')).toHaveLength(3);
    expect((within(direction).getByRole('radio', { name: /Suelo/ }) as HTMLInputElement).checked).toBe(true);

    await user.click(within(direction).getByRole('radio', { name: /Muro/ }));
    expect(storedSupport()).toMatchObject({ type: 'roller', angleDeg: 0 });

    const normal = screen.getByRole('textbox', { name: 'Normal' });
    await user.clear(normal);
    await user.type(normal, '37.125');
    await user.tab();
    expect(storedSupport().angleDeg).toBe(37.125);
  });

  /**
   * Un ángulo que no es de ningún preset no se redondea al más cercano ni
   * desmarca la capa en silencio: se dice que es propio y se conserva.
   */
  it('un ángulo propio no queda absorbido por ningún preset', () => {
    renderPicker({ type: 'roller', angleDeg: 37.125 });
    const direction = screen.getByRole('group', { name: /Dirección del rodillo/ });
    for (const radio of within(direction).getAllByRole('radio')) {
      expect((radio as HTMLInputElement).checked).toBe(false);
    }
    expect(screen.getByText(/Ángulo propio: 37.13°/)).toBeTruthy();
  });

  it('deja claro que suelo, muro e inclinado son el mismo tipo', () => {
    renderPicker({ type: 'roller' });
    const direction = screen.getByRole('group', { name: /Dirección del rodillo/ });
    for (const radio of within(direction).getAllByRole('radio')) {
      const description = document.getElementById(radio.getAttribute('aria-describedby') ?? '');
      expect(description?.textContent).toContain('angleDeg =');
      expect(description?.textContent).not.toContain('type =');
    }
    expect(screen.getByText(/presets de angleDeg sobre el mismo tipo rodillo/)).toBeTruthy();
  });

  it('las guías escriben personalizado con una sola casilla, y la matriz lo refleja', async () => {
    const user = userEvent.setup();
    renderPicker({ type: 'custom' });

    const guides = screen.getByRole('group', { name: /Guías y grados de libertad/ });
    await user.click(within(guides).getByRole('radio', { name: /Guía horizontal/ }));
    expect(storedSupport()).toMatchObject({ type: 'custom', restrainX: false, restrainY: true, restrainR: false });

    const matrix = screen.getByRole('group', { name: 'Grados de libertad restringidos' });
    expect((within(matrix).getByRole('checkbox', { name: 'Uy' }) as HTMLInputElement).checked).toBe(true);
    expect((within(matrix).getByRole('checkbox', { name: 'Ux' }) as HTMLInputElement).checked).toBe(false);

    /* Marcar Ux a mano deja de ser una guía reconocible, y ninguna tarjeta
       debe quedarse marcada mintiendo. */
    await user.click(within(matrix).getByRole('checkbox', { name: 'Ux' }));
    for (const radio of within(guides).getAllByRole('radio')) {
      expect((radio as HTMLInputElement).checked).toBe(false);
    }
  });

  it('lee el apoyo en su normal cuando es un rodillo, y en Ux/Uy cuando no', () => {
    const { unmount } = renderPicker({ type: 'roller', angleDeg: 45 });
    expect(within(readout()).getByText('Normal restringido · Tangencial libre · Rz libre')).toBeTruthy();
    unmount();

    renderPicker({ type: 'pin' });
    expect(within(readout()).getByText('Ux restringido · Uy restringido · Rz libre')).toBeTruthy();
  });

  /** La rigidez no es una condición de borde: se anuncia, no se mezcla. */
  it('anuncia la rigidez activa sin convertirla en un tipo de apoyo', () => {
    renderPicker({ type: 'pin', spring: { kx: 0, ky: 900, kNormal: 400 } });
    expect(screen.getByText(/Rigidez elástica activa \(ky, kNormal\)/)).toBeTruthy();
    expect(within(baseGroup()).queryByRole('radio', { name: /esorte/ })).toBeNull();
  });

  it('no anuncia rigidez donde no hay ninguna con valor', () => {
    renderPicker({ type: 'pin', spring: { kx: 0 } });
    expect(screen.queryByText(/Rigidez elástica activa/)).toBeNull();
  });
});
