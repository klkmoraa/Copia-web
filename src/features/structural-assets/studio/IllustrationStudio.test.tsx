// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { IllustrationStudio } from './IllustrationStudio';
import { STUDIO_PRESET_STORAGE_KEY } from './presetRepository';

const sceneMocks = vi.hoisted(() => ({
  renderStudioPng: vi.fn(),
  serializeStudioSvg: vi.fn(),
}));

vi.mock('./studioScene', async () => {
  const actual = await vi.importActual<typeof import('./studioScene')>('./studioScene');
  return { ...actual, renderStudioPng: sceneMocks.renderStudioPng, serializeStudioSvg: sceneMocks.serializeStudioSvg };
});

beforeAll(() => {
  window.requestAnimationFrame ??= (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0);
  window.cancelAnimationFrame ??= (handle: number) => window.clearTimeout(handle);
});

beforeEach(() => {
  localStorage.clear();
  sceneMocks.renderStudioPng.mockReset().mockResolvedValue('data:image/png;base64,ok');
  sceneMocks.serializeStudioSvg.mockReset().mockReturnValue('<svg width="900" height="600"/>');
});
afterEach(cleanup);

describe('Illustration Studio surface', () => {
  it('exposes all assets through compact rails and only one active parameter section', async () => {
    const user = userEvent.setup();
    render(<IllustrationStudio language="es" onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Estudio de ilustraciones' })).toBeTruthy();
    expect(within(screen.getByLabelText('Familias estructurales')).getAllByRole('button')).toHaveLength(10);
    expect(screen.getByLabelText('Activos estructurales')).toBeTruthy();
    expect(screen.getByTestId('studio-three-preview').getAttribute('data-structural-render')).toBe('three-live');
    expect(screen.getByRole('slider', { name: 'Ancho' })).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Altura' })).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Profundidad' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pórtico de un vano' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Single-bay portal frame' })).toBeNull();
    expect(screen.getByText('Estructuras / Ilustraciones')).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: 'Material' }));
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Acero' })).toBeTruthy();
  });

  it('keeps Day/Night accessible and exposes PNG/SVG at 1x, 2x and 4x', async () => {
    const user = userEvent.setup();
    render(<IllustrationStudio language="es" onClose={vi.fn()} />);
    await user.click(screen.getByRole('tab', { name: 'Vista' }));
    await user.click(screen.getByRole('button', { name: 'Noche' }));
    expect(screen.getByTestId('studio-preview-shell').getAttribute('data-preview-theme')).toBe('dark');
    expect(screen.getByRole('dialog').getAttribute('data-studio-theme')).toBe('dark');
    const scale = screen.getByLabelText('Escala de exportación') as HTMLSelectElement;
    expect([...scale.options].map((option) => option.value)).toEqual(['1', '2', '4']);
    expect(screen.getByRole('button', { name: 'Exportar PNG' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Exportar SVG' })).toBeTruthy();
  });

  it('localizes the canvas name and every family label without exposing raw keys', () => {
    const { unmount } = render(<IllustrationStudio language="es" onClose={vi.fn()} />);
    expect(screen.getByRole('img', { name: 'Vista previa estructural Three.js' })).toBeTruthy();
    unmount();
    render(<IllustrationStudio language="en" onClose={vi.fn()} />);
    expect(screen.getByRole('img', { name: 'Three.js structural preview' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Space frames' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'space-frame' })).toBeNull();
  });

  it('keeps Night active while navigating assets and restoring a personal design', async () => {
    const user = userEvent.setup();
    render(<IllustrationStudio language="es" onClose={vi.fn()} />);
    await user.click(screen.getByRole('tab', { name: 'Vista' }));
    await user.click(screen.getByRole('button', { name: 'Noche' }));
    await user.click(screen.getByRole('button', { name: 'Vigas' }));
    expect(screen.getByRole('dialog').getAttribute('data-studio-theme')).toBe('dark');
    await user.click(screen.getByRole('tab', { name: 'Material' }));
    await user.click(screen.getByRole('button', { name: 'Acero' }));
    await user.click(screen.getByRole('button', { name: 'Restaurar' }));
    expect(screen.getByRole('dialog').getAttribute('data-studio-theme')).toBe('dark');
  });

  it('keeps rename spaces as a draft and shows localized empty and duplicate errors on commit', async () => {
    const user = userEvent.setup();
    render(<IllustrationStudio language="es" onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole('slider', { name: 'Ancho' }), { target: { value: '1.05' } });
    const input = screen.getByRole('textbox', { name: 'Nombre del diseño' }) as HTMLInputElement;
    await user.clear(input);
    await user.type(input, '  Mi diseño con espacios  ');
    expect(input.value).toBe('  Mi diseño con espacios  ');
    fireEvent.blur(input);
    expect(input.value).toBe('Mi diseño con espacios');

    await user.click(screen.getByRole('button', { name: 'Duplicar' }));
    const duplicateName = (screen.getByRole('textbox', { name: 'Nombre del diseño' }) as HTMLInputElement).value;
    const selector = screen.getByLabelText('Diseños guardados') as HTMLSelectElement;
    await user.selectOptions(selector, selector.options[1].value);
    const originalInput = screen.getByRole('textbox', { name: 'Nombre del diseño' });
    await user.clear(originalInput);
    await user.type(originalInput, duplicateName);
    await user.keyboard('{Enter}');
    expect(screen.getByRole('alert').textContent).toMatch(/ya existe/i);
    await user.clear(originalInput);
    await user.keyboard('{Enter}');
    expect(screen.getByRole('alert').textContent).toMatch(/escribe un nombre/i);
  });

  it('does not overwrite recovered future storage on mount', async () => {
    const original = JSON.stringify({ schemaVersion: 9, presets: [{ future: true }] });
    localStorage.setItem(STUDIO_PRESET_STORAGE_KEY, original);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    render(<IllustrationStudio language="es" onClose={vi.fn()} />);
    await Promise.resolve();
    expect(localStorage.getItem(STUDIO_PRESET_STORAGE_KEY)).toBe(original);
    expect(setItem).not.toHaveBeenCalledWith(STUDIO_PRESET_STORAGE_KEY, expect.any(String));
    setItem.mockRestore();
  });

  it('survives storage write failures and gives localized guidance', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key) => {
      if (key === STUDIO_PRESET_STORAGE_KEY) throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    render(<IllustrationStudio language="es" onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole('slider', { name: 'Ancho' }), { target: { value: '1.05' } });
    expect(screen.getByRole('alert').textContent).toMatch(/no se pudo guardar/i);
    expect(screen.getByRole('dialog')).toBeTruthy();
    setItem.mockRestore();
  });

  it('traps forward and backward Tab inside the modal', async () => {
    const user = userEvent.setup();
    render(<><button type="button">Home behind</button><IllustrationStudio language="es" onClose={vi.fn()} /></>);
    const close = screen.getByRole('button', { name: 'Cerrar estudio' });
    const last = screen.getByRole('button', { name: 'Exportar SVG' });
    close.focus();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(last);
    await user.tab();
    expect(document.activeElement).toBe(close);
  });

  it('revokes SVG object URLs and reports rejected PNG exports without an unhandled promise', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:studio-svg');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    sceneMocks.renderStudioPng.mockRejectedValueOnce(new Error('GPU lost'));
    render(<IllustrationStudio language="es" onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Exportar SVG' }));
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:studio-svg');
    await user.click(screen.getByRole('button', { name: 'Exportar PNG' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/no se pudo exportar/i));
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });
});
