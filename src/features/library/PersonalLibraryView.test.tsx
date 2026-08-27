// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { readCanvasViewSettings } from '../view/canvasViewSettings';
import { PersonalLibraryView } from './PersonalLibraryView';

const renderLibrary = (language: 'es' | 'en' = 'es', storage: Storage = localStorage) => {
  const project = createDefaultProject();
  return render(<PersonalLibraryView
    language={language}
    units={project.settings.units}
    theme="light"
    view={readCanvasViewSettings(project)}
    storage={storage}
  />);
};

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('PersonalLibraryView', () => {
  it('creates, searches, renames, duplicates, trashes and restores a pair', async () => {
    const user = userEvent.setup();
    renderLibrary();
    expect(screen.getByText('Todavía no guardas favoritos.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Crear favorito' }));
    await user.selectOptions(screen.getByLabelText('Tipo de favorito'), 'pair');
    await user.type(screen.getByLabelText('Nombre del favorito'), 'Acero + IPE');
    await user.selectOptions(screen.getByLabelText('Material'), 'steel-a992');
    await user.selectOptions(screen.getByLabelText('Sección'), 'ipe-300');
    await user.click(screen.getByRole('button', { name: 'Guardar favorito' }));

    const search = screen.getByRole('searchbox', { name: 'Buscar favoritos' });
    await user.type(search, 'ipe-300');
    expect(screen.getByText('Acero + IPE')).toBeTruthy();
    await user.clear(search);

    const item = screen.getByRole('listitem', { name: /Acero \+ IPE/ });
    await user.click(within(item).getByRole('button', { name: 'Renombrar Acero + IPE' }));
    const rename = within(item).getByRole('textbox', { name: 'Nuevo nombre' });
    await user.clear(rename);
    await user.type(rename, 'Par principal');
    await user.click(within(item).getByRole('button', { name: 'Guardar nombre' }));

    const renamed = screen.getByRole('listitem', { name: /Par principal/ });
    await user.click(within(renamed).getByRole('button', { name: 'Duplicar Par principal' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    await user.click(within(renamed).getByRole('button', { name: 'Borrar Par principal' }));
    expect(screen.queryByText('Par principal')).toBeNull();

    const activeCopy = screen.getByRole('listitem', { name: /Par principal — Copia/ });
    await user.click(within(activeCopy).getByRole('button', { name: 'Renombrar Par principal — Copia' }));
    const copyRename = within(activeCopy).getByRole('textbox', { name: 'Nuevo nombre' });
    await user.clear(copyRename);
    await user.type(copyRename, 'Par principal');
    await user.click(within(activeCopy).getByRole('button', { name: 'Guardar nombre' }));

    await user.click(screen.getByRole('button', { name: /Papelera 1/ }));
    const deleted = screen.getByRole('listitem', { name: /Par principal/ });
    await user.click(within(deleted).getByRole('button', { name: 'Restaurar Par principal' }));
    expect(screen.getByRole('alert').textContent).toMatch(/nombre ya está en uso/i);
    await user.click(within(deleted).getByRole('button', { name: 'Renombrar Par principal' }));
    const deletedRename = within(deleted).getByRole('textbox', { name: 'Nuevo nombre' });
    await user.clear(deletedRename);
    await user.type(deletedRename, 'Par restaurado');
    await user.click(within(deleted).getByRole('button', { name: 'Guardar nombre' }));
    await user.click(within(screen.getByRole('listitem', { name: /Par restaurado/ })).getByRole('button', { name: 'Restaurar Par restaurado' }));
    expect(screen.getByText(/Favorito restaurado/)).toBeTruthy();
  });

  it('creates a visual favorite from the current theme and view', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await user.click(screen.getByRole('button', { name: 'Crear favorito' }));
    await user.selectOptions(screen.getByLabelText('Tipo de favorito'), 'view');
    await user.type(screen.getByLabelText('Nombre del favorito'), 'Vista limpia');
    await user.click(screen.getByRole('button', { name: 'Guardar favorito' }));
    const item = screen.getByRole('listitem', { name: /Vista limpia/ });
    expect(item.textContent).toMatch(/Vista.*Día.*kN-m/);
  });

  it('keeps the empty state and reports storage failure without pretending it saved', async () => {
    const storage = {
      getItem: () => null,
      setItem: () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); },
    } as unknown as Storage;
    const user = userEvent.setup();
    renderLibrary('es', storage);
    await user.click(screen.getByRole('button', { name: 'Crear favorito' }));
    await user.type(screen.getByLabelText('Nombre del favorito'), 'Acero');
    await user.selectOptions(screen.getByLabelText('Material'), 'steel-a36');
    await user.click(screen.getByRole('button', { name: 'Guardar favorito' }));
    expect(screen.getByRole('alert').textContent).toMatch(/No se pudo guardar/);
    expect(screen.getByText('Todavía no guardas favoritos.')).toBeTruthy();
  });

  it('renders the management flow in English without mixed Spanish controls', async () => {
    const user = userEvent.setup();
    renderLibrary('en');
    expect(screen.getByRole('heading', { name: 'Personal library' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Create favorite' }));
    expect(screen.getByRole('button', { name: 'Save favorite' })).toBeTruthy();
    expect(screen.queryByText(/Crear|Guardar favorito|Papelera/)).toBeNull();
  });
});
