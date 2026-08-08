// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LayerToggle, NumericValue, StatusStrip, ToolButton, UnitField } from './editor';

afterEach(() => cleanup());

describe('component-library editor patterns', () => {
  it('exposes tool identity, active state, shortcuts, and callbacks', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<>
      <ToolButton label="Carga puntual" icon={<span>↓</span>} shortcut="P" tone="load" active onClick={onClick} />
      <ToolButton label="Eliminar" icon={<span>×</span>} tone="destructive" disabled />
    </>);
    const tool = screen.getByRole('button', { name: 'Carga puntual (P)' });
    expect(tool.getAttribute('aria-pressed')).toBe('true');
    expect(tool.getAttribute('aria-keyshortcuts')).toBe('P');
    await user.click(tool);
    expect(onClick).toHaveBeenCalledOnce();
    expect((screen.getByRole('button', { name: 'Eliminar' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('uses a real switch contract for layer visibility', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<LayerToggle label="Cargas" description="Puntuales y distribuidas" checked onCheckedChange={onCheckedChange} />);
    const toggle = screen.getByRole('switch', { name: /Cargas.*Puntuales/ });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    await user.click(toggle);
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  it('keeps unit editing and numeric formatting presentational', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<>
      <UnitField label="Longitud" value="4.50" unit="m" onValueChange={onValueChange} />
      <NumericValue value={-1284.5} unit="kN" locale="es-MX" minimumFractionDigits={1} maximumFractionDigits={1} />
    </>);
    const input = screen.getByRole('textbox', { name: 'Longitud' });
    await user.clear(input);
    await user.type(input, '5.25');
    expect(onValueChange).toHaveBeenCalled();
    expect(screen.getByText('-1,284.5')).toBeTruthy();
    expect(screen.getByText('kN')).toBeTruthy();
  });

  it('announces loading and error status without relying on color alone', () => {
    const { rerender } = render(<StatusStrip status="loading" title="Calculando" detail="4 / 8" />);
    expect(screen.getByRole('status').getAttribute('aria-busy')).toBe('true');
    expect(screen.getByText('Calculando')).toBeTruthy();
    rerender(<StatusStrip status="error" title="No se pudo analizar" detail="Revisa el modelo" />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Revisa el modelo')).toBeTruthy();
  });
});
