// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { standardSections } from '../../data/standardSections';
import { ProjectProvider } from '../../store/ProjectContext';
import { SectionViewer2D } from './SectionViewer2D';

afterEach(cleanup);

const ipe300 = standardSections.find((section) => section.id === 'ipe-300')!;
const hss = standardSections.find((section) => section.shapeType === 'HSS_RECT')!;

const renderViewer = (
  section: { area: number; inertiaX: number },
  stress = true,
  overrides?: { axialForce?: number; bendingMoment?: number },
) => render(
  <ProjectProvider>
    <SectionViewer2D
      area={section.area}
      inertia={section.inertiaX}
      sectionId={'id' in section ? String(section.id) : undefined}
      sectionOrigin="catalog"
      units="kN-m"
      axialForce={overrides?.axialForce ?? (stress ? -180 : 0)}
      bendingMoment={overrides?.bendingMoment ?? (stress ? 95 : 0)}
    />
  </ProjectProvider>,
);

const shapeElement = () => document.querySelector('.section-shape');

describe('SectionViewer2D', () => {
  it('does not infer a commercial shape from matching A and I without explicit identity', () => {
    render(
      <ProjectProvider>
        <SectionViewer2D
          area={ipe300.area}
          inertia={ipe300.inertiaX}
          sectionOrigin={'legacy' as never}
          units="kN-m"
        />
      </ProjectProvider>,
    );

    expect(screen.queryByText(ipe300.name)).toBeNull();
    expect(shapeElement()?.tagName.toLowerCase()).toBe('rect');
  });

  it('keeps the real profile geometry when the stress map is switched on', async () => {
    const user = userEvent.setup();
    renderViewer(ipe300);

    // Cotas: el perfil I es un `path`, no una caja.
    const dimensioned = shapeElement()!;
    expect(dimensioned.tagName.toLowerCase()).toBe('path');
    const outline = dimensioned.getAttribute('d')!;
    expect(outline).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Tensiones/ }));

    // La regresión concreta: el modo Stress pintaba un rectángulo con degradado
    // sobre cualquier perfil. El contorno tiene que seguir siendo el mismo path.
    const stressed = shapeElement()!;
    expect(stressed.tagName.toLowerCase()).toBe('path');
    expect(stressed.getAttribute('d')).toBe(outline);
  });

  it('clips the stress gradient with that same geometry instead of a bare rectangle', async () => {
    const user = userEvent.setup();
    renderViewer(ipe300);
    const outline = shapeElement()!.getAttribute('d');

    await user.click(screen.getByRole('button', { name: /Tensiones/ }));

    const fill = screen.getByTestId('section-stress-fill');
    const mask = screen.getByTestId('section-stress-mask');
    const maskId = mask.getAttribute('id') ?? '';
    expect(maskId).toMatch(/^section-stress-mask-/);
    expect(fill.getAttribute('mask')).toBe(`url(#${maskId})`);
    expect(fill.getAttribute('fill')).toMatch(/^url\(#section-stress-gradient-/);

    const masked = mask.querySelector('path');
    expect(masked?.getAttribute('d')).toBe(outline);
  });

  it('keeps gradient and mask ids unique across simultaneous instances', async () => {
    const user = userEvent.setup();
    render(
      <ProjectProvider>
        <SectionViewer2D area={ipe300.area} inertia={ipe300.inertiaX} units="kN-m" axialForce={-180} bendingMoment={95} />
        <SectionViewer2D area={hss.area} inertia={hss.inertiaX} units="kN-m" axialForce={-180} bendingMoment={95} />
      </ProjectProvider>,
    );
    for (const button of screen.getAllByRole('button', { name: /Tensiones/ })) await user.click(button);

    const masks = screen.getAllByTestId('section-stress-mask');
    const maskIds = masks.map((mask) => mask.getAttribute('id'));
    expect(new Set(maskIds).size).toBe(maskIds.length);

    const fills = screen.getAllByTestId('section-stress-fill');
    const fillRefs = fills.map((fill) => fill.getAttribute('fill'));
    expect(new Set(fillRefs).size).toBe(fillRefs.length);
  });

  it('carries the hollow of a tube into the mask so the void stays empty', async () => {
    const user = userEvent.setup();
    renderViewer(hss);
    await user.click(screen.getByRole('button', { name: /Tensiones/ }));

    const mask = screen.getByTestId('section-stress-mask');
    const shapes = [...mask.querySelectorAll('rect')];
    expect(shapes).toHaveLength(2);
    // Blanco es material, negro es hueco.
    expect(shapes[0].getAttribute('fill')).toBe('white');
    expect(shapes[1].getAttribute('fill')).toBe('black');
  });

  it('places the zero-stress fibre where Navier puts it, not at mid depth', async () => {
    const user = userEvent.setup();
    renderViewer(ipe300);
    await user.click(screen.getByRole('button', { name: /Tensiones/ }));

    const fill = screen.getByTestId('section-stress-fill');
    const gradientId = (fill.getAttribute('fill') ?? '').replace(/^url\(#/, '').replace(/\)$/, '');
    const stops = [...document.getElementById(gradientId)!.querySelectorAll('stop')];
    // Con axil de compresión y flexión, σ cambia de signo dentro del canto: hay
    // una parada intermedia, y no está en el 50 % como estaba antes fijada.
    expect(stops).toHaveLength(3);
    const middle = Number(stops[1].getAttribute('offset'));
    expect(middle).toBeGreaterThan(0);
    expect(middle).toBeLessThan(1);
    expect(middle).not.toBeCloseTo(0.5, 3);
    expect(stops[1].getAttribute('stop-opacity')).toBe('0');
  });

  it('leaves the stress mode unavailable when the member carries no forces', () => {
    renderViewer(ipe300, false);
    expect((screen.getByRole('button', { name: /Tensiones/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('draws E.N. at the geometric mid-depth in dimensions view', () => {
    renderViewer(ipe300);
    const axis = document.querySelector('.section-neutral-axis');
    expect(axis).toBeTruthy();
    expect(axis?.getAttribute('y1')).toBe('70');
  });

  it('moves E.N. to the Navier zero-stress fibre in stress view, not the geometric centre', async () => {
    const user = userEvent.setup();
    renderViewer(ipe300);
    const centerY = document.querySelector('.section-neutral-axis')?.getAttribute('y1');

    await user.click(screen.getByRole('button', { name: /Tensiones/ }));

    const axis = document.querySelector('.section-neutral-axis');
    expect(axis).toBeTruthy();
    expect(axis?.getAttribute('y1')).not.toBe(centerY);
  });

  it('hides E.N. in stress view when the whole section carries the same sign (no zero crossing)', async () => {
    const user = userEvent.setup();
    renderViewer(ipe300, true, { axialForce: -400, bendingMoment: 1 });
    await user.click(screen.getByRole('button', { name: /Tensiones/ }));
    expect(document.querySelector('.section-neutral-axis')).toBeNull();
  });
});
