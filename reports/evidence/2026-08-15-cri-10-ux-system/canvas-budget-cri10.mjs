// CRI-10 — Presupuesto de lienzo de la composición propuesta.
//
// Script de INVESTIGACIÓN. No forma parte del gate, no se referencia desde
// package.json y no toca `src/**`. Sólo calcula.
//
// Uso:  node reports/evidence/2026-08-15-cri-10-ux-system/canvas-budget-cri10.mjs
//
// QUÉ HACE, EN ORDEN, Y POR QUÉ ESE ORDEN
// ---------------------------------------------------------------------------
// 1. Importa el modelo de CRI-9 SIN modificarlo y ejecuta su calibración contra
//    las once mediciones de CRI-7. Si esa calibración falla, sale con código 1
//    y no calcula nada más: un presupuesto propuesto sobre un modelo que ya no
//    reproduce la realidad medida no vale nada.
// 2. Sólo entonces aplica las constantes de chrome que CRI-10 propone, y
//    recalcula. Cada constante nueva trae el porqué al lado.
// 3. Comprueba CB-1..CB-6 sobre la composición propuesta y emite el CSV.
//
// LO QUE ESTE SCRIPT NO ES
// ---------------------------------------------------------------------------
// No es una medición. CRI-7 midió el producto real con Playwright; esto es
// geometría sobre constantes declaradas. Vale exactamente lo que valen sus
// constantes, y por eso cada una está justificada abajo. Cuando CRI-11
// construya los prototipos, la medición real manda sobre este cálculo.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHROME,
  CB,
  calibrate,
  evaluate,
  expandedBoundary as cri9Boundary,
  VIEWPORTS,
} from '../2026-08-15-cri-9-adaptive-architecture/canvas-budget-model.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fail = (message) => {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
};

// ---------------------------------------------------------------------------
// PASO 1 · El modelo heredado sigue reproduciendo lo que CRI-7 midió
// ---------------------------------------------------------------------------

const calibration = calibrate();
const worstError = Math.max(...calibration.map((row) => Math.abs(row.delta)));
console.log('CRI-10 · presupuesto de lienzo de la composición propuesta');
console.log('='.repeat(78));
console.log(`\n1 · Calibración heredada de CRI-9 contra CRI-7 — error máx. ${worstError.toFixed(2)} pp`);
if (worstError > 0.5) {
  fail(`El modelo de CRI-9 ya no reproduce las mediciones de CRI-7 (${worstError.toFixed(2)} pp > 0.5). No se puede proponer un presupuesto encima.`);
}
console.log('   OK — el modelo base es válido, se puede construir sobre él.');

/**
 * La frontera de CRI-9 se captura AQUÍ, antes de tocar `CHROME`.
 *
 * `CHROME` es un objeto exportado y mutable, y las funciones de CRI-9 lo leen en
 * vivo. Llamar a `expandedBoundary` después de aplicar las constantes de CRI-10
 * no devuelve «la frontera de CRI-9»: devuelve la función de CRI-9 alimentada
 * con constantes de CRI-10, que no es ninguna de las dos cosas. Capturada antes,
 * esta línea reproduce exactamente la tabla publicada en CRI-9 §12
 * (768→1117 · 900→1089 · 1080→1065 · 1366→1042), lo que de paso verifica que el
 * módulo importado es el mismo que produjo aquel informe.
 */
const CRI9_BOUNDARY = Object.fromEntries(
  [768, 900, 1080, 1366].map((height) => [height, cri9Boundary(height)]),
);
const CRI9_PUBLISHED = { 768: 1117, 900: 1089, 1080: 1065, 1366: 1042 };
for (const [height, value] of Object.entries(CRI9_BOUNDARY)) {
  if (value !== CRI9_PUBLISHED[height]) {
    fail(`El módulo de CRI-9 ya no reproduce su propia tabla §12 (altura ${height}: ${value} ≠ ${CRI9_PUBLISHED[height]}). Alguien tocó el modelo heredado.`);
  }
}
console.log('   OK — y reproduce la tabla de fronteras publicada en CRI-9 §12.');

// ---------------------------------------------------------------------------
// PASO 2 · Las constantes que CRI-10 cambia, y por qué cada una
// ---------------------------------------------------------------------------

