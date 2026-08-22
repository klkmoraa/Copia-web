/// <reference types="node" />

/**
 * El contrato de la gramática de materia.
 *
 * Seis niveles, y lo que los distingue no es cuánto volumen tiene cada pieza
 * sino en qué plano está: el valor del fondo, el material translúcido y el
 * filete de medio píxel. La proyección aparece sólo donde algo está de verdad
 * despegado.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./material.css', import.meta.url), 'utf8');
const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

const ruleFor = (selector: string): string => {
  const index = css.indexOf(selector);
  if (index < 0) return '';
  const open = css.indexOf('{', index);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
};

describe('gramática de materia', () => {
  it('declara los seis niveles aprobados', () => {
    for (const level of ['flat', 'inset', 'raised', 'floating', 'sheet', 'modal']) {
      expect(css).toContain(`[data-level='${level}']`);
    }
  });

  it('reserva la proyección para lo que de verdad flota', () => {
    // Un panel acoplado no está despegado de nada: si proyecta, miente.
    expect(ruleFor(".sc-surface[data-level='raised']")).toContain('box-shadow: none');
    expect(ruleFor(".sc-surface[data-level='floating']")).toContain('var(--sc-elevation-3)');
    expect(ruleFor(".sc-surface[data-level='modal']")).toContain('var(--sc-elevation-4)');
    expect(ruleFor(".sc-surface[data-level='sheet']")).toContain('var(--sc-shadow-sheet)');
  });

  it('da material translúcido a lo que se apoya sobre contenido', () => {
    // Barra superior, barra lateral, menús y chrome del lienzo. Lo que
    // comunica "hay algo debajo" es que se ve, no una sombra que lo insinúe.
    for (const selector of ['.topbar', '.toolbar', ".sc-surface[data-level='floating']", '.canvas-layer-panel']) {
      const rule = ruleFor(selector);
      expect(rule, selector).toMatch(/backdrop-filter: var\(--sc-material-blur/);
      expect(rule, selector).toMatch(/background: var\(--sc-material-/);
    }
    // Y el desenfoque siempre lleva saturación: sin ella el material se
    // ensucia y deja de leerse como cristal.
    for (const grade of ['thin', 'regular', 'thick']) {
      expect(tokens).toMatch(new RegExp(`--sc-material-blur-${grade}:\\s*saturate\\(\\d+%\\) blur\\(`));
    }
  });

  it('declara un respaldo opaco donde no hay backdrop-filter', () => {
    // Un fondo al 72 % sin desenfoque deja leer el contenido de debajo a
    // través del texto. Eso no es degradar: es romperse.
    expect(css).toContain('@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))');
  });

  it('pinta la cavidad con un relleno, no con una sombra interior', () => {
    // `inset` era una cavidad excavada con luz propia. Ahora es un grado de la
    // jerarquía de rellenos, que se tiñe con lo que tiene detrás.
    const inset = ruleFor(".sc-surface[data-level='inset']");
    expect(inset).toContain('var(--sc-color-fill-tertiary)');
    expect(inset).toContain('box-shadow: none');
    expect(inset).not.toContain('inset');
  });

  it('mantiene las superficies técnicas densas sin materia', () => {
    const baseStart = css.indexOf('.datasheet-grid-scroll');
    const base = css.slice(baseStart, css.indexOf('}', baseStart));
    for (const selector of ['.datasheet-grid-scroll', '.datasheet-grid tbody th', '.datasheet-grid tbody td', '.datasheet-cell-editor', '.inspector-numeric-field__control']) {
      expect(base).toContain(selector);
    }
    expect(base).toContain('box-shadow: none');
    expect(base).toContain('background-image: none');
    expect(base).not.toContain('gradient');
  });

  it('el pulsado sube el relleno y encoge la pieza, no la hunde', () => {
    const pressed = ruleFor(".sc-surface[data-pressed='true']");
    expect(pressed).toContain('var(--sc-color-fill-secondary)');
    expect(pressed).toContain('box-shadow: none');
    expect(tokens).toMatch(/--sc-press-transform:\s*scale\(0\.9\d\);/);
  });

  it('el velo del modal aparta el contexto en vez de borrarlo', () => {
    const overlay = ruleFor('.sc-overlay');
    expect(overlay).toContain('var(--sc-color-overlay-strong)');
    expect(overlay).toContain('backdrop-filter: blur(');
  });

  it('no repite un nivel dentro de sí mismo', () => {
    // Una tarjeta dentro de una tarjeta inventa una elevación que no existe.
    expect(css).toContain("[data-level='raised'] [data-level='raised']");
    expect(css).toContain("[data-level='floating'] [data-level='floating']");
    expect(css).toContain("[data-level='modal'] [data-level='modal']");
  });
});
