// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Banner } from './feedback';
import { StatusStrip } from './editor';

afterEach(() => cleanup());

describe('semantic feedback', () => {
  it.each([
    ['info', 'status', 'polite'],
    ['success', 'status', 'polite'],
    ['warning', 'status', 'polite'],
    ['error', 'alert', 'assertive'],
  ] as const)('gives %s banners an icon, text, and live semantics', (tone, role, live) => {
    const { container } = render(<Banner tone={tone} title={`${tone} title`}>Actionable detail</Banner>);
    const banner = screen.getByRole(role);
    expect(banner.getAttribute('aria-live')).toBe(live);
    expect(banner.getAttribute('aria-atomic')).toBe('true');
    expect(banner.textContent).toContain('Actionable detail');
    expect(container.querySelector('.sc-banner__icon svg')).not.toBeNull();
  });

  it.each(['ready', 'loading', 'success', 'stale', 'warning', 'error'] as const)(
    'does not encode the %s status with color alone',
    (status) => {
      const { container } = render(<StatusStrip status={status} title={`${status} title`} detail="Next step" />);
      expect(container.querySelector('.sc-status-strip__mark svg, .sc-status-strip__mark .sc-spinner')).not.toBeNull();
      expect(screen.getByText(`${status} title`)).toBeTruthy();
      expect(screen.getByText('Next step')).toBeTruthy();
    },
  );
});