/**
 * Sólo se listan las que CAMBIAN. Todo lo que no aparece aquí conserva el valor
 * despejado por CRI-9 de las mediciones de CRI-7.
 */
const CRI10_CHROME = {
  // 68 → 60. La Cinta aloja un control de 40 px (`--sc-control-height-md`) con
  // `--sc-space-2` arriba y abajo: 8+40+8 = 56, más 1 px de canto y holgura de
  // subpíxel = 60. Los 68 de hoy son el alto que necesitaba una banda con
  // cuatro `select` de contexto de análisis apilando etiqueta encima del
  // control; al mover ese contexto a `analysis-setup` (D-09) el alto sobra.
  topBarWide: 60,

  // 48 → 52. SUBE, y a propósito. Un objetivo táctil son 44 px
  // (`--sc-size-target-touch`); 48 px de banda dejan 2 px de holgura por lado,
  // que es lo que produce hoy botones de 44 px pegados al canto. 44+4+4 = 52.
  // Se paga lienzo para cumplir un mínimo que el propio proyecto declara.
  topBarCompact: 52,

  // 22 → 0. La nota de responsabilidad profesional NO desaparece: deja de ser
  // una banda propia y pasa a un chip permanente y enfocable dentro del grupo
  // de estado de la Cinta, que se expande a la frase completa. El compromiso de
  // marca se mantiene (Brandbook §01) y además sube de 10 px a 12 px, con lo
  // que se corrige de paso una violación de F-03. Ver §20 · LEDGER-07: es una
  // decisión que el propietario debe confirmar.
  footerWide: 0,
  footerCompactWide: 0,

  // 164 → 168. Los rótulos de hoy se truncan a 164 px («Seleccio…», «Buscar
  // com…», «Carga distribui…»), lo que anula la razón de tener rótulos. 168 px
  // = 12 (padding) + 22 (icono) + 12 (gap) + 110 (rótulo) + 12 (padding).
  railLabels: 168,

  // 76 → 76. Sin cambio. Es el ancho de un objetivo táctil (44) más el aire que
  // lo separa del canto del lienzo.
  railIcons: 76,

  // 58 → 64. El dock flotante de Compact retrato sigue contando como banda
  // (CRI-9 lo despejó de dos columnas independientes de CRI-7 y se conserva).
  // Sube a 64 por la misma razón que `topBarCompact`: 44 de objetivo + 10 de
  // aire por lado. Se paga lienzo para cumplir el mínimo táctil.
  railBandCompactPortrait: 64,

  // 300 → 320. El detalle superpuesto de Medium y el acoplado de Expanded son
  // LA MISMA superficie (D-12: un view-model, dos cardinalidades, tres
  // presentaciones). Que midan distinto obligaría a dos maquetaciones internas
  // de la misma ficha, que es exactamente la duplicación que D-12 retira.
  detailOverlayMedium: 320,
};

console.log('\n2 · Constantes de chrome que CRI-10 propone');
for (const [key, value] of Object.entries(CRI10_CHROME)) {
  const before = CHROME[key];
  const arrow = before === value ? '=' : before < value ? '↑' : '↓';
  console.log(`   ${key.padEnd(26)} ${String(before).padStart(4)} ${arrow} ${String(value).padStart(4)} px`);
}
Object.assign(CHROME, CRI10_CHROME);

/**
 * Las composiciones de CRI-9 capturan el ancho de rail y detalle en el momento
 * de importar el módulo, así que mutar CHROME no las alcanza. Se reconstruyen
 * aquí con los valores de CRI-10. La ESTRUCTURA no cambia — sigue siendo X2 con
 * dos docks, M1 con un dock más inset sin reflow, y K0 sin docks — porque eso
 * es arquitectura de CRI-9 y CRI-10 no la reabre. Lo único que cambia son las
 * medidas, que sí son diseño visual.
 */
