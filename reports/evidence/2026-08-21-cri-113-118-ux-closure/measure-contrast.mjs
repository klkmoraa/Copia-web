// CRI-113 / CRI-114 / CRI-117 · Remedición de los tres roles de color que este
// slice toca, sobre valores COMPUTADOS por Chromium real (no jsdom, no la tabla
// del Brandbook), contra los cuatro fondos: lienzo/superficie x Día/Noche.
//
// Mismo método y mismas fórmulas que
// `reports/evidence/2026-08-21-cri-106-accessibility/contrast/measure-contrast.mjs`,
// que es donde se midieron los tres FAIL originales. Aquella evidencia no se
// reescribe: es el registro de CRI-106 y sigue describiendo el estado que había.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(root, '../../../');
const tokens = readFileSync(path.join(repoRoot, 'src/design-system/tokens.css'), 'utf8');

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
await page.setContent(`<style>${tokens}</style><div id="p"></div>`);

const ROLES = {
  // CRI-114 · caption técnico (unidades y magnitudes del solver).
  'caption técnico (CRI-114)': '--sc-color-text-unit',
  // CRI-117 · tinta de deshabilitado CON contenido obligatorio.
  'disabled con contenido obligatorio (CRI-117)': '--sc-color-text-disabled-content',
  // CRI-117 · el rol exento se queda como estaba; se mide para dejar constancia.
  'disabled inactivo, exento 1.4.3 (CRI-117)': '--sc-color-text-disabled',
  // CRI-113 · tinta de marca sobre el tinte suave de acción.
  'brand ink sobre accent-soft (CRI-113)': '--sc-color-action-ink-on-soft',
  // Trazo de marca sobre superficie base: invariante, no se ha tocado.
  'brand edge (invariante, control)': '--sc-color-action-edge',
};

const MIXES = {
  'accent-soft (fondo hover/active)': 'color-mix(in srgb, var(--sc-color-action-primary) 10%, var(--sc-color-surface-1))',
};

const BACKGROUNDS = { 'lienzo': '--sc-color-bg-canvas', 'superficie': '--sc-color-surface-1' };

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

// El suelo depende del rol, no del capricho: texto 4,5:1 (WCAG 1.4.3), no
// textual 3:1 (1.4.11). El rol de disabled EXENTO se mide sin suelo: WCAG no se
// lo exige y este slice no lo mueve — está para que se vea que sigue igual.
const FLOORS = {
  'caption técnico (CRI-114)': 4.5,
  'disabled con contenido obligatorio (CRI-117)': 4.5,
  'disabled inactivo, exento 1.4.3 (CRI-117)': null,
  'brand ink sobre accent-soft (CRI-113)': 3.0,
  'brand edge (invariante, control)': 3.0,
};
const PAIRED = { 'brand ink sobre accent-soft (CRI-113)': 'accent-soft (fondo hover/active)' };

const rows = [];
for (const label of Object.keys(ROLES)) {
  const dayVal = day.roles[label];
  const nightVal = night.roles[label];
  const floor = FLOORS[label];

  if (label in PAIRED) {
    const against = PAIRED[label];
    const dDay = r2(ratio(dayVal, day.mixes[against]));
    const dNight = r2(ratio(nightVal, night.mixes[against]));
    const worst = Math.min(dDay, dNight);
    rows.push({ role: label, elemento: `${hex(dayVal)} D / ${hex(nightVal)} N vs ${against}`, dia_lienzo: '—', dia_superficie: dDay, noche_lienzo: '—', noche_superficie: dNight, peor: r2(worst), umbral: floor, pass: worst >= floor });
    continue;
  }

  const results = {};
  for (const bgLabel of Object.keys(BACKGROUNDS)) {
    results[`dia_${bgLabel}`] = r2(ratio(dayVal, day.backgrounds[bgLabel]));
    results[`noche_${bgLabel}`] = r2(ratio(nightVal, night.backgrounds[bgLabel]));
  }
  const worst = Math.min(...Object.values(results));
  rows.push({
    role: label,
    elemento: hex(dayVal) === hex(nightVal) ? `${hex(dayVal)} (idéntico D/N)` : `${hex(dayVal)} D / ${hex(nightVal)} N`,
    ...results,
    peor: r2(worst),
    umbral: floor,
    pass: floor === null ? null : worst >= floor,
  });
}

writeFileSync(path.join(root, 'contrast-table.json'), JSON.stringify(rows, null, 2));

let md = '| Rol | Elemento real (HEX computado) | Día lienzo | Día superficie | Noche lienzo | Noche superficie | Peor | Umbral | Veredicto |\n';
md += '|---|---|---|---|---|---|---|---|---|\n';
for (const r of rows) {
  const verdict = r.pass === null ? 'EXENTO' : (r.pass ? 'PASS' : 'FAIL');
  md += `| ${r.role} | ${r.elemento} | ${r.dia_lienzo} | ${r.dia_superficie} | ${r.noche_lienzo} | ${r.noche_superficie} | ${r.peor}:1 | ${r.umbral === null ? '—' : `${r.umbral}:1`} | ${verdict} |\n`;
}
writeFileSync(path.join(root, 'contrast-table.md'), md);

console.log(md);
const fails = rows.filter((r) => r.pass === false);
console.log(`\n${rows.length} roles medidos · ${fails.length} FAIL`);
for (const f of fails) console.log(`FAIL: ${f.role} → peor ${f.peor}:1 (umbral ${f.umbral}:1)`);
process.exit(fails.length === 0 ? 0 : 1);
