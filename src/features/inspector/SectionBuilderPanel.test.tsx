// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSection } from '../../data/sectionBuilder';
import { standardSections } from '../../data/standardSections';
import { ProjectProvider } from '../../store/ProjectContext';
import { SectionBuilderPanel } from './SectionBuilderPanel';

afterEach(cleanup);

const ipe300 = standardSections.find((section) => section.id === 'ipe-300')!;

const renderPanel = (props: Partial<Parameters<typeof SectionBuilderPanel>[0]> = {}) => {
  const onApply = props.onApply ?? vi.fn();
  render(
    <ProjectProvider>
      <SectionBuilderPanel
        units={props.units ?? 'kN-m'}
        seedSection={'seedSection' in props ? props.seedSection : ipe300}
        currentArea={props.currentArea ?? ipe300.area}
        currentInertia={props.currentInertia ?? ipe300.inertiaX}
        onApply={onApply}
      />
    </ProjectProvider>,
  );
  return onApply as ReturnType<typeof vi.fn>;
};

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const applyButton = () => screen.getByRole('button', { name: 'Aplicar A e I al miembro' });
const type = async (user: ReturnType<typeof userEvent.setup>, label: string, value: string) => {
  await user.clear(field(label));
  await user.type(field(label), value);
  await user.tab();
};

