/**
 * AUDIT/TEMPORARY — CRI-91 chromatic gate.
 *
 * Recomputes WCAG contrast from the canonical token backgrounds and records
 * grayscale, deuteranopia and protanopia separation evidence. CVD transforms
 * use the Machado 2009 severity-100 matrices as a visual QA approximation;
 * they are not a clinical diagnosis.
 *
 * Run from the repository root:
 *   node validation/cri-91/cri91-color-gate.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tokensSource = readFileSync(new URL('../../src/design-system/tokens.css', import.meta.url), 'utf8');
const brandbookSource = readFileSync(new URL('../../brand/brandbook-clay.html', import.meta.url), 'utf8').toUpperCase();

const extractBlock = (selector) => {
  const start = tokensSource.indexOf(selector);
  assert.notEqual(start, -1, `Missing ${selector} in tokens.css`);
  const open = tokensSource.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < tokensSource.length; index += 1) {
    if (tokensSource[index] === '{') depth += 1;
    if (tokensSource[index] === '}') depth -= 1;
    if (depth === 0) return tokensSource.slice(open + 1, index);
  }
  throw new Error(`Unclosed ${selector} block`);
};

const declarations = (block) => new Map(
  [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)]
    .map((match) => [match[1], match[2].trim()]),
);

const root = declarations(extractBlock(':root {'));
const dark = declarations(extractBlock(":root[data-theme='dark'] {"));

const resolveHex = (name, theme = root, seen = new Set()) => {
  if (seen.has(name)) throw new Error(`Token cycle at ${name}`);
  seen.add(name);
  const raw = theme.get(name) ?? root.get(name);
  assert.ok(raw, `Missing token ${name}`);
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toUpperCase();
  const reference = raw.match(/^var\((--[\w-]+)\)$/)?.[1];
  assert.ok(reference, `${name} does not resolve to a HEX: ${raw}`);
  return resolveHex(reference, theme, seen);
};

const backgrounds = {
  canvasDay: resolveHex('--sc-color-bg-canvas'),
  surfaceDay: resolveHex('--sc-color-surface-1'),
  canvasNight: resolveHex('--sc-color-bg-canvas', new Map([...root, ...dark])),
  surfaceNight: resolveHex('--sc-color-surface-1', new Map([...root, ...dark])),
};

const palette = {
  brandFill: { hex: '#1AA57A', gate: 'ui', change: 'NEW' },
  brandHover: { hex: '#159A72', gate: 'ui', change: 'NEW' },
  brandPressed: { hex: '#148F69', gate: 'ui', change: 'NEW' },
  brandStroke: { hex: '#087E5C', gate: 'ui', change: 'NEW' },
  brandInk: { hex: '#02140F', gate: 'text-pair', change: 'NEW' },
  shearStroke: { hex: '#468C09', gate: 'ui', change: 'REASSIGNED' },
  shearArea: { hex: '#DAEFC8', gate: 'area', edge: 'shearStroke', change: 'REASSIGNED' },
  influenceEdge: { hex: '#D85AC9', gate: 'ui', change: 'NEW' },
  influenceArea: { hex: '#F2C2E6', gate: 'area', edge: 'influenceEdge', change: 'NEW' },
  success: { hex: '#2D7C36', gate: 'ui', change: 'MOVED' },
  aula: { hex: '#C94A8F', gate: 'ui', change: 'UNCHANGED' },
  moment: { hex: '#ED4B46', gate: 'ui', change: 'UNCHANGED' },
  error: { hex: '#D92E28', gate: 'ui', change: 'UNCHANGED' },
  focus: { hex: '#6A5DF2', gate: 'ui', change: 'UNCHANGED' },
  selection: { hex: '#6A5DF2', gate: 'ui', change: 'UNCHANGED' },
};

const tokenRoleByPaletteRole = {
  brandFill: '--sc-color-action-primary',
  brandHover: '--sc-color-action-hover',
  brandPressed: '--sc-color-action-pressed',
  brandStroke: '--sc-color-action-edge',
  brandInk: '--sc-color-action-foreground',
  shearStroke: '--sc-color-technical-shear',
  shearArea: '--sc-color-technical-shear-area',
  influenceEdge: '--sc-color-influence-line',
  influenceArea: '--sc-color-influence-area',
  success: '--sc-color-state-success',
  aula: '--sc-color-aula',
  moment: '--sc-color-technical-moment',
  error: '--sc-color-state-error',
  focus: '--sc-color-focus',
  selection: '--sc-color-selection-stroke',
};

for (const [role, token] of Object.entries(tokenRoleByPaletteRole)) {
  assert.equal(resolveHex(token), palette[role].hex, `${token} is not synchronized with the CRI-91 gate`);
  assert.ok(brandbookSource.includes(palette[role].hex), `${palette[role].hex} is missing from the canonical Brandbook`);
}

const toSrgb = (hex) => [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
const linearize = (channel) => channel <= 0.04045
  ? channel / 12.92
  : ((channel + 0.055) / 1.055) ** 2.4;
const encode = (channel) => channel <= 0.0031308
  ? 12.92 * channel
  : 1.055 * channel ** (1 / 2.4) - 0.055;
const clamp = (value) => Math.max(0, Math.min(1, value));
const luminance = (hex) => {
  const [red, green, blue] = toSrgb(hex).map(linearize);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};
const contrast = (first, second) => {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
};
const round = (value) => Number(value.toFixed(2));

const contrastRows = Object.entries(palette).map(([role, entry]) => {
  const ratios = Object.fromEntries(
    Object.entries(backgrounds).map(([background, hex]) => [background, round(contrast(entry.hex, hex))]),
  );
  const worstRatio = Math.min(...Object.values(ratios));
  const pass = entry.gate === 'ui'
    ? worstRatio >= 3
    : entry.gate === 'area'
      ? palette[entry.edge].gate === 'ui'
      : true;
  return { role, ...entry, ratios, worstRatio, pass };
});

const textPairs = [
  ['brandFill', 'brandInk'],
  ['brandHover', 'brandInk'],
  ['brandPressed', 'brandInk'],
  ['success', '#FFFFFF'],
].map(([fill, ink]) => {
  const fillHex = palette[fill].hex;
  const inkHex = palette[ink]?.hex ?? ink;
  const ratio = round(contrast(fillHex, inkHex));
  return { fill, fillHex, ink, inkHex, ratio, pass: ratio >= 4.5 };
});

const matrices = {
  color: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.011820, 0.042940, 0.968881],
  ],
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
};

const rgbToHex = (rgb) => `#${rgb
  .map((channel) => Math.round(clamp(channel) * 255).toString(16).padStart(2, '0'))
  .join('')}`.toUpperCase();

const transform = (hex, mode) => {
  if (mode === 'grayscale') {
    const gray = encode(luminance(hex));
    return rgbToHex([gray, gray, gray]);
  }
  const linear = toSrgb(hex).map(linearize);
  return rgbToHex(matrices[mode].map((row) => encode(clamp(
    row.reduce((sum, coefficient, index) => sum + coefficient * linear[index], 0),
  ))));
};

const lab = (hex) => {
  const [red, green, blue] = toSrgb(hex).map(linearize);
  const convert = (value) => value > 0.008856 ? value ** (1 / 3) : 7.787 * value + 16 / 116;
  const x = convert((0.4124 * red + 0.3576 * green + 0.1805 * blue) / 0.95047);
  const y = convert(0.2126 * red + 0.7152 * green + 0.0722 * blue);
  const z = convert((0.0193 * red + 0.1192 * green + 0.9505 * blue) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};

const deltaE76 = (first, second) => {
  const a = lab(first);
  const b = lab(second);
  return Math.hypot(...a.map((value, index) => value - b[index]));
};

const groups = {
  A: {
    roles: ['brandFill', 'shearStroke', 'success'],
    independentSignals: ['filled brand control', 'lime shear edge plus area', 'status icon plus label'],
  },
  B: {
    roles: ['influenceEdge', 'aula'],
    independentSignals: ['dashed influence edge plus area', 'solid Aula badge plus label'],
  },
  C: {
    roles: ['influenceEdge', 'moment', 'error'],
    independentSignals: ['dashed influence edge', 'continuous M curve plus label', 'alert icon plus text'],
  },
};

const cvdEvidence = Object.fromEntries(Object.entries(groups).map(([group, definition]) => {
  const modes = Object.fromEntries(['color', 'grayscale', 'deuteranopia', 'protanopia'].map((mode) => {
    const transformed = Object.fromEntries(definition.roles.map((role) => [role, transform(palette[role].hex, mode)]));
    const pairs = [];
    for (let first = 0; first < definition.roles.length; first += 1) {
      for (let second = first + 1; second < definition.roles.length; second += 1) {
        const firstRole = definition.roles[first];
        const secondRole = definition.roles[second];
        pairs.push({
          pair: `${firstRole}/${secondRole}`,
          deltaE76: round(deltaE76(transformed[firstRole], transformed[secondRole])),
          luminanceGap: Number(Math.abs(
            luminance(transformed[firstRole]) - luminance(transformed[secondRole]),
          ).toFixed(4)),
        });
      }
    }
    const uniqueOutputs = new Set(Object.values(transformed)).size === definition.roles.length;
    return [mode, { transformed, pairs, pass: uniqueOutputs }];
  }));
  return [group, { ...definition, modes }];
}));

const gatePass = contrastRows.every((row) => row.pass)
  && textPairs.every((pair) => pair.pass)
  && Object.values(cvdEvidence).every((group) => Object.values(group.modes).every((mode) => mode.pass));

const evidence = {
  classification: 'AUDIT/TEMPORARY',
  issue: 'CRI-91',
  method: {
    contrast: 'WCAG relative luminance and contrast ratio',
    cvd: 'Machado 2009 severity-100 matrices; visual QA approximation, not clinical',
    separation: 'numeric transformed-color evidence plus labels, pattern and shape independent of color',
  },
  backgrounds,
  contrastRows,
  textPairs,
  cvdEvidence,
  verdicts: { success: 'MOVED', aula: 'UNCHANGED', gate: gatePass ? 'PASS' : 'FAIL' },
};

console.log(JSON.stringify(evidence, null, 2));
if (!gatePass) process.exitCode = 1;
