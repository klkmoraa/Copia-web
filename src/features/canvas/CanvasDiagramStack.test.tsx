// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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

const renderStack = (
  { cursorX = null, onCursorChange = vi.fn() }: { cursorX?: number | null; onCursorChange?: (x: number | null) => void } = {},
) => render(<svg><CanvasDiagramStack
  memberId="AB"
  result={beamResult}
  quantities={STACK_QUANTITIES}
  modelScreenBounds={{ minX: 100, maxX: 500, maxY: 300 }}
  viewportHeight={900}
  cursorX={cursorX}
  onCursorChange={onCursorChange}
  units="kN-m"
  lengthLabel="m"
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

  it('reads the three quantities at one station, on a cursor that crosses every lane', () => {
    const { container } = renderStack({ cursorX: 4 });
    const readings = Array.from(container.querySelectorAll('[data-stack-reading]'));
    expect(readings.map((node) => node.getAttribute('data-stack-reading'))).toEqual(['axial', 'shear', 'moment']);
    // Mid span of this beam: V = 0 y M = 80, los dos en la misma sección.
    expect(readings[1].textContent).toContain('0.00');
    expect(readings[2].textContent).toContain('80.00');

    const cursor = container.querySelector('[data-stack-cursor] line');
    const lanes = Array.from(container.querySelectorAll('[data-stack-lane]'));
    const laneBoxes = lanes.map((lane) => lane.querySelector('.diagram-stack-baseline')!);
    // La línea del cursor abarca de la primera línea base a la última.
    expect(Number(cursor?.getAttribute('y1'))).toBeLessThan(Number(laneBoxes[0].getAttribute('y1')));
    expect(Number(cursor?.getAttribute('y2'))).toBeGreaterThan(Number(laneBoxes[2].getAttribute('y1')));
  });

  it('publishes a station snapped to the peak instead of wherever the pointer landed', () => {
    const onCursorChange = vi.fn();
    const { container } = renderStack({ onCursorChange });
    const surface = container.querySelector('[data-stack-surface]')!;
    // El lienzo mide 0..600 y el carril va de 100 a 500: 302 px cae a un pelo
    // del centro de la viga, donde vive el Mmáx.
    fireEvent.pointerMove(surface, { clientX: 302, clientY: 400 });
    expect(onCursorChange).toHaveBeenCalledWith(4);
    fireEvent.pointerLeave(surface);
    expect(onCursorChange).toHaveBeenLastCalledWith(null);
  });

  it('dims the sealed extremes only while a reading is active', () => {
    expect(renderStack().container.querySelector('.diagram-stack-extremes')?.classList.contains('is-dimmed')).toBe(false);
    expect(renderStack({ cursorX: 2 }).container.querySelector('.diagram-stack-extremes')?.classList.contains('is-dimmed')).toBe(true);
  });
});
