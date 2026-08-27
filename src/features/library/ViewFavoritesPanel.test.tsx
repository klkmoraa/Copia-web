// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { readCanvasViewSettings } from '../view/canvasViewSettings';
import { createFavorite, readPersonalLibrary, writePersonalLibrary } from './personalLibrary';
import { ViewFavoritesPanel } from './ViewFavoritesPanel';

const NOW = '2026-08-24T16:00:00.000Z';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('ViewFavoritesPanel', () => {
  it('does nothing on selection and applies theme plus view only after explicit confirmation', async () => {
    const project = createDefaultProject();
    const savedView = { ...readCanvasViewSettings(project), showGrid: false, showLoads: false, diagramScale: 2.5 };
    const favorite = createFavorite([], { kind: 'view', name: 'Revisión limpia', theme: 'dark', view: savedView, unitsAtSave: 'N-mm' }, 'view-1', NOW)[0];
    writePersonalLibrary(localStorage, [favorite]);
    const onApply = vi.fn();
    render(<ViewFavoritesPanel language="es" units="kN-m" theme="light" view={readCanvasViewSettings(project)} onApply={onApply} />);

    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByRole('option', { name: /Revisión limpia.*N-mm/ })).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Aplicar vista' }));
    expect(onApply).toHaveBeenCalledOnce();
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ kind: 'view', theme: 'dark', view: savedView }));
  });

  it('saves an isolated snapshot of the current view without applying it', async () => {
    const project = createDefaultProject();
    const view = { ...readCanvasViewSettings(project), showNodeLabels: false, diagramSide: 'negative' as const };
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(<ViewFavoritesPanel language="en" units="kip-ft" theme="dark" view={view} onApply={onApply} />);

    await user.type(screen.getByRole('textbox', { name: 'Name to save' }), 'Dark review');
    await user.click(screen.getByRole('button', { name: 'Save current view' }));

    expect(onApply).not.toHaveBeenCalled();
    expect(readPersonalLibrary(localStorage)[0]).toMatchObject({ kind: 'view', name: 'Dark review', theme: 'dark', unitsAtSave: 'kip-ft', view });
    expect(screen.getByRole('status').textContent).toMatch(/saved/i);
  });
});
