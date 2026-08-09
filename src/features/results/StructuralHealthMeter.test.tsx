// @vitest-environment jsdom
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AnalysisResult, MemberResult, ProjectModel } from '../../types';
import { StructuralHealthMeter } from './StructuralHealthMeter';

describe('StructuralHealthMeter Component', () => {
  afterEach(cleanup);

  const mockProject: ProjectModel = {
    version: '1.0.0',
    title: 'Test Project',
    nodes: [
      { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'N2', x: 4, y: 0, support: { type: 'roller', angleDeg: 90 } },
    ],
    members: [
      { id: 'M1', i: 'N1', j: 'N2', type: 'frame', E: 200000, A: 0.005, I: 0.00008 },
    ],
    nodalLoads: [],
    memberLoads: [],
    loadCases: [{ id: 'LC1', name: 'Dead Load', category: 'permanent', active: true }],
    settings: {
      units: 'kN-m',
      calculationMode: 'complete',
    } as ProjectModel['settings'],
  } as unknown as ProjectModel;

  const mockAnalysis: AnalysisResult = {
    success: true,
    nodeResults: [],
    memberResults: [
      {
        memberId: 'M1',
        maxAxial: 50,
        minAxial: 50,
        maxShear: 20,
        minShear: -20,
        maxMoment: 40,
        minMoment: 0,
      } as unknown as MemberResult,
    ],
  } as unknown as AnalysisResult;

  it('renders structural health meter with utilization and safety factor', () => {
    render(
      <StructuralHealthMeter
        project={mockProject}
        analysis={mockAnalysis}
        yieldStrengthDefault={250}
      />
    );

    expect(screen.getByTestId('structural-health-meter')).toBeTruthy();
    expect(screen.getByText('Utilización Estructural Global')).toBeTruthy();
    expect(screen.getByText('M1')).toBeTruthy();
    expect(screen.getByText(/Factor de Seguridad/i)).toBeTruthy();
  });

  it('triggers onLocateMember when clicking critical member button', () => {
    const onLocate = vi.fn();
    render(
      <StructuralHealthMeter
        project={mockProject}
        analysis={mockAnalysis}
        onLocateMember={onLocate}
      />
    );

    const locateBtn = screen.getByRole('button', { name: 'M1' });
    fireEvent.click(locateBtn);
    expect(onLocate).toHaveBeenCalledWith('M1');
  });

  it('returns null when analysis is unsuccessful', () => {
    const failedAnalysis = {
      success: false,
      nodeResults: [],
      memberResults: [],
    } as unknown as AnalysisResult;

    const { container } = render(
      <StructuralHealthMeter
        project={mockProject}
        analysis={failedAnalysis}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
