// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { LeftCutEquilibrium } from '../../engine/cut';
import type { CutInfo } from './canvasVocabulary';
import { CutInspector, type CutDemand } from './CutInspector';

afterEach(cleanup);

const t = (key: string, variables?: Record<string, string | number>) =>
  variables ? `${key}:${JSON.stringify(variables)}` : key;

const cut: CutInfo = {
  memberId: 'B1',
  ratio: 0.5,
  point: { x: 3, axial: 10, shear: 20, moment: 30 },
  clientX: 100,
  clientY: 100,
  pinned: true,
};

const equilibrium: LeftCutEquilibrium = {
  x: 3,
  internal: { x: 3, axial: 10, shear: 20, moment: 30 },
  start: { axial: 0, shear: 0, moment: 0 },
  resultants: [
    { kind: 'point', sourceX: 1, forceX: 0, forceY: -5, appliedMoment: 0, momentAboutCut: -10 },
  ],
  totals: { forceX: 0, forceY: -5, momentAboutCut: -10 },
  residuals: { forceX: 0, forceY: 0, moment: 0 },
  symbolicEquations: ['ΣFx = 0', 'ΣFy = 0', 'ΣM = 0'],
};

const baseProps = {
  cut,
  cutDemand: null as CutDemand,
  cutEquilibrium: null as LeftCutEquilibrium | null,
  hostLeft: 0,
  hostTop: 0,
  size: { width: 1200, height: 800 },
  units: 'kN-m' as const,
  lengthLabel: 'm',
  forceLabel: 'kN',
  momentLabel: 'kN·m',
  t,
};

describe('CutInspector', () => {
  it('renders the internal action values for the pinned cut', () => {
    render(<CutInspector {...baseProps} />);
    expect(screen.getByText('canvas.cutTitle:{"member":"B1"}')).toBeTruthy();
    expect(screen.getByText('canvas.pinned')).toBeTruthy();
    expect(screen.getByText(/N = 10\.000 kN/)).toBeTruthy();
    expect(screen.getByText(/V = 20\.000 kN/)).toBeTruthy();
    expect(screen.getByText(/M = 30\.000 kN·m/)).toBeTruthy();
  });

  it('shows the demand badge when cutDemand is available', () => {
    render(<CutInspector {...baseProps} cutDemand={{ status: 'available', ratio: 0.42, color: 'red', atReference: false, saturated: false }} />);
    expect(screen.getByText('η 0.42')).toBeTruthy();
  });

  it('shows the unavailable demand label when cutDemand cannot be computed', () => {
    render(<CutInspector {...baseProps} cutDemand={{ status: 'unavailable' }} />);
    expect(screen.getByText('canvas.cutDemandUnavailable')).toBeTruthy();
  });

  it('renders the free body diagram and equilibrium equations when cutEquilibrium is present', () => {
    render(<CutInspector {...baseProps} cutEquilibrium={equilibrium} />);
    expect(screen.getByText('canvas.leftSideFbd')).toBeTruthy();
    equilibrium.symbolicEquations.forEach((equation) => {
      expect(screen.getByText(equation)).toBeTruthy();
    });
  });

  it('omits the equilibrium block when cutEquilibrium is null', () => {
    render(<CutInspector {...baseProps} />);
    expect(screen.queryByText('canvas.leftSideFbd')).toBeNull();
  });
});
