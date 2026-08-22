// CRI-10 — Renderiza los conceptos a PNG, uno por lámina.
//
// Uso:  node reports/evidence/2026-08-15-cri-10-ux-system/render-concepts.mjs
//
// No construye la app y no lee `src/**` salvo `tokens.css` y `fonts.css`, que
// carga la propia página por enlace relativo desde un servidor estático efímero.
//
// EL TEMA SE RESUELVE COMO EN EL PRODUCTO. `tokens.css` declara la noche bajo
// `:root[data-theme='dark']`, así que un tema por marco sería mentira: el
// producto escribe SIEMPRE un `data-theme` explícito en la raíz
// (`ProjectContext.tsx`). Por eso este script hace dos pasadas sobre la misma
// página — una con la raíz en claro y otra en oscuro — y en cada pasada captura
// sólo las láminas declaradas para ese tema. Es la única forma de que el PNG
// nocturno demuestre de verdad la cascada nocturna.

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');
const outDir = path.join(here, 'shots');
fs.mkdirSync(outDir, { recursive: true });

// Servidor estático mínimo sobre la raíz del repo.
//
// No es un capricho: la página de conceptos usa módulos ES (`type="module"`), y
// Chromium los bloquea por CORS sobre `file://`. Servir desde la raíz del repo
// además mantiene vivo el enlace relativo a `src/design-system/tokens.css`, que
// es justo lo que hace que estos conceptos usen los tokens reales.
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const server = http.createServer((request, response) => {
  // Chromium pide `/favicon.ico` en todo `goto()`, sin relación con la página.
  // Sin esta rama el servidor la 404ea y el detector de errores de consola de
  // más abajo la confunde con un fallo real de la propia página — de forma
  // no determinista, según si la petición llega antes o después de `load`.
  if (request.url === '/favicon.ico') { response.writeHead(204).end(); return; }
  const relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/+/, '');
  // `fonts.css` pide `/fonts/*.woff2`, que en la app sirve Vite desde `public/`.
  // Sin este mapeo las láminas se renderizarían con la tipografía de reserva del
  // sistema y no probarían nada sobre la tipografía real del producto.
  const file = path.resolve(repoRoot, relative.startsWith('fonts/') ? `public/${relative}` : relative);
  if (!file.startsWith(repoRoot) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404).end('not found');
    return;
  }
  response.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const pageUrl = `${origin}/reports/evidence/2026-08-15-cri-10-ux-system/concepts/concepts.html`;

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });

const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

await page.goto(pageUrl, { waitUntil: 'load' });
await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, { timeout: 15000 });
await page.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 15000 }).catch(() => {});

if (errors.length > 0) {
  console.error('\n✗ La página de conceptos lanzó errores:\n' + errors.map((e) => `   ${e}`).join('\n'));
  await browser.close(); server.close();
  process.exit(1);
}

const frames = await page.$$eval('.frame', (nodes) => nodes.map((node) => ({
  name: node.dataset.name,
  theme: node.getAttribute('data-theme-scope'),
  w: node.offsetWidth,
  h: node.offsetHeight,
})));

if (frames.length === 0) {
  console.error('\n✗ No se generó ninguna lámina.');
  await browser.close(); server.close();
  process.exit(1);
}

/**
 * COMPROBACIÓN DE DESBORDAMIENTO DE LA CINTA — nueva en esta pasada de
 * corrección. Al devolver el lanzador de Datasheet a la Cinta (permanente,
 * al mismo nivel que Model Doctor), la Cinta de Compact gana un icono más.
 * En vez de asumir que cabe en 320-390px, se mide contra el propio DOM
 * renderizado — el mismo principio que sostiene `qa-topbar.mjs` en el
 * producto real: «cero desbordamiento horizontal» no se declara, se
 * comprueba. Si algún día deja de caber, esta comprobación falla en vez de
 * dejar una Cinta cortada en una lámina que nadie vuelve a mirar de cerca.
 */
const overflowing = await page.$$eval('.frame[data-class="K0"] .cinta', (nodes) =>
  nodes
    .filter((node) => node.scrollWidth > node.clientWidth + 1)
    .map((node) => ({
      frame: node.closest('.frame')?.dataset.name ?? '?',
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth,
    })),
);
if (overflowing.length > 0) {
  console.error(
    '\n✗ La Cinta desborda horizontalmente en Compact:\n' +
    overflowing.map((o) => `   ${o.frame}: contenido ${o.scrollWidth}px > banda ${o.clientWidth}px`).join('\n') +
    '\n  El lanzador de Datasheet no cabe junto al de Model Doctor en este ancho: comparte disparador o degrada antes.',
  );
  await browser.close(); server.close();
  process.exit(1);
}
console.log(`✓ La Cinta no desborda en ninguna de las ${await page.$$eval('.frame[data-class="K0"] .cinta', (n) => n.length)} láminas Compact.`);

