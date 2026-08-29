#!/usr/bin/env node
/**
 * El bundle del navegador no puede llevar construcciones que sólo existen en Node.
 *
 * Este gate nace de un fallo real y caro: `mathjax-full/js/components/version.js` resuelve su
 * versión con `eval('require')` cuando nadie define `PACKAGE_VERSION`, y `mathjax.js` —el
 * módulo que arrastra cualquier otro de MathJax— lo importa. En el navegador `require` no
 * existe, así que **importar** MathJax lanzaba `ReferenceError: require is not defined` y se
 * llevaba por delante toda la memoria de cálculo: el diálogo de exportación no podía ni
 * previsualizar ni descargar.
 *
 * Ninguna prueba se enteró, y no por descuido: las 2 900 pruebas corren en Node, donde
 * `require` sí existe y el mismo código funciona. Ésa es exactamente la clase de defecto que
 * un gate sobre el artefacto construido puede ver y una prueba unitaria no.
 *
 * `vite.config.ts` lo arregla definiendo `PACKAGE_VERSION`, con lo que la rama del `eval`
 * queda inalcanzable y el minificador la borra. Esto comprueba que siga borrada.
 *
 * Uso: npm run build && node scripts/check-browser-bundle.mjs
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');

/**
 * Cada patrón es una construcción que, ejecutada en el navegador, lanza. No se buscan los
 * identificadores sueltos (`require`, `__dirname`) porque aparecen legítimamente dentro de
 * cadenas y comentarios; se busca la forma que de verdad se evalúa.
 *
 * Las tres comillas importan: el minificador reescribe `eval('require')` como
 * ``eval(`require`)``, así que un patrón que sólo aceptara comilla simple y doble daría el
 * bundle por limpio justo en el artefacto que se publica.
 */
const QUOTE = "['\"`]";
const evalOf = (identifier) => new RegExp(`eval\\(\\s*${QUOTE}${identifier}${QUOTE}\\s*\\)`);

const FORBIDDEN = [
  {
    what: 'eval("require")',
    patterns: [evalOf('require')],
    why: 'Resuelve el `require` de CommonJS en tiempo de ejecución; en un módulo ESM del navegador lanza ReferenceError.',
  },
  {
    what: 'eval("__dirname")',
    patterns: [evalOf('__dirname')],
    why: 'Sólo existe en Node; en el navegador lanza ReferenceError.',
  },
];

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  }));
  return nested.flat();
};

try {
  await stat(DIST);
} catch {
  console.error('dist/ no existe; ejecuta npm run build primero.');
  process.exit(1);
}

const files = (await walk(DIST)).filter((file) => /\.(js|mjs)$/.test(file) && !file.endsWith('.map'));
const failures = [];
for (const rule of FORBIDDEN) {
  const carriers = [];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    if (rule.patterns.some((pattern) => pattern.test(source))) {
      carriers.push(path.relative(DIST, file).replaceAll('\\', '/'));
    }
  }
  if (carriers.length) {
    failures.push(`  ${rule.what} en ${carriers.join(', ')}\n      ${rule.why}`);
  }
}

if (failures.length) {
  console.error('El bundle del navegador lleva código que sólo funciona en Node:\n');
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Bundle del navegador limpio: ${files.length} archivos sin construcciones exclusivas de Node.`);
