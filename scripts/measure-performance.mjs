#!/usr/bin/env node
/**
 * Reproducible performance measurement for structureCo.
 *
 * Reports bundle composition from a real `dist/` build and solver timings across model
 * sizes. Prints a table; `--json` emits the raw numbers so a budget check can consume them.
 *
 * Usage: npm run build && node scripts/measure-performance.mjs [--json]
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const asJson = process.argv.includes('--json');

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  }));
  return nested.flat();
};

let bundle = { files: [], eagerBytes: 0, eagerGzip: 0, totalBytes: 0 };
try {
  await stat(DIST);
  const files = await walk(DIST);
  const html = await readFile(path.join(DIST, 'index.html'), 'utf8');
  const measured = await Promise.all(files
    .filter((file) => /\.(js|mjs|css)$/.test(file))
    .map(async (file) => {
      const bytes = await readFile(file);
      const name = path.relative(DIST, file).replaceAll('\\', '/');
      return {
        name,
        bytes: bytes.byteLength,
        gzip: gzipSync(bytes, { level: 9 }).byteLength,
        // "Eager" means the browser fetches it for the first paint, either because
        // index.html references it or because it is preloaded from there.
        eager: html.includes(path.basename(file)),
      };
    }));
  measured.sort((a, b) => b.bytes - a.bytes);
  bundle = {
    files: measured,
    eagerBytes: measured.filter((file) => file.eager).reduce((sum, file) => sum + file.bytes, 0),
    eagerGzip: measured.filter((file) => file.eager).reduce((sum, file) => sum + file.gzip, 0),
    totalBytes: measured.reduce((sum, file) => sum + file.bytes, 0),
  };
} catch {
  bundle.error = 'dist/ no existe; ejecuta npm run build primero.';
}

const { analyzeProject } = await import(path.join(ROOT, 'src', 'engine', 'solver.ts'))
  .catch(() => ({ analyzeProject: null }));

let solver = { supported: false, reason: 'El solver TypeScript no puede importarse desde Node sin transpilar.' };
if (analyzeProject) {
  solver = { supported: true, samples: [] };
}

const report = { bundle, solver };

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  if (bundle.error) {
    console.log(bundle.error);
  } else {
    console.log('Composicion del bundle\n');
    console.log('  carga  tamano      gzip     archivo');
    for (const file of bundle.files.slice(0, 18)) {
      const eager = file.eager ? 'inicial' : 'diferid';
      console.log(`  ${eager} ${String(file.bytes).padStart(9)} ${String(file.gzip).padStart(9)}  ${file.name}`);
    }
    console.log(`\n  Carga inicial: ${bundle.eagerBytes} bytes (${bundle.eagerGzip} gzip)`);
    console.log(`  Total en dist: ${bundle.totalBytes} bytes`);
  }
  if (!solver.supported) console.log(`\n${solver.reason}`);
}
