#!/usr/bin/env node
/**
 * CRI-8 — Genera las tablas que el informe principal incrusta literalmente.
 * Salida: report-tables.md (se pega dentro del informe para que éste se lea sin herramientas).
 *
 * Uso: node reports/evidence/2026-08-15-cri-8-ux-map/build-report-tables.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ROWS } from './build-inventory.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cell = (value) => String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const out = [];

/* ---- Tabla 1: inventario condensado por dominio -------------------------- */
out.push('## TABLA A — Inventario condensado (122 tareas)', '');
const domains = [...new Set(ROWS.map((row) => row.dom))];
for (const domain of domains) {
  const rows = ROWS.filter((row) => row.dom === domain);
  out.push(`### ${domain} — ${rows.length} tareas`, '');
  out.push('| ID | Tarea | Dónde vive hoy | Clasificación UX | Frec. (fuente) | Criticidad |');
  out.push('|---|---|---|---|---|---|');
  for (const row of rows) {
    out.push(`| \`${row.id}\` | ${cell(row.task)} | ${cell(row.today)} | ${cell(row.cls)} | ${row.freq} (${row.fsrc}) | ${row.crit} |`);
  }
  out.push('');
}

/* ---- Tabla 2: Expanded / Medium / Compact + input ------------------------ */
/** Una fila "cambia de tier" si Medium o Compact no repiten la ruta de Expanded. */
const repeats = (value) => /^(igual|idéntic|invisible|automátic|no accionable|pantalla)/i.test(String(value).trim());
const tierChanging = ROWS.filter((row) => !repeats(row.med) || !repeats(row.cmp));

out.push('## TABLA B — Expanded / Medium / Compact + método de entrada', '');
out.push(`Filas cuya ruta funcional **cambia** en algún tier: **${tierChanging.length} de ${ROWS.length}**.`, '');
out.push('| ID | Tarea | Expanded | Medium | Compact | Mouse/teclado | Touch |');
out.push('|---|---|---|---|---|---|---|');
for (const row of tierChanging) {
  out.push(`| \`${row.id}\` | ${cell(row.task)} | ${cell(row.exp)} | ${cell(row.med)} | ${cell(row.cmp)} | ${cell(row.mk)} | ${cell(row.touch)} |`);
}
out.push('');

/* ---- Tabla 3: Medium sin comportamiento propio --------------------------- */
const mediumSameAsExpanded = ROWS.filter((row) => repeats(row.med));
out.push('## TABLA C — Tareas cuyo Medium hoy sólo repite Expanded', '');
out.push(`**${mediumSameAsExpanded.length} de ${ROWS.length}** filas declaran para Medium «igual que Expanded». Es la medida directa de F-01: Medium no existe como comportamiento.`, '');
out.push('| ID | Tarea | Qué dice Medium hoy |');
out.push('|---|---|---|');
for (const row of mediumSameAsExpanded) out.push(`| \`${row.id}\` | ${cell(row.task)} | ${cell(row.med)} |`);
out.push('');

/* ---- Tabla 4: candidatas a contextual a selección ------------------------ */
const selectionCandidates = ROWS.filter((row) => /^S[ÍI]/i.test(String(row.selctx)));
out.push('## TABLA D — Tareas que pueden depender de la selección', '');
out.push(`**${selectionCandidates.length} de ${ROWS.length}**. La columna dice si ya lo son o si sólo podrían serlo.`, '');
out.push('| ID | Tarea | ¿Contextual a selección? | Dónde vive hoy |');
out.push('|---|---|---|---|');
for (const row of selectionCandidates) out.push(`| \`${row.id}\` | ${cell(row.task)} | ${cell(row.selctx)} | ${cell(row.today)} |`);
out.push('');

/* ---- Tabla 5: precisión especial ---------------------------------------- */
const precision = ROWS.filter((row) => /^S[ÍI]|^ES\b/i.test(String(row.prec)));
out.push('## TABLA E — Tareas con necesidad de precisión especial', '');
out.push(`**${precision.length} de ${ROWS.length}**.`, '');
out.push('| ID | Tarea | Por qué necesita precisión | Touch path actual |');
out.push('|---|---|---|---|');
for (const row of precision) out.push(`| \`${row.id}\` | ${cell(row.task)} | ${cell(row.prec)} | ${cell(row.touch)} |`);
out.push('');

/* ---- Tabla 6: unknowns --------------------------------------------------- */
const unknowns = ROWS.filter((row) => row.unk && row.unk !== '—');
out.push('## TABLA F — Unknowns declarados', '');
out.push(`**${unknowns.length} de ${ROWS.length}** filas declaran al menos un unknown.`, '');
out.push('| ID | Tarea | Unknown |');
out.push('|---|---|---|');
for (const row of unknowns) out.push(`| \`${row.id}\` | ${cell(row.task)} | ${cell(row.unk)} |`);
out.push('');

/* ---- Tabla 7: decisiones CRI-9 y patrones CRI-10 ------------------------- */
const c9 = ROWS.filter((row) => row.c9 && row.c9 !== '—');
out.push('## TABLA G — Decisiones que CRI-9 debe resolver (por tarea)', '');
out.push(`**${c9.length} entradas.**`, '');
out.push('| ID | Tarea | Decisión pendiente |');
out.push('|---|---|---|');
for (const row of c9) out.push(`| \`${row.id}\` | ${cell(row.task)} | ${cell(row.c9)} |`);
out.push('');

const c10 = ROWS.filter((row) => row.c10 && row.c10 !== '—');
out.push('## TABLA H — Patrones que CRI-10 debe diseñar (por tarea)', '');
out.push(`**${c10.length} entradas.**`, '');
out.push('| ID | Tarea | Patrón visual/interactivo |');
out.push('|---|---|---|');
for (const row of c10) out.push(`| \`${row.id}\` | ${cell(row.task)} | ${cell(row.c10)} |`);
out.push('');

/* ---- Tabla 9: fortalezas -------------------------------------------------- */
const keeps = ROWS.filter((row) => row.keep && row.keep !== '—');
out.push('## TABLA I — Fortalezas a conservar (por tarea)', '');
out.push(`**${keeps.length} entradas.**`, '');
out.push('| ID | Tarea | Qué funciona y no debe perderse |');
out.push('|---|---|---|');
for (const row of keeps) out.push(`| \`${row.id}\` | ${cell(row.task)} | ${cell(row.keep)} |`);
out.push('');

writeFileSync(join(here, 'report-tables.md'), `${out.join('\n')}\n`);
console.log(`report-tables.md: ${out.length} líneas`);
console.log(`  cambian de tier: ${tierChanging.length}`);
console.log(`  Medium == Expanded: ${mediumSameAsExpanded.length}`);
console.log(`  contextual a selección: ${selectionCandidates.length}`);
console.log(`  precisión especial: ${precision.length}`);
console.log(`  unknowns: ${unknowns.length}`);
console.log(`  decisiones CRI-9: ${c9.length} · patrones CRI-10: ${c10.length} · fortalezas: ${keeps.length}`);
