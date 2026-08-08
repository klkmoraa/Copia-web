// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InspectorNumericField } from './InspectorNumericField';

afterEach(cleanup);

describe('InspectorNumericField', () => {
  it('shows compact reading precision but edits the exact round-trip value', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<InspectorNumericField label="Longitud" value={1 / 3} unit="m" resetKey="node:N1" onCommit={onCommit} />);

    const input = screen.getByRole('textbox', { name: 'Longitud' }) as HTMLInputElement;
    expect(input.value).toBe('0.333333');
    await user.click(input);
    expect(input.value).toBe(String(1 / 3));
    await user.tab();
    expect(input.value).toBe('0.333333');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits a changed valid display value on blur and Enter', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<InspectorNumericField label="Fuerza X" value={12} unit="kN" resetKey="load:L1" onCommit={onCommit} />);
    const input = screen.getByRole('textbox', { name: 'Fuerza X' }) as HTMLInputElement;

    await user.click(input);
    await user.clear(input);
    await user.type(input, '12.3456789012345');
    await user.keyboard('{Enter}');

    expect(onCommit).toHaveBeenCalledOnce();
    expect(onCommit).toHaveBeenCalledWith(12.3456789012345);
    expect(input).not.toBe(document.activeElement);
    expect(input.value).toBe('12.3457');
  });

  it('does not create a commit when only the textual representation changes', () => {
    const onCommit = vi.fn();
    render(<InspectorNumericField label="X" value={1} resetKey="node:N1" onCommit={onCommit} />);
    const input = screen.getByRole('textbox', { name: 'X' }) as HTMLInputElement;

    input.focus();
    expect(input).toBe(document.activeElement);
    fireEvent.change(input, { target: { value: '1.000' } });
    fireEvent.blur(input);

    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe('1');
  });

  it('keeps stored state untouched for blank and invalid drafts and exposes inline errors', () => {
    const onCommit = vi.fn();
    const { rerender } = render(<InspectorNumericField label="Coordenada Y" value={4.5} unit="m" resetKey="node:N1" onCommit={onCommit} />);
    const input = screen.getByRole('textbox', { name: 'Coordenada Y' }) as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe('');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toContain(`${input.id}-error`);
    expect(screen.getByRole('alert').textContent).toBe('Este campo no puede quedar vacío.');

    rerender(<InspectorNumericField label="Coordenada Y" value={4.5} unit="m" resetKey="node:N1" onCommit={onCommit} />);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Ingresa un número válido.');
  });

  it('localizes built-in validation feedback without changing the numeric draft', () => {
    const onCommit = vi.fn();
    const { rerender } = render(
      <InspectorNumericField
        label="Coordinate Y"
        value={4.5}
        unit="m"
        resetKey="node:N1"
        language="en"
        onCommit={onCommit}
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Coordinate Y' }) as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe('');
    expect(screen.getByRole('alert').textContent).toBe('This field cannot be empty.');

    rerender(
      <InspectorNumericField
        label="Coordinate Y"
        value={4.5}
        unit="m"
        resetKey="node:N1"
        language="en"
        onCommit={onCommit}
      />,
    );
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Enter a valid number.');
  });

  it('runs optional range validation without committing', () => {
    const onCommit = vi.fn();
    render(<InspectorNumericField
      label="Posición"
      value={0.5}
      unit="L"
      resetKey="load:L1"
      onCommit={onCommit}
      validate={(value) => value < 0 || value > 1 ? 'Usa un valor entre 0 y 1.' : undefined}
    />);
    const input = screen.getByRole('textbox', { name: 'Posición' });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.blur(input);

    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Usa un valor entre 0 y 1.');
  });

  it('restores with Escape, suppresses propagation, and resets on selection/value changes', () => {
    const onCommit = vi.fn();
    const onEscape = vi.fn();
    const { rerender } = render(<div onKeyDown={onEscape}>
      <InspectorNumericField label="X" value={2.25} resetKey="node:N1" onCommit={onCommit} />
    </div>);
    const input = screen.getByRole('textbox', { name: 'X' }) as HTMLInputElement;

    input.focus();
    expect(input).toBe(document.activeElement);
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('2.25');
    expect(input).toBe(document.activeElement);
    expect(onCommit).not.toHaveBeenCalled();
    expect(onEscape).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '77' } });
    rerender(<div onKeyDown={onEscape}>
      <InspectorNumericField label="X" value={8.125} resetKey="node:N2" onCommit={onCommit} />
    </div>);
    expect(input.value).toBe('8.125');
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('makes units, helper copy, and locked state visible and accessible', () => {
    const onCommit = vi.fn();
    const { rerender } = render(<InspectorNumericField
      label="Longitud"
      value={4}
      unit="m"
      resetKey="member:M1"
      onCommit={onCommit}
      hint="Valor mostrado en las unidades activas."
    />);
    const input = screen.getByRole('textbox', { name: 'Longitud' }) as HTMLInputElement;
    expect(screen.getByText('m')).toBeTruthy();
    expect(input.getAttribute('aria-describedby')).toContain(`${input.id}-unit`);
    expect(input.getAttribute('aria-describedby')).toContain(`${input.id}-hint`);

    rerender(<InspectorNumericField
      label="Longitud"
      value={4}
      unit="m"
      resetKey="member:M1"
      onCommit={onCommit}
      hint="Valor mostrado en las unidades activas."
      lockedReason="Se deriva de la geometría."
    />);
    expect(input.disabled).toBe(true);
    expect(screen.getByText('Se deriva de la geometría.')).toBeTruthy();
    expect(input.getAttribute('aria-describedby')).toContain(`${input.id}-locked`);
  });
});
