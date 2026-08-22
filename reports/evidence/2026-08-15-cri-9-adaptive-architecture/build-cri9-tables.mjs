#!/usr/bin/env node
/**
 * CRI-9 · Generador reproducible de matrices y tablas.
 *
 * No lee `src/**`, no necesita `npm install` y no construye la app. Toma los
 * módulos de `data/`, los une con el inventario de 122 tareas de CRI-8 y emite
 * JSON, CSV y `report-tables.md`.
 *
 * VALIDA y sale con código 1 si:
 *   - alguna de las 122 tareas queda sin superficie;
 *   - una excepción de ubicación apunta a un id inexistente;
 *   - una superficie no declara presentación en las tres clases;
 *   - falta alguna decisión D-01…D-15 o alguna carece de `status` válido;
 *   - el modelo de canvas-budget no reproduce las mediciones de CRI-7.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SURFACES, OWNERS } from './data/surfaces.mjs';
import { DECISIONS, DISPOSITIONS } from './data/decisions.mjs';
import { TRANSITIONS, INVARIANTS } from './data/transitions.mjs';
import { STATE_OWNERSHIP } from './data/state-ownership.mjs';
import { COMPETITIVE, NOT_COPIED } from './data/competitive.mjs';
import { UNKNOWNS } from './data/unknowns.mjs';
import { OVERRIDES, PSEUDO_SURFACES, placeTask, primaryClass } from './data/placement.mjs';
import { budgetTable, calibrate, expandedBoundary, CB, CHROME } from './canvas-budget-model.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const CRI8 = join(here, '..', '2026-08-15-cri-8-ux-map', 'cri-8-task-inventory.json');

const failures = [];
const fail = (message) => failures.push(message);

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

const { rows: cri8Rows } = JSON.parse(readFileSync(CRI8, 'utf8'));
if (cri8Rows.length !== 122) fail(`El inventario de CRI-8 tiene ${cri8Rows.length} filas, se esperaban 122.`);

const surfaceIds = new Set(SURFACES.map((surface) => surface.id));
const validTargets = new Set([...surfaceIds, ...Object.keys(PSEUDO_SURFACES)]);
const cri8Ids = new Set(cri8Rows.map((row) => row.id));

for (const id of Object.keys(OVERRIDES)) {
  if (!cri8Ids.has(id)) fail(`La excepción de ubicación ${id} no existe en el inventario de CRI-8.`);
  if (!validTargets.has(OVERRIDES[id].surface)) fail(`La excepción ${id} apunta a la superficie desconocida "${OVERRIDES[id].surface}".`);
}

for (const surface of SURFACES) {
  for (const klass of ['expanded', 'medium', 'compact']) {
    if (!surface[klass]) fail(`La superficie ${surface.id} no declara presentación en ${klass}.`);
  }
}

const VALID_STATUS = /^(DECIDED|DEFERRED|UNKNOWN)$/;
for (let index = 1; index <= 15; index += 1) {
  const id = `D-${String(index).padStart(2, '0')}`;
  const decision = DECISIONS.find((entry) => entry.id === id);
  if (!decision) fail(`Falta la decisión ${id}.`);
  else if (!VALID_STATUS.test(decision.status)) fail(`${id} tiene un status inválido: "${decision.status}".`);
}
for (const id of ['G-01', 'G-02', 'F-11']) {
  if (!DISPOSITIONS.some((entry) => entry.id === id)) fail(`Falta la disposición ${id}.`);
}

const calibration = calibrate();
const worstDelta = Math.max(...calibration.map((row) => Math.abs(row.delta)));
if (worstDelta > 0.5) fail(`El modelo de canvas-budget se desvía ${worstDelta.toFixed(2)} pp de CRI-7 (máximo admitido 0.5).`);

// ---------------------------------------------------------------------------
// Ubicación de las 122 tareas
// ---------------------------------------------------------------------------

const surfaceById = new Map(SURFACES.map((surface) => [surface.id, surface]));

const placements = cri8Rows.map((row) => {
  const placement = placeTask(row);
  if (!validTargets.has(placement.surface)) fail(`La tarea ${row.id} quedó sin superficie válida.`);
  const surface = surfaceById.get(placement.surface);
  return {
    id: row.id,
    dominio: row.dom,
    tarea: row.task,
    claseUX: row.cls,
    clasePrimaria: primaryClass(row.cls),
    hoy: row.today,
    superficieCRI9: placement.surface,
    origenDeLaUbicacion: placement.source,
    motivo: placement.why,
    expanded: surface ? surface.expanded : PSEUDO_SURFACES[placement.surface],
    medium: surface ? surface.medium : PSEUDO_SURFACES[placement.surface],
    compact: surface ? surface.compact : PSEUDO_SURFACES[placement.surface],
    rutaPuntero: row.mk,
    rutaTactil: row.touch,
    precision: row.prec,
    criticidad: row.crit,
    decisionCRI8: row.c9,
  };
});

const placementCounts = placements.reduce((accumulator, row) => {
  accumulator[row.superficieCRI9] = (accumulator[row.superficieCRI9] ?? 0) + 1;
  return accumulator;
}, {});

const overrideCount = placements.filter((row) => row.origenDeLaUbicacion === 'decisión CRI-9').length;

// ---------------------------------------------------------------------------
// Paridad de input: qué tareas declara CRI-8 sin ruta táctil equivalente
// ---------------------------------------------------------------------------

/**
 * Brechas declaradas, no detectadas por patrón. Un filtro sobre texto libre
 * confunde «no existe ruta táctil» con «no aplica» y con «no accionable», y
 * produciría una lista que parece exhaustiva sin serlo. Estas seis son las que
 * CRI-8 verificó una por una en el código, con su cita.
 */
