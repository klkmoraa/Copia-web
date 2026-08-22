// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Surface } from './surface';

afterEach(() => cleanup());

describe('Surface', () => {
  it('defaults to the raised level as a div', () => {
    render(<Surface data-testid="s">contenido</Surface>);
    const el = screen.getByTestId('s');
    expect(el.tagName).toBe('DIV');
    expect(el.getAttribute('data-level')).toBe('raised');
    expect(el.getAttribute('data-pressed')).toBeNull();
  });

  it('exposes the complete six-level material grammar as data attributes', () => {
    render(<>
      <Surface level="flat" data-testid="base" />
      <Surface level="inset" data-testid="inset" />
      <Surface level="raised" data-testid="raised" />
      <Surface level="floating" data-testid="floating" />
      <Surface level="sheet" data-testid="sheet" />
      <Surface level="modal" data-testid="modal" />
    </>);

    for (const [testId, level] of [
      ['base', 'flat'],
      ['inset', 'inset'],
      ['raised', 'raised'],
      ['floating', 'floating'],
      ['sheet', 'sheet'],
      ['modal', 'modal'],
    ]) {
      expect(screen.getByTestId(testId).getAttribute('data-level')).toBe(level);
    }
  });

  it('marks the pressed state only when asked', () => {
    render(<Surface pressed data-testid="s" />);
    expect(screen.getByTestId('s').getAttribute('data-pressed')).toBe('true');
  });

  it('renders as the requested semantic element', () => {
    render(<Surface as="section" data-testid="s" />);
    expect(screen.getByTestId('s').tagName).toBe('SECTION');
  });

  it('keeps caller classes alongside its own', () => {
    render(<Surface className="welcome-frame" data-testid="s" />);
    const el = screen.getByTestId('s');
    expect(el.classList.contains('sc-surface')).toBe(true);
    expect(el.classList.contains('welcome-frame')).toBe(true);
  });

  it('forwards arbitrary props such as aria-labelledby', () => {
    render(<Surface aria-labelledby="t" data-testid="s" />);
    expect(screen.getByTestId('s').getAttribute('aria-labelledby')).toBe('t');
  });

  it('renders as an interactive element when asked', () => {
    render(<Surface as="button" data-testid="s" />);
    expect(screen.getByTestId('s').tagName).toBe('BUTTON');
  });

  it('renders as header or nav for landmark surfaces', () => {
    render(<><Surface as="header" data-testid="h" /><Surface as="nav" data-testid="n" /></>);
    expect(screen.getByTestId('h').tagName).toBe('HEADER');
    expect(screen.getByTestId('n').tagName).toBe('NAV');
  });

  it('preserves native button props and its accessible click contract', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <Surface
        as="button"
        type="button"
        disabled={false}
        aria-label="Abrir controles de vista"
        onClick={onClick}
      />,
    );

    const button = screen.getByRole('button', { name: 'Abrir controles de vista' });
    expect(button.getAttribute('type')).toBe('button');
    expect((button as HTMLButtonElement).disabled).toBe(false);

    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
