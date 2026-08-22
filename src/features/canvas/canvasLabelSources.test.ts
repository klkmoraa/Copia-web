import { describe, expect, it } from 'vitest';
import type {
  AnalysisResult, DiagramCriticalPoint, MemberModel, MemberResult, NodeModel, ProjectModel,
} from '../../types';
import type { ResultTab } from '../../store/ProjectContext';
import { readCanvasViewSettings } from '../view/canvasViewSettings';
import type { EditorLayerState } from './editorLayers';
import { buildCanvasSelectionVisualState } from './selectionVisuals';
import { buildCanvasLabelCandidates, type CanvasLabelSourcesParams } from './canvasLabelSources';

const node = (id: string, x: number): NodeModel =>
  ({ id, x, y: 0, support: { type: 'none' } } as unknown as NodeModel);

const member: MemberModel = { id: 'B1', i: 'N1', j: 'N2', type: 'frame', E: 2.1e8, A: 0.01, I: 1e-4 } as MemberModel;

const critical = (x: number, value: number, quantity: DiagramCriticalPoint['quantity']): DiagramCriticalPoint =>
  ({ x, value, quantity, kind: 'maximum' });

const result: MemberResult = {
  memberId: 'B1', length: 6, startOffset: 0,
  localDisplacements: [], localEndForces: [], diagramSegments: [], diagramJumps: [],
  criticalPoints: [
    critical(0, 0, 'moment'),
    critical(3, 45, 'moment'),
    critical(6, -12, 'moment'),
    critical(0, 30, 'shear'),
  ],
  diagram: [], deformation: [], deformationSegments: [], deformationCriticalPoints: [],
  maxAxial: 0, minAxial: 0, maxShear: 30, minShear: -30, maxMoment: 45, minMoment: -12,
} as unknown as MemberResult;

const project = {
  id: 'p', name: 'p',
  nodes: [node('N1', 0), node('N2', 6)],
  members: [member],
  nodalLoads: [], memberLoads: [],
  settings: {
    units: 'kN-m', language: 'es', showResultOverlay: true, diagramSide: 'positive', diagramScale: 1, diagramScaleMode: 'common',
    showGrid: true, snap: true, gridSize: 1, showNodeLabels: true, showMemberLabels: true, showLocalAxes: false,
    showDimensions: true, showLoads: true, showResultValues: true, deformedScale: 1,
  },
} as unknown as ProjectModel;

const analysis = { success: true, memberResults: [result], nodeResults: [] } as unknown as AnalysisResult;

const allLayersOn: EditorLayerState = {
  model: true, loads: true, dimensions: true, ids: true, results: true, labels: true, help: true, diagnostics: true, heatmap: true,
};

const baseParams = (resultTab: ResultTab, overrides: Partial<CanvasLabelSourcesParams> = {}): CanvasLabelSourcesParams => ({
  activeTool: 'select',
  analysis,
  cameraScale: 40,
  distributedLabel: 'kN/m',
  forceLabel: 'kN',
  globalDiagramMax: 45,
  layers: allLayersOn,
  lengthLabel: 'm',
  loadsLayerVisible: true,
  memberMap: new Map([[member.id, member]]),
  momentLabel: 'kN·m',
  nodeMap: new Map(project.nodes.map((item) => [item.id, item])),
  nodeResultMap: new Map(),
  project,
  resultMap: new Map([[result.memberId, result]]),
  resultTab,
  resultsAllowed: true,
  selectionVisualState: buildCanvasSelectionVisualState(null),
  size: { width: 800, height: 600 },
  toScreen: (x, y) => ({ x: 40 + x * 40, y: 300 - y * 40 }),
  units: 'kN-m',
  view: readCanvasViewSettings(project),
  ...overrides,
});

describe('buildCanvasLabelCandidates', () => {
  it('labels every node and member with the model layer on', () => {
    const candidates = buildCanvasLabelCandidates(baseParams('summary'));
    expect(candidates.find((candidate) => candidate.id === 'node:N1')).toBeTruthy();
    expect(candidates.find((candidate) => candidate.id === 'member:B1')).toBeTruthy();
  });

  it('stamps Mmax/Mmin as forced two-line candidates and does not duplicate them as generic M= labels', () => {
    const candidates = buildCanvasLabelCandidates(baseParams('moment'));

    const maxStamp = candidates.find((candidate) => candidate.id === 'critical:B1:moment:max');
    const minStamp = candidates.find((candidate) => candidate.id === 'critical:B1:moment:min');
    expect(maxStamp?.lines).toEqual(['Mmax 45.00 kN·m', 'x 3.00 m']);
    expect(maxStamp?.forceVisible).toBe(true);
    expect(minStamp?.lines).toEqual(['Mmin -12.00 kN·m', 'x 6.00 m']);

    // Antes del arreglo, StructuralCanvas.tsx empujaba además un candidato
    // genérico `M = 45.00 kN·m` para el mismo punto máximo/mínimo: dos
    // etiquetas sobre el mismo valor. Ahora el punto crítico sólo aparece
    // una vez en el pool.
    const criticalIds = candidates.filter((candidate) => candidate.id.startsWith('result:B1:moment:'));
    expect(criticalIds.some((candidate) => candidate.text.startsWith('M = 45.00'))).toBe(false);
    expect(criticalIds.some((candidate) => candidate.text.startsWith('M = -12.00'))).toBe(false);
  });

  it('does not stamp critical points for the axial tab', () => {
    const candidates = buildCanvasLabelCandidates(baseParams('axial'));
    expect(candidates.some((candidate) => candidate.id.startsWith('critical:'))).toBe(false);
  });

  it('stays quiet on critical stamps while the result overlay is off', () => {
    const hidden = { ...project, settings: { ...project.settings, showResultOverlay: false } };
    const candidates = buildCanvasLabelCandidates(baseParams('moment', { project: hidden, view: readCanvasViewSettings(hidden) }));
    expect(candidates.some((candidate) => candidate.id.startsWith('critical:'))).toBe(false);
  });

  it('does not saturate the canvas with extremes that barely work', () => {
    const candidates = buildCanvasLabelCandidates(baseParams('moment', { globalDiagramMax: 600 }));
    expect(candidates.some((candidate) => candidate.id.startsWith('critical:'))).toBe(false);
  });
});
