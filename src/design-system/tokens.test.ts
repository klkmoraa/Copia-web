/// <reference types="node" />

/**
 * El contrato de los design tokens.
 *
 * Lo que este archivo vigila NO es "el CSS dice tal cosa en tal línea", sino el
 * contrato del sistema: que cada rol exista, que cada color llegue a su suelo de
 * contraste CONTRA LOS FONDOS DE SU PROPIA APARIENCIA, que la apariencia oscura
 * sea un tema escrito a mano y no una inversión, y que ninguna pieza reintroduzca
 * la materia de arcilla que el sistema retiró.
 *
 * REGLA DE COLOR POR APARIENCIA
 * ---------------------------------------------------------------------------
 * El sistema anterior exigía un mismo HEX en Día y en Noche para todo rol
 * semántico. Eso encerraba la paleta en una franja de luminancia estrechísima y
 * no es como trabaja la plataforma que este producto imita: systemBlue vale
 * #007AFF en claro y #0A84FF en oscuro porque un color medido sobre blanco no
 * está medido sobre negro.
 *
 * Lo que sustituye a aquella regla es un contrato más exigente, no más laxo:
 * cada rol se mide contra los DOS fondos de su apariencia (lienzo y superficie),
 * y el peor de los dos tiene que llegar al suelo. Antes sólo se medía el lienzo.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** The block matchers below are line-oriented; CRLF checkouts must not disable them. */
const readCss = (url: URL) => readFileSync(url, 'utf8').replace(/\r\n/g, '\n');

const tokensCss = readCss(new URL('./tokens.css', import.meta.url));
const stylesCss = readCss(new URL('../styles.css', import.meta.url));
const uiCss = readCss(new URL('./components/ui.css', import.meta.url));
const materialCss = readCss(new URL('./material.css', import.meta.url));
const phase1Css = readCss(new URL('../features/workspace/phase1.css', import.meta.url));
/** The combined text of all component CSS that is not `tokens.css`. */
const componentCss = `${stylesCss}\n${materialCss}\n${uiCss}\n${phase1Css}`;

const blockFor = (pattern: RegExp) => {
  const match = tokensCss.match(pattern);
  if (!match?.[1]) throw new Error(`Missing token block: ${pattern}`);
  return match[1];
};

const parseDeclarations = (block: string) => {
  const declarations = new Map<string, string>();
  const names: string[] = [];
  for (const match of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    names.push(match[1]);
    declarations.set(match[1], match[2].trim());
  }
  return { declarations, names };
};

const rootBlock = blockFor(/:root\s*\{([\s\S]*?)\n\}/);
const darkBlock = blockFor(/:root\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/);
const reducedMotionBlock = blockFor(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?:root\s*\{([\s\S]*?)\n\s*\}\n\}/);

const rootTokens = parseDeclarations(rootBlock);
const darkTokens = parseDeclarations(darkBlock);
const reducedMotionTokens = parseDeclarations(reducedMotionBlock);

const lightTheme = new Map(rootTokens.declarations);
const darkTheme = new Map(rootTokens.declarations);
for (const [name, value] of darkTokens.declarations) darkTheme.set(name, value);

