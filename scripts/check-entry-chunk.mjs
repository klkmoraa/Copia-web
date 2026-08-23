#!/usr/bin/env node
/**
 * El chunk de entrada no carga lo que la primera pintada no necesita.
 *
 * Este gate nace de una medición concreta: hasta 2026-08-23 los catálogos
 * español **e inglés** vivían en el mismo archivo, y como `useI18n` lo importa,
 * los dos viajaban en `dist/assets/index-*.js`. Un usuario en español
 * descargaba 109 920 bytes (30 502 gzip) de inglés antes de ver nada.
 *
 * Partirlo arregló el síntoma; sin gate, un `import` estático de `catalogEn`
 * escrito por distracción lo devuelve entero y **ninguna prueba se entera**:
 * la aplicación funciona igual, sólo que más lenta. Por eso lo que se vigila
 * no es un número de bytes sino la ubicación: el texto inglés tiene que estar
 * en un archivo que la primera pintada no pide.
 *
 * Un presupuesto en bytes no serviría aquí — `check-performance-budget.mjs`
 * declara techo infinito a propósito—; esto es una afirmación sobre qué
 * contiene qué, y se cumple o no se cumple.
 *
 * Uso: npm run build && node scripts/check-entry-chunk.mjs
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');

/**
 * Cada centinela es una cadena que **sólo** puede existir si el módulo entero
 * entró en el archivo. Se eligen literales largos y propios: un identificador
 * corto podría aparecer por casualidad en otro chunk y dar una falsa alarma.
 */
const SENTINELS = [
  {
    what: 'el catálogo inglés',
    text: 'structureCo is an educational support tool.',
    why: 'El español es la reserva de translate(); el inglés se pide con loadCatalog() desde useI18n.',
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

const html = await readFile(path.join(DIST, 'index.html'), 'utf8');
const files = (await walk(DIST)).filter((file) => /\.(js|mjs)$/.test(file));

const failures = [];
const found = [];
for (const sentinel of SENTINELS) {
  const carriers = [];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    if (!source.includes(sentinel.text)) continue;
    const name = path.relative(DIST, file).replaceAll('\\', '/');
    // Misma definición de «inicial» que measure-performance.mjs: lo que
    // index.html referencia o precarga es lo que el navegador pide para pintar.
    carriers.push({ name, eager: html.includes(path.basename(file)) });
  }
  if (carriers.length === 0) {
    failures.push(`  ${sentinel.what}: no aparece en ningún archivo del build. ¿Cambió el texto centinela?`);
    continue;
  }
  const eager = carriers.filter((carrier) => carrier.eager);
  if (eager.length) {
    failures.push(`  ${sentinel.what} viaja en la carga inicial: ${eager.map((c) => c.name).join(', ')}\n      ${sentinel.why}`);
    continue;
  }
  found.push(`  ${sentinel.what}: ${carriers.map((c) => c.name).join(', ')} (diferido)`);
}

if (failures.length) {
  console.error('El chunk de entrada carga cosas que la primera pintada no necesita:\n');
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Chunk de entrada limpio:');
console.log(found.join('\n'));
