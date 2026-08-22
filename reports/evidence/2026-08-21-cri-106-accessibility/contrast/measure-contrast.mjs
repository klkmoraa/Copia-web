// CRI-106 · Contraste medido sobre valores COMPUTADOS por Chromium real
// (no jsdom, no tabla del Brandbook), sobre los cuatro fondos: lienzo/superficie x Día/Noche.
// Patrón heredado de reports/evidence/2026-08-15-palette-closure-v2/measure-computed.mjs.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(root, '../../../../');
const tokens = readFileSync(path.join(repoRoot, 'src/design-system/tokens.css'), 'utf8');

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
await page.setContent(`<style>${tokens}</style><div id="p"></div>`);

// Roles exigidos por CRI-106 §6, resueltos a su variable real en tokens.css.
const ROLES = {
  'texto primario': '--sc-color-text-primary',
  'texto secundario': '--sc-color-text-secondary',
  'caption técnico': '--sc-color-text-unit',
  'focus ring': '--sc-color-focus',
  'selection (trazo)': '--sc-color-selection-stroke',
  'brand action (relleno)': '--sc-color-action-primary',
  'brand edge': '--sc-color-action-edge',
  'brand foreground (tinta sobre relleno)': '--sc-color-action-foreground',
  success: '--sc-color-state-success',
  warning: '--sc-color-state-warning',
  error: '--sc-color-state-error',
  info: '--sc-color-info',
  'axial N': '--sc-color-technical-axial',
  'cortante V (trazo)': '--sc-color-technical-shear',
  'momento M': '--sc-color-technical-moment',
  deformada: '--sc-color-technical-deformed',
  reacción: '--sc-color-technical-reaction',
  cota: '--sc-color-technical-dimension',
  eje: '--sc-color-technical-axis',
  'texto disabled': '--sc-color-text-disabled',
  'stale/reliability (ámbar, texto/ícono)': '--sc-color-state-warning-foreground',
  'error (texto/ícono, tinta de error)': '--sc-color-state-error-foreground',
  'Aula (rosa)': '--sc-color-aula',
  'brand ink --accent (sobre accent-soft)': '--sc-color-action-ink',
};

// Pares reales tinta/relleno: verificados por uso en CSS (grep), no supuestos.
const MIXES = {
  'accent-soft (fondo hover/active)': 'color-mix(in srgb, var(--sc-color-action-primary) 10%, var(--sc-color-surface-1))',
};

const BACKGROUNDS = {
  'lienzo': '--sc-color-bg-canvas',
  'superficie': '--sc-color-surface-1',
};

const read = async (theme) => page.evaluate(({ roles, mixes, backgrounds, theme }) => {
  document.documentElement.setAttribute('data-theme', theme);
  const el = document.getElementById('p');
  const out = { roles: {}, mixes: {}, backgrounds: {} };
  for (const [label, varName] of Object.entries(roles)) {
    el.style.color = `var(${varName})`;
    out.roles[label] = getComputedStyle(el).color;
  }
  for (const [label, expr] of Object.entries(mixes)) {
    el.style.color = expr;
    out.mixes[label] = getComputedStyle(el).color;
  }
  for (const [label, varName] of Object.entries(backgrounds)) {
    el.style.color = `var(${varName})`;
    out.backgrounds[label] = getComputedStyle(el).color;
  }
  return out;
}, { roles: ROLES, mixes: MIXES, backgrounds: BACKGROUNDS, theme });

const day = await read('light');
const night = await read('dark');
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

