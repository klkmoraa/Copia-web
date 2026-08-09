// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasMiniMap } from './CanvasMiniMap';
import { createDefaultProject } from '../../data/defaultProject';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('CanvasMiniMap', () => {
  it('returns null when there are no nodes in project', () => {
    const emptyProject = { ...createDefaultProject(), nodes: [], members: [] };
    const { container } = render(<CanvasMiniMap project={emptyProject} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders SVG representation of nodes and members', () => {
    const project = createDefaultProject();
    render(<CanvasMiniMap project={project} />);

    expect(screen.getByRole('region', { name: /Minimapa Radar/i })).toBeTruthy();
    expect(screen.getByText('RADAR')).toBeTruthy();
  });

  it('delegates fit action when clicked', async () => {
    const user = userEvent.setup();
    const onFit = vi.fn();
    const project = createDefaultProject();

    render(<CanvasMiniMap project={project} onFit={onFit} />);
    await user.click(screen.getByRole('region', { name: /Minimapa Radar/i }));

    expect(onFit).toHaveBeenCalledOnce();
  });
});
