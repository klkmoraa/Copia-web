// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Button, Field, IconButton, SegmentedControl, Select } from './controls';

beforeAll(() => {
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0);
    window.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);
  }
});

afterEach(() => cleanup());

describe('component-library controls', () => {
  it('keeps loading buttons inert and exposes their busy state', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button loading loadingLabel="Guardando" onClick={onClick}>Guardar</Button>);

    const button = screen.getByRole('button', { name: 'Guardando' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Guardando');
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('announces the active action for a loading icon button', () => {
    render(<IconButton label="Exportar" loading loadingLabel="Exportando">icon</IconButton>);
    const button = screen.getByRole('button', { name: 'Exportando' });
    expect(button.getAttribute('aria-busy')).toBe('true');
  });

  it('connects field hints and errors to their controls', () => {
    render(<>
      <Field label="Nombre" hint="Etiqueta breve" defaultValue="M-04" />
      <Field label="Longitud" error="Valor requerido" defaultValue="" />
    </>);

    const named = screen.getByRole('textbox', { name: 'Nombre' });
    const invalid = screen.getByRole('textbox', { name: 'Longitud' });
    expect(document.getElementById(named.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Etiqueta breve');
    expect(invalid.getAttribute('aria-invalid')).toBe('true');
    expect(invalid.getAttribute('aria-errormessage')).toBe(invalid.getAttribute('aria-describedby'));
    expect(document.getElementById(invalid.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Valor requerido');
    expect(screen.getByRole('alert').textContent).toBe('Valor requerido');
  });

  it('emits native select changes and skips disabled segmented options with the keyboard', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onMode = vi.fn();
    const { rerender } = render(<>
      <Select label="Material" defaultValue="steel" onChange={onSelect}>
        <option value="steel">Acero</option><option value="wood">Madera</option>
      </Select>
      <SegmentedControl
        label="Modo"
        value="select"
        options={[{ value: 'select', label: 'Seleccionar' }, { value: 'locked', label: 'Bloqueado', disabled: true }, { value: 'draw', label: 'Dibujar' }]}
        onValueChange={onMode}
      />
    </>);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Material' }), 'wood');
    expect(onSelect).toHaveBeenCalledOnce();

    const selected = screen.getByRole('radio', { name: 'Seleccionar' });
    selected.focus();
    await user.keyboard('{ArrowRight}');
    expect(onMode).toHaveBeenCalledWith('draw');

    rerender(<SegmentedControl
      label="Modo"
      value="draw"
      options={[{ value: 'select', label: 'Seleccionar' }, { value: 'locked', label: 'Bloqueado', disabled: true }, { value: 'draw', label: 'Dibujar' }]}
      onValueChange={onMode}
    />);
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Dibujar' }).getAttribute('tabindex')).toBe('0'));
  });
});
