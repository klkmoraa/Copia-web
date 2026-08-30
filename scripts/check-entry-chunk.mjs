#!/usr/bin/env node
/**
 * El reparto en chunks: qué entra en la primera pintada, y qué viaja junto a qué.
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
  /**
   * `fflate` entró en la carga inicial por una sola importación estática:
   * `App.tsx` traía `decodeProjectFragment` de `utils/shareLink`, y ése importa
   * el compresor. El compresor entero —33 081 bytes, 12 720 gzip— viajaba en la
   * primera pintada por una rama que `if (!fragment) return;` descarta en casi
   * todos los arranques. Ahora se pide con `import()` dentro del efecto.
   *
   * El centinela es la tabla de errores de su descompresor, que el minificador
   * conserva porque son cadenas que se emiten en tiempo de ejecución.
   */
  {
    what: 'el compresor fflate',
    text: 'invalid length/literal',
    why: 'Sólo hace falta para leer un enlace compartido o un expediente portable; ambos lo piden con import().',
  },
];

/**
 * Lo anterior vigila qué entra en la **primera pintada**. Esto vigila otra cosa:
 * qué viaja **junto a** qué, entre chunks que los dos son diferidos.
 *
 * Nace de un caso concreto: `utils/portableBundle.ts` importaba
 * `createCalculationReport` de forma estática, y esa cadena llega hasta MathJax.
 * Sólo lo necesita `createPortableBundle` —exportar—; `readPortableBundle`
 * —importar— descomprime y valida sin tocarlo. Con el import estático, abrir un
 * expediente ajeno descargaba 1 817 093 bytes (624 654 gzip) de tipografiador
 * matemático para no usarlo. Diferirlo lo dejó en 9 975 (4 105 gzip).
 *
 * El gate de arriba **no** puede ver esta regresión: MathJax estaba diferido antes
 * y seguiría diferido después. Lo que hay que afirmar es que las dos rutas no
 * comparten archivo.
 */
const SEPARATIONS = [
  {
    what: 'la ruta de importar un .structureco',
    text: 'no es un paquete ZIP valido',
    awayFrom: 'MathJax',
    otherText: 'MathJax retry',
    why: 'readPortableBundle no tipografía nada; createCalculationReport se pide con import() desde createPortableBundle.',
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

for (const rule of SEPARATIONS) {
  const carriers = [];
  const others = [];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const name = path.relative(DIST, file).replaceAll('\\', '/');
    if (source.includes(rule.text)) carriers.push(name);
    if (source.includes(rule.otherText)) others.push(name);
  }
  if (carriers.length === 0 || others.length === 0) {
    failures.push(`  ${rule.what}: uno de los dos centinelas no aparece en el build. ¿Cambió el texto?`);
    continue;
  }
  const shared = carriers.filter((name) => others.includes(name));
  if (shared.length) {
    failures.push(`  ${rule.what} arrastra ${rule.awayFrom}: ${shared.join(', ')}\n      ${rule.why}`);
    continue;
  }
  found.push(`  ${rule.what}: ${carriers.join(', ')} — sin ${rule.awayFrom} (${others.join(', ')})`);
}

if (failures.length) {
  // El script vigila dos cosas —qué entra en la primera pintada y qué viaja junto
  // a qué—, así que la cabecera no puede hablar sólo de la carga inicial.
  console.error('El reparto en chunks no cumple lo declarado:\n');
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Reparto en chunks correcto:');
console.log(found.join('\n'));
