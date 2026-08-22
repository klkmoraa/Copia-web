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

describe('CanvasResultLayer critical M/V stamps', () => {
  it('marca Mmax y Mmin con el valor y la estación que reportó el análisis', () => {
    renderLayer('moment');
    expect(stamps().map((stamp) => stamp.getAttribute('data-critical-point')))
      .toEqual(['B1:moment:max', 'B1:moment:min']);

    // El valor y la estación siguen SIENDO de esta capa —viajan en el `title`
    // de cada marca, que es lo que lee la tecnología de asistencia—, pero ya no
    // los PINTA aquí: el texto visible lo coloca `layoutSmartLabels`, que
    // resuelve colisiones. Antes se pintaban en los dos sitios a la vez y se
    // pisaban entre sí sobre el dibujo.
    expect(stamps().map((stamp) => stamp.querySelector('title')?.textContent)).toEqual([
      'B1 · Mmax 45.00 kN·m · x 3.00 m',
      'B1 · Mmin -12.00 kN·m · x 6.00 m',
    ]);
  });

  it('no vuelve a pintar el texto del extremo en esta capa', () => {
    // El sello con anclaje fijo se retiró entero. Si alguien lo reintroduce,
    // el producto vuelve a tener dos sistemas de etiquetas y una de las dos
    // copias no evita a nadie.
    renderLayer('moment');
    expect(document.querySelectorAll('.critical-point-stamp')).toHaveLength(0);
    expect(document.querySelectorAll('.critical-point-value')).toHaveLength(0);
    expect(document.querySelectorAll('.critical-point-station')).toHaveLength(0);
  });

  it('anchors the stamp on the diagram ordinate, not on the bare member axis', () => {
    renderLayer('moment');
    const stem = document.querySelector('[data-critical-point="B1:moment:max"] .critical-point-stem')!;
    // x = 3 m sobre la barra ⇒ 40 + 3·40 = 160 px, y la punta se separa del eje.
    expect(Number(stem.getAttribute('x1'))).toBeCloseTo(160, 6);
    expect(Number(stem.getAttribute('y1'))).toBeCloseTo(300, 6);
    expect(Number(stem.getAttribute('y2'))).not.toBeCloseTo(300, 3);
  });

  it('follows the tab: shear is stamped as V, and axial gets no stamps', () => {
    renderLayer('shear');
    expect(document.querySelector('.critical-point-layer')?.getAttribute('class')).toContain('is-shear');
    expect(stamps()[0]?.querySelector('title')?.textContent).toContain('Vmax 30.00 kN');
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
