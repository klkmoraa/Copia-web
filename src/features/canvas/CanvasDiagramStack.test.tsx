// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { MemberResult } from '../../types';
import { CanvasDiagramStack } from './CanvasDiagramStack';
import { STACK_QUANTITIES } from './diagramStack';

/**
 * La hoja real, no una copia: lo que se comprueba aquí es la cascada que el
 * producto sirve. El defecto que motiva la prueba era exactamente eso — una
 * regla que pintaba de relleno la línea del carril, cerrándola contra su cuerda
 * y llenando esa área a opacidad plena. No se ve en un axial constante ni en un
 * cortante recto; en la parábola del momento es un manchón sólido.
 */
const phase2Css = readFileSync(path.join(process.cwd(), 'src/features/canvas/phase2.css'), 'utf8');

/** Momento parabólico: el único de los tres cuya cuerda encierra área. */
const beamResult: MemberResult = {
  memberId: 'AB',
  length: 8,
  localDisplacements: [],
  localEndForces: [],
  diagramSegments: [{
    x0: 0,
    x1: 8,
    axial: [0, 0, 0],
    shear: [40, -10, 0],
    moment: [0, 40, -5, 0],
    distributedAxial: [0, 0],
    distributedTransverse: [0, -10],
  }],
  diagramJumps: [],
  criticalPoints: [{ x: 4, quantity: 'moment', value: 80, kind: 'maximum' }],
  diagram: [],
  deformation: [],
  deformationSegments: [],
  deformationCriticalPoints: [],
  maxAxial: 0,
  minAxial: 0,
  maxShear: 40,
  minShear: -40,
  maxMoment: 80,
  minMoment: 0,
};

beforeAll(() => {
  const style = document.createElement('style');
  style.textContent = phase2Css;
  document.head.append(style);
});

afterEach(cleanup);

/** Lo que jsdom devuelve para `fill: none`. */
const NO_FILL = 'rgba(0, 0, 0, 0)';

const renderStack = () => render(<svg><CanvasDiagramStack
  memberId="AB"
  result={beamResult}
  quantities={STACK_QUANTITIES}
  modelScreenBounds={{ minX: 100, maxX: 500, maxY: 300 }}
  units="kN-m"
  t={((key: string) => key) as never}
/></svg>);

describe('CanvasDiagramStack', () => {
  it('keeps the curve a stroke: only the area path is ever filled', () => {
    const { container } = renderStack();
    const lines = container.querySelectorAll('.diagram-stack-line');
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      // jsdom normaliza `fill: none` a transparente; el defecto que esto vigila
      // dejaba aquí el propio token de color («var(--moment)»), y una línea sin
      // regla ninguna daría negro. Los tres valores se distinguen.
      expect(getComputedStyle(line).fill).toBe(NO_FILL);
    }
  });

  it('paints the area translucent, like the diagram drawn over the member', () => {
    const { container } = renderStack();
    const areas = container.querySelectorAll('.diagram-stack-fill');
    expect(areas).toHaveLength(3);
    for (const area of areas) {
      expect(Number(getComputedStyle(area).opacity)).toBeCloseTo(0.18);
      expect(getComputedStyle(area).fill).not.toBe(NO_FILL);
    }
  });

  it('draws one lane per quantity, in canonical order', () => {
    const { container } = renderStack();
    expect(Array.from(container.querySelectorAll('[data-stack-lane]')).map((lane) => lane.getAttribute('data-stack-lane')))
      .toEqual(['axial', 'shear', 'moment']);
  });
});
