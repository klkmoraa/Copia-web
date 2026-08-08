// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ComponentLab } from './ComponentLab';

beforeAll(() => {
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0);
    window.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);
  }
});

afterEach(() => cleanup());

describe('ComponentLab TopBar exploration', () => {
  it('switches directions without losing the existing global controls or local context', async () => {
    const user = userEvent.setup();
    render(<ComponentLab />);

    const directionPicker = screen.getByRole('radiogroup', { name: 'Dirección de TopBar' });
    expect(within(directionPicker).getAllByRole('radio')).toHaveLength(3);
    expect(within(directionPicker).getByRole('radio', { name: 'Mesa continua' }).getAttribute('aria-checked')).toBe('true');

    const preview = screen.getByRole('region', { name: 'Vista previa de TopBar' });
    const units = within(preview).getByRole('combobox', { name: 'Unidades' });
    await user.selectOptions(units, 'N-mm');
    await user.click(within(directionPicker).getByRole('radio', { name: 'Instrumentación estratificada' }));

    expect(preview.getAttribute('data-direction')).toBe('layered');
    expect((within(preview).getByRole('combobox', { name: 'Unidades' }) as HTMLSelectElement).value).toBe('N-mm');
    expect(within(preview).getByRole('button', { name: 'Abrir proyectos y ejemplos' })).toBeTruthy();
    expect(within(preview).getByRole('button', { name: 'Deshacer' })).toBeTruthy();
    expect(within(preview).getByRole('button', { name: 'Rehacer' })).toBeTruthy();
    expect(within(preview).getByRole('button', { name: 'Exportar' })).toBeTruthy();
    expect(within(preview).getByRole('button', { name: 'Más acciones' })).toBeTruthy();
    expect(within(preview).getByRole('button', { name: 'Analizar' })).toBeTruthy();
  });
});
