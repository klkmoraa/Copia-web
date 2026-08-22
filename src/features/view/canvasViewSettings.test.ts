import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { readCanvasViewSettings, withCanvasViewSettings } from './canvasViewSettings';

describe('canvas view settings accessor', () => {
  it('reads legacy schema values through one view contract and writes only the requested view field', () => {
    const project = createDefaultProject();
    project.settings = {
      ...project.settings,
      showGrid: false,
      snapTargets: { grid: false, nodes: true, midpoints: false, intersections: true, perpendicular: false },
      selectionFilter: { nodes: true, members: false, loads: true },
    };

    const view = readCanvasViewSettings(project);
    expect(view.showGrid).toBe(false);
    expect(view.snapTargets).toEqual(project.settings.snapTargets);
    expect(view.selectionFilter).toEqual(project.settings.selectionFilter);

    const next = withCanvasViewSettings(project, { showGrid: true });
    expect(next.settings.showGrid).toBe(true);
    expect(next.settings.snapTargets).toEqual(project.settings.snapTargets);
    expect(next.settings.selectionFilter).toEqual(project.settings.selectionFilter);
  });
});
