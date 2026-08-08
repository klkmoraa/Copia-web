#!/usr/bin/env node
/**
 * Fails the build when the initial download grows past its declared ceiling.
 *
 * `measure-performance.mjs` has always been able to report bundle composition, but nothing
 * ever *asserted* on it: the numbers were printed, read once, written into
 * `docs/releases/0.8.1/PERFORMANCE.md`, and then drifted silently. That is exactly how the
 * animation library landed in the entry chunk and pushed the initial download from
 * 148 531 gzip to 195 360 gzip without a single check going red.
 *
 * This script closes that hole. It re-uses the measurement script as the single source of
 * truth (spawned with `--json`) rather than re-implementing the walk, so the budget can
 * never be checked against a different definition of "initial load" than the one the
 * performance document reports.
 *
 * Usage: npm run build && node scripts/check-performance-budget.mjs
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');

/**
 * Ceilings for what the browser must download before first paint.
 *
 * Provenance — these are NOT aspirational targets, they are the measured value plus a
 * deliberate 3 % of headroom so that ordinary content edits (a few translation keys, a CSS
 * rule) do not fail the gate, while a new library or an eagerly-imported feature does.
 *
 * Measured 2026-08-07 after the second visual-fidelity pass: 691 205 bytes, 182 809 gzip.
 * The additional clay control vocabulary is intentional CSS for the official brandbook;
 * the ceiling is re-based here with a small margin instead of hiding the visual work in
 * an untracked override.
 *
 * Why the ceiling moved. The previous pair (648 000 / 174 000) came from a 2026-08-03
 * measurement of 629 337 / 169 132. By the time AG-015 started, `main` already measured
 * 639 791 / 171 997 — three feature commits had quietly eaten 10 454 bytes of that 3 % of
 * headroom without ever tripping the gate, which is exactly the drift this script exists to
 * make visible. AG-015 itself adds 11 316 bytes / 2 358 gzip: a restructured token layer and
 * a rewritten welcome surface, both of which are pure CSS in the entry chunk. That cost is
 * deliberate and was authorised as a design decision, so the ceiling is re-based on the new
 * measurement rather than the redesign being trimmed to fit a stale number.
 *
 * KNOWN DEBT: this is still above the 0.8.1 baseline of 556 000 bytes / 148 531 gzip. The
 * gap is the animation core (`m` + `AnimatePresence` + `LazyMotion`) that the welcome
 * screen pulls into the entry chunk. AG-015 deliberately drove its new hero animation from
 * CSS instead of `motion` so as not to deepen that debt, but the card hovers and the
 * `AnimatePresence` filter reflow still need it. Lowering this ceiling means porting those
 * two to CSS as well; until that decision is made, the ceiling holds the line where it is
 * instead of letting it drift further.
 */
const BUDGET = {
  eagerBytes: 700_000,
  eagerGzip: 185_000,
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
const failures = [];

if (eagerBytes > BUDGET.eagerBytes) {
  failures.push(`  carga inicial: ${eagerBytes} bytes supera el techo de ${BUDGET.eagerBytes} (+${percent(eagerBytes, BUDGET.eagerBytes)})`);
}
if (eagerGzip > BUDGET.eagerGzip) {
  failures.push(`  carga inicial: ${eagerGzip} gzip supera el techo de ${BUDGET.eagerGzip} (+${percent(eagerGzip, BUDGET.eagerGzip)})`);
}

if (failures.length) {
  console.error('Presupuesto de rendimiento excedido:\n');
  console.error(failures.join('\n'));
  console.error('\nRevisa que ninguna dependencia nueva haya entrado al chunk de entrada.');
  console.error('Los archivos marcados "inicial" en `node scripts/measure-performance.mjs` son los que se descargan antes del primer pintado.');
  process.exit(1);
}

console.log(`Presupuesto de rendimiento respetado: ${eagerBytes} bytes / ${eagerGzip} gzip (techo ${BUDGET.eagerBytes} / ${BUDGET.eagerGzip}).`);
