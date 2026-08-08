/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** The block matchers below are line-oriented; CRLF checkouts must not disable them. */
const readCss = (url: URL) => readFileSync(url, 'utf8').replace(/\r\n/g, '\n');

const tokensCss = readCss(new URL('./tokens.css', import.meta.url));
const stylesCss = readCss(new URL('../styles.css', import.meta.url));
const uiCss = readCss(new URL('./components/ui.css', import.meta.url));
const materialCss = readCss(new URL('./material.css', import.meta.url));
/** The combined text of all component CSS that is not `tokens.css`. */
const componentCss = `${stylesCss}\n${materialCss}`;

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

describe('Phase 4 design-token contract', () => {
  it('declares every required foundation token once per theme block', () => {
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
      '--sc-color-technical-axial',
      '--sc-color-technical-shear',
      '--sc-color-technical-moment',
      '--sc-color-technical-deformed',
      '--sc-color-technical-reaction',
      '--sc-font-ui',
      '--sc-font-mono',
      '--sc-numeric-variant',
      '--sc-size-target-touch',
      '--sc-focus-ring-width',
      '--sc-motion-control',
      '--sc-motion-loading',
      '--sc-transition-control',
      '--sc-z-modal',
    ];

    expect(new Set(rootTokens.names).size).toBe(rootTokens.names.length);
    expect(new Set(darkTokens.names).size).toBe(darkTokens.names.length);
    for (const token of required) expect(rootTokens.declarations.has(token), token).toBe(true);
  });

  it('defines Dark as an explicit visual theme rather than an inversion', () => {
    const explicitDarkRoles = [
      '--sc-color-bg-app',
      '--sc-color-bg-canvas',
      '--sc-color-surface-1',
      '--sc-color-surface-2',
      '--sc-color-text-primary',
      '--sc-color-text-secondary',
      '--sc-color-border',
      '--sc-color-focus',
      '--sc-color-selection-stroke',
      '--sc-color-canvas-grid',
      '--sc-color-canvas-member',
      '--sc-color-overlay-strong',
      '--sc-color-technical-load',
      '--sc-color-technical-moment',
      '--sc-shadow-modal',
    ];

    for (const token of explicitDarkRoles) expect(darkTokens.declarations.has(token), token).toBe(true);
    expect(darkBlock).not.toMatch(/invert\(|filter\s*:/);
  });

  it('keeps compatibility aliases attached to semantic roles', () => {
    const aliases = new Map([
      ['--app-bg', '--sc-color-bg-app'],
      ['--surface', '--sc-color-surface-1'],
      ['--canvas-bg', '--sc-color-bg-canvas'],
      ['--text', '--sc-color-text-primary'],
      ['--focus', '--sc-color-focus'],
      ['--selection', '--sc-color-selection-stroke'],
      ['--grid', '--sc-color-canvas-grid'],
      ['--member', '--sc-color-canvas-member'],
      ['--node-fill', '--sc-color-canvas-node-fill'],
      ['--force', '--sc-color-technical-load'],
      ['--moment', '--sc-color-technical-moment'],
    ]);

    for (const [alias, semantic] of aliases) {
      expect(rootTokens.declarations.get(alias)).toBe(`var(${semantic})`);
    }
  });

  it('keeps tool identity colors aligned with their canvas roles', () => {
    const toolRoles = new Map([
      ['--sc-color-tool-structure', '--sc-color-text-primary'],
      ['--sc-color-tool-point-load', '--sc-color-technical-load'],
      ['--sc-color-tool-distributed-load', '--sc-color-technical-shear'],
      ['--sc-color-tool-moment', '--sc-color-technical-moment'],
      ['--sc-color-tool-dimension', '--sc-color-technical-dimension'],
      ['--sc-color-tool-cut', '--sc-color-technical-axis'],
      ['--sc-color-tool-destructive', '--sc-color-state-error'],
    ]);

    for (const [tool, role] of toolRoles) {
      expect(rootTokens.declarations.get(tool)).toBe(`var(${role})`);
    }
  });

  it.each([
    ['Light', lightTheme],
    ['Dark', darkTheme],
  ] as const)('%s meets interface and technical contrast floors', (_label, theme) => {
    const textPairs = [
      ['--sc-color-text-primary', '--sc-color-surface-1', 4.5],
      ['--sc-color-text-secondary', '--sc-color-surface-1', 4.5],
      ['--sc-color-action-foreground', '--sc-color-action-primary', 4.5],
      // Solid semantic fills are measured as a pair. `styles.css` used to hardcode #fff
      // on these, which in Dark gave 2.11:1 on success and 2.37:1 on the accent.
      ['--sc-color-success-on-solid', '--sc-color-success-solid', 4.5],
      ['--sc-color-error-on-solid', '--sc-color-error-solid', 4.5],
      ['--sc-color-focus', '--sc-color-surface-1', 3],
      ['--sc-color-state-warning-foreground', '--sc-color-surface-1', 4.5],
      ['--sc-color-state-error-foreground', '--sc-color-surface-1', 4.5],
    ] as const;
    const technicalRoles = [
      '--sc-color-technical-load',
      '--sc-color-technical-axial',
      '--sc-color-technical-shear',
      '--sc-color-technical-moment',
      '--sc-color-technical-deformed',
      '--sc-color-technical-reaction',
      '--sc-color-technical-dimension',
      '--sc-color-technical-axis',
    ];

    for (const [foreground, background, minimum] of textPairs) {
      expect(contrast(foreground, background, theme), `${foreground} on ${background}`).toBeGreaterThanOrEqual(minimum);
    }
    for (const role of technicalRoles) {
      expect(contrast(role, '--sc-color-bg-canvas', theme), role).toBeGreaterThanOrEqual(3);
    }
  });

  it('neutralizes all shared duration tokens when reduced motion is requested', () => {
    const durations = [
      '--sc-motion-press',
      '--sc-motion-fast',
      '--sc-motion-control',
      '--sc-motion-standard',
      '--sc-motion-slow',
      '--sc-motion-loading',
    ];
    for (const token of durations) expect(reducedMotionTokens.declarations.get(token)).toBe('0.001ms');
  });

  it('does not consume primitive color tokens from component CSS', () => {
    expect(componentCss).not.toMatch(/var\(--sc-(?:white|black|green-\d+|cyan-\d+|slate-\d+|blue-\d+|violet-\d+|orange-\d+|red-\d+|amber-\d+)\)/);
  });

  it('never hardcodes an opaque color in component CSS', () => {
    // A literal foreground cannot follow the theme. `color:#fff` on `var(--accent)`
    // measured 2.37:1 in Dark, far below the 4.5:1 the tokens themselves guarantee.
    const literals = componentCss.match(/#[0-9a-fA-F]{3,8}\b|(?<!\/\*[^*]*)\brgb\([^)]*\)/g) ?? [];
    expect(literals).toEqual([]);
  });

  it('keeps translucency literals to shadows and scrims, where a token cannot express alpha', () => {
    // `rgba()` is still allowed, but only inside box-shadow / filter / background scrims.
    // Anywhere else it would be a color decision escaping the palette.
    const offenders: string[] = [];
    for (const match of componentCss.matchAll(/[^;{}]*rgba\([^)]*\)[^;{}]*/g)) {
      const declaration = match[0].trim();
      if (!/box-shadow|drop-shadow|filter|background(-color)?\s*:/.test(declaration)) {
        offenders.push(declaration.slice(0, 80));
      }
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * `--sc-*` custom properties injected at runtime rather than declared in `tokens.css`.
 * `WorkspaceShell` writes these from `visualViewport` on every resize, so the stylesheet
 * legitimately reads them with a fallback and the static check must not flag them.
 */
const RUNTIME_INJECTED_TOKENS = new Set([
  '--sc-visual-viewport-height',
  '--sc-visual-viewport-top',
  '--sc-visual-viewport-bottom',
]);

const referencedTokens = (css: string) => {
  const local = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]));
  return [...css.matchAll(/var\(\s*(--sc-[\w-]+)/g)]
    .map((match) => match[1])
    .filter((name) => !local.has(name) && !RUNTIME_INJECTED_TOKENS.has(name));
};

describe('AG-015 premium visual layer contract', () => {
  const declared = new Set([...tokensCss.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]));

  it.each([
    ['styles.css', stylesCss],
    ['ui.css', uiCss],
    ['material.css', materialCss],
  ] as const)('resolves every design token %s references', (_label, css) => {
    // A `var(--sc-…)` typo does not fail the build, it silently renders the property
    // invalid — which is how `.welcome-badge--beam` shipped with an unstyled badge.
    const missing = [...new Set(referencedTokens(css))].filter((name) => !declared.has(name));
    expect(missing).toEqual([]);
  });

  it('declares the display typography scale the marketing surfaces need', () => {
    const display = [
      '--sc-font-display',
      '--sc-font-size-display-xl',
      '--sc-font-size-display-md',
      '--sc-font-size-lead',
      '--sc-line-height-display',
      '--sc-tracking-display',
      '--sc-tracking-eyebrow',
      '--sc-font-weight-display',
    ];
    for (const token of display) expect(rootTokens.declarations.has(token), token).toBe(true);
  });

  it('declares rings, glows and gradients as tokens, not per-component literals', () => {
    const materials = [
      '--sc-ring-inset',
      '--sc-glow-accent',
      '--sc-glow-aula',
      '--sc-shadow-lifted',
      '--sc-gradient-brand-soft',
      '--sc-gradient-display',
      '--sc-gradient-sheen',
    ];
    for (const token of materials) expect(rootTokens.declarations.has(token), token).toBe(true);
  });

  it('recalibrates every material Dark cannot inherit from Day', () => {
    // Rings and glows read inverted across themes: an accent halo that reads as
    // light in Day reads as haze in Night. Re-measure them instead of inheriting.
    const recalibrated = [
      '--sc-ring-inset',
      '--sc-glow-accent',
      '--sc-shadow-lifted',
    ];
    for (const token of recalibrated) expect(darkTokens.declarations.has(token), token).toBe(true);
  });

  it('keeps the welcome surface free of untokenized elevation', () => {
    // The previous welcome cards hardcoded `rgba(0,0,0,.15)`, which is invisible against
    // the Night ground: elevation has to come from the theme-calibrated shadow tokens.
    const welcomeRules = [...componentCss.matchAll(/^[^\n{]*\.welcome[^\n{]*\{([^}]*)\}/gm)];
    const offenders = welcomeRules
      .flatMap((rule) => rule[1].split(';'))
      .filter((declaration) => /box-shadow/.test(declaration) && /rgba?\(/.test(declaration))
      .map((declaration) => declaration.trim());
    expect(offenders).toEqual([]);
  });

  it('declares the clay elevation scale in both themes', () => {
    const clay = [
      '--sc-shadow-clay-xs',
      '--sc-shadow-clay-sm',
      '--sc-shadow-clay-md',
      '--sc-shadow-clay-lg',
      '--sc-shadow-clay-floating',
      '--sc-shadow-clay-pressed',
    ];
    for (const token of clay) {
      expect(rootTokens.declarations.has(token), `light ${token}`).toBe(true);
      // Night cannot inherit Day's clay: an inner highlight tuned for warm
      // porcelain reads as a scratch over graphite, and the outer shadow has to
      // shrink because there is no light left for it to remove.
      expect(darkTokens.declarations.has(token), `dark ${token}`).toBe(true);
    }
  });

  it('lights every clay surface from the same direction', () => {
    // Four layers per surface: outer shadow down-right, inner highlight
    // up-left, inner shadow down-right, and the 1px edge. Two of them are
    // `inset`; a level that forgot them would read as a flat card with a blur.
    // Both themes must hold this shape independently — Night recalibrates the
    // values but not the structure, and a regression in either block has to
    // fail here, not just in Day.
    for (const [themeLabel, theme] of [
      ['light', rootTokens],
      ['dark', darkTokens],
    ] as const) {
      for (const level of ['--sc-shadow-clay-sm', '--sc-shadow-clay-md', '--sc-shadow-clay-lg']) {
        const value = theme.declarations.get(level) ?? '';
        expect((value.match(/inset/g) ?? []).length, `${themeLabel} ${level}`).toBeGreaterThanOrEqual(2);
      }
      // Pressed inverts: it is inset-only, or it would still look like it floats.
      expect(theme.declarations.get('--sc-shadow-clay-pressed'), `${themeLabel} --sc-shadow-clay-pressed`)
        .not.toMatch(/(^|,)\s*0\s+\d+px/);
    }
  });

  it('reserves a hero radius above the card scale', () => {
    expect(rootTokens.declarations.has('--sc-radius-hero')).toBe(true);
  });

  it('measures a canvas-chrome border that clears the non-text contrast floor in both themes', () => {
    // Nothing else does: --sc-color-border-strong is 1.96:1 against the canvas
    // in Day. Floating chrome (mode badge, zoom controls, quick-entry) needs
    // its own measured border or it becomes unreadable once the glass that
    // used to separate it from the drawing is gone.
    expect(contrast('--sc-color-border-canvas-chrome', '--sc-color-bg-canvas', lightTheme))
      .toBeGreaterThanOrEqual(3);
    expect(contrast('--sc-color-border-canvas-chrome', '--sc-color-bg-canvas', darkTheme))
      .toBeGreaterThanOrEqual(3);
  });

  it('keeps ui.css off the flat AG-015 shadow family', () => {
    // ui.css is the design-system library CSS — every sc-* component's shadow
    // should resolve to the clay scale, not the flat one clay was meant to
    // replace. Grep, not getComputedStyle: jsdom can't render this, so the
    // text-level check is what guards it inside `npm test`.
    const flatShadowTokens = ['--sc-shadow-raised', '--sc-shadow-lifted', '--sc-shadow-floating', '--sc-shadow-modal', '--sc-shadow-popover', '--sc-shadow-contact', '--sc-shadow-sheet'];
    const offenders = flatShadowTokens.filter((token) => uiCss.includes(`var(${token})`));
    expect(offenders).toEqual([]);
  });
});
