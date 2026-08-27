// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decodePersonalSections, PERSONAL_SECTIONS_STORAGE_KEY } from '../../data/personalSections';
import { SectionBuilder } from './SectionBuilder';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('SectionBuilder', () => {
  it('creates and revises a personal rectangle while preserving its stable id', async () => {
    const user = userEvent.setup();
    render(<SectionBuilder language="es" units="kN-m" storage={localStorage} />);

    await user.click(screen.getByRole('button', { name: 'Nueva sección' }));
    await user.type(screen.getByLabelText('Nombre de la sección'), 'Viga 30 × 50');
    await user.clear(screen.getByLabelText('Ancho b (m)'));
    await user.type(screen.getByLabelText('Ancho b (m)'), '0.3');
    await user.clear(screen.getByLabelText('Peralte h (m)'));
    await user.type(screen.getByLabelText('Peralte h (m)'), '0.5');
    expect(screen.getByTestId('section-builder-preview').getAttribute('data-family')).toBe('rectangle');
    expect(screen.getByText('0.15 m²')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Guardar sección' }));

    const created = decodePersonalSections(localStorage.getItem(PERSONAL_SECTIONS_STORAGE_KEY)!);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ name: 'Viga 30 × 50', revision: 1, definition: { width: 0.3, depth: 0.5 } });
    const stableId = created[0].id;

    const card = screen.getByRole('listitem', { name: /Viga 30 × 50/ });
    await user.click(within(card).getByRole('button', { name: 'Editar Viga 30 × 50' }));
    await user.clear(screen.getByLabelText('Ancho b (m)'));
    await user.type(screen.getByLabelText('Ancho b (m)'), '0.25');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    const revised = decodePersonalSections(localStorage.getItem(PERSONAL_SECTIONS_STORAGE_KEY)!);
    expect(revised[0]).toMatchObject({ id: stableId, revision: 2, definition: { width: 0.25, depth: 0.5 } });
  });

  it('switches families, reports invalid geometry, and never saves it', async () => {
    const user = userEvent.setup();
    render(<SectionBuilder language="es" units="N-mm" storage={localStorage} />);
    await user.click(screen.getByRole('button', { name: 'Nueva sección' }));
    await user.type(screen.getByLabelText('Nombre de la sección'), 'Caja inválida');
    await user.selectOptions(screen.getByLabelText('Familia geométrica'), 'rectangular-box');
    await user.clear(screen.getByLabelText('Ancho b (mm)'));
    await user.type(screen.getByLabelText('Ancho b (mm)'), '200');
    await user.clear(screen.getByLabelText('Peralte h (mm)'));
    await user.type(screen.getByLabelText('Peralte h (mm)'), '200');
    await user.clear(screen.getByLabelText('Espesor t (mm)'));
    await user.type(screen.getByLabelText('Espesor t (mm)'), '100');
    await user.click(screen.getByRole('button', { name: 'Guardar sección' }));
    expect(screen.getByRole('alert').textContent).toMatch(/espesor|hueco/i);
    expect(localStorage.getItem(PERSONAL_SECTIONS_STORAGE_KEY)).toBeNull();
  });

  it('exports and imports the versioned personal library without touching the project', async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn();
    const project = '{"protected":true}';
    localStorage.setItem('structureCo.project', project);
    const { unmount } = render(<SectionBuilder language="es" units="kN-m" storage={localStorage} onDownload={onDownload} />);
    await user.click(screen.getByRole('button', { name: 'Nueva sección' }));
    await user.type(screen.getByLabelText('Nombre de la sección'), 'Círculo 20');
    await user.selectOptions(screen.getByLabelText('Familia geométrica'), 'circle');
    await user.click(screen.getByRole('button', { name: 'Guardar sección' }));
    await user.click(screen.getByRole('button', { name: 'Exportar secciones' }));
    expect(onDownload).toHaveBeenCalledOnce();
    const [serialized, filename] = onDownload.mock.calls[0];
    expect(filename).toBe('structureco-secciones-personales.json');
    expect(decodePersonalSections(serialized)).toHaveLength(1);
    expect(localStorage.getItem('structureCo.project')).toBe(project);

    unmount();
    localStorage.removeItem(PERSONAL_SECTIONS_STORAGE_KEY);
    render(<SectionBuilder
      language="es"
      units="kN-m"
      storage={localStorage}
      readFile={async () => serialized}
    />);
    const input = screen.getByLabelText('Importar secciones');
    fireEvent.change(input, { target: { files: [new File(['ignored'], 'secciones.json', { type: 'application/json' })] } });
    expect(await screen.findByText('Se importó 1 sección.')).toBeTruthy();
    expect(decodePersonalSections(localStorage.getItem(PERSONAL_SECTIONS_STORAGE_KEY)!)).toHaveLength(1);
    expect(localStorage.getItem('structureCo.project')).toBe(project);
  });

  it('renders the complete editor contract in English', async () => {
    const user = userEvent.setup();
    render(<SectionBuilder language="en" units="kip-ft" storage={localStorage} />);
    expect(screen.getByRole('heading', { name: 'Section Builder' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'New section' }));
    expect(screen.getByLabelText('Section name')).toBeTruthy();
    expect(screen.getByLabelText('Width b (ft)')).toBeTruthy();
    expect(screen.queryByText(/Nueva sección|Guardar sección|Familia geométrica/)).toBeNull();
  });
});
