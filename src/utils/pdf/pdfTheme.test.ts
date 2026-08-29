/// <reference types="node" />

/**
 * The report may not invent colour.
 *
 * `tokens.css` is the product's single source of colour, and until 0.8.3 the PDF ignored it:
 * axial was drawn blue on paper and teal on screen, moment red on paper and orange on screen,
 * and the whole document wore a forest-green chrome that exists nowhere in the app. A reader
 * moving between the canvas and the signed memoir was being asked to learn the same structure
 * twice.
 *
 * `pdfTheme.ts` duplicates the hexes because it runs in a DOM-free path with no stylesheet to
 * read. This gate is what keeps the duplicate honest: it parses the real stylesheet and
 * compares, so a token that changes in the app cannot silently stop matching the report.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { rgb } from 'pdf-lib';
import { REPORT_TOKENS, TYPE, createPalette, fromHex } from './pdfTheme';

const TOKENS_CSS = readFileSync(
  fileURLToPath(new URL('../../design-system/tokens.css', import.meta.url)),
  'utf8',
);

/** Value of a custom property in the light appearance, following one level of `var()`. */
const token = (name: string): string => {
  const direct = new RegExp(`^\\s*--${name}:\\s*([^;]+);`, 'm').exec(TOKENS_CSS);
  if (!direct) throw new Error(`tokens.css no declara --${name}`);
  const value = direct[1].trim();
  const alias = /^var\(--([\w-]+)\)$/.exec(value);
  return alias ? token(alias[1]) : value;
};

describe('paleta de la memoria', () => {
  it('toma cada color del token del producto, sin inventar ninguno', () => {
    const pairs: Array<[keyof typeof REPORT_TOKENS, string]> = [
      ['tint', 'sc-grey-100'],
      ['tintDeep', 'sc-grey-150'],
      ['rule', 'sc-grey-300'],
      ['inkFaint', 'sc-grey-500'],
      ['inkSoft', 'sc-grey-600'],
      ['ink', 'sc-grey-900'],
      ['band', 'sc-grey-950'],
      ['accent', 'sc-color-action-primary'],
      ['axial', 'sc-color-technical-axial'],
      ['shear', 'sc-color-technical-shear'],
      ['moment', 'sc-color-technical-moment'],
      ['reaction', 'sc-color-technical-reaction'],
      ['load', 'sc-color-load-point'],
      ['deformed', 'sc-color-technical-deformed'],
    ];
    for (const [name, custom] of pairs) {
      expect(`${name}: ${REPORT_TOKENS[name]}`).toBe(`${name}: ${token(custom).toLowerCase()}`);
    }
  });

  it('separa causa de efecto: ninguna acción aplicada comparte tono con una respuesta', () => {
    const responses = [REPORT_TOKENS.axial, REPORT_TOKENS.shear, REPORT_TOKENS.moment];
    // On the free-body diagram the applied actions and the reactions sit beside the response
    // curves; a load drawn in the moment's orange would read as a result.
    expect(responses).not.toContain(REPORT_TOKENS.load);
    expect(responses).not.toContain(REPORT_TOKENS.reaction);
    expect(REPORT_TOKENS.load).not.toBe(REPORT_TOKENS.reaction);
    expect(new Set(responses).size).toBe(3);
  });

  it('convierte el hex a los tres componentes que pdf-lib espera', () => {
    expect(fromHex('#ffffff')).toEqual([1, 1, 1]);
    expect(fromHex('#000000')).toEqual([0, 0, 0]);
    const [red, green, blue] = fromHex(REPORT_TOKENS.moment);
    expect(red).toBeGreaterThan(green);
    expect(green).toBeGreaterThan(blue);
    // Shorthand survives, so a three-digit token would not silently become black.
    expect(fromHex('#fff')).toEqual([1, 1, 1]);
  });

  it('construye una paleta completa y con los tres tonos técnicos separados', () => {
    const palette = createPalette(rgb);
    expect(palette.quantity.axial).not.toEqual(palette.quantity.shear);
    expect(palette.quantity.shear).not.toEqual(palette.quantity.moment);
    expect(palette.paper).toEqual(rgb(1, 1, 1));
    expect(palette.ink).toEqual(rgb(...fromHex(REPORT_TOKENS.ink)));
  });

  it('mantiene una escala tipográfica monótona, de la portada al pie', () => {
    const steps = [TYPE.display, TYPE.title, TYPE.section, TYPE.sub, TYPE.body, TYPE.small, TYPE.micro];
    for (let index = 1; index < steps.length; index += 1) {
      expect(steps[index]).toBeLessThan(steps[index - 1]);
    }
    // Nothing in a document meant to be read on paper drops below six points.
    expect(TYPE.micro).toBeGreaterThanOrEqual(6);
  });
});
