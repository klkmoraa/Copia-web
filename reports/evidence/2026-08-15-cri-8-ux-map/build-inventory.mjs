#!/usr/bin/env node
/**
 * CRI-8 — Generador reproducible del inventario de tareas.
 *
 * Fuente única: `data/*.mjs`. Emite tres artefactos derivados:
 *   - cri-8-task-inventory.json  (todas las columnas, legible por herramientas)
 *   - cri-8-task-inventory.csv   (mismo contenido, para hoja de cálculo)
 *   - matrix-fragment.md         (tabla condensada que el informe principal incrusta)
 *
 * Uso:  node reports/evidence/2026-08-15-cri-8-ux-map/build-inventory.mjs
 *
 * No lee ni escribe nada de `src/**`. No requiere build de la app.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { entry } from './data/01-entry.mjs';
import { shell } from './data/02-shell.mjs';
import { modelling } from './data/03-modelling.mjs';
import { selectionCanvas } from './data/04-selection-canvas.mjs';
import { inspectorResults } from './data/05-inspector-results.mjs';
import { datasheetDoctor } from './data/06-datasheet-doctor.mjs';
import { persistenceStates } from './data/07-persistence-states.mjs';

const here = dirname(fileURLToPath(import.meta.url));

/** Orden y nombre largo de cada columna. El JSON conserva la clave corta. */
export const COLUMNS = [
  ['id', 'ID'],
  ['dom', 'Dominio'],
  ['task', 'Tarea de usuario'],
  ['goal', 'Objetivo del usuario'],
  ['impl', 'Implementación actual verificada'],
  ['files', 'Archivos / componentes'],
  ['ev', 'Tests / QA / evidencia'],
  ['freq', 'Frecuencia esperada'],
  ['fsrc', 'Fuente de la frecuencia'],
  ['crit', 'Criticidad'],
  ['ctx', 'Objeto / contexto del que depende'],
  ['pre', 'Precondiciones'],
  ['today', 'Dónde vive hoy'],
  ['alt', 'Rutas alternativas actuales'],
  ['cri7', 'Findings CRI-7 relacionados'],
  ['keep', 'Qué funciona bien y debe conservarse'],
  ['cls', 'Clasificación UX'],
  ['exp', 'Expanded: ruta funcional propuesta'],
  ['med', 'Medium: ruta funcional propuesta'],
  ['cmp', 'Compact: ruta funcional propuesta'],
  ['mk', 'Mouse / keyboard path'],
  ['touch', 'Touch path'],
  ['prec', 'Necesidad de precisión especial'],
  ['selctx', '¿Puede ser contextual a selección?'],
  ['vis', 'Visibilidad persistente o disclosure'],
  ['surf', 'Superficie apropiada'],
  ['states', 'Disabled / loading / error'],
  ['fb', 'Feedback esperado'],
  ['focus', 'Focus / Escape / Cancel / Reset'],
  ['budget', 'Impacto en canvas-budget'],
  ['c9', 'Decisión para CRI-9'],
  ['c10', 'Patrón para CRI-10'],
  ['unk', 'Unknowns / preguntas abiertas'],
];

export const ROWS = [
  ...entry,
  ...shell,
  ...modelling,
  ...selectionCanvas,
  ...inspectorResults,
  ...datasheetDoctor,
  ...persistenceStates,
];

