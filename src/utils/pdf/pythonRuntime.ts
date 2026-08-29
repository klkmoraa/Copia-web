/**
 * The Python runtime the report renderer runs inside, booted locally.
 *
 * ReportLab is a Python library and structureCo is a browser application, so something has to
 * bridge them. That something is Pyodide — CPython compiled to WebAssembly — loaded from the
 * app's own assets, never from a CDN. The whole point of the choice is that the report is
 * produced *on the reader's machine*: no upload of a model somebody is going to sign, no
 * service to be offline, no network at all. An installed PWA with no connection generates the
 * same document it generates online, byte for byte.
 *
 * Three things are handed to the interpreter and nothing else:
 *
 * - `pyodide.asm.wasm` and the Python standard library, from `node_modules/pyodide`, copied
 *   into the build by `vite.config.ts`.
 * - `vendor/reportlab-*.whl`, vendored in the repository because it is not on npm and because a
 *   build that reached out to PyPI would not be reproducible. It is a pure-Python wheel, so it
 *   is mounted on `sys.path` and imported straight out of the zip — no installer, no compiler.
 * - `python/**`, this repository's own renderer, inlined at build time by `import.meta.glob` so
 *   the sources stay real files that a person can read, run and test with plain CPython.
 *
 * Booting costs a couple of seconds and about thirteen megabytes, which is why it happens on
 * the first export rather than at startup, is cached for the rest of the session, and is
 * behind the dynamic `import()` in `calculationPdf.ts`. The service worker caches the assets
 * with everything else, so the second export in a session — and the first one offline — pays
 * only for the interpreter starting up.
 */

/** The shape of `loadPyodide`'s result this module actually uses. */
interface PyodideInterpreter {
  FS: {
    mkdirTree(path: string): void;
    writeFile(path: string, data: Uint8Array | string): void;
  };
  runPython(code: string): unknown;
  globals: { get(name: string): { toJs(): Uint8Array; destroy?(): void } | undefined };
}

/**
 * Where the interpreter's own files live.
 *
 * `import.meta.url` is the built chunk's URL, so this resolves under the app's asset directory
 * whatever path the site is deployed at — which matters, because the app is served from a
 * subdirectory on some hosts and from the root on others.
 */
const assetBase = (): URL => new URL('./pyodide/', import.meta.url);

const PYTHON_SOURCES = import.meta.glob('/python/**/*.py', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Directory the renderer's own package is written to, and the shim that stands in for Pillow. */
const PACKAGE_ROOT = '/opt/structureco';

let booting: Promise<PyodideInterpreter> | undefined;

const fetchBinary = async (url: URL): Promise<Uint8Array> => {
  const response = await fetch(url.href);
  if (!response.ok) throw new Error(`No se pudo cargar ${url.pathname} (${response.status}).`);
  return new Uint8Array(await response.arrayBuffer());
};

/**
 * Writes `python/**` into the interpreter's filesystem, keeping the directory layout.
 *
 * The keys `import.meta.glob` produces are repository-absolute (`/python/structureco_report/
 * render.py`), so the leading `/python` is dropped and the rest is recreated verbatim: the
 * package a test imports with CPython is the package the browser imports.
 */
const mountSources = (pyodide: PyodideInterpreter): void => {
  for (const [path, source] of Object.entries(PYTHON_SOURCES)) {
    const relative = path.replace(/^\/python\//, '');
    const target = `${PACKAGE_ROOT}/${relative}`;
    const directory = target.slice(0, target.lastIndexOf('/'));
    pyodide.FS.mkdirTree(directory);
    pyodide.FS.writeFile(target, source);
  }
};

const boot = async (): Promise<PyodideInterpreter> => {
  const base = assetBase();
  const [{ loadPyodide }, wheel] = await Promise.all([
    import('pyodide'),
    fetchBinary(new URL('reportlab.whl', base)),
  ]);
  const pyodide = await loadPyodide({ indexURL: base.href }) as unknown as PyodideInterpreter;
  pyodide.FS.mkdirTree('/opt');
  pyodide.FS.writeFile('/opt/reportlab.whl', wheel);
  mountSources(pyodide);
  pyodide.runPython(`
import sys
# A wheel is a zip, and ReportLab is pure Python, so \`zipimport\` serves it directly. The shim
# goes on the path first: \`reportlab.lib.utils\` imports PIL at module scope and this report
# never draws a bitmap (see \`python/pilshim/PIL/__init__.py\`).
for entry in ('${PACKAGE_ROOT}/pilshim', '/opt/reportlab.whl', '${PACKAGE_ROOT}'):
    if entry not in sys.path:
        sys.path.insert(0, entry)
import structureco_report
`);
  return pyodide;
};

/** The interpreter, booted once per session. A failed boot is not cached, so a retry can work. */
export const pythonRuntime = async (): Promise<PyodideInterpreter> => {
  if (!booting) {
    booting = boot().catch((error: unknown) => {
      booting = undefined;
      throw error;
    });
  }
  return booting;
};

/** Runs the renderer over one serialised document and returns the PDF bytes. */
export const renderWithPython = async (documentJson: string): Promise<Uint8Array> => {
  const pyodide = await pythonRuntime();
  // The document travels as a string in a global rather than as an argument, so a model with
  // forty thousand numbers is copied once instead of being marshalled object by object.
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
