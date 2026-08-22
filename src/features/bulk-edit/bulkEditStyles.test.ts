/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Contrato visual del panel: el design system, y sólo el design system.
 *
 * Un `var(--sc-…)` mal escrito no rompe la compilación, sólo deja la propiedad
 * inválida y el componente sin estilo. Estas pruebas comprueban que el panel usa
 * el sistema existente en vez de introducir un segundo lenguaje visual, y que
 * los objetivos táctiles se declaran con el token de 44 px.
 *
 * Alcance: sólo `bulkEdit.css`. La vista previa reutiliza a propósito la tarjeta
 * `.section-viewer` de `src/styles.css`, que es hoja heredada y no está cubierta
 * por estas comprobaciones.
 */

const bulkCss = readFileSync(new URL('./bulkEdit.css', import.meta.url), 'utf8');
const tokensCss = readFileSync(new URL('../../design-system/tokens.css', import.meta.url), 'utf8');

const declaredTokens = new Set([...tokensCss.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]));
const localTokens = new Set([...bulkCss.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]));
const referencedTokens = [...bulkCss.matchAll(/var\(\s*(--sc-[\w-]+)/g)]
  .map((match) => match[1])
  .filter((name) => !localTokens.has(name));

describe('bulk edit styles', () => {
  it('resolves every design token it references', () => {
    const missing = [...new Set(referencedTokens)].filter((name) => !declaredTokens.has(name));
    expect(missing).toEqual([]);
  });

  it('stays on semantic tokens instead of the primitive palette', () => {
    expect(bulkCss).not.toMatch(/var\(--sc-(?:white|black|green-\d+|blue-\d+|violet-\d+|orange-\d+|red-\d+|amber-\d+)\)/);
  });

  it('never hard-codes a colour outside the token system', () => {
    const withoutComments = bulkCss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(withoutComments).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(withoutComments).not.toMatch(/\b(?:rgb|rgba|hsl|hsla)\(/);
  });

  it('sizes every interactive control with the touch target token', () => {
    for (const selector of [
      '.bulk-field__select',
      '.bulk-field__input',
      '.bulk-field__action',
      '.bulk-field__segmented button',
      '.bulk-changes__untouched summary',
      '.bulk-edit-panel__buttons .sc-button',
      // El filtro de alcance es el primer control del panel en una hoja móvil.
      '.bulk-edit-panel__scope-control button',
    ]) {
      const block = bulkCss.slice(bulkCss.indexOf(selector));
      expect(block.slice(0, block.indexOf('}')), selector).toContain('var(--sc-control-height-touch)');
    }
  });

  it('adapts to the width of its container rather than to the viewport', () => {
    // El panel debe servir igual en el costado del Inspector que en una hoja
    // móvil, y en ambos casos su ancho lo decide el contenedor, no la ventana.
    expect(bulkCss).toContain('container-type: inline-size');
    expect(bulkCss).toMatch(/@container \(min-width:/);
    expect(bulkCss).not.toContain('@media');
  });

  it('keeps the actions clear of the mobile safe area', () => {
    expect(bulkCss).toContain('env(safe-area-inset-bottom');
  });
});