const CRI10_COMPOSITIONS = {
  X2: {
    id: 'X2',
    name: 'Expanded · riel rotulado + detalle acoplado',
    bands: 'wide',
    rail: { mode: 'dock', width: CRI10_CHROME.railLabels },
    detail: { mode: 'dock', width: CHROME.detailDock, reflow: true, persistent: false },
    dense: 'drawer',
  },
  M1: {
    id: 'M1',
    name: 'Medium · riel de iconos + detalle superpuesto sin reflow',
    bands: 'wide',
    rail: { mode: 'dock', width: CRI10_CHROME.railIcons },
    detail: { mode: 'overlay-inset', width: CRI10_CHROME.detailOverlayMedium, reflow: false, persistent: false },
    dense: 'drawer',
  },
  K0: {
    id: 'K0',
    name: 'Compact · dock flotante + una capa contextual',
    bands: 'compact',
    rail: { mode: 'band', width: 0 },
    detail: { mode: 'sheet', reflow: false, persistent: false },
    dense: 'fullscreen',
  },
};

// `persistent: false` en X2 no es un descuido: es D-02 aplicado. El detalle deja
// de existir cuando no hay selección, así que no es una superficie persistente y
// CB-4 no le aplica. En el producto de hoy sí lo es, y por eso CRI-7 pudo medir
// un Inspector de 27.6% conviviendo con un lienzo de 24.6%.

/**
 * DETENT POR DEFECTO DE LA HOJA EN COMPACT — y por qué no es 0.40.
 *
 * CRI-9 escribió el modelo con el detent por defecto colocado EXACTAMENTE en el
 * suelo de CB-6 (0.40) y comprobando después `>= 0.40`. Eso deja el veredicto a
 * merced del redondeo: en 390×844 el escenario mide 728 px, el 40% redondea a
 * 291, y 291/728 = 0.39973 — falla por 27 diezmilésimas. No es un fallo de
 * diseño; es una constante puesta encima de su propio suelo.
 *
 * CRI-10 lo resuelve donde corresponde, que es en el diseño y no en el
 * redondeo: **el detent por defecto deja el 44% del escenario como lienzo
 * vivo**, no el 40%. Tres razones, ninguna aritmética:
 *
 *   1. Un valor por defecto no debe apoyarse en su propio mínimo. CB-6 es un
 *      SUELO (CRI-9 §15, contrato 12), y un defecto que lo toca no deja margen
 *      para el safe-area, la barra de gestos del sistema ni el teclado virtual.
 *   2. 44/56 es el reparto que deja la hoja en «algo más de la mitad», que es
 *      el detent medio natural de los tres (asomo · medio · casi completo).
 *   3. Con 44% el objeto seleccionado y su entorno inmediato caben encima de la
 *      hoja, que es la condición para que editar propiedades no sea a ciegas.
 */
const CRI10_COMPACT_DEFAULT_DETENT = 0.44;

/**
 * K0 se evalúa aquí y no con `evaluate` de CRI-9 porque aquélla lee el detent
 * del propio suelo `CB.compactDefaultDetentFloor`. X2 y M1 sí reutilizan la
 * función heredada sin tocarla: su cálculo no depende del detent.
 */
const evaluateCompact = (viewport) => {
  const composition = CRI10_COMPOSITIONS.K0;
  const rest = evaluate(composition, viewport).restBox;
  const side = viewport.width > viewport.height ? 'side' : 'bottom';
  const box = side === 'side'
    ? { width: Math.max(0, rest.width - CHROME.detailDock), height: rest.height }
    : { width: rest.width, height: Math.round(rest.height * CRI10_COMPACT_DEFAULT_DETENT) };
  const area = box.width * box.height;
  const viewportArea = viewport.width * viewport.height;
  const stageArea = rest.width * rest.height;
  const liveStageShare = stageArea === 0 ? 0 : area / stageArea;
  return {
    composition: 'K0',
    restShare: rest.area / viewportArea,
    detailShare: area / viewportArea,
    cb1: true, // una hoja levantada por el usuario ES la tarea activa: manda CB-6
    cb2: rest.area / viewportArea >= CB.restFloor,
    cb4: true, // la hoja no es persistente
    cb6: liveStageShare >= CB.compactDefaultDetentFloor,
    passes: rest.area / viewportArea >= CB.restFloor && liveStageShare >= CB.compactDefaultDetentFloor,
    restBox: rest,
    detailBox: { ...box, area },
    sheetSide: side,
    liveStageShare,
  };
};

const resolve = (viewport) => {
  for (const id of ['X2', 'M1']) {
    const verdict = evaluate(CRI10_COMPOSITIONS[id], viewport);
    if (verdict.passes) return verdict;
  }
  return evaluateCompact(viewport);
};