describe('arranque desde el perfil del miembro', () => {
  it('trae las cotas del perfil, en la unidad en que se publican', () => {
    renderPanel();
    expect((screen.getByLabelText('Forma') as HTMLSelectElement).value).toBe('i-shape');
    // 0,3 m de canto son 300 mm, no 0,3: la cantidad de sección existe para eso.
    expect(field('Canto').value).toBe('300');
    expect(field('Espesor del alma').value).toBe('7.1');
  });

  it('sin identidad de catálogo arranca en una sección que existe, no en ceros', () => {
    renderPanel({ seedSection: undefined });
    expect(field('Canto').value).toBe('300');
    expect((applyButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it('presenta las cotas en pulgadas cuando el sistema es imperial', () => {
    renderPanel({ units: 'kip-ft' });
    // 0,3 m son 11,811 in. En la cantidad `length` del mismo sistema serían
    // 0,984 ft, que es el número que este panel no quiere pedirle a nadie.
    expect(Number(field('Canto').value)).toBeCloseTo(11.811, 2);
  });
});

describe('lo que se aplica', () => {
  it('escribe el área y la inercia que el constructor devuelve para la descripción', async () => {
    const user = userEvent.setup();
    const onApply = renderPanel();
    await user.click(applyButton());

    const expected = buildSection({
      kind: 'i-shape',
      depth: ipe300.depth,
      width: ipe300.width,
      webThickness: ipe300.webThickness,
      flangeThickness: ipe300.flangeThickness,
    });
    expect(onApply).toHaveBeenCalledTimes(1);
    const applied = onApply.mock.calls[0][0] as { A: number; I: number };
    expect(applied.A).toBeCloseTo(expected.area, 12);
    expect(applied.I).toBeCloseTo(expected.inertiaX, 15);
  });

  it('aplica la inercia débil cuando el eje elegido es el débil', async () => {
    const user = userEvent.setup();
    const onApply = renderPanel();
    await user.selectOptions(screen.getByLabelText(/Eje de flexión/), 'y');
    await user.click(applyButton());

    const expected = buildSection({
      kind: 'i-shape',
      depth: ipe300.depth,
      width: ipe300.width,
      webThickness: ipe300.webThickness,
      flangeThickness: ipe300.flangeThickness,
    });
    const applied = onApply.mock.calls[0][0] as { A: number; I: number };
    expect(applied.I).toBeCloseTo(expected.inertiaY, 15);
    // Y no la fuerte: son casi dos órdenes de magnitud de diferencia, así que
    // confundirlas no es un matiz.
    expect(applied.I).toBeLessThan(expected.inertiaX / 10);
  });

  it('lleva a la aplicación lo que se teclea, no lo que trajo la semilla', async () => {
    const user = userEvent.setup();
    const onApply = renderPanel();
    await type(user, 'Canto', '500');
    await user.click(applyButton());

    const applied = onApply.mock.calls[0][0] as { A: number; I: number };
    expect(applied.A).toBeCloseTo(buildSection({
      kind: 'i-shape',
      depth: 0.5,
      width: ipe300.width,
      webThickness: ipe300.webThickness,
      flangeThickness: ipe300.flangeThickness,
    }).area, 12);
  });
});

describe('una descripción que no cierra', () => {
  it('nombra el motivo y no deja aplicar nada', async () => {
    const user = userEvent.setup();
    const onApply = renderPanel();
    // Dos alas de 200 mm no caben en un canto de 300 mm.
    await type(user, 'Espesor del ala', '200');

    expect(screen.getByRole('alert').textContent).toContain('consumen todo el canto');
    expect((applyButton() as HTMLButtonElement).disabled).toBe(true);
    await user.click(applyButton());
    expect(onApply).not.toHaveBeenCalled();
  });

  it('vuelve a dejar aplicar en cuanto la descripción cierra otra vez', async () => {
    const user = userEvent.setup();
    const onApply = renderPanel();
    await type(user, 'Espesor del ala', '200');
    expect((applyButton() as HTMLButtonElement).disabled).toBe(true);
    await type(user, 'Espesor del ala', '11');
    expect(screen.queryByRole('alert')).toBeNull();
    await user.click(applyButton());
    expect(onApply).toHaveBeenCalledTimes(1);
  });
});

describe('cambiar de forma', () => {
  it('conserva las cotas ya escritas que la forma nueva no usa', async () => {
    const user = userEvent.setup();
    renderPanel();
    await type(user, 'Espesor del ala', '20');
    await user.selectOptions(screen.getByLabelText('Forma'), 'box');
    expect(screen.queryByLabelText('Espesor del ala')).toBeNull();
    await user.selectOptions(screen.getByLabelText('Forma'), 'i-shape');
    // Ir y volver es cambiar de vista sobre la misma descripción, no empezar
    // de cero: el espesor tecleado sigue ahí.
    expect(field('Espesor del ala').value).toBe('20');
  });

  it('pide las cotas del tubo y dibuja su contorno, no una caja', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.selectOptions(screen.getByLabelText('Forma'), 'tube');
    expect(screen.getByLabelText('Diámetro exterior')).toBeTruthy();
    expect(screen.queryByLabelText('Canto')).toBeNull();
    const preview = screen.getByRole('img', { name: 'Vista previa de la sección descrita' });
    expect(preview.querySelector('circle')).toBeTruthy();
  });

  it('dibuja el contorno real de la forma descrita, sin esperar a que se aplique', () => {
    renderPanel();
    const preview = screen.getByRole('img', { name: 'Vista previa de la sección descrita' });
    // Un perfil I es un `path`; el visor del miembro, en cambio, sólo dibuja la
    // rectangular equivalente mientras la sección no sea de catálogo.
    expect(preview.querySelector('path')).toBeTruthy();
    expect(preview.getAttribute('data-shape')).toBe('I');
  });
});

describe('lo que el panel declara sobre sí mismo', () => {
  it('dice que la descripción no se guarda antes de que alguien lo descubra', () => {
    renderPanel();
    const note = screen.getByText(/no se guarda/);
    expect(note.textContent).toContain('personalizada');
  });

  it('deja de ofrecer aplicar cuando el miembro ya tiene lo descrito', () => {
    const built = buildSection({
      kind: 'i-shape',
      depth: ipe300.depth,
      width: ipe300.width,
      webThickness: ipe300.webThickness,
      flangeThickness: ipe300.flangeThickness,
    });
    renderPanel({ currentArea: built.area, currentInertia: built.inertiaX });
    // Una flecha entre dos números iguales no informa de un cambio: no lo hay.
    expect(document.querySelector('.section-builder__delta')?.textContent).toContain('ya tiene esta sección');
    expect((applyButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it('enseña el cambio que va a producir, contra los valores actuales', () => {
    renderPanel({ currentArea: 0.001, currentInertia: 1e-6 });
    const delta = document.querySelector('.section-builder__delta')!;
    expect(delta.textContent).toContain('→');
    expect(delta.textContent).toContain('A ');
    expect(delta.textContent).toContain('I ');
  });
});
