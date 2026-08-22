// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createStructureGenerationGhost } from '../../data/generators/generatorGhost';
import { findGeneratorFixture } from '../../data/generators/generatorFixtures';
import { CanvasStructureGeneratorLayer } from './CanvasStructureGeneratorLayer';

afterEach(cleanup);

const ghostFor = (fixture: string) =>
  createStructureGenerationGhost(findGeneratorFixture(fixture).params);

/** Escala uno a uno con Y invertida, como el lienzo real. */
const toScreen = (x: number, y: number) => ({ x: 100 + x * 10, y: 400 - y * 10 });

const renderLayer = (fixture: string, origin: { x: number; y: number } | null = null) => {
  const ghost = ghostFor(fixture);
  render(<svg><CanvasStructureGeneratorLayer
    ghost={ghost}
    origin={origin}
    toScreen={toScreen}
    label="Generar estructura"
  /></svg>);
  return ghost;
};

describe('capa de vista previa de generación', () => {
  it('dibuja exactamente los nudos y barras que el ghost declara', () => {
    const ghost = renderLayer('multi-story-frame-two-levels');
    const layer = document.querySelector('[data-structure-generation-ghost]')!;
    expect(layer.querySelectorAll('.structure-generation-ghost__nodes circle')).toHaveLength(ghost.nodes.length);
    expect(layer.querySelectorAll('.structure-generation-ghost__members line')).toHaveLength(ghost.members.length);
    expect(layer.getAttribute('data-ghost-nodes')).toBe(String(ghost.nodes.length));
    expect(layer.getAttribute('data-ghost-members')).toBe(String(ghost.members.length));
  });

  it('coloca cada nudo en la proyección que le corresponde', () => {
    const ghost = renderLayer('multi-story-frame-two-levels');
    const first = ghost.nodes[0];
    const expected = toScreen(first.x, first.y);
    const circle = document.querySelectorAll('.structure-generation-ghost__nodes circle')[0];
    expect(circle.getAttribute('cx')).toBe(String(expected.x));
    expect(circle.getAttribute('cy')).toBe(String(expected.y));
  });

  it('no lleva IDs de entidad: lo dibujado no puede confundirse con el modelo', () => {
    renderLayer('multi-story-frame-two-levels');
    const layer = document.querySelector('[data-structure-generation-ghost]')!;
    expect(layer.querySelectorAll('[data-structure-object]')).toHaveLength(0);
    expect(layer.querySelectorAll('[data-structure-id]')).toHaveLength(0);
    expect(layer.querySelectorAll('[data-structure-kind]')).toHaveLength(0);
  });

  it('no captura el puntero: el lienzo sigue siendo del usuario', () => {
    renderLayer('multi-story-frame-two-levels');
    const layer = document.querySelector('[data-structure-generation-ghost]') as SVGGElement;
    expect(layer.style.pointerEvents).toBe('none');
  });

  it('se anuncia como una imagen con nombre, no como ruido sin etiqueta', () => {
    renderLayer('multi-story-frame-two-levels');
    expect(screen.getByRole('img', { name: 'Generar estructura' })).toBeTruthy();
  });

  it('distingue los nudos que recibirían apoyo de los que no', () => {
    const ghost = renderLayer('continuous-beam-uniform-pinned');
    const supported = [...document.querySelectorAll('[data-ghost-supported="true"]')];
    expect(supported).toHaveLength(ghost.nodes.filter((node) => node.supported).length);
    expect(supported.length).toBeGreaterThan(0);
  });

  it('marca cada barra con su rol, para que una cercha no se lea como una rejilla', () => {
    renderLayer('truss-pratt-four-panels');
    const roles = new Set([...document.querySelectorAll('[data-ghost-member-role]')]
      .map((line) => line.getAttribute('data-ghost-member-role')));
    expect(roles.has('diagonal')).toBe(true);
    expect(roles.has('top-chord')).toBe(true);
    expect(roles.has('bottom-chord')).toBe(true);
  });

  it('dibuja el ancla de inserción sólo cuando hay un origen que enseñar', () => {
    renderLayer('multi-story-frame-two-levels');
    expect(document.querySelector('[data-ghost-origin]')).toBeNull();
    cleanup();
    renderLayer('multi-story-frame-two-levels', { x: 4, y: 2 });
    const anchor = document.querySelector('[data-ghost-origin] circle')!;
    expect(anchor.getAttribute('cx')).toBe(String(toScreen(4, 2).x));
    expect(anchor.getAttribute('cy')).toBe(String(toScreen(4, 2).y));
  });
});
