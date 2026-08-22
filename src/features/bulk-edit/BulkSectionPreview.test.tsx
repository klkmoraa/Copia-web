// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { standardSections } from '../../data/standardSections';
import { BulkEditPanel } from './BulkEditPanel';
import { BulkSectionPreview } from './BulkSectionPreview';
import { createBulkMember, resetBulkFixtureIds } from './bulkEditFixtures';
import type { BulkSectionPreviewModel } from './bulkSectionPreviewModel';

afterEach(cleanup);
beforeEach(resetBulkFixtureIds);

const ipe300 = standardSections.find((section) => section.id === 'ipe-300')!;
const hss = standardSections.find((section) => section.id === 'hss6x6x3-8')!;

const renderPreview = (preview: BulkSectionPreviewModel) =>
  render(<BulkSectionPreview preview={preview} units="kN-m" language="es" />);

const slot = (side: 'current' | 'target') => screen.getByTestId(`bulk-section-preview-${side}`);
const shapeOf = (side: 'current' | 'target') => slot(side).querySelector('.section-shape');

describe('BulkSectionPreview', () => {
  it('draws the real geometry of a known catalog profile', () => {
    renderPreview({
      current: { kind: 'catalog', sectionId: 'ipe-300' },
      target: { kind: 'catalog', sectionId: 'ipe-300' },
      changed: false,
    });

    // Un perfil I es un `path`, no una caja.
    expect(shapeOf('current')?.tagName.toLowerCase()).toBe('path');
    expect(within(slot('current')).getByText('IPE 300')).toBeTruthy();
    expect(within(slot('current')).getByText('I · EUROCODE')).toBeTruthy();
  });

  it('draws the hollow of a tube instead of a solid box', () => {
    renderPreview({
      current: { kind: 'catalog', sectionId: hss.id },
      target: { kind: 'catalog', sectionId: hss.id },
      changed: false,
    });

    const rects = slot('current').querySelectorAll('rect');
    expect(rects).toHaveLength(2);
    expect(rects[1].getAttribute('class')).toBe('section-shape-void');
  });

  it('identifies an equivalent section as equivalent and never as a catalog profile', () => {
    renderPreview({
      current: { kind: 'equivalent', area: ipe300.area, inertia: ipe300.inertiaX },
      target: { kind: 'equivalent', area: ipe300.area, inertia: ipe300.inertiaX },
      changed: false,
    });

    expect(within(slot('current')).getByText('Rectangular equivalente')).toBeTruthy();
    expect(within(slot('current')).getByText(/Deducida de A e I/)).toBeTruthy();
    expect(within(slot('current')).queryByText('IPE 300')).toBeNull();
    // A e I coinciden con un IPE 300 y aun así se dibuja el rectángulo.
    expect(shapeOf('current')?.tagName.toLowerCase()).toBe('rect');
  });

  it('shows a mixed selection as «Varios» without drawing any shape', () => {
    renderPreview({ current: { kind: 'mixed' }, target: { kind: 'mixed' }, changed: false });

    expect(within(slot('current')).getByText('Varios')).toBeTruthy();
    expect(shapeOf('current')).toBeNull();
  });

  it('shows a single section when nothing is staged, not a transition into itself', () => {
    renderPreview({
      current: { kind: 'catalog', sectionId: 'ipe-300' },
      target: { kind: 'catalog', sectionId: 'ipe-300' },
      changed: false,
    });

    expect(within(slot('current')).getByText('Sin cambio preparado')).toBeTruthy();
    // Dos dibujos idénticos a los lados de una flecha se leen como un cambio.
    expect(screen.queryByTestId('bulk-section-preview-target')).toBeNull();
  });

  it('labels the target slot as the objective once a change is staged', () => {
    renderPreview({
      current: { kind: 'mixed' },
      target: { kind: 'catalog', sectionId: 'w12x53' },
      changed: true,
    });

    expect(within(slot('target')).getByText('Objetivo')).toBeTruthy();
    expect(within(slot('target')).getByText('W12x53')).toBeTruthy();
    expect(shapeOf('target')?.tagName.toLowerCase()).toBe('path');
  });
});

describe('BulkSectionPreview inside the panel', () => {
  const openSectionTab = async (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('tab', { name: 'Vista sección' }));

  it('reacts in real time to the staged target section', async () => {
    const user = userEvent.setup({ delay: null });
    render(<BulkEditPanel
      selection={{ members: [createBulkMember({ sectionId: 'ipe-300' }), createBulkMember({ sectionId: 'ipe-300' })], nodes: [] }}
      units="kN-m"
      language="es"
      onApply={vi.fn()}
    />);

    await openSectionTab(user);
    expect(within(slot('current')).getByText('IPE 300')).toBeTruthy();
    expect(within(slot('current')).getByText('Sin cambio preparado')).toBeTruthy();
    expect(screen.queryByTestId('bulk-section-preview-target')).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Propiedades' }));
    await user.selectOptions(screen.getByLabelText('Sección'), 'hss6x6x3-8');
    await openSectionTab(user);

    expect(within(slot('target')).getByText('HSS6x6x3/8')).toBeTruthy();
    expect(within(slot('target')).getByText('Objetivo')).toBeTruthy();
    // El objetivo cambia de forma, no sólo de nombre: el tubo es un rectángulo hueco.
    expect(slot('target').querySelectorAll('rect')).toHaveLength(2);
    expect(shapeOf('current')?.tagName.toLowerCase()).toBe('path');
  });

  it('never infers a catalog identity from matching A and I', async () => {
    const user = userEvent.setup({ delay: null });
    render(<BulkEditPanel
      selection={{
        members: [createBulkMember({ sectionId: undefined, sectionOrigin: undefined, A: ipe300.area, I: ipe300.inertiaX })],
        nodes: [],
      }}
      units="kN-m"
      language="es"
      onApply={vi.fn()}
    />);

    await openSectionTab(user);

    expect(within(slot('current')).getByText('Rectangular equivalente')).toBeTruthy();
    expect(within(slot('current')).queryByText('IPE 300')).toBeNull();
    expect(shapeOf('current')?.tagName.toLowerCase()).toBe('rect');
  });

  it('shows «Varios» when the selection does not share one section', async () => {
    const user = userEvent.setup({ delay: null });
    render(<BulkEditPanel
      selection={{ members: [createBulkMember({ sectionId: 'ipe-300' }), createBulkMember({ sectionId: 'w12x53' })], nodes: [] }}
      units="kN-m"
      language="es"
      onApply={vi.fn()}
    />);

    await openSectionTab(user);

    expect(within(slot('current')).getByText('Varios')).toBeTruthy();
    expect(shapeOf('current')).toBeNull();
  });
});