const resolveHex = (name: string, theme: Map<string, string>, seen = new Set<string>()): string => {
  if (seen.has(name)) throw new Error(`Circular token reference: ${name}`);
  seen.add(name);
  const value = theme.get(name);
  if (!value) throw new Error(`Unknown token: ${name}`);
  const reference = value.match(/^var\((--[\w-]+)\)$/);
  if (reference) return resolveHex(reference[1], theme, seen);
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${name} does not resolve to a six-digit hex color: ${value}`);
  return value;
};

const luminance = (hex: string) => {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
};

const contrast = (foreground: string, background: string, theme: Map<string, string>) => {
  const a = luminance(resolveHex(foreground, theme));
  const b = luminance(resolveHex(background, theme));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

/** El peor de los dos fondos de una apariencia: el lienzo y la superficie. */
const worstOnAppearance = (role: string, theme: Map<string, string>) => Math.min(
  contrast(role, '--sc-color-bg-canvas', theme),
  contrast(role, '--sc-color-surface-1', theme),
);

const appearances: ReadonlyArray<readonly [string, Map<string, string>]> = [
  ['clara', lightTheme],
  ['oscura', darkTheme],
];

describe('contrato de los design tokens', () => {
  it('declara cada rol de fundación una sola vez en el bloque raíz', () => {
    const required = [
      '--sc-color-bg-app',
      '--sc-color-bg-canvas',
      '--sc-color-surface-1',
      '--sc-color-text-primary',
      '--sc-color-action-primary',
      '--sc-color-focus',
      '--sc-color-selection-stroke',
      '--sc-color-canvas-grid',
      '--sc-color-technical-load',
      '--sc-color-load-point',
      '--sc-color-load-distributed',
      '--sc-color-load-moment-applied',
      '--sc-color-technical-axial',
      '--sc-color-technical-shear',
      '--sc-color-technical-moment',
      '--sc-color-technical-deformed',
      '--sc-color-technical-reaction',
      '--sc-font-ui',
      '--sc-font-display',
      '--sc-font-mono',
      '--sc-radius-control',
      '--sc-radius-card',
      '--sc-radius-panel',
      '--sc-radius-modal',
      '--sc-motion-fast',
      '--sc-ease-standard',
    ];
    for (const token of required) {
      expect(rootTokens.declarations.has(token), `falta ${token}`).toBe(true);
      expect(rootTokens.names.filter((name) => name === token)).toHaveLength(1);
    }
  });

  it('define la apariencia oscura como tema explícito y no como una inversión', () => {
    // Un tema oscuro que sólo invierte reutiliza el mismo valor con otro signo.
    // Éste redeclara a mano cada fondo, cada tinta y cada material.
    const mustBeRewritten = [
      '--sc-color-bg-app',
      '--sc-color-bg-canvas',
      '--sc-color-surface-1',
      '--sc-color-surface-2',
      '--sc-color-text-primary',
      '--sc-color-text-secondary',
      '--sc-color-border',
      '--sc-color-canvas-grid',
      '--sc-material-thin',
      '--sc-material-regular',
      '--sc-material-thick',
      '--sc-elevation-1',
      '--sc-elevation-4',
    ];
    for (const token of mustBeRewritten) {
      expect(darkTokens.declarations.has(token), `la apariencia oscura debe redeclarar ${token}`).toBe(true);
      expect(darkTokens.declarations.get(token)).not.toBe(rootTokens.declarations.get(token));
    }
  });

  it('la jerarquía de rellenos sube de opacidad en la apariencia oscura', () => {
    // Sobre carbón, el 12 % que basta sobre papel no separa nada.
    const alphaOf = (value: string) => Number.parseFloat(value.match(/,\s*([0-9.]+)\s*\)$/)?.[1] ?? 'NaN');
    for (const fill of ['--sc-color-fill-quaternary', '--sc-color-fill-tertiary', '--sc-color-fill-secondary', '--sc-color-fill-primary']) {
      const light = alphaOf(lightTheme.get(fill) ?? '');
      const dark = alphaOf(darkTheme.get(fill) ?? '');
      expect(Number.isNaN(light), `${fill} no declara alfa en claro`).toBe(false);
      expect(dark, `${fill} debe subir de opacidad en oscuro`).toBeGreaterThan(light);
    }
  });

  describe.each(appearances)('apariencia %s', (_name, theme) => {
    it('mantiene toda la familia técnica sobre el suelo no textual de 3:1', () => {
      const technical = [
        '--sc-color-load-point',
        '--sc-color-load-distributed',
        '--sc-color-load-moment-applied',
        '--sc-color-technical-axial',
        '--sc-color-technical-shear',
        '--sc-color-technical-moment',
        '--sc-color-technical-deformed',
        '--sc-color-technical-reaction',
        '--sc-color-technical-dimension',
        '--sc-color-technical-axis',
        '--sc-color-influence-line',
        '--sc-color-envelope',
      ];
      for (const role of technical) {
        expect(worstOnAppearance(role, theme), role).toBeGreaterThanOrEqual(3);
      }
    });

    it('mantiene los estados y la selección sobre el mismo suelo', () => {
      for (const role of [
        '--sc-color-state-success',
        '--sc-color-state-warning',
        '--sc-color-state-error',
        '--sc-color-state-critical',
        '--sc-color-selection-stroke',
        '--sc-color-focus',
        '--sc-color-action-ink',
        '--sc-color-aula',
      ]) {
        expect(worstOnAppearance(role, theme), role).toBeGreaterThanOrEqual(3);
      }
    });

    it('mantiene las tintas de texto sobre el suelo textual de 4,5:1', () => {
      for (const role of [
        '--sc-color-text-primary',
        '--sc-color-text-secondary',
        '--sc-color-text-technical',
        '--sc-color-text-unit',
        '--sc-color-text-disabled-content',
        '--sc-color-text-link',
      ]) {
        expect(contrast(role, '--sc-color-surface-1', theme), role).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('deja el relleno de acción legible con su propia tinta encima', () => {
      // Un botón por defecto es relleno + etiqueta, y la pareja se mide junta.
      expect(contrast('--sc-color-action-foreground', '--sc-color-action-primary', theme)).toBeGreaterThanOrEqual(4.5);
      expect(contrast('--sc-color-action-foreground', '--sc-color-action-hover', theme)).toBeGreaterThanOrEqual(4.5);
      expect(contrast('--sc-color-action-foreground', '--sc-color-action-pressed', theme)).toBeGreaterThanOrEqual(4.5);
      // Y la silueta del control tiene que verse contra el fondo que lo rodea.
      expect(worstOnAppearance('--sc-color-action-primary', theme)).toBeGreaterThanOrEqual(3);
    });

    it('separa la identidad de una acción aplicada de la de su respuesta', () => {
      // Un momento aplicado no puede leerse como el diagrama de momentos que
      // produce: son la causa y el efecto, y comparten pantalla.
      expect(resolveHex('--sc-color-load-moment-applied', theme))
        .not.toBe(resolveHex('--sc-color-technical-moment', theme));
      expect(resolveHex('--sc-color-load-point', theme))
        .not.toBe(resolveHex('--sc-color-technical-shear', theme));
    });
  });

  it('el amarillo de sistema nunca es trazo suelto: va a relleno con su propia tinta', () => {
    // Es el único hue que no puede ser relleno y tinta a la vez.
    expect(contrast('--sc-color-canario-ink', '--sc-color-canario', lightTheme)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('--sc-color-canario-ink', '--sc-color-canario', darkTheme)).toBeGreaterThanOrEqual(4.5);
  });

  it('el movimiento reducido neutraliza duración y encogido de una sola vez', () => {
    for (const token of [
      '--sc-motion-instant', '--sc-motion-press', '--sc-motion-fast', '--sc-motion-control',
      '--sc-motion-standard', '--sc-motion-slow', '--sc-motion-reveal', '--sc-motion-loading',
    ]) {
      expect(reducedMotionTokens.declarations.get(token), token).toBe('0.001ms');
    }
    // Anular la duración no basta: un `transform` sin transición sigue saltando.
    expect(reducedMotionTokens.declarations.get('--sc-press-transform')).toBe('none');
  });

  it('no queda materia de arcilla en ningún consumidor', () => {
    // La arcilla eran cuatro capas de sombra y una fuente de luz propia por
    // pieza. Un `inset` con desplazamiento en las dos direcciones es su firma:
    // si reaparece, alguien está volviendo a esculpir volumen a mano.
    const sculptedShadows = [...componentCss.matchAll(/box-shadow\s*:\s*([^;]+);/g)]
      .map((match) => match[1])
      .filter((value) => /inset\s+-?\d+px\s+-?\d+px\s+\d+px/.test(value.replace(/rgba?\([^)]*\)/g, '')))
      .filter((value) => !value.includes('var(--'));
    expect(sculptedShadows).toEqual([]);
  });

  it('ningún componente reescribe la elevación con literales de color', () => {
    // La altura la reparte la escala `--sc-elevation-*`. Un `box-shadow` con
    // rgba escrito a mano es una pieza decidiendo su propia física.
    const handRolled = [...componentCss.matchAll(/box-shadow\s*:\s*([^;]+);/g)]
      .map((match) => match[1].trim())
      .filter((value) => /rgba?\(/.test(value) && !value.includes('var(--'))
      // El pomo del interruptor es la excepción declarada: es la única pieza
      // que proyecta contacto sobre su propia pista y no sobre el plano.
      .filter((value) => !value.includes('0 2px 4px rgba(0,0,0,0.2)'));
    expect(handRolled).toEqual([]);
  });

  it('el acento no se usa nunca como fuente de luz', () => {
    // Un halo de color alrededor de un control lo convierte en un objeto
    // encendido. En el sistema, lo que rodea a un control es aire.
    expect(rootTokens.declarations.get('--sc-glow-accent')).toBe('0 0 transparent');
    expect(rootTokens.declarations.get('--sc-glow-aula')).toBe('0 0 transparent');
    expect(rootTokens.declarations.has('--sc-gradient-clay-action')).toBe(false);
    expect(rootTokens.declarations.get('--sc-gradient-sheen')).toBe('none');
  });
});
