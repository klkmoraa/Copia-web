import { readFileSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Provenance stamped on exported documents must come from the package, never from a
// literal someone has to remember to bump.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/**
 * MathJax's own version constant, which its bundled builds are expected to define.
 *
 * `mathjax-full/js/components/version.js` reads its version like this:
 *
 *     exports.VERSION = (typeof PACKAGE_VERSION === 'undefined'
 *       ? (function () { const load = eval('require'); … })()
 *       : PACKAGE_VERSION);
 *
 * The fallback runs at module-evaluation time, and `mathjax.js` — the entry every other
 * MathJax module pulls in — imports it. In a browser ESM bundle `require` does not exist, so
 * merely importing MathJax threw `ReferenceError: require is not defined` and took the whole
 * calculation report down with it: the export dialog could neither preview nor download,
 * while every Node test passed because `require` is defined there.
 *
 * Defining the constant at build time is what MathJax's own component builds do. It makes the
 * ternary pick the literal, so the `eval` branch is never evaluated — and, being unreachable,
 * is dropped by the minifier along with the build warning it used to raise.
 */
const { version: mathjaxVersion } = JSON.parse(
  readFileSync(new URL('./node_modules/mathjax-full/package.json', import.meta.url), 'utf8'),
) as { version: string };

const collectBuildFiles = async (relative = ''): Promise<string[]> => {
  const directory = new URL(`./dist/${relative}`, import.meta.url);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    return entry.isDirectory() ? collectBuildFiles(child) : [child];
  }));
  return files.flat();
};

/**
 * The Python runtime the calculation report is rendered by, served from the app's own origin.
 *
 * Since 0.8.4 the report is drawn by ReportLab running on Pyodide (`src/utils/pdf/
 * pythonRuntime.ts`), which needs three files at run time: the WebAssembly interpreter, the
 * Python standard library, and the ReportLab wheel. None of them may come from a CDN — the
 * report has to be producible with no network at all, which is the property that keeps a model
 * somebody is about to sign on their own machine — so they are emitted as ordinary build assets
 * beside the chunk that loads them, and the service worker caches them with everything else.
 *
 * They are emitted rather than copied through `public/`: `pyodide.asm.wasm` alone is 8.6 MB,
 * and `public/` files are copied on every dev start whether or not anybody exports a report.
 * The dev server serves them from `node_modules` instead, through the middleware below.
 */
/**
 * `pyodide-lock.json` is in the list because the interpreter reads it while booting, to learn
 * which packages its distribution carries. It is not optional: without it the dev server and
 * the SPA fallback both answer with `index.html`, and the boot dies on `Unexpected token '<'`.
 */
/** El único archivo de pruebas que afirma sobre reloj de pared; corre aislado. */
const PERFORMANCE_SUITE = 'src/engine/performance.test.ts';

const SUITE_GLOB = 'src/**/*.{test,spec}.{ts,tsx}';

/**
 * The quality gate must only observe the real product. Backups, worktrees and
 * vendored copies of the app live beside `src/` and would otherwise be collected,
 * reporting stale failures and inflating the suite by an order of magnitude.
 */
const COLLECTION_EXCLUDE = [
  '**/node_modules/**',
  '**/dist/**',
  'structureCo/**',
  'structureCo-backup-*/**',
  'structureCo-worktrees/**',
  'structureco-sites/**',
  'structureco-sites-worktrees/**',
  'structureco-design-review/**',
  'structureco-palette-lab/**',
  'structureCo-contexto-*/**',
  'structureCo-documentacion-integral-*/**',
];

const PYODIDE_FILES = ['pyodide.asm.js', 'pyodide.asm.wasm', 'pyodide.mjs', 'pyodide-lock.json', 'python_stdlib.zip'];
/** The name `pythonRuntime.ts` fetches, so the vendored wheel's version is not in the code. */
const WHEEL_ASSET = 'reportlab.whl';

const pythonRuntimeAssets = (): Plugin => {
  const require = createRequire(import.meta.url);
  const pyodideDir = path.dirname(require.resolve('pyodide/package.json'));
  const wheelDir = new URL('./vendor/', import.meta.url);
  const wheelFile = async () => {
    const entries = await readdir(wheelDir);
    const wheel = entries.find((entry) => /^reportlab-.*\.whl$/.test(entry));
    if (!wheel) throw new Error('Falta vendor/reportlab-*.whl: el informe no se puede renderizar sin ReportLab.');
    return new URL(wheel, wheelDir);
  };
  /** `assets/` is where Rollup puts the chunk whose `import.meta.url` resolves this directory. */
  const target = (file: string) => `assets/pyodide/${file}`;

  return {
    name: 'structureco-python-runtime',
    apply: () => true,
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = request.url ?? '';
        const match = /\/pyodide\/([\w.-]+)$/.exec(url.split('?')[0]);
        if (!match) return next();
        const name = match[1];
        try {
          const source = name === WHEEL_ASSET
            ? await wheelFile()
            : PYODIDE_FILES.includes(name) ? new URL(`file://${path.join(pyodideDir, name)}`) : undefined;
          if (!source) return next();
          const body = await readFile(source);
          response.setHeader('Content-Type', name.endsWith('.wasm')
            ? 'application/wasm'
            : name.endsWith('.js') || name.endsWith('.mjs') ? 'text/javascript'
              : name.endsWith('.json') ? 'application/json' : 'application/octet-stream');
          response.end(body);
        } catch {
          next();
        }
      });
    },
    async generateBundle() {
      for (const file of PYODIDE_FILES) {
        this.emitFile({
          type: 'asset',
          fileName: target(file),
          source: await readFile(path.join(pyodideDir, file)),
        });
      }
      this.emitFile({ type: 'asset', fileName: target(WHEEL_ASSET), source: await readFile(await wheelFile()) });
    },
  };
};

