// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Accordion, Tabs } from './disclosure';

beforeAll(() => {
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0);
    window.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);
  }
});

afterEach(() => cleanup());

describe('component-library disclosure', () => {
  it('moves tabs with arrow keys while skipping disabled tabs', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Tabs
      label="Vistas"
      value="one"
      onValueChange={onValueChange}
      items={[
        { id: 'one', label: 'Uno', content: 'Panel uno' },
        { id: 'disabled', label: 'Bloqueado', content: 'No visible', disabled: true },
        { id: 'three', label: 'Tres', content: 'Panel tres' },
      ]}
    />);
    const first = screen.getByRole('tab', { name: 'Uno' });
    first.focus();
    await user.keyboard('{ArrowRight}');
    expect(onValueChange).toHaveBeenCalledWith('three');
    await user.keyboard('{End}');
    expect(onValueChange).toHaveBeenLastCalledWith('three');
  });

  it('emits controlled accordion state for single and multiple modes', async () => {
    const user = userEvent.setup();
    const onExpandedChange = vi.fn();
    const items = [{ id: 'a', title: 'Incluido', content: 'Contenido A' }, { id: 'b', title: 'Fuera', content: 'Contenido B' }];
    const { rerender } = render(<Accordion items={items} expanded={['a']} onExpandedChange={onExpandedChange} />);
    await user.click(screen.getByRole('button', { name: 'Fuera' }));
    expect(onExpandedChange).toHaveBeenCalledWith(['b']);

    rerender(<Accordion multiple items={items} expanded={['a']} onExpandedChange={onExpandedChange} />);
    await user.click(screen.getByRole('button', { name: 'Fuera' }));
    expect(onExpandedChange).toHaveBeenLastCalledWith(['a', 'b']);
  });
});