/* --------------------------------------------------------------- validación */
const problems = [];
const seen = new Set();
for (const row of ROWS) {
  if (seen.has(row.id)) problems.push(`ID duplicado: ${row.id}`);
  seen.add(row.id);
  for (const [key] of COLUMNS) {
    if (row[key] === undefined) problems.push(`${row.id}: falta la columna "${key}"`);
  }
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

/* -------------------------------------------------------------------- JSON */
const meta = {
  issue: 'CRI-8',
  generatedFrom: 'reports/evidence/2026-08-15-cri-8-ux-map/data/*.mjs',
  baselineSha: 'e9a406a56ca05cc25e69b83a6e9d4c34794e7b13',
  auditedTreeNote: 'src/ y package.json son idénticos entre b121c03 (árbol auditado por CRI-7) y e9a406a (main vigente): git diff --stat b121c03 e9a406a -- src/ package.json devuelve vacío.',
  totalRows: ROWS.length,
  columns: COLUMNS.map(([key, label]) => ({ key, label })),
};
writeFileSync(join(here, 'cri-8-task-inventory.json'), `${JSON.stringify({ meta, rows: ROWS }, null, 2)}\n`);

/* --------------------------------------------------------------------- CSV */
const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const csv = [
  COLUMNS.map(([, label]) => csvCell(label)).join(','),
  ...ROWS.map((row) => COLUMNS.map(([key]) => csvCell(row[key])).join(',')),
].join('\n');
writeFileSync(join(here, 'cri-8-task-inventory.csv'), `﻿${csv}\n`);

/* ------------------------------------------------- fragmento markdown condensado */
const mdCell = (value) => String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const byDomain = new Map();
for (const row of ROWS) {
  if (!byDomain.has(row.dom)) byDomain.set(row.dom, []);
  byDomain.get(row.dom).push(row);
}
const fragment = [
  '<!-- GENERADO por build-inventory.mjs — no editar a mano. -->',
  '',
  ...[...byDomain.entries()].flatMap(([domain, rows]) => [
    `### ${domain} (${rows.length})`,
    '',
    '| ID | Tarea | Dónde vive hoy | Clasificación UX | Frecuencia (fuente) | Expanded | Medium | Compact |',
    '|---|---|---|---|---|---|---|---|',
    ...rows.map((row) => `| \`${row.id}\` | ${mdCell(row.task)} | ${mdCell(row.today)} | ${mdCell(row.cls)} | ${row.freq} (${row.fsrc}) | ${mdCell(row.exp)} | ${mdCell(row.med)} | ${mdCell(row.cmp)} |`),
    '',
  ]),
].join('\n');
writeFileSync(join(here, 'matrix-fragment.md'), `${fragment}\n`);

/* ------------------------------------------- clasificación UX (deliverable 4) */
const CLASS_NAMES = {
  1: 'Global persistente',
  2: 'Contextual a proyecto/análisis',
  3: 'Contextual a selección',
  4: 'Canvas-local',
  5: 'Inspector/detail',
  6: 'Workflow temporal',
  7: 'Power-user / Command Palette',
  8: 'Configuración / preferencias',
  9: 'Fullscreen / datos densos',
};
/** Una fila puede pertenecer a varias categorías compatibles; se cuentan todas. */
const classify = (row) => [...new Set(
  [...String(row.cls).matchAll(/(?:^|[+/]\s*)([1-9])\s/g)].map((match) => Number(match[1])),
)];
const classification = Object.fromEntries(Object.keys(CLASS_NAMES).map((key) => [key, []]));
const transversal = [];
for (const row of ROWS) {
  const buckets = classify(row);
  if (buckets.length === 0) transversal.push(row.id);
  for (const bucket of buckets) classification[bucket].push(row.id);
}
writeFileSync(join(here, 'cri-8-ux-classification.json'), `${JSON.stringify({
  meta: { issue: 'CRI-8', baselineSha: meta.baselineSha, note: 'Una tarea puede pertenecer a varias categorías compatibles; los recuentos suman más de 122.' },
  categories: Object.entries(CLASS_NAMES).map(([key, label]) => ({
    id: Number(key), label, count: classification[key].length, taskIds: classification[key],
  })),
  transversal: { count: transversal.length, taskIds: transversal },
}, null, 2)}\n`);

/* ------------------------------------------------------------------ recuentos */
console.log('clasificación UX:');
for (const [key, label] of Object.entries(CLASS_NAMES)) {
  console.log(`  ${key} ${label}: ${classification[key].length}`);
}
console.log(`  transversal (sin número): ${transversal.length}`);
const tally = (key) => {
  const counts = new Map();
  for (const row of ROWS) {
    const bucket = String(row[key]);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
};

console.log(`filas: ${ROWS.length}`);
console.log(`dominios: ${byDomain.size} → ${[...byDomain.entries()].map(([d, r]) => `${d}:${r.length}`).join(', ')}`);
console.log(`frecuencia por fuente: ${tally('fsrc').map(([k, v]) => `${k}:${v}`).join(', ')}`);
console.log(`criticidad: ${tally('crit').map(([k, v]) => `${k}:${v}`).join(', ')}`);
console.log(`filas con unknown declarado: ${ROWS.filter((row) => row.unk && row.unk !== '—').length}`);
console.log(`filas que pueden ser contextuales a selección: ${ROWS.filter((row) => /^S[ÍI]/i.test(String(row.selctx))).length}`);