// `-foreground` de warning/error son texto plano usado sobre el lienzo/superficie
// (`.project-hub__error{color:...}`, `.canvas-demand-saturated{color:...}`, sin fondo
// sólido propio) → se miden como cualquier otro rol de texto, contra los 4 fondos.
// Sólo `--accent-foreground` tiene un relleno sólido real emparejado (`--accent-fill`,
// confirmado por grep: `.analyze-button{background:var(--accent-fill);color:var(--accent-foreground)}`).
const TEXT_ROLES = new Set(['texto primario', 'texto secundario', 'caption técnico', 'texto disabled', 'brand foreground (tinta sobre relleno)', 'stale/reliability (ámbar, texto/ícono)', 'error (texto/ícono, tinta de error)']);
// Pares reales tinta/relleno confirmados por grep de uso (no supuestos).
const PAIRED = {
  'brand foreground (tinta sobre relleno)': { against: 'brand action (relleno)', kind: 'role', floor: 4.5 },
  'brand ink --accent (sobre accent-soft)': { against: 'accent-soft (fondo hover/active)', kind: 'mix', floor: 3.0 },
};

const rows = [];
// Los MIXES (p.ej. accent-soft) son fondos usados sólo como pareja de otro rol
// (arriba, PAIRED) — no se listan como fila propia: no son "texto sobre fondo",
// son el fondo mismo, y no está sujeto a un suelo de contraste por sí solo.
const allRoleLabels = Object.keys(ROLES);

for (const label of allRoleLabels) {
  const dayVal = day.roles[label];
  const nightVal = night.roles[label];
  const floor = TEXT_ROLES.has(label) ? 4.5 : 3.0;

  if (label in PAIRED) {
    const { against, kind, floor: pairFloor } = PAIRED[label];
    const dayBg = kind === 'mix' ? day.mixes[against] : day.roles[against];
    const nightBg = kind === 'mix' ? night.mixes[against] : night.roles[against];
    const dDay = r2(ratio(dayVal, dayBg));
    const dNight = r2(ratio(nightVal, nightBg));
    const worst = Math.min(dDay, dNight);
    rows.push({ role: label, elemento: `tinta vs ${against}`, dia_lienzo: '—', dia_superficie: dDay, noche_lienzo: '—', noche_superficie: dNight, peor: r2(worst), umbral: pairFloor, pass: worst >= pairFloor });
    continue;
  }

  const results = {};
  for (const [bgLabel, bgVar] of Object.entries(BACKGROUNDS)) {
    results[`dia_${bgLabel}`] = r2(ratio(dayVal, day.backgrounds[bgLabel]));
    results[`noche_${bgLabel}`] = r2(ratio(nightVal, night.backgrounds[bgLabel]));
  }
  const worst = Math.min(...Object.values(results));
  rows.push({
    role: label,
    elemento: hex(dayVal) === hex(nightVal) ? `${hex(dayVal)} (idéntico D/N)` : `${hex(dayVal)} D / ${hex(nightVal)} N`,
    dia_lienzo: results.dia_lienzo,
    dia_superficie: results.dia_superficie,
    noche_lienzo: results.noche_lienzo,
    noche_superficie: results.noche_superficie,
    peor: r2(worst),
    umbral: floor,
    pass: worst >= floor,
  });
}

writeFileSync(path.join(root, 'contrast-table.json'), JSON.stringify(rows, null, 2));

let md = '| Rol | Elemento real (HEX computado) | Día lienzo | Día superficie | Noche lienzo | Noche superficie | Peor | Umbral | Veredicto |\n';
md += '|---|---|---|---|---|---|---|---|---|\n';
for (const r of rows) {
  md += `| ${r.role} | ${r.elemento} | ${r.dia_lienzo} | ${r.dia_superficie} | ${r.noche_lienzo} | ${r.noche_superficie} | ${r.peor}:1 | ${r.umbral}:1 | ${r.pass ? 'PASS' : 'FAIL'} |\n`;
}
writeFileSync(path.join(root, 'contrast-table.md'), md);

console.log(md);
const fails = rows.filter((r) => !r.pass);
console.log(`\n${rows.length} roles medidos · ${fails.length} FAIL`);
for (const f of fails) console.log(`FAIL: ${f.role} → peor ${f.peor}:1 (umbral ${f.umbral}:1)`);
