// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BulkEditPanel, type BulkEditApplyRequest } from './BulkEditPanel';
import { BULK_UNTOUCHED_OPTION } from './BulkPropertyField';
import { aggregateBulkSelection, findBulkProperty } from './bulkEditAggregation';
import { createBulkMember, createBulkNode, resetBulkFixtureIds } from './bulkEditFixtures';
import { EMPTY_BULK_DRAFT, stageBulkChange } from './bulkEditIntent';
import type { BulkSelectionInput } from './bulkEditTypes';

afterEach(cleanup);
beforeEach(resetBulkFixtureIds);

/** Diez pórticos con material y sección mezclados: el caso del enunciado. */
const mixedMembers = (): BulkSelectionInput => ({
  members: Array.from({ length: 10 }, (_unused, index) => createBulkMember({
    materialId: index % 2 === 0 ? 'steel-a992' : 'steel-a36',
    sectionId: index % 3 === 0 ? 'ipe-300' : 'w12x26',
  })),
  nodes: [],
});

const renderPanel = (selection: BulkSelectionInput = mixedMembers()) => {
  const onApply = vi.fn<(request: BulkEditApplyRequest) => void>();
  const onCancel = vi.fn();
  render(<BulkEditPanel selection={selection} units="kN-m" language="es" onApply={onApply} onCancel={onCancel} />);
  return { onApply, onCancel };
};

/** Sin espera entre pulsaciones: el panel no depende del ritmo de tecleo. */
const setup = () => userEvent.setup({ delay: null });

const field = (label: string) => screen.getByLabelText(label) as HTMLSelectElement;
const fieldRow = (property: string) => document.querySelector(`.bulk-field[data-property="${property}"]`)!;
/**
 * El botón del pie ya no aplica: abre la revisión. Confirmar exige pasar por
 * ella, que es justo la garantía que estas pruebas deben seguir ejerciendo.
 */
const reviewButton = () => screen.getByRole('button', { name: /^Revisar cambios/ }) as HTMLButtonElement;

/** Prepara → revisa → confirma, como hace una persona. */
const confirm = async (user: ReturnType<typeof setup>) => {
  await user.click(reviewButton());
  const review = screen.getByRole('region', { name: 'Revisar cambios' });
  await user.click(within(review).getByRole('button', { name: /^Aplicar/ }));
};

