// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CanvasTouchLoupe } from './CanvasTouchLoupe';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('CanvasTouchLoupe', () => {
  it('returns null when active is false', () => {
    const { container } = render(
      <CanvasTouchLoupe active={false} screenX={100} screenY={200} modelX={4.5} modelY={2.0} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders coordinate readout and active state when active is true', () => {
    const { container } = render(
      <CanvasTouchLoupe active={true} screenX={150} screenY={300} modelX={6.0} modelY={3.5} unit="m" />
    );
    const loupe = container.querySelector('.touch-loupe');
    expect(loupe).toBeTruthy();
    expect(loupe?.classList.contains('active')).toBe(true);
    expect(screen.getByText(/X: 6\.00 m · Y: 3\.50 m/i)).toBeTruthy();
  });
});
