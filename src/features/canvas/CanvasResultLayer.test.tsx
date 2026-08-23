// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  AnalysisResult, DiagramCriticalPoint, MemberModel, MemberResult, NodeModel, ProjectModel,
} from '../../types';
import type { ResultTab } from '../../store/ProjectContext';
import { CanvasResultLayer } from './CanvasResultLayer';

afterEach(cleanup);

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
  settings: { units: 'kN-m', language: 'es', showResultOverlay: true, diagramSide: 'positive', diagramScale: 1, diagramScaleMode: 'common' },
} as unknown as ProjectModel;

const analysis = { success: true, memberResults: [result], nodeResults: [] } as unknown as AnalysisResult;

const renderLayer = (resultTab: ResultTab, overrides: Record<string, unknown> = {}) => render(
  <svg>
    <CanvasResultLayer
      slot="annotations"
      project={project}
      analysis={analysis}
      resultTab={resultTab}
      resultsAllowed
      resultCursor={null}
      influenceCanvasState={null}
      modeShapeState={null}
      camera={{ scale: 40, x: 0, y: 0 }}
      toScreen={(x, y) => ({ x: 40 + x * 40, y: 300 - y * 40 })}
      nodeMap={new Map(project.nodes.map((item) => [item.id, item]))}
      memberMap={new Map([[member.id, member]])}
      resultMap={new Map([[result.memberId, result]])}
      nodeResultMap={new Map()}
      mechanismMap={new Map()}
      mechanismPixelScale={1}
      globalDiagramMax={45}
      units="kN-m"
      lengthLabel="m"
      forceLabel="kN"
      momentLabel="kN·m"
      showResults
      showDiagnostics={false}
      size={{ width: 800, height: 600 }}
      t={((key: string) => key) as never}
      {...overrides}
    />
  </svg>,
);

const stamps = () => [...document.querySelectorAll('[data-critical-point]')];

// El texto del sello (valor + estación) lo sella `canvasLabelSources.ts`
// como candidato del repartidor de etiquetas — ver
// `canvasLabelSources.test.ts` para su contenido. Este componente sólo
// dibuja la geometría del sello: el tallo desde la barra hasta la ordenada
// del diagrama, y el punto en la punta.
describe('CanvasResultLayer critical M/V stamps', () => {
  it('marks Mmax and Mmin on the diagram, one stem+dot per extreme', () => {
    renderLayer('moment');
    expect(stamps().map((stamp) => stamp.getAttribute('data-critical-point')))
      .toEqual(['B1:moment:max', 'B1:moment:min']);
    for (const stamp of stamps()) {
      expect(stamp.querySelector('.critical-point-stem')).not.toBeNull();
      expect(stamp.querySelector('.critical-point-dot')).not.toBeNull();
    }
  });

  it('anchors the stamp on the diagram ordinate, not on the bare member axis', () => {
    renderLayer('moment');
    const stem = document.querySelector('[data-critical-point="B1:moment:max"] .critical-point-stem')!;
    // x = 3 m sobre la barra ⇒ 40 + 3·40 = 160 px, y la punta se separa del eje.
    expect(Number(stem.getAttribute('x1'))).toBeCloseTo(160, 6);
    expect(Number(stem.getAttribute('y1'))).toBeCloseTo(300, 6);
    expect(Number(stem.getAttribute('y2'))).not.toBeCloseTo(300, 3);
  });

  it('follows the tab: shear is stamped, and axial gets no stamps', () => {
    renderLayer('shear');
    expect(document.querySelector('.critical-point-layer')?.getAttribute('class')).toContain('is-shear');
    expect(stamps()).toHaveLength(1);
    cleanup();

    renderLayer('axial');
    expect(stamps()).toHaveLength(0);
  });

  it('stays quiet while the result overlay is off', () => {
    const hidden = { ...project, settings: { ...project.settings, showResultOverlay: false } };
    renderLayer('moment', { project: hidden });
    expect(stamps()).toHaveLength(0);
  });

  it('does not saturate the canvas with extremes that barely work', () => {
    // Con el máximo global diez veces mayor, 45 kN·m cae por debajo del 15 %.
    renderLayer('moment', { globalDiagramMax: 600 });
    expect(stamps()).toHaveLength(0);
  });
});

/**
 * El modo propio se dibuja en el `slot` de diagramas, junto a la deformada, y
 * **no** por su ruta: la deformada interpola con los puntos que el solver
 * produjo para este análisis, y un modo sólo trae tres números por nudo.
 */
describe('CanvasResultLayer mode shape', () => {
  const mode = {
    kind: 'buckling' as const,
    index: 0,
    label: 'Modo 1',
    shape: [
      { nodeId: 'N1', ux: 0, uy: 0, rz: 0 },
      { nodeId: 'N2', ux: 0, uy: 1, rz: 0.02 },
    ],
  };
  const renderDiagrams = (overrides: Record<string, unknown>) => renderLayer('buckling', { slot: 'diagrams', ...overrides });

  it('no dibuja nada mientras no haya modo elegido', () => {
    renderDiagrams({ modeShapeState: null });
    expect(document.querySelector('.mode-shape-layer')).toBeNull();
  });

  it('dibuja una traza por barra deformable, con su etiqueta accesible', () => {
    renderDiagrams({ modeShapeState: mode });
    const layer = document.querySelector('.mode-shape-layer');
    expect(layer).not.toBeNull();
    expect(layer?.getAttribute('aria-label')).toBe('Modo 1');
    expect(layer?.querySelectorAll('path')).toHaveLength(1);
  });

  it('la traza es curva, no una recta entre nudos', () => {
    /* Es la razón de existir de `modeShapePath`: con giros en los extremos, los
       puntos intermedios NO pueden caer sobre la recta que une los dos nudos.
       Una traza recta significaría que la curvatura del modo se perdió. */
    renderDiagrams({ modeShapeState: mode });
    const d = document.querySelector('.mode-shape-layer path')?.getAttribute('d') ?? '';
    const ys = [...d.matchAll(/[ML] (-?[\d.e+-]+) (-?[\d.e+-]+)/g)].map((match) => Number(match[2]));
    expect(ys.length).toBeGreaterThan(2);
    const straight = ys.map((_, index) => ys[0] + (index / (ys.length - 1)) * (ys[ys.length - 1] - ys[0]));
    const deviation = Math.max(...ys.map((y, index) => Math.abs(y - straight[index])));
    expect(deviation).toBeGreaterThan(1);
  });

  it('un modo cuyos nudos no están en el modelo no pinta una barra a medias', () => {
    renderDiagrams({ modeShapeState: { ...mode, shape: [{ nodeId: 'N9', ux: 1, uy: 1, rz: 0 }] } });
    expect(document.querySelector('.mode-shape-layer')).toBeNull();
  });
});
