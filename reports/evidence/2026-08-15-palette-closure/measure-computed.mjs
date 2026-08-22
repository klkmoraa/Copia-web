// Resuelve los tokens en un navegador real (no jsdom) y vuelve a medir contraste
// sobre los valores COMPUTADOS, incluidos los color-mix() que el test de texto
// no puede evaluar.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const tokens = readFileSync(new URL('../../../src/design-system/tokens.css', import.meta.url), 'utf8');

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
await page.setContent(`<style>${tokens}</style><div id="p"></div>`);

const ROLES = [
  '--sc-color-action-primary', '--sc-color-action-hover', '--sc-color-action-pressed',
  '--sc-color-action-foreground', '--sc-color-action-edge', '--sc-color-action-ink',
  '--sc-color-technical-load', '--sc-color-technical-axial', '--sc-color-technical-shear',
  '--sc-color-technical-moment', '--sc-color-technical-deformed', '--sc-color-technical-reaction',
  '--sc-color-technical-dimension', '--sc-color-technical-axis',
  '--sc-color-state-success', '--sc-color-state-warning', '--sc-color-state-error',
  '--sc-color-selection-stroke', '--sc-color-focus', '--sc-color-aula', '--sc-color-aula-solid',
  '--sc-color-success-solid', '--sc-color-error-solid', '--sc-color-canario', '--sc-color-canario-ink',
  '--sc-color-bg-canvas', '--sc-color-surface-1', '--sc-color-bg-app',
  '--sc-color-state-warning-foreground', '--sc-color-state-error-foreground',
];
// color-mix() reales que ningún test de texto puede evaluar
const MIXES = {
  'gradiente CTA (tope)': 'color-mix(in srgb, var(--sc-color-action-primary) 78%, white)',
  'gradiente CTA (pie)': 'color-mix(in srgb, var(--sc-color-action-primary) 82%, black)',
  'accent-soft': 'color-mix(in srgb, var(--sc-color-action-primary) 10%, var(--sc-color-surface-1))',
  'clay-edge': 'color-mix(in srgb, var(--sc-color-border) 58%, white)',
};

const read = async (theme) => page.evaluate(({ roles, mixes, theme }) => {
  document.documentElement.setAttribute('data-theme', theme);
  const el = document.getElementById('p');
  const out = {};
  for (const r of roles) {
    el.style.color = `var(${r})`;
    out[r] = getComputedStyle(el).color;
  }
  for (const [name, expr] of Object.entries(mixes)) {
    el.style.color = expr;
    out[name] = getComputedStyle(el).color;
  }
  return out;
}, { roles: ROLES, mixes: MIXES, theme });

const light = await read('light');
const dark = await read('dark');
await browser.close();

const rgb = (s) => {
  const n = s.match(/[\d.]+/g).slice(0, 3).map(Number);
  return s.startsWith('color(') ? n.map((c) => c * 255) : n;
};
const lum = (s) => {
  const [r, g, b] = rgb(s).map((c) => c / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const r2 = (n) => Math.round(n * 100) / 100;
const hex = (s) => '#' + rgb(s).map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');

console.log('=== 1 · Invariancia comprobada sobre valores COMPUTADOS por el navegador ===');
const SEMANTIC = ROLES.filter((r) => !/bg-|surface-1|foreground$/.test(r) || /action-foreground/.test(r));
let drift = 0;
for (const r of SEMANTIC) {
  if (hex(light[r]) !== hex(dark[r])) { drift += 1; console.log('DERIVA', r, hex(light[r]), '!=', hex(dark[r])); }
}
console.log(drift === 0 ? `-> ${SEMANTIC.length} roles semánticos idénticos en Día y Noche\n` : `-> ${drift} DERIVAS\n`);

console.log('=== 2 · Contraste real por tema (piso 3:1 señal / 4.5:1 texto) ===');
const check = (label, fg, bg, floor, theme) => {
  const v = ratio(fg, bg);
  const ok = v >= floor;
  console.log(`${ok ? 'PASS' : 'FAIL'} [${theme}] ${label.padEnd(46)} ${r2(v)}:1 (piso ${floor})`);
  return ok;
};
let allOk = true;
for (const [theme, t] of [['Día', light], ['Noche', dark]]) {
  const canvas = t['--sc-color-bg-canvas'];
  const surface = t['--sc-color-surface-1'];
  for (const role of ['--sc-color-technical-load', '--sc-color-technical-axial', '--sc-color-technical-shear',
    '--sc-color-technical-moment', '--sc-color-technical-deformed', '--sc-color-technical-reaction',
    '--sc-color-technical-dimension', '--sc-color-technical-axis', '--sc-color-action-ink',
    '--sc-color-selection-stroke', '--sc-color-state-success', '--sc-color-state-warning',
    '--sc-color-state-error', '--sc-color-aula']) {
    allOk = check(`${role.replace('--sc-color-', '')} sobre lienzo`, t[role], canvas, 3, theme) && allOk;
    allOk = check(`${role.replace('--sc-color-', '')} sobre superficie`, t[role], surface, 3, theme) && allOk;
  }
  allOk = check('tinta CTA sobre relleno', t['--sc-color-action-foreground'], t['--sc-color-action-primary'], 4.5, theme) && allOk;
  allOk = check('tinta CTA sobre hover', t['--sc-color-action-foreground'], t['--sc-color-action-hover'], 4.5, theme) && allOk;
  allOk = check('tinta CTA sobre pressed', t['--sc-color-action-foreground'], t['--sc-color-action-pressed'], 4.5, theme) && allOk;
  allOk = check('tinta CTA sobre gradiente (tope)', t['--sc-color-action-foreground'], t['gradiente CTA (tope)'], 4.5, theme) && allOk;
  allOk = check('tinta CTA sobre gradiente (pie)', t['--sc-color-action-foreground'], t['gradiente CTA (pie)'], 4.5, theme) && allOk;
  allOk = check('canto CTA sobre superficie', t['--sc-color-action-edge'], surface, 3, theme) && allOk;
  allOk = check('canto CTA sobre accent-soft', t['--sc-color-action-edge'], t['accent-soft'], 3, theme) && allOk;
  allOk = check('warning-foreground sobre superficie', t['--sc-color-state-warning-foreground'], surface, 4.5, theme) && allOk;
  allOk = check('error-foreground sobre superficie', t['--sc-color-state-error-foreground'], surface, 4.5, theme) && allOk;
  allOk = check('blanco sobre success sólido', 'rgb(255,255,255)', t['--sc-color-success-solid'], 4.5, theme) && allOk;
  allOk = check('blanco sobre error sólido', 'rgb(255,255,255)', t['--sc-color-error-solid'], 4.5, theme) && allOk;
  allOk = check('blanco sobre aula sólido', 'rgb(255,255,255)', t['--sc-color-aula-solid'], 4.5, theme) && allOk;
  allOk = check('tinta canario sobre canario', t['--sc-color-canario-ink'], t['--sc-color-canario'], 4.5, theme) && allOk;
  console.log('');
}
console.log(allOk ? 'TODO PASA' : 'HAY FALLOS');
console.log('\n=== 3 · HEX computados (Día) ===');
for (const r of ROLES) console.log(r.padEnd(38), hex(light[r]), hex(light[r]) === hex(dark[r]) ? '(idéntico en Noche)' : `(Noche ${hex(dark[r])})`);
