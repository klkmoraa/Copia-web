#!/usr/bin/env node
/**
 * The calculation report's renderer, driven from Node.
 *
 * The product renders through Pyodide loaded from the app's own assets; this is the same
 * interpreter, the same vendored ReportLab wheel and the same `python/**` sources, resolved
 * from `node_modules` instead. It exists so the things that verify the document — the test
 * suite, the WebKit QA run, an agent inspecting a report by hand — drive the real renderer
 * rather than a stand-in, and so there is exactly one copy of the boot sequence outside the app.
 *
 * Usage as a command: `node scripts/report-renderer.mjs <document.json> <out.pdf>`
 */
import { createRequire } from 'node:module';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '..');
/** Where the renderer's package and the Pillow shim are mounted inside the interpreter. */
const PACKAGE_ROOT = '/opt/structureco';

const collectPython = async (directory, prefix = '') => {
  const entries = await readdir(directory, { withFileTypes: true });
  const collected = await Promise.all(entries.map(async (entry) => {
    const child = path.join(directory, entry.name);
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return collectPython(child, relative);
    return entry.name.endsWith('.py') ? [[relative, await readFile(child, 'utf8')]] : [];
  }));
  return collected.flat();
};

/** The wheel vendored for offline rendering; its version lives in the filename, not in code. */
const wheelPath = async () => {
  const vendor = path.join(ROOT, 'vendor');
  const name = (await readdir(vendor)).find((entry) => /^reportlab-.*\.whl$/.test(entry));
  if (!name) throw new Error('Falta vendor/reportlab-*.whl: el informe no se puede renderizar sin ReportLab.');
  return path.join(vendor, name);
};

let booting;

const boot = async () => {
  const pyodideDir = path.dirname(require.resolve('pyodide/package.json'));
  const { loadPyodide } = await import('pyodide');
  const pyodide = await loadPyodide({ indexURL: pyodideDir });

  pyodide.FS.mkdirTree('/opt');
  pyodide.FS.writeFile('/opt/reportlab.whl', new Uint8Array(await readFile(await wheelPath())));
  for (const [relative, source] of await collectPython(path.join(ROOT, 'python'))) {
    const target = `${PACKAGE_ROOT}/${relative}`;
    pyodide.FS.mkdirTree(target.slice(0, target.lastIndexOf('/')));
    pyodide.FS.writeFile(target, source);
  }
  // A wheel is a zip and ReportLab is pure Python, so `zipimport` serves it with no installer.
  // The shim goes first: `reportlab.lib.utils` imports PIL at module scope and this report
  // never draws a bitmap (see `python/pilshim/PIL/__init__.py`).
  pyodide.runPython(`
import sys
for entry in ('${PACKAGE_ROOT}/pilshim', '/opt/reportlab.whl', '${PACKAGE_ROOT}'):
    if entry not in sys.path:
        sys.path.insert(0, entry)
import structureco_report
`);
  return pyodide;
};

/** Renders one serialised `ReportDocument` and returns the PDF bytes. */
export const renderReportJson = async (documentJson) => {
  booting ??= boot();
  const pyodide = await booting;
  pyodide.FS.writeFile('/opt/document.json', documentJson);
  pyodide.runPython(`
import structureco_report
with open('/opt/document.json', 'r', encoding='utf-8') as handle:
    _structureco_pdf = structureco_report.render_report(handle.read())
`);
  const result = pyodide.globals.get('_structureco_pdf');
  if (!result) throw new Error('El renderizador no devolvió el documento.');
  try {
    // `.toJs()` copies the buffer out of WebAssembly memory, which the next render would reuse.
    return result.toJs();
  } finally {
    result.destroy?.();
  }
};

/** The same, from a document object. */
export const renderReport = (document) => renderReportJson(JSON.stringify(document));

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const [, , input, output] = process.argv;
  if (!input || !output) {
    console.error('Uso: node scripts/report-renderer.mjs <document.json> <out.pdf>');
    process.exit(2);
  }
  const bytes = await renderReportJson(await readFile(input, 'utf8'));
  await writeFile(output, bytes);
  console.log(`${output}: ${bytes.byteLength} bytes`);
}
