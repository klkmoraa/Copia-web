/// <reference types="node" />

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

describe('material grammar', () => {
  it('declares all six approved material levels', () => {
    for (const level of ['flat', 'inset', 'raised', 'floating', 'sheet', 'modal']) {
      expect(css).toContain(`[data-level='${level}']`);
    }
  });

  it('uses the existing sheet and modal material tokens', () => {
    expect(ruleFor(".sc-surface[data-level='sheet']")).toContain('var(--sc-shadow-sheet)');
    expect(ruleFor(".sc-surface[data-level='modal']")).toContain('var(--sc-shadow-modal)');
    expect(css).toMatch(/sc-overlay[^}]*background:\s*var\(--sc-color-overlay-strong\)/s);
  });

  it('keeps dense technical surfaces at BASE', () => {
    const baseStart = css.indexOf('.datasheet-grid-scroll');
    const base = css.slice(baseStart, css.indexOf('}', baseStart));
    for (const selector of ['.datasheet-grid-scroll', '.datasheet-grid tbody th', '.datasheet-grid tbody td', '.datasheet-cell-editor', '.inspector-numeric-field__control']) {
      expect(base).toContain(selector);
    }
    expect(base).toContain('box-shadow: none');
    expect(base).toContain('background-image: none');
    expect(base).not.toContain('gradient');
  });

  it('uses a stable inset well without pretending the control is being pressed', () => {
    expect(ruleFor(".sc-surface[data-level='inset']")).toContain('var(--sc-shadow-clay-inset)');
    expect(ruleFor(".sc-surface[data-level='inset']")).not.toContain('var(--sc-shadow-clay-pressed)');
  });

  it('presses every level with inset-only light', () => {
    expect(ruleFor(".sc-surface[data-pressed='true']")).toContain('var(--sc-shadow-clay-pressed)');
    const pressedToken = tokens.match(/--sc-shadow-clay-pressed:\s*([^;]+);/)?.[1] ?? '';
    expect(pressedToken).toContain('inset');
    const shadowLayers = pressedToken.replace(/rgba?\([^)]*\)/g, '').split(',');
    expect(shadowLayers.every((layer) => layer.trimStart().startsWith('inset '))).toBe(true);
  });
});
