// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ProjectModel, Selection } from '../../types';
import { InspectorSelectionPreview } from './InspectorSelectionPreview';

afterEach(cleanup);

const project = {
  id: 'p1',
  name: 'Preview',
  nodes: [
    { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'N2', x: 6, y: 0, support: { type: 'roller' } },
  ],
  members: [{ id: 'B1', i: 'N1', j: 'N2', type: 'frame', E: 2.1e8, A: 0.01, I: 1e-4 }],
  nodalLoads: [{ id: 'NL1', nodeId: 'N2', caseId: 'c', fx: 12, fy: -30, mz: 0 }],
  memberLoads: [
    {
      id: 'ML-dist', memberId: 'B1', caseId: 'c', type: 'distributed',
      coordinateSystem: 'global', lengthBasis: 'projected',
      start: 0.2, end: 0.8, qyStart: -10, qyEnd: -4,
    },
    {
      id: 'ML-point', memberId: 'B1', caseId: 'c', type: 'point',
      coordinateSystem: 'global', lengthBasis: 'projected',
      start: 0.35, end: 0.35, position: 0.35, py: -25,
    },
    {
      id: 'ML-moment', memberId: 'B1', caseId: 'c', type: 'moment',
      coordinateSystem: 'global', lengthBasis: 'projected',
      start: 0.5, end: 0.5, position: 0.5, moment: 18,
    },
  ],
  settings: { units: 'kN-m', language: 'es' },
} as unknown as ProjectModel;

const renderPreview = (selection: Selection) => render(
  <InspectorSelectionPreview project={project} selection={selection} label="Vista previa" caption="Entorno" />,
);

const glyph = (kind: string) => document.querySelector(`[data-load-kind="${kind}"]`);

describe('InspectorSelectionPreview', () => {
  it('draws a nodal load as a direction, not just as its carrier node', () => {
    renderPreview({ kind: 'nodalLoad', id: 'NL1' });
    const nodal = glyph('nodal')!;
    expect(nodal).not.toBeNull();

    // La regresión: antes esto era el nudo y nada más. Ahora hay flecha…
    const line = nodal.querySelector('.preview-arrow line')!;
    const dx = Number(line.getAttribute('x2')) - Number(line.getAttribute('x1'));
    const dy = Number(line.getAttribute('y2')) - Number(line.getAttribute('y1'));
    // fx = +12, fy = -30 ⇒ en pantalla la flecha va a la derecha y hacia abajo.
    expect(dx).toBeGreaterThan(0);
    expect(dy).toBeGreaterThan(0);
    // …y las componentes disponibles se nombran.
    expect(nodal.querySelector('.preview-load-label')?.textContent).toBe('Fx · Fy');
  });

  it('shows a nodal moment as a moment and not as a force', () => {
    const withMoment = { ...project, nodalLoads: [{ id: 'NL1', nodeId: 'N2', caseId: 'c', fx: 0, fy: 0, mz: 9 }] } as ProjectModel;
    render(<InspectorSelectionPreview project={withMoment} selection={{ kind: 'nodalLoad', id: 'NL1' }} label="l" caption="c" />);
    const nodal = glyph('nodal')!;
    expect(nodal.querySelector('.preview-moment')).not.toBeNull();
    expect(nodal.querySelector('.preview-arrow')).toBeNull();
    expect(nodal.querySelector('.preview-load-label')?.textContent).toBe('Mz');
  });

  it('draws a distributed load as a band over its own interval', () => {
    renderPreview({ kind: 'memberLoad', id: 'ML-dist' });
    const distributed = glyph('distributed')!;
    const band = distributed.querySelector('.preview-load-band')!;
    expect(band).not.toBeNull();
    expect(distributed.querySelector('.preview-load-label')?.textContent).toBe('0.20–0.80 L');

    // Trapezoidal: los dos cantos de la banda no miden lo mismo.
    const [baseFrom, topFrom, topTo, baseTo] = band.getAttribute('d')!
      .match(/-?\d+(?:\.\d+)?\s-?\d+(?:\.\d+)?/g)!
      .map((pair) => pair.split(' ').map(Number));
    const height = (base: number[], top: number[]) => Math.hypot(top[0] - base[0], top[1] - base[1]);
    expect(height(baseFrom, topFrom)).toBeGreaterThan(height(baseTo, topTo));
  });

  it('places a point load and a member moment at their own station', () => {
    renderPreview({ kind: 'memberLoad', id: 'ML-point' });
    expect(glyph('point')?.querySelector('.preview-load-label')?.textContent).toBe('x 0.35 L');
    cleanup();

    renderPreview({ kind: 'memberLoad', id: 'ML-moment' });
    const moment = glyph('moment')!;
    expect(moment.querySelector('.preview-moment')).not.toBeNull();
    expect(moment.querySelector('.preview-load-label')?.textContent).toBe('x 0.50 L');
  });

  it('shows a selected support through its own node', () => {
    renderPreview({ kind: 'node', id: 'N2' });
    const focused = document.querySelector('.preview-support.is-focus')!;
    expect(focused.getAttribute('data-support-type')).toBe('roller');
    // El otro apoyo sigue dibujado, pero sin el énfasis.
    expect(document.querySelectorAll('.preview-support')).toHaveLength(2);
  });

  it('falls back to the plain member view when a load has no drawable geometry', () => {
    renderPreview({ kind: 'member', id: 'B1' });
    expect(document.querySelector('[data-load-kind]')).toBeNull();
    expect(document.querySelectorAll('.preview-members line')).toHaveLength(1);
  });
});