const pwaShellPlugin = () => ({
  name: 'structureco-pwa-shell',
  async closeBundle() {
    const files = (await collectBuildFiles()).filter((file) => file !== 'sw.js' && !file.endsWith('.map')).sort();
    const digest = createHash('sha256');
    for (const file of files) {
      digest.update(file);
      digest.update(await readFile(new URL(`./dist/${file}`, import.meta.url)));
    }
    const release = digest.digest('hex').slice(0, 16);
    const assets = files.map((file) => `./${file}`);
    const source = `const CACHE_NAME=${JSON.stringify(`structureco-shell-${release}`)};
const SHELL=${JSON.stringify(assets)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{
      if(response.ok)event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.put('./index.html',response.clone())));
      return response;
    }).catch(async()=>await caches.match('./index.html',{ignoreVary:true})||await caches.match('./',{ignoreVary:true})));
    return;
  }
  event.respondWith(caches.match(request,{ignoreVary:true}).then(cached=>cached||fetch(request).then(response=>{
    if(response.ok)event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.put(request,response.clone())));
    return response;
  })));
});`;
    await writeFile(new URL('./dist/sw.js', import.meta.url), source, 'utf8');
  },
});

export default defineConfig({
  plugins: [react(), pythonRuntimeAssets(), pwaShellPlugin()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(version),
    PACKAGE_VERSION: JSON.stringify(mathjaxVersion),
  },
  build: {
    rollupOptions: {
      /**
       * Dos puntos de entrada: la app y el brandbook.
       *
       * `brand/brandbook.html` importa `tokens.css` en vivo —no transcribe la
       * paleta, la lee— y es la única superficie que enseña el sistema pintado
       * con sus valores reales. Hasta aquí el build sólo emitía la app, así que
       * el brandbook no era alcanzable desde el sitio publicado.
       *
       * Se resuelve dándoselo a Vite y no copiándolo con un paso aparte, porque
       * copiarlo NO basta: `fonts.css` declara sus caras con URL absoluta
       * (`url('/fonts/inter-latin-variable.woff2')`), que bajo Pages resuelve a
       * la raíz del dominio y da 404 — un brandbook sobre tipografía pintado en
       * la cara de reserva. Vite ya reescribe esas URL al construir (en
       * `dist/assets/index-*.css` salen como `url(../fonts/…)`), así que aquí se
       * usa esa máquina en vez de reproducirla a mano con un `sed` en el
       * workflow.
       *
       * La clave DEBE llamarse `index`: Rollup nombra el chunk de entrada por su
       * clave, y `qa.mjs` localiza los archivos de producción con
       * `/^index-.*\.js$/` y `/^index-.*\.css$/`. Con cualquier otra clave el
       * gate de navegador muere buscando un archivo que ya no existe.
       */
      input: {
        index: 'index.html',
        brandbook: 'brand/brandbook.html',
      },
    },
  },
  test: {
    /* El inglés ya no viaja en el chunk de entrada: se pide bajo demanda. Este
       arranque lo registra antes de la primera prueba para que las que rinden
       en inglés no tengan que volverse asíncronas. El instante sin catálogo se
       prueba aparte, con el registro limpio (`catalogs.test.ts`). */
    setupFiles: [
      'src/i18n/testCatalogSetup.ts',
      /* El informe se rinde con el mismo ReportLab que usa el producto, sobre el mismo
         Pyodide: las pruebas que leen el PDF de vuelta sólo valen si el PDF es el de verdad. */
      'src/utils/pdf/testReportRenderer.ts',
    ],
    exclude: COLLECTION_EXCLUDE,
    /**
     * Dos proyectos, y el motivo es una sola prueba.
     *
     * La suite corría entera con `--maxWorkers=1`. `src/engine/performance.test.ts`
     * es el único archivo que afirma sobre reloj de pared —«el modelo de 300
     * miembros resuelve en menos de 20 s»—, y bajo contención de CPU esa clase de
     * afirmación mide la máquina, no el código. Serializar las 317 para proteger a
     * una costaba 410 s por ejecución.
     *
     * `benchmarks.test.ts` y `pDeltaBenchmarks.test.ts`, pese al nombre, afirman
     * exactitud numérica y no tiempo: van en paralelo con el resto.
     *
     * Los dos `setupFiles` son seguros por worker — el registro del catálogo es
     * idempotente y Pyodide arranca de forma perezosa, sólo si una prueba pide un
     * informe—, así que el paralelismo no multiplica el arranque del intérprete
     * salvo en los workers que de verdad rinden un PDF.
     *
     * `npm test` los encadena en vez de dejarlos concurrir, para que el proyecto
     * de rendimiento tenga la máquina para él solo. 410 s → 157 s + el margen del
     * archivo aislado.
     */
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: [SUITE_GLOB],
          /* `exclude` de un proyecto reemplaza al heredado, así que la lista de
             copias y worktrees se repite aquí: omitirla las volvería a recoger. */
          exclude: [...COLLECTION_EXCLUDE, PERFORMANCE_SUITE],
        },
      },
      {
        extends: true,
        test: {
          name: 'perf',
          include: [PERFORMANCE_SUITE],
          exclude: COLLECTION_EXCLUDE,
          // El reloj de pared sólo significa algo sin nadie más compitiendo.
          fileParallelism: false,
          maxWorkers: 1,
        },
      },
    ],
  },
});