/**
 * COMPROBACIÓN DE DESBORDAMIENTO DEL MARCO COMPLETO — añadida en la pasada de
 * rediseño de la entrada, y añadida PORQUE ESTA MISMA PASADA SE LE ESCAPÓ UN
 * FALLO REAL: la comprobación de arriba sólo mira `.cinta`, y la nueva Mesa
 * ya no tiene Cinta. Un contenedor `display:grid` con la columna implícita
 * `auto` se dimensionó al max-content de su cabecera y sacó 51px de TODO el
 * contenido fuera del marco de 390px — con el gate en verde.
 *
 * Aquí se mide cada elemento contra el borde derecho de su propio marco, que
 * es la única forma de detectar un desbordamiento que no produce scroll (el
 * marco recorta con `overflow:hidden`, así que `scrollWidth` no lo delata).
 * Se reporta sólo el ancestro más externo de cada cadena: si `.ws__frame` se
 * sale, sus 200 descendientes también, y listarlos no añade información.
 *
 * El SVG queda fuera de la comprobación A PROPÓSITO, y no para que pase: en
 * este cuaderno un dibujo MÁS GRANDE que su marco es lo normal y lo correcto
 * — `.lienzo` y las miniaturas son mirillas sobre un plano mayor, igual que
 * el lienzo del producto. Lo que se persigue aquí es el desbordamiento de
 * CAJA (contenedores de texto y controles), que siempre es un fallo.
 */
const clipped = await page.$$eval('.frame', (frames) => {
  const out = [];
  for (const frame of frames) {
    const edge = frame.getBoundingClientRect().right;
    const offenders = [];
    for (const el of frame.querySelectorAll('*')) {
      if (el instanceof SVGElement) continue;
      const box = el.getBoundingClientRect();
      if (box.width > 0 && box.right > edge + 1) offenders.push(el);
    }
    // Sólo el más externo de cada rama: descarta lo que ya tiene un ancestro marcado.
    const outermost = offenders.filter((el) => !offenders.some((other) => other !== el && other.contains(el)));
    for (const el of outermost) {
      out.push({
        frame: frame.dataset.name ?? '?',
        selector: `${el.tagName.toLowerCase()}${el.getAttribute('class') ? `.${el.getAttribute('class').trim().split(/\s+/).join('.')}` : ''}`,
        over: Math.round(el.getBoundingClientRect().right - edge),
      });
    }
  }
  return out;
});
if (clipped.length > 0) {
  console.error(
    '\n✗ Hay contenido que se sale del marco (recortado, no visible):\n' +
    clipped.map((c) => `   ${c.frame}: ${c.selector} sobresale ${c.over}px`).join('\n') +
    '\n  Suele ser un contenedor grid/flex sin `minmax(0, 1fr)` o sin `min-width: 0`.',
  );
  await browser.close(); server.close();
  process.exit(1);
}
console.log(`✓ Ningún elemento se sale de su marco en las ${frames.length} láminas.\n`);

let written = 0;
for (const theme of ['light', 'dark']) {
  await page.evaluate((t) => { document.documentElement.setAttribute('data-theme', t); }, theme);
  await page.waitForTimeout(120);
  for (const frame of frames.filter((f) => f.theme === theme)) {
    const element = await page.$(`.frame[data-name="${frame.name}"][data-theme-scope="${theme}"]`);
    await element.screenshot({ path: path.join(outDir, `${frame.name}.png`) });
    written += 1;
    console.log(`  ${String(frame.w).padStart(4)}×${String(frame.h).padStart(4)}  ${theme === 'dark' ? 'noche' : 'día  '}  ${frame.name}.png`);
  }
}

await browser.close();
server.close();
console.log(`\n${written} láminas escritas en reports/evidence/2026-08-15-cri-10-ux-system/shots/\n`);
if (written !== frames.length) {
  console.error(`✗ Se declararon ${frames.length} láminas y se escribieron ${written}.`);
  process.exit(1);
}