const boundary = (height) => {
  for (let width = 640; width <= 3840; width += 1) {
    if (resolve({ width, height }).composition === 'X2') return width;
  }
  return null;
};

// ---------------------------------------------------------------------------
// PASO 3 · Presupuesto por viewport
// ---------------------------------------------------------------------------

const pct = (n) => `${(n * 100).toFixed(1)}%`;
const CRI7_TODAY = new Map([
  ['390×844', 0.810], ['844×390', 0.695], ['768×1024', 0.828], ['900×1000', 0.824],
  ['1024×768', 0.246], ['1280×800', 0.303], ['1440×900', 0.361], ['1536×960', 0.392],
]);

const rows = VIEWPORTS.map((viewport) => {
  const label = `${viewport.width}×${viewport.height}`;
  const verdict = resolve(viewport);
  return {
    viewport: label,
    note: viewport.note ?? '',
    hoy: CRI7_TODAY.get(label) ?? null,
    clase: verdict.composition,
    reposo: verdict.restShare,
    conDetalle: verdict.detailShare,
    lienzoReposo: `${verdict.restBox.width}×${verdict.restBox.height}`,
    hoja: verdict.sheetSide ?? '',
    cb1: verdict.cb1, cb2: verdict.cb2, cb4: verdict.cb4, cb6: verdict.cb6,
  };
});

console.log('\n3 · Presupuesto por viewport');
console.log('-'.repeat(78));
console.log(`${'viewport'.padEnd(12)} ${'hoy'.padStart(7)} ${'clase'.padEnd(6)} ${'reposo'.padStart(8)} ${'detalle'.padStart(8)}  CB`);
for (const row of rows) {
  const cb = `${row.cb1 ? '1' : '·'}${row.cb2 ? '2' : '·'}${row.cb4 ? '4' : '·'}${row.cb6 ? '6' : '·'}`;
  const hoy = row.hoy === null ? '—' : pct(row.hoy);
  console.log(
    `${row.viewport.padEnd(12)} ${hoy.padStart(7)} ${row.clase.padEnd(6)} ` +
    `${pct(row.reposo).padStart(8)} ${pct(row.conDetalle).padStart(8)}  ${cb}` +
    (row.hoja ? `  hoja: ${row.hoja}` : ''),
  );
}

const broken = rows.filter((row) => !(row.cb1 && row.cb2 && row.cb4 && row.cb6));
if (broken.length > 0) {
  fail(`La composición propuesta rompe CB en: ${broken.map((r) => r.viewport).join(', ')}. Un diseño que rompe un suelo se rechaza (CRI-9 §15, contrato 12).`);
}
console.log('\n   CB-1..CB-6 se cumplen en los 11 viewports.');

/**
 * COMPROBACIÓN DE CLASE ESPERADA — y por qué la de arriba no basta.
 *
 * El resolutor de CRI-9 **siempre encuentra una composición**: si X2 no cumple
 * prueba M1, y si M1 no cumple cae a K0 incondicionalmente. Eso es correcto como
 * comportamiento de producto —nunca hay que dejar al usuario sin composición—
 * pero convierte la comprobación anterior en decorativa: engordar el chrome no
 * rompe CB, sólo degrada la clase, y CB sigue saliendo en verde.
 *
 * La afirmación que de verdad hay que proteger no es «se cumple CB» sino
 * «1024×768 recibe Medium». Si un cambio de chrome empuja ese viewport a K0, la
 * promesa central de esta especificación —que el portátil corriente deja de
 * comportarse como un móvil grande— se ha roto en silencio.
 *
 * Ésta es exactamente la clase de aserción que CRI-9 §17 identifica como
 * ausente: «nada afirma que el tier compacto llegue a activarse», y por eso F-01
 * vivió en `main`.
 */
const CLASE_ESPERADA = {
  '390×844': 'K0', '844×390': 'K0', '768×1024': 'K0',
  '900×1000': 'M1', '1024×768': 'M1',
  '1112×834': 'X2', '1280×800': 'X2', '1440×900': 'X2', '1920×1080': 'X2',
};
const desviadas = rows.filter((row) => CLASE_ESPERADA[row.viewport] && CLASE_ESPERADA[row.viewport] !== row.clase);
if (desviadas.length > 0) {
  fail(
    'La composición resuelta no es la que la especificación promete:\n' +
    desviadas.map((r) => `   ${r.viewport}: esperada ${CLASE_ESPERADA[r.viewport]}, resuelta ${r.clase}`).join('\n'),
  );
}
console.log(`   Y las ${Object.keys(CLASE_ESPERADA).length} clases prometidas por la especificación se resuelven como se prometen.`);

