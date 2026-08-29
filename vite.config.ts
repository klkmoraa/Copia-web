import { readFileSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { defineConfig } from 'vitest/config';
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
  plugins: [react(), pwaShellPlugin()],
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
    setupFiles: ['src/i18n/testCatalogSetup.ts'],
    // The quality gate must only observe the real product. Backups, worktrees and
    // vendored copies of the app live beside `src/` and would otherwise be collected,
    // reporting stale failures and inflating the suite by an order of magnitude.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: [
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
    ],
  },
});
