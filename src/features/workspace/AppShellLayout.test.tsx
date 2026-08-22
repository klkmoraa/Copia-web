// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AppShellLayout } from './AppShellLayout';

afterEach(cleanup);

describe('AppShellLayout', () => {
  it('composes editor surfaces without owning their behavior', () => {
    const { container } = render(<AppShellLayout
      projectId="project-01"
      skipLabel="Saltar a la mesa"
      topBar={<header>TopBar</header>}
      toolRail={<nav>ToolRail</nav>}
      workspace={<div>Canvas</div>}
      inspector={<aside>Inspector</aside>}
      inspectorWidth={384}
      footer={<footer>Footer</footer>}
      inspectorCollapsed
      shellClass="M1"
    />);

    const shell = container.querySelector('.app-shell');
    expect(shell?.getAttribute('data-project-id')).toBe('project-01');
    expect(shell?.getAttribute('data-inspector-collapsed')).toBe('true');
    expect(shell?.getAttribute('data-shell-class')).toBe('M1');
    // La compacidad del riel se deriva de la clase, no llega como prop propia.
    expect(shell?.getAttribute('data-tool-rail-compact')).toBe('true');
    expect((shell as HTMLElement).style.getPropertyValue('--inspector-w')).toBe('384px');
    expect(screen.getByRole('main').id).toBe('workspace-canvas');
    expect(screen.getByRole('link', { name: 'Saltar a la mesa' }).getAttribute('href')).toBe('#workspace-canvas');
    expect(screen.getByText('TopBar')).toBeTruthy();
    expect(screen.getByText('ToolRail')).toBeTruthy();
    expect(screen.getByText('Canvas')).toBeTruthy();
    expect(screen.getByText('Inspector')).toBeTruthy();
  });

  it('exposes full canvas as presentation state only', () => {
    const { container } = render(<AppShellLayout
      projectId="project-02"
      skipLabel="Skip"
      topBar={null}
      toolRail={null}
      workspace={null}
      inspector={null}
      fullCanvas
    />);

    expect(container.querySelector('.app-shell')?.getAttribute('data-full-canvas')).toBe('true');
  });

  it('publishes the resolved composition class and derives rail compactness from it', () => {
    const shellOf = (shellClass: 'X2' | 'M1' | 'K0') => {
      const { container } = render(<AppShellLayout
        projectId="project-03"
        skipLabel="Skip"
        topBar={null}
        toolRail={null}
        workspace={null}
        inspector={null}
        shellClass={shellClass}
      />);
      return container.querySelector('.app-shell') as HTMLElement;
    };

    // Sólo Expanded paga un riel con etiquetas; Medium y Compact no.
    expect(shellOf('X2').dataset.shellClass).toBe('X2');
    expect(shellOf('X2').dataset.toolRailCompact).toBeUndefined();
    cleanup();
    expect(shellOf('M1').dataset.toolRailCompact).toBe('true');
    cleanup();
    expect(shellOf('K0').dataset.toolRailCompact).toBe('true');
  });
});