describe('BulkEditPanel', () => {
  it('announces the scope family by family instead of with a single global count', () => {
    renderPanel();

    const summary = screen.getByRole('region', { name: 'Resumen de la selección' });
    expect(within(summary).getByText('10 miembros seleccionados')).toBeTruthy();
    // Una fila por familia presente, y ninguna por una familia ausente.
    expect(summary.querySelector('[data-scope="member"]')?.textContent).toBe('10 miembros');
    expect(summary.querySelector('[data-scope="node"]')).toBeNull();
    expect(summary.querySelector('[data-scope="nodalLoad"]')).toBeNull();
  });

  it('shows a mixed value as «Varios» and never as the first value of the selection', () => {
    renderPanel();

    const section = fieldRow('member.sectionId');
    expect(within(section as HTMLElement).getByText('Varios')).toBeTruthy();
    // Ninguna de las secciones presentes en la selección queda preseleccionada.
    expect(field('Sección').value).toBe(BULK_UNTOUCHED_OPTION);
    expect(field('Sección').selectedOptions[0].textContent).toBe('Sin cambios');
    expect(field('Material').value).toBe(BULK_UNTOUCHED_OPTION);
    expect(field('Material').selectedOptions[0].textContent).toBe('Sin cambios');
  });

  it('reports the empty selection instead of rendering an editor', () => {
    renderPanel({ members: [], nodes: [] });

    expect(screen.getByText('Sin selección')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Revisar cambios/ })).toBeNull();
  });

  it('stages exactly one change when a single field is edited', async () => {
    const user = setup();
    const { onApply } = renderPanel();

    await user.selectOptions(field('Sección'), 'w12x53');

    expect(screen.getByTestId('bulk-changes-count').textContent).toBe('1 cambio preparado');
    await confirm(user);

    expect(onApply).toHaveBeenCalledTimes(1);
    const intent = onApply.mock.calls[0][0].intent;
    expect(intent.entries).toHaveLength(1);
    expect(intent.entries[0]).toMatchObject({
      property: 'member.sectionId',
      change: { kind: 'set', value: 'w12x53' },
      previous: { state: 'mixed' },
    });
    expect(intent.affected).toHaveLength(10);
  });

  it('leaves every untouched property out of the emitted intent', async () => {
    const user = setup();
    const { onApply } = renderPanel();

    await user.selectOptions(field('Sección'), 'w12x53');
    await confirm(user);

    const properties = onApply.mock.calls[0][0].intent.entries.map((entry) => entry.property);
    expect(properties).toEqual(['member.sectionId']);
    expect(properties).not.toContain('member.materialId');
    expect(properties).not.toContain('member.type');
  });

  it('summarises what changes and what stays untouched', async () => {
    const user = setup();
    renderPanel();
    await user.selectOptions(field('Sección'), 'w12x53');

    const summary = screen.getByRole('region', { name: 'Cambios preparados' });
    const sectionRow = summary.querySelector('[data-property="member.sectionId"]')!;
    expect(sectionRow.textContent).toContain('Varios');
    expect(sectionRow.textContent).toContain('W12x53');
    expect(sectionRow.textContent).toContain('10 objetos afectados');

    // Lo que no cambia sigue estando, plegado en una sola linea.
    const untouched = screen.getByTestId('bulk-changes-untouched');
    expect(untouched.querySelector('summary')!.textContent).toMatch(/propiedades sin cambios/);
    expect(untouched.querySelector('[data-property="member.materialId"]')).toBeTruthy();
  });

  it('keeps Apply disabled until something is staged', async () => {
    const user = setup();
    const { onApply } = renderPanel();

    expect(reviewButton().disabled).toBe(true);
    await user.selectOptions(field('Sección'), 'w12x53');
    expect(reviewButton().disabled).toBe(false);
    expect(reviewButton().textContent).toContain('Revisar cambios (1)');
    expect(onApply).not.toHaveBeenCalled();
  });

  it('clears every staged change on Cancel', async () => {
    const user = setup();
    const { onCancel } = renderPanel();

    await user.selectOptions(field('Sección'), 'w12x53');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(field('Sección').value).toBe(BULK_UNTOUCHED_OPTION);
    expect(screen.getByTestId('bulk-changes-count').textContent).toBe('Ningún cambio preparado');
    expect(reviewButton().disabled).toBe(true);
  });

  it('withdraws a single staged change back to untouched', async () => {
    const user = setup();
    renderPanel();

    await user.selectOptions(field('Sección'), 'w12x53');
    await user.click(screen.getByRole('button', { name: /Descartar el cambio preparado de Sección/ }));

    expect(field('Sección').value).toBe(BULK_UNTOUCHED_OPTION);
    expect(screen.getByTestId('bulk-changes-count').textContent).toBe('Ningún cambio preparado');
  });

  it('reports the incompatible part of the selection instead of applying silently', async () => {
    const user = setup();
    const { onApply } = renderPanel({
      members: [createBulkMember({ type: 'frame' }), createBulkMember({ type: 'frame' }), createBulkMember({ type: 'truss' })],
      nodes: [],
    });

    await user.click(screen.getByRole('button', { name: /Más propiedades/ }));
    const releases = fieldRow('member.releases.iMoment') as HTMLElement;
    expect(releases.textContent).toContain('2 de 3 compatibles');
    expect(releases.textContent).toContain('No aplica a este tipo de miembro');

    await user.click(within(releases).getByRole('radio', { name: 'Sí' }));
    await confirm(user);

    const entry = onApply.mock.calls[0][0].intent.entries[0];
    expect(entry.compatible).toHaveLength(2);
    expect(entry.incompatible).toEqual([{ target: { kind: 'member', id: 'M3' }, reason: 'member-type' }]);
  });

  it('keeps a boolean tri-state where mixed is not false', async () => {
    const user = setup();
    renderPanel({
      members: [
        createBulkMember({ type: 'frame', releases: { iMoment: true } }),
        createBulkMember({ type: 'frame', releases: { iMoment: false } }),
      ],
      nodes: [],
    });

    await user.click(screen.getByRole('button', { name: /Más propiedades/ }));
    const releases = fieldRow('member.releases.iMoment') as HTMLElement;

    expect(within(releases).getByText('Varios')).toBeTruthy();
    expect(within(releases).getByRole('radio', { name: 'Sin cambios' }).getAttribute('aria-checked')).toBe('true');
    expect(within(releases).getByRole('radio', { name: 'No' }).getAttribute('aria-checked')).toBe('false');
  });

  it('offers an explicit clear for optional properties', async () => {
    const user = setup();
    const { onApply } = renderPanel({ members: [createBulkMember({ density: 7850 })], nodes: [] });

    await user.click(screen.getByRole('button', { name: /Más propiedades/ }));
    const density = fieldRow('member.density') as HTMLElement;
    await user.click(within(density).getByRole('button', { name: /^Borrar valor de / }));
    await confirm(user);

    expect(onApply.mock.calls[0][0].intent.entries[0]).toMatchObject({
      property: 'member.density',
      change: { kind: 'clear' },
    });
  });

  it('stages a number in the project units and stores it in base units', async () => {
    const user = setup();
    const onApply = vi.fn<(request: BulkEditApplyRequest) => void>();
    render(<BulkEditPanel
      selection={{ members: [createBulkMember()], nodes: [] }}
      units="kN-m"
      language="es"
      onApply={onApply}
    />);

    await user.click(screen.getByRole('button', { name: /Más propiedades/ }));
    const input = within(fieldRow('member.A') as HTMLElement).getByRole('textbox');
    await user.type(input, '0.02');
    await user.tab();
    await confirm(user);

    expect(onApply.mock.calls[0][0].intent.entries[0]).toMatchObject({
      property: 'member.A',
      change: { kind: 'set', value: 0.02 },
    });
  });

  it('rejects an unparsable number without staging anything', async () => {
    const user = setup();
    renderPanel({ members: [createBulkMember()], nodes: [] });

    await user.click(screen.getByRole('button', { name: /Más propiedades/ }));
    const input = within(fieldRow('member.A') as HTMLElement).getByRole('textbox');
    await user.type(input, 'ancha');
    await user.tab();

    expect(screen.getByRole('alert').textContent).toContain('número válido');
    expect(screen.getByTestId('bulk-changes-count').textContent).toBe('Ningún cambio preparado');
  });

  it('aggregates a node selection with its support configuration', () => {
    renderPanel({
      members: [],
      nodes: [createBulkNode({ support: { type: 'pin' } }), createBulkNode({ support: { type: 'fixed' } })],
    });

    expect(screen.getByText('2 nudos seleccionados')).toBeTruthy();
    expect(screen.getByText('2 nudos')).toBeTruthy();
    expect(within(fieldRow('node.support.type') as HTMLElement).getByText('Varios')).toBeTruthy();
  });
});