const PARITY_GAPS = [
  { id: 'SEL-02', kind: 'brecha completa', fix: 'D-06: el long-press arma el picker cuando hay más de un candidato. Sin gesto nuevo.' },
  { id: 'SEL-03', kind: 'brecha completa', fix: 'D-07: submodo explícito de marco en la herramienta `select`, armado y desarmado por acción.' },
  { id: 'MOD-12', kind: 'brecha completa', fix: 'D-07: Repeat gana casa en `contextual-actions` y entrada de paleta.' },
  { id: 'MOD-13', kind: 'brecha completa', fix: 'D-07: copiar/pegar/duplicar en `contextual-actions`, su primera afordancia visible.' },
  { id: 'DAT-06', kind: 'brecha completa', fix: 'D-07: afordancia de pegado en la barra de la tabla, con portapapeles asíncrono. Sujeta a U-11.' },
  { id: 'SHL-20', kind: 'brecha parcial', fix: 'P-12 (CRI-10): el detent debe responder también al arrastre del tirador, no sólo a tres botones.' },
];

const parity = PARITY_GAPS.map((gap) => {
  const row = cri8Rows.find((entry) => entry.id === gap.id);
  if (!row) fail(`La brecha de paridad ${gap.id} no existe en el inventario de CRI-8.`);
  return {
    id: gap.id,
    tarea: row ? row.task : '',
    tipo: gap.kind,
    tactilHoy: row ? row.touch : '',
    superficieCRI9: placements.find((entry) => entry.id === gap.id)?.superficieCRI9 ?? '',
    cierraPor: gap.fix,
  };
});

// ---------------------------------------------------------------------------
// Salida
// ---------------------------------------------------------------------------

