// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { standardSections } from '../../data/standardSections';
import { SectionViewer2D } from './SectionViewer2D';

describe('SectionViewer2D Component', () => {
  afterEach(cleanup);

  it('renders section geometry for an I-beam (IPE 300) with technical dimensions', () => {
    const ipe300 = standardSections.find((s) => s.id === 'ipe-300')!;
    render(
      <SectionViewer2D
        section={ipe300}
        area={ipe300.area}
        inertia={ipe300.inertiaX}
        units="kN-m"
      />
    );

    expect(screen.getByTestId('section-viewer-2d')).toBeTruthy();
    expect(screen.getByText('IPE 300')).toBeTruthy();
    expect(screen.getByText(/EUROCODE/i)).toBeTruthy();
    expect(screen.getByText('N.A.')).toBeTruthy();
    expect(screen.getByText(/b =/i)).toBeTruthy();
    expect(screen.getByText(/h =/i)).toBeTruthy();
  });

  it('renders a rectangular concrete section with dimensions', () => {
    const rectSection = standardSections.find((s) => s.id === 'rect-concrete-200x300')!;
    render(
      <SectionViewer2D
        section={rectSection}
        area={rectSection.area}
        inertia={rectSection.inertiaX}
        units="kN-m"
      />
    );

    expect(screen.getByTestId('section-viewer-2d')).toBeTruthy();
    expect(screen.getByText(/RECT/i)).toBeTruthy();
    expect(screen.getByText(/b =/i)).toBeTruthy();
    expect(screen.getByText(/h =/i)).toBeTruthy();
  });
});