describe('BulkEditPanel accessibility', () => {
  it('names the panel, the tablist and every control', () => {
    renderPanel();

    expect(screen.getByRole('region', { name: 'Edición múltiple' })).toBeTruthy();
    expect(screen.getByRole('tablist', { name: 'Vistas de la edición múltiple' })).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(field('Sección').getAttribute('aria-describedby')).toBeTruthy();
  });

  it('describes each field with its current value and its compatibility', () => {
    renderPanel();

    const select = field('Sección');
    const described = (select.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ');
    expect(described).toContain('Varios');
    expect(described).toContain('10 de 10 compatibles');
  });

  it('moves between tabs with the arrow keys', async () => {
    const user = setup();
    renderPanel();

    const properties = screen.getByRole('tab', { name: 'Propiedades' });
    properties.focus();
    await user.keyboard('{ArrowRight}');

    const section = screen.getByRole('tab', { name: 'Vista sección' });
    expect(section.getAttribute('aria-selected')).toBe('true');
    // El foco lo mueve el design system en el siguiente frame.
    await waitFor(() => expect(document.activeElement).toBe(section));
    expect(screen.getByRole('region', { name: 'Vista previa de la sección' })).toBeTruthy();
  });

  it('drives the boolean tri-state from the keyboard', async () => {
    const user = setup();
    const { onApply } = renderPanel({ members: [createBulkMember({ type: 'frame' })], nodes: [] });

    await user.click(screen.getByRole('button', { name: /Más propiedades/ }));
    const releases = fieldRow('member.releases.jMoment') as HTMLElement;
    within(releases).getByRole('radio', { name: 'Sin cambios' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(within(releases).getByRole('radio', { name: 'Sí' }).getAttribute('aria-checked')).toBe('true');
    await confirm(user);
    expect(onApply.mock.calls[0][0].intent.entries[0]).toMatchObject({
      property: 'member.releases.jMoment',
      change: { kind: 'set', value: true },
    });
  });

  it('keeps the advanced properties out of the tab order until they are revealed', async () => {
    const user = setup();
    renderPanel();

    const advanced = screen.getByRole('button', { name: /Más propiedades/ });
    expect(advanced.getAttribute('aria-expanded')).toBe('false');
    expect(fieldRow('member.E').closest('[hidden]')).toBeTruthy();

    await user.click(advanced);
    expect(advanced.getAttribute('aria-expanded')).toBe('true');
    expect(fieldRow('member.E').closest('[hidden]')).toBeNull();
  });
});

describe('BulkEditPanel prepared-intent safety', () => {
  it('keeps an explicit clear when the number field is focused and left', async () => {
    const user = setup();
    const { onApply } = renderPanel({ members: [createBulkMember({ density: 7850 })], nodes: [] });

    await user.click(screen.getByRole('button', { name: /Más propiedades/ }));
    const density = fieldRow('member.density') as HTMLElement;
    await user.click(within(density).getByRole('button', { name: /^Borrar valor de / }));

    // Entrar y salir del campo vacío no puede retirar el borrado preparado:
    // «vacío» es como se muestra `clear`, no sólo como se muestra `untouched`.
    await user.click(within(density).getByRole('textbox'));
    await user.tab();

    expect(density.getAttribute('data-change')).toBe('clear');
    await confirm(user);
    expect(onApply.mock.calls[0][0].intent.entries[0]).toMatchObject({
      property: 'member.density',
      change: { kind: 'clear' },
    });
  });

  it('shows a staged clear on a boolean as its own state, not as untouched', async () => {
    const user = setup();
    renderPanel({ members: [createBulkMember({ type: 'frame', releases: { iMoment: true } })], nodes: [] });

    await user.click(screen.getByRole('button', { name: /Más propiedades/ }));
    const releases = fieldRow('member.releases.iMoment') as HTMLElement;
    await user.click(within(releases).getByRole('radio', { name: 'Borrar valor' }));

    expect(within(releases).getByRole('radio', { name: 'Borrar valor' }).getAttribute('aria-checked')).toBe('true');
    expect(within(releases).getByRole('radio', { name: 'Sin cambios' }).getAttribute('aria-checked')).toBe('false');
  });

  it('withdraws a staged change that a coupled one would contradict', async () => {
    const user = setup();
    const { onApply } = renderPanel({ members: [createBulkMember()], nodes: [] });

    await user.click(screen.getByRole('button', { name: /Más propiedades/ }));
    const area = within(fieldRow('member.A') as HTMLElement).getByRole('textbox');
    await user.type(area, '0.02');
    await user.tab();
    await user.selectOptions(field('Sección'), 'w12x53');
    await confirm(user);

    // Una identidad de catálogo y unos números que la contradicen no pueden
    // prepararse a la vez: la sección retira el área.
    const properties = onApply.mock.calls[0][0].intent.entries.map((entry) => entry.property);
    expect(properties).toEqual(['member.sectionId']);
  });

  it('drops the staged changes when the selection itself changes', async () => {
    const user = setup();
    const onApply = vi.fn<(request: BulkEditApplyRequest) => void>();
    const first: BulkSelectionInput = { members: [createBulkMember({ id: 'M1' })], nodes: [] };
    const second: BulkSelectionInput = { members: [createBulkMember({ id: 'M2' })], nodes: [] };
    const { rerender } = render(<BulkEditPanel selection={first} units="kN-m" language="es" onApply={onApply} />);

    await user.selectOptions(field('Sección'), 'w12x53');
    expect(reviewButton().disabled).toBe(false);

    rerender(<BulkEditPanel selection={second} units="kN-m" language="es" onApply={onApply} />);

    // El borrador se refería a M1; aplicarlo sobre M2 escribiría en un objeto
    // que el usuario nunca editó.
    expect(reviewButton().disabled).toBe(true);
    expect(screen.getByTestId('bulk-changes-count').textContent).toBe('Ningún cambio preparado');
  });

  it('refuses a section id the catalog does not know', () => {
    const aggregate = aggregateBulkSelection({ members: [createBulkMember()], nodes: [] });
    const draft = stageBulkChange(
      EMPTY_BULK_DRAFT,
      findBulkProperty(aggregate, 'member.sectionId'),
      { kind: 'set', value: 'w99x999' },
    );

    expect(draft).toEqual(EMPTY_BULK_DRAFT);
  });

  it('returns focus to the control when a staged change is discarded', async () => {
    const user = setup();
    renderPanel();

    await user.selectOptions(field('Sección'), 'w12x53');
    await user.click(screen.getByRole('button', { name: /Descartar el cambio preparado de Sección/ }));

    // El botón provoca su propio desmontaje: sin devolver el foco, el siguiente
    // Tab reempezaría desde el principio del documento.
    expect(document.activeElement).toBe(field('Sección'));
  });

  it('names the discard control with the text the user can see', () => {
    renderPanel();

    const discard = screen.queryByRole('button', { name: /^Descartar/ });
    expect(discard).toBeNull();
  });
});

/**
 * Descubribilidad de lo que una puerta acaba de habilitar.
 *
 * Cambiar el apoyo a «personalizado» hace aparecer sus restricciones. Si nacen
 * dentro de una revelación progresiva plegada, habilitar y configurar en una
 * sola pasada deja de existir en la práctica: el usuario no ve lo que acaba de
 * desbloquear y vuelve a necesitar dos pasadas.
 */
describe('BulkEditPanel · what a gate unlocks is visible', () => {
  const nodes = (): BulkSelectionInput => ({
    members: [],
    nodes: [createBulkNode({ support: { type: 'pin' } }), createBulkNode({ support: { type: 'pin' } })],
  });

  it('shows the custom restraints without opening a disclosure', async () => {
    const user = setup();
    renderPanel(nodes());

    await user.selectOptions(screen.getByLabelText('Apoyo'), 'custom');

    for (const property of ['node.support.restrainX', 'node.support.restrainY', 'node.support.restrainR']) {
      const row = fieldRow(property) as HTMLElement;
      expect(row, property).toBeTruthy();
      expect(row.closest('[hidden]'), property).toBeNull();
    }
  });

  it('shows the roller normal without opening a disclosure', async () => {
    const user = setup();
    renderPanel(nodes());

    await user.selectOptions(screen.getByLabelText('Apoyo'), 'roller');

    const row = fieldRow('node.support.angleDeg') as HTMLElement;
    expect(row).toBeTruthy();
    expect(row.closest('[hidden]')).toBeNull();
  });
});