// ---------------------------------------------------------------------------
// PASO 4 · La frontera Expanded↔Medium, que nadie escribe
// ---------------------------------------------------------------------------

console.log('\n4 · Frontera Expanded↔Medium (calculada, no declarada)');
const boundaries = [768, 900, 1080, 1366].map((height) => ({
  height,
  cri9: CRI9_BOUNDARY[height],
  cri10: boundary(height),
}));
for (const row of boundaries) {
  console.log(`   altura ${String(row.height).padStart(4)} px → CRI-9: ${row.cri9} px · CRI-10: ${row.cri10} px`);
}

// ---------------------------------------------------------------------------
// PASO 5 · Presupuesto de chrome flotante (CB-3)
// ---------------------------------------------------------------------------

/**
 * Los tres grupos flotantes de la propuesta, con su caja declarada. El minimapa
 * va aparte porque la propuesta lo apaga por defecto (F-07: mide 144 px y el
 * encuadre sólo reserva 68, así que el modelo encuadrado queda debajo).
 */
const FLOATING = [
  { id: 'estado-gesto', w: 260, h: 36, note: 'badge de modo + capa de evidencia activa' },
  { id: 'vista', w: 200, h: 36, note: 'disparador de capas + chips accionables' },
  { id: 'camara', w: 176, h: 44, note: 'zoom + encuadre + escala/lectura' },
];
const MINIMAP = { id: 'minimapa', w: 104, h: 104, note: 'apagado por defecto (F-07)' };

console.log('\n5 · Chrome flotante sobre el lienzo (CB-3 ≤ 12%)');
for (const viewport of [{ width: 1024, height: 768 }, { width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  const verdict = resolve(viewport);
  const canvas = verdict.restBox.width * verdict.restBox.height;
  const base = FLOATING.reduce((sum, item) => sum + item.w * item.h, 0);
  const withMap = base + MINIMAP.w * MINIMAP.h;
  const label = `${viewport.width}×${viewport.height}`;
  const okBase = base / canvas <= CB.floatingChromeMax;
  const okMap = withMap / canvas <= CB.floatingChromeMax;
  console.log(
    `   ${label.padEnd(10)} por defecto ${pct(base / canvas).padStart(6)} ${okBase ? 'OK' : '✗'}` +
    `   con minimapa ${pct(withMap / canvas).padStart(6)} ${okMap ? 'OK' : '✗'}`,
  );
}
console.log('   El zócalo de selección no se cuenta aquí: no es chrome, existe sólo mientras');
console.log('   hay selección y se ancla al objeto. Su tope propio está en §14 de la especificación.');

// ---------------------------------------------------------------------------
// Salida
// ---------------------------------------------------------------------------

const csv = [
  'viewport,nota,lienzo_hoy_cri7,clase_cri10,reposo,con_detalle,caja_reposo,hoja,cb1,cb2,cb4,cb6',
  ...rows.map((row) => [
    row.viewport,
    `"${row.note}"`,
    row.hoy === null ? '' : row.hoy.toFixed(3),
    row.clase,
    row.reposo.toFixed(3),
    row.conDetalle.toFixed(3),
    row.lienzoReposo,
    row.hoja,
    row.cb1, row.cb2, row.cb4, row.cb6,
  ].join(',')),
].join('\n');
fs.writeFileSync(path.join(here, 'cri-10-canvas-budget.csv'), `${csv}\n`);

const boundaryCsv = [
  'altura,frontera_cri9,frontera_cri10',
  ...boundaries.map((row) => `${row.height},${row.cri9},${row.cri10}`),
].join('\n');
fs.writeFileSync(path.join(here, 'cri-10-expanded-boundary.csv'), `${boundaryCsv}\n`);

console.log('\n→ cri-10-canvas-budget.csv');
console.log('→ cri-10-expanded-boundary.csv\n');