const csv = (rows, columns) => [
  columns.join(','),
  ...rows.map((row) => columns.map((column) => {
    const value = row[column] ?? '';
    const text = String(value).replace(/"/g, '""').replace(/\s+/g, ' ').trim();
    return /[",]/.test(text) ? `"${text}"` : text;
  }).join(',')),
].join('\n') + '\n';

const write = (name, content) => {
  writeFileSync(join(here, name), content);
  return name;
};

const written = [];

written.push(write('cri-9-decision-register.json', JSON.stringify({
  meta: {
    task: 'CRI-9',
    baseline: '07f80b99a3ae9cb4404c5882d4195a814f331dd9',
    generated: 'build-cri9-tables.mjs',
    classification: 'AUDIT/TEMPORARY',
  },
  decisions: DECISIONS,
  dispositions: DISPOSITIONS,
  unknowns: UNKNOWNS,
}, null, 2) + '\n'));

written.push(write('cri-9-decision-register.csv', csv(
  [...DECISIONS.map((entry) => ({ ...entry, kind: 'decisión' })), ...DISPOSITIONS.map((entry) => ({ ...entry, kind: 'disposición' }))],
  ['id', 'kind', 'title', 'status', 'decision', 'why', 'evidence', 'impact', 'cri10', 'risk', 'open'],
)));

written.push(write('cri-9-surface-ownership.csv', csv(SURFACES,
  ['id', 'name', 'owner', 'origin', 'tasks', 'expanded', 'medium', 'compact', 'input', 'budget', 'note'])));

written.push(write('cri-9-state-ownership.csv', csv(STATE_OWNERSHIP,
  ['category', 'item', 'owner', 'writers', 'persisted', 'onTransition', 'today', 'change', 'evidence'])));

written.push(write('cri-9-transition-matrix.csv', csv(TRANSITIONS,
  ['id', 'from', 'to', 'trigger', 'selection', 'surface', 'draft', 'focus', 'scroll', 'overlays', 'canvas', 'escape', 'evidence'])));

written.push(write('cri-9-competitive-matrix.csv', csv(COMPETITIVE,
  ['product', 'pattern', 'reverified', 'problem', 'application', 'strength', 'risk', 'decisions', 'source'])));

written.push(write('cri-9-unknowns.csv', csv(UNKNOWNS, ['id', 'question', 'status', 'effect', 'needed', 'evidence'])));

written.push(write('cri-9-task-placement.csv', csv(placements,
  ['id', 'dominio', 'tarea', 'claseUX', 'clasePrimaria', 'hoy', 'superficieCRI9', 'origenDeLaUbicacion', 'motivo',
    'expanded', 'medium', 'compact', 'rutaPuntero', 'rutaTactil', 'precision', 'criticidad', 'decisionCRI8'])));

written.push(write('cri-9-canvas-budget.csv', csv(budgetTable(),
  ['viewport', 'width', 'height', 'todayTier', 'todayCanvasPct', 'resolved', 'restPct', 'detailPct', 'canvasBox', 'sheetSide', 'denseDockPinnable', 'deltaVsToday'])));

// --------------------------------------------------------------------- md ---

const mdTable = (headers, rows) => [
  `| ${headers.join(' | ')} |`,
  `|${headers.map(() => '---').join('|')}|`,
  ...rows.map((cells) => `| ${cells.map((cell) => String(cell ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()).join(' | ')} |`),
].join('\n');

const md = [];
md.push('# CRI-9 — Tablas exhaustivas\n');
md.push('**Clasificación:** `AUDIT/TEMPORARY`. Generado por `build-cri9-tables.mjs`; no editar a mano.\n');
md.push('El informe principal (`reports/2026-08-15-0400-cri-9-arquitectura-interaccion-adaptativa.md`) se lee sin este archivo. Aquí viven las versiones completas de las matrices que allí aparecen resumidas.\n');

md.push('\n## TABLA A — Registro de decisiones D-01…D-15\n');
md.push(mdTable(['ID', 'Decisión', 'Status', 'Qué se decide', 'Por qué', 'Evidencia'],
  DECISIONS.map((entry) => [entry.id, entry.title, `**${entry.status}**`, entry.decision, entry.why, entry.evidence])));

md.push('\n## TABLA B — Disposiciones G-01, G-02 y F-11\n');
md.push(mdTable(['ID', 'Asunto', 'Status', 'Disposición', 'Evidencia'],
  DISPOSITIONS.map((entry) => [entry.id, entry.title, entry.status, entry.decision, entry.evidence])));

md.push('\n## TABLA C — Catálogo de superficies y presentación por clase\n');
md.push(mdTable(['Superficie', 'Dueño', 'Expanded', 'Medium', 'Compact', 'Input', 'Canvas-budget'],
  SURFACES.map((surface) => [`\`${surface.id}\` · ${surface.name}`, surface.owner, surface.expanded, surface.medium, surface.compact, surface.input, surface.budget])));

md.push('\n## TABLA D — Ownership de estado (categorías A–E)\n');
md.push(mdTable(['Categoría', 'Estado', 'Dueño', 'Quién escribe', '¿Persiste?', 'En una transición', 'Hoy', 'Cambio'],
  STATE_OWNERSHIP.map((entry) => [entry.category, entry.item, entry.owner, entry.writers, entry.persisted, entry.onTransition, entry.today, entry.change])));

md.push('\n## TABLA E — Matriz de transiciones\n');
md.push(mdTable(['ID', 'De', 'A', 'Disparador', 'Selección', 'Superficie', 'Borrador', 'Foco', 'Scroll', 'Overlays', 'Lienzo', 'Escape'],
  TRANSITIONS.map((entry) => [entry.id, entry.from, entry.to, entry.trigger, entry.selection, entry.surface, entry.draft, entry.focus, entry.scroll, entry.overlays, entry.canvas, entry.escape])));

md.push('\n## TABLA F — Invariantes de transición\n');
md.push(mdTable(['ID', 'Regla', 'Por qué'], INVARIANTS.map((entry) => [entry.id, entry.rule, entry.why])));

md.push('\n## TABLA G — Ubicación de las 122 tareas de CRI-8\n');
md.push(`Regla determinista sobre la clase UX primaria + ${overrideCount} excepciones declaradas, cada una de ellas una decisión de CRI-9.\n`);
md.push(mdTable(['ID', 'Tarea', 'Dónde vive hoy', 'Superficie CRI-9', 'Origen', 'Motivo', 'Expanded', 'Medium', 'Compact'],
  placements.map((entry) => [entry.id, entry.tarea, entry.hoy, `\`${entry.superficieCRI9}\``, entry.origenDeLaUbicacion, entry.motivo, entry.expanded, entry.medium, entry.compact])));

md.push('\n## TABLA H — Brechas de paridad táctil y cómo se cierran\n');
md.push('Lista declarada, no detectada por patrón: son las que CRI-8 verificó una por una en el código.\n');
md.push(mdTable(['ID', 'Tarea', 'Tipo', 'Táctil hoy', 'Superficie CRI-9', 'Cómo se cierra'],
  parity.map((entry) => [entry.id, entry.tarea, entry.tipo, entry.tactilHoy, `\`${entry.superficieCRI9}\``, entry.cierraPor])));

md.push('\n## TABLA I — Canvas-budget calculado por el resolutor\n');
md.push(mdTable(['Viewport', 'Hoy', 'Lienzo hoy %', 'Resuelve', 'Reposo %', 'Con detalle %', 'Lienzo', 'Hoja', 'Dock denso fijable'],
  budgetTable().map((entry) => [entry.viewport, entry.todayTier, entry.todayCanvasPct ?? '—', `**${entry.resolved}**`, entry.restPct, entry.detailPct, entry.canvasBox, entry.sheetSide, entry.denseDockPinnable ? 'sí' : 'no'])));

md.push('\n## TABLA J — Calibración del modelo contra CRI-7 §2\n');
md.push(mdTable(['Viewport', 'Tier', 'CRI-7 medido %', 'Modelo %', 'Δ (pp)'],
  calibration.map((entry) => [entry.label, entry.tier, entry.canvasPct.toFixed(1), entry.modelled.toFixed(1), `${entry.delta >= 0 ? '+' : ''}${entry.delta.toFixed(2)}`])));

md.push('\n## TABLA K — Matriz competitiva\n');
md.push(mdTable(['Producto', 'Patrón oficial verificado', 'Re-verificado en CRI-9', 'Problema de StructureCo', 'Aplicación', 'Fortaleza a preservar', 'Riesgo de copiar literal', 'Decisiones'],
  COMPETITIVE.map((entry) => [entry.product, entry.pattern, entry.reverified ? 'sí' : 'no (se cita como en CRI-8)', entry.problem, entry.application, entry.strength, entry.risk, entry.decisions])));

md.push('\n### Patrones que NO se copian\n');
md.push(NOT_COPIED.map((line, index) => `${index + 1}. ${line}`).join('\n'));

md.push('\n\n## TABLA L — Unknowns\n');
md.push(mdTable(['ID', 'Pregunta', 'Status', 'Efecto sobre las decisiones', 'Qué haría falta'],
  UNKNOWNS.map((entry) => [entry.id, entry.question, `**${entry.status}**`, entry.effect, entry.needed])));

md.push('\n## TABLA M — Frontera Expanded↔Medium calculada\n');
md.push('Ningún umbral está escrito: todos salen de las reglas CB.\n');
md.push(mdTable(['Altura del viewport', 'Expanded desde'],
  [720, 768, 800, 834, 900, 960, 1024, 1080, 1200, 1366].map((height) => [`${height} px`, `${expandedBoundary(height)} px de ancho`])));

md.push('\n## TABLA N — Reparto de las 122 tareas por superficie\n');
md.push(mdTable(['Superficie', 'Tareas'],
  Object.entries(placementCounts).sort((a, b) => b[1] - a[1]).map(([id, count]) => [`\`${id}\``, count])));

md.push('\n## TABLA O — Dueños de estado (leyenda)\n');
md.push(mdTable(['Clave', 'Dueño'], Object.entries(OWNERS).map(([key, value]) => [key, value])));

written.push(write('report-tables.md', md.join('\n') + '\n'));

// ---------------------------------------------------------------------------
// Informe de consola
// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error('VALIDACIÓN FALLIDA:\n');
  for (const message of failures) console.error(`  · ${message}`);
  process.exit(1);
}

console.log('CRI-9 · generación correcta\n');
console.log(`  tareas de CRI-8 ubicadas       ${placements.length} / 122`);
console.log(`  ubicadas por excepción         ${overrideCount}`);
console.log(`  ubicadas por regla             ${placements.length - overrideCount}`);
console.log(`  superficies del catálogo       ${SURFACES.length}`);
console.log(`  decisiones D-01…D-15           ${DECISIONS.length} (${DECISIONS.filter((entry) => entry.status === 'DECIDED').length} DECIDED, ${DECISIONS.filter((entry) => entry.status === 'DEFERRED').length} DEFERRED, ${DECISIONS.filter((entry) => entry.status === 'UNKNOWN').length} UNKNOWN)`);
console.log(`  disposiciones                  ${DISPOSITIONS.length}`);
console.log(`  transiciones                   ${TRANSITIONS.length} · invariantes ${INVARIANTS.length}`);
console.log(`  unknowns                       ${UNKNOWNS.length} (${UNKNOWNS.filter((entry) => entry.status.startsWith('RESUELTO')).length} resueltos)`);
console.log(`  brechas de paridad táctil      ${parity.length}`);
console.log(`  calibración canvas-budget      error máximo ${worstDelta.toFixed(2)} pp (límite 0.5)`);
console.log(`  suelos CB                      CB-1 ${CB.coexistenceFloor * 100}% · CB-2 ${CB.restFloor * 100}% · CB-3 ${CB.floatingChromeMax * 100}% · CB-6 ${CB.compactDefaultDetentFloor * 100}%`);
console.log(`  rail Expanded/Medium           ${CHROME.railLabels}px / ${CHROME.railIcons}px`);
console.log(`\n  archivos escritos: ${written.length}`);
for (const name of written) console.log(`    ${name}`);
