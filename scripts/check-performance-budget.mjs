#!/usr/bin/env node
/**
 * Reports the initial download using the same measurement source as the performance report.
 *
 * Fase 4 keeps this command as an observability check, but deliberately does not impose a
 * byte/gzip ceiling: the product decision for this phase is an unbounded budget. A failed
 * measurement still fails the command; a larger bundle remains visible in the output without
 * blocking implementation work.
 *
 * Usage: npm run build && node scripts/check-performance-budget.mjs
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');

/**
 * Fase 4 decision (2026-08-09): no hard performance ceiling. `Infinity` is explicit so a
 * future finite budget cannot be mistaken for an omitted check.
 */
const BUDGET = {
  eagerBytes: Number.POSITIVE_INFINITY,
  eagerGzip: Number.POSITIVE_INFINITY,
};

let report;
try {
  const raw = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'measure-performance.mjs'), '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  report = JSON.parse(raw);
} catch (error) {
  console.error(`No se pudo medir el bundle: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}

if (report.bundle?.error) {
  console.error(report.bundle.error);
  process.exit(1);
}

const { eagerBytes, eagerGzip } = report.bundle;
const percent = (actual, ceiling) => `${((actual / ceiling - 1) * 100).toFixed(1)}%`;
const displayLimit = (limit) => (Number.isFinite(limit) ? String(limit) : 'sin límite');
const failures = [];

if (Number.isFinite(BUDGET.eagerBytes) && eagerBytes > BUDGET.eagerBytes) {
  failures.push(`  carga inicial: ${eagerBytes} bytes supera el techo de ${BUDGET.eagerBytes} (+${percent(eagerBytes, BUDGET.eagerBytes)})`);
}
if (Number.isFinite(BUDGET.eagerGzip) && eagerGzip > BUDGET.eagerGzip) {
  failures.push(`  carga inicial: ${eagerGzip} gzip supera el techo de ${BUDGET.eagerGzip} (+${percent(eagerGzip, BUDGET.eagerGzip)})`);
}

if (failures.length) {
  console.error('Presupuesto de rendimiento excedido:\n');
  console.error(failures.join('\n'));
  console.error('\nRevisa que ninguna dependencia nueva haya entrado al chunk de entrada.');
  console.error('Los archivos marcados "inicial" en `node scripts/measure-performance.mjs` son los que se descargan antes del primer pintado.');
  process.exit(1);
}

console.log(`Métrica de rendimiento registrada: ${eagerBytes} bytes / ${eagerGzip} gzip (límite ${displayLimit(BUDGET.eagerBytes)} / ${displayLimit(BUDGET.eagerGzip)}; sin techo bloqueante).`);
