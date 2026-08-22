import type { ProjectModel } from '../../types';

/**
 * Temporary CRI-92 option-B boundary. View consumers never reach into
 * `project.settings` for canvas visibility; the later schema migration changes
 * this file, not every canvas and panel call site.
 */
export const readCanvasViewSettings = (project: ProjectModel) => ({
  showGrid: project.settings.showGrid,
  snap: project.settings.snap,
  gridSize: project.settings.gridSize,
  showNodeLabels: project.settings.showNodeLabels,
  showMemberLabels: project.settings.showMemberLabels,
  showLocalAxes: project.settings.showLocalAxes,
  showDimensions: project.settings.showDimensions,
  showLoads: project.settings.showLoads,
  showResultValues: project.settings.showResultValues,
  showResultOverlay: project.settings.showResultOverlay ?? true,
  snapTargets: project.settings.snapTargets ?? { grid: true, nodes: true, midpoints: true, intersections: true, perpendicular: true },
  selectionFilter: project.settings.selectionFilter ?? { nodes: true, members: true, loads: true },
  diagramScale: project.settings.diagramScale,
  diagramScaleMode: project.settings.diagramScaleMode ?? 'common',
  deformedScale: project.settings.deformedScale,
  diagramSide: project.settings.diagramSide,
});

export type CanvasViewSettings = ReturnType<typeof readCanvasViewSettings>;

export const withCanvasViewSettings = (
  project: ProjectModel,
  patch: Partial<CanvasViewSettings>,
): ProjectModel => ({
  ...project,
  settings: { ...project.settings, ...patch },
});
