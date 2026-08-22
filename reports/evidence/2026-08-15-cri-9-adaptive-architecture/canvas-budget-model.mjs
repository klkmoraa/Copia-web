/**
 * CRI-9 · Modelo geométrico de canvas-budget y resolutor de composición.
 *
 * QUÉ ES: una función pura que, dado un viewport, calcula qué composición cabe
 * sin romper las reglas CB-1..CB-6 del informe CRI-9. No lee `src/**`, no
 * ejecuta la app y no mide nada: es un modelo con constantes declaradas.
 *
 * POR QUÉ ES CREÍBLE: sus constantes están calibradas contra las mediciones
 * reales de CRI-7 §2 (Playwright sobre la app construida). Al ejecutarlo, lo
 * primero que imprime es la calibración: reproduce las once cifras publicadas
 * por CRI-7 para la composición ACTUAL con error < 0.5 puntos porcentuales, y
 * sale con código 1 si no lo consigue. Si esa comprobación falla, el modelo no
 * debe usarse para decidir nada.
 *
 * QUÉ NO ES: no predice el «lienzo útil» (el hueco menos el chrome flotante).
 * El chrome flotante se trata aparte, con la regla CB-3, porque su tamaño es
 * fijo en px y su peso relativo depende del lienzo resultante.
 */

// ---------------------------------------------------------------------------
// 1. Constantes de chrome, despejadas de las mediciones de CRI-7 §2
// ---------------------------------------------------------------------------

/**
 * Cada constante trae el cálculo que la despeja desde un porcentaje publicado
 * por CRI-7, para que se pueda auditar sin volver a correr Playwright.
 */
export const CHROME = {
  // 8.9% de 1024×768 = 69 985 px² / 1024 = 68.3 px  ·  7.6% de 1440×900 → 68.4 px
  topBarWide: 68,
  // 5.7% de 390×844 = 18 762 px² / 390 = 48.1 px
  topBarCompact: 48,
  // 2.9% de 1024×768 = 22 806 px² / 1024 = 22.3 px
  footerWide: 22,
  // Despejado de 768×1024 y 900×1000: ambos exigen 16 px más de chrome que los
  // móviles estrechos. La nota legal aparece por encima de ~700 px de ancho.
  footerCompactWide: 16,
  footerCompactNarrow: 0,
  // 14.1% de 1024×768 = 110 887 px² / (768−68−22) = 163.6 px
  railLabels: 164,
  // Declarado por styles.css:979 y :1851 para 1024–1439; hoy código muerto (F-01)
  railIcons: 76,
  // 6.9% de 390×844 = 22 712 px² / 390 = 58.2 px. Banda horizontal fija, y sólo
  // en retrato: en 844×390 las cifras de CRI-7 sólo cuadran sin esta banda, y su
  // columna de chrome flotante confirma el otro lado del mismo hecho (14.5% del
  // lienzo, el máximo de los once viewports). Dos columnas independientes
  // coinciden, así que la condición de orientación es dato, no ajuste.
  railBandCompactPortrait: 58,
  // DEFAULT_INSPECTOR_WIDTH · useWorkspaceLayoutPreferences.ts:17
  detailDock: 320,
  // MIN_INSPECTOR_WIDTH = 280 · ancho propuesto para el detalle superpuesto en Medium
  detailOverlayMedium: 300,
  // 22.0% de 1024×768 = 173 015 px² / 540 = 320.4 px (alto reservado siempre)
  resultsDockToday: 320,
  // ResultsPanel.tsx:339 — altura del modo `compact`
  resultsDockCompactMode: 190,
  // 6.4% de 390×844 = 21 066 px² / 390 = 54.0 px (banda colapsada)
  resultsCollapsedBand: 54,
};

/** Suelos de la regla de canvas-budget. Ver CRI-9 §12 para su justificación. */
export const CB = {
  /** CB-1 · coexistencia: docks y superposiciones que conviven con el trabajo. */
  coexistenceFloor: 0.50,
  /** CB-2 · reposo: sin ninguna superficie auxiliar invocada. */
  restFloor: 0.70,
  /** CB-3 · chrome flotante sobre el lienzo. */
  floatingChromeMax: 0.12,
  /** CB-6 · detent por defecto en Compact: lienzo vivo mínimo. */
  compactDefaultDetentFloor: 0.40,
};

// ---------------------------------------------------------------------------
// 2. Composiciones: las únicas tres que el resolutor puede producir
// ---------------------------------------------------------------------------

/**
 * `reflow: true`  → el detalle resta ancho al lienzo y éste se recompone.
 * `reflow: false` → se superpone; el lienzo conserva su caja y su cámara, y lo
 *                   que se reduce es el rectángulo seguro. Lo que se mide
 *                   entonces es lienzo VISIBLE, no lienzo asignado.
 */
export const COMPOSITIONS = {
  X2: {
    id: 'X2',
    name: 'Expanded · dos docks laterales',
    bands: 'wide',
    rail: { mode: 'dock', width: CHROME.railLabels },
    detail: { mode: 'dock', width: CHROME.detailDock, reflow: true, persistent: true },
    dense: 'drawer',
  },
  M1: {
    id: 'M1',
    name: 'Medium · un dock lateral + detalle superpuesto',
    bands: 'wide',
    rail: { mode: 'dock', width: CHROME.railIcons },
    detail: { mode: 'overlay-inset', width: CHROME.detailOverlayMedium, reflow: false, persistent: false },
    dense: 'drawer',
  },
  K0: {
    id: 'K0',
    name: 'Compact · cero docks, capa contextual única',
    bands: 'compact',
    rail: { mode: 'band', width: 0 },
    detail: { mode: 'sheet', reflow: false, persistent: false },
    dense: 'fullscreen',
  },
};

/** Composición ACTUAL del producto. Existe sólo para calibrar contra CRI-7. */
const todayBands = (viewport, tier) => {
  if (tier === 'expanded') {
    return { top: CHROME.topBarWide, bottom: CHROME.footerWide, extra: CHROME.resultsDockToday };
  }
  const portrait = viewport.height > viewport.width;
  return {
    top: CHROME.topBarCompact,
    bottom: viewport.width >= 700 ? CHROME.footerCompactWide : CHROME.footerCompactNarrow,
    extra: CHROME.resultsCollapsedBand + (portrait ? CHROME.railBandCompactPortrait : 0),
  };
};

// ---------------------------------------------------------------------------
// 3. El cálculo
// ---------------------------------------------------------------------------

const bands = (composition, viewport) => {
  if (composition.bands === 'wide') {
    return { top: CHROME.topBarWide, bottom: CHROME.footerWide, extra: 0 };
  }
  const portrait = viewport.height > viewport.width;
  return {
    top: CHROME.topBarCompact,
    bottom: viewport.width >= 700 ? CHROME.footerCompactWide : CHROME.footerCompactNarrow,
    // El dock de herramientas sigue siendo banda en retrato: es lo que hoy
    // funciona bien y CRI-7 §6 pide conservarlo. La banda de Results desaparece
    // (D-03): su estado sube al chip de la TopBar.
    extra: portrait ? CHROME.railBandCompactPortrait : 0,
  };
};

const stageHeight = (composition, viewport, resultsHeight = 0) => {
  const band = bands(composition, viewport);
  return Math.max(0, viewport.height - band.top - band.bottom - band.extra - resultsHeight);
};

/**
 * Lado por el que llega la hoja en Compact. Es una consecuencia del modelo, no
 * una preferencia: en apaisado una hoja inferior deja el lienzo por debajo de
 * cualquier suelo utilizable, así que la hoja llega por el lado.
 */
export const compactSheetSide = (viewport) => (viewport.width > viewport.height ? 'side' : 'bottom');

/**
 * Área de lienzo visible, en px².
 * `detailPresent: false` → reposo (CB-2); `true` → con la superficie contextual.
 */
export const canvasArea = (composition, viewport, { detailPresent = false, resultsHeight = 0 } = {}) => {
  const height = stageHeight(composition, viewport, resultsHeight);
  const railWidth = composition.rail.mode === 'dock' ? composition.rail.width : 0;
  let width = viewport.width - railWidth;
  let visibleHeight = height;

  if (detailPresent) {
    if (composition.detail.mode === 'dock' || composition.detail.mode === 'overlay-inset') {
      width -= composition.detail.width;
    } else if (compactSheetSide(viewport) === 'side') {
      width -= CHROME.detailDock;
    } else {
      // Detent por defecto en Compact retrato: la hoja toma el 60% y deja el 40%.
      visibleHeight = Math.round(height * CB.compactDefaultDetentFloor);
    }
  }
  width = Math.max(0, width);
  visibleHeight = Math.max(0, visibleHeight);
  return { width, height: visibleHeight, area: width * visibleHeight };
};

const share = (area, viewport) => area / (viewport.width * viewport.height);

/** Área de la superficie de detalle, para CB-4. */
const detailArea = (composition, viewport) => {
  const height = stageHeight(composition, viewport);
  if (composition.detail.mode !== 'sheet') return composition.detail.width * height;
  return compactSheetSide(viewport) === 'side'
    ? CHROME.detailDock * height
    : viewport.width * Math.round(height * (1 - CB.compactDefaultDetentFloor));
};

/**
 * Evalúa una composición.
 *
 * CB-1 sólo se exige a superficies que COEXISTEN con el trabajo sobre el
 * lienzo: docks e insets. Una hoja que el usuario levanta explícitamente es la
 * tarea activa, y ahí manda CB-6, no CB-1. Sostener CB-1 sobre una hoja de
 * Compact sería dogma, no presupuesto.
 * CB-4 sólo se exige a superficies persistentes, por la misma razón.
 */
export const evaluate = (composition, viewport, { resultsHeight = 0 } = {}) => {
  const rest = canvasArea(composition, viewport, { detailPresent: false, resultsHeight });
  const withDetail = canvasArea(composition, viewport, { detailPresent: true, resultsHeight });
  const restShare = share(rest.area, viewport);
  const detailShare = share(withDetail.area, viewport);
  const coexists = composition.detail.mode === 'dock' || composition.detail.mode === 'overlay-inset';
  const cb1 = coexists ? detailShare >= CB.coexistenceFloor : true;
  const cb2 = restShare >= CB.restFloor;
  const cb4 = composition.detail.persistent ? detailArea(composition, viewport) <= withDetail.area : true;
  // CB-6 se mide contra el escenario (viewport menos bandas fijas), no contra el
  // viewport: la hoja no puede reclamar el espacio que la TopBar ya ocupaba.
  const stage = stageHeight(composition, viewport, resultsHeight);
  const liveStageShare = stage === 0 ? 0 : withDetail.area / ((viewport.width - (composition.rail.mode === 'dock' ? composition.rail.width : 0)) * stage);
  const cb6 = coexists ? true : liveStageShare >= CB.compactDefaultDetentFloor;
  return {
    composition: composition.id,
    restShare,
    detailShare,
    cb1,
    cb2,
    cb4,
    cb6,
    passes: cb1 && cb2 && cb4 && cb6,
    restBox: rest,
    detailBox: withDetail,
    sheetSide: composition.detail.mode === 'sheet' ? compactSheetSide(viewport) : null,
  };
};

/**
 * El resolutor: elige la composición MÁS RICA que cumple CB. El orden es
 * deliberado — más docks persistentes primero — porque la clase de espacio es
 * la SALIDA del presupuesto, no una etiqueta de ancho de entrada. Ahí muere el
 * acantilado 1023↔1024 de F-01: nadie declara el umbral, se calcula.
 */
export const resolveComposition = (viewport, { resultsHeight = 0 } = {}) => {
  for (const id of ['X2', 'M1', 'K0']) {
    const verdict = evaluate(COMPOSITIONS[id], viewport, { resultsHeight });
    if (verdict.passes) return verdict;
  }
  return evaluate(COMPOSITIONS.K0, viewport, { resultsHeight });
};

/**
 * ¿Cabe fijar (pin) el dock de datos densos sin romper CB?
 *
 * CB-2 gobierna el reposo POR DEFECTO. Un pin es un acto explícito del usuario,
 * así que puede gastar hasta CB-1; lo que no puede es cruzarlo. Por eso aquí se
 * comprueban CB-1 y CB-4, no CB-2.
 */
export const denseDockAffordable = (viewport) => {
  if (resolveComposition(viewport).composition !== 'X2') return false;
  const pinned = evaluate(COMPOSITIONS.X2, viewport, { resultsHeight: CHROME.resultsDockCompactMode });
  return pinned.cb1 && pinned.cb4;
};

/**
 * Frontera Expanded↔Medium para una altura dada, por barrido. Se publica para
 * que nadie tenga que creerse un umbral: se recalcula.
 */
export const expandedBoundary = (height) => {
  for (let width = 640; width <= 3840; width += 1) {
    if (resolveComposition({ width, height }).composition === 'X2') return width;
  }
  return null;
};

// ---------------------------------------------------------------------------
// 4. Calibración contra CRI-7 §2 — si esto falla, el modelo no vale
// ---------------------------------------------------------------------------

/** Cifras publicadas por CRI-7 §2, columna «canvas % vp». */
export const CRI7_MEASURED = [
  { label: '320×568', width: 320, height: 568, tier: 'compact', canvasPct: 71.8, usefulPct: 63.0 },
  { label: '360×800', width: 360, height: 800, tier: 'compact', canvasPct: 80.0, usefulPct: 74.4 },
  { label: '375×667', width: 375, height: 667, tier: 'compact', canvasPct: 76.0, usefulPct: 69.6 },
  { label: '390×844', width: 390, height: 844, tier: 'compact', canvasPct: 81.0, usefulPct: 76.2 },
  { label: '844×390', width: 844, height: 390, tier: 'compact', canvasPct: 69.5, usefulPct: 59.4 },
  { label: '768×1024', width: 768, height: 1024, tier: 'compact', canvasPct: 82.8, usefulPct: 78.6 },
  { label: '900×1000', width: 900, height: 1000, tier: 'compact', canvasPct: 82.4, usefulPct: 78.1 },
  { label: '1024×768', width: 1024, height: 768, tier: 'expanded', canvasPct: 24.6, usefulPct: 20.3 },
  { label: '1280×800', width: 1280, height: 800, tier: 'expanded', canvasPct: 30.3, usefulPct: 26.7 },
  { label: '1440×900', width: 1440, height: 900, tier: 'expanded', canvasPct: 36.1, usefulPct: 33.3 },
  { label: '1536×960', width: 1536, height: 960, tier: 'expanded', canvasPct: 39.2, usefulPct: 36.7 },
];

/** Reproduce la composición ACTUAL, para comparar con lo que CRI-7 midió. */
export const modelToday = (viewport, tier) => {
  const band = todayBands(viewport, tier);
  const railWidth = tier === 'expanded' ? CHROME.railLabels : 0;
  const detailWidth = tier === 'expanded' ? CHROME.detailDock : 0;
  const width = viewport.width - railWidth - detailWidth;
  const height = viewport.height - band.top - band.bottom - band.extra;
  return (width * height) / (viewport.width * viewport.height);
};

export const calibrate = () => CRI7_MEASURED.map((row) => {
  const modelled = modelToday(row, row.tier) * 100;
  return { ...row, modelled, delta: modelled - row.canvasPct };
});

// ---------------------------------------------------------------------------
// 5. Salida
// ---------------------------------------------------------------------------

export const VIEWPORTS = [
  { label: '320×568 · móvil mínimo', width: 320, height: 568 },
  { label: '360×800 · móvil', width: 360, height: 800 },
  { label: '375×667 · móvil', width: 375, height: 667 },
  { label: '390×844 · móvil', width: 390, height: 844 },
  { label: '844×390 · móvil apaisado', width: 844, height: 390 },
  { label: '768×1024 · tablet retrato', width: 768, height: 1024 },
  { label: '900×1000 · split-screen', width: 900, height: 1000 },
  { label: '1024×1366 · tablet grande retrato', width: 1024, height: 1366 },
  { label: '1024×768 · portátil corriente', width: 1024, height: 768 },
  { label: '1112×834 · tablet apaisada', width: 1112, height: 834 },
  { label: '1180×820 · tablet grande apaisada', width: 1180, height: 820 },
  { label: '1280×800', width: 1280, height: 800 },
  { label: '1366×768', width: 1366, height: 768 },
  { label: '1440×900', width: 1440, height: 900 },
  { label: '1536×960', width: 1536, height: 960 },
  { label: '1920×1080', width: 1920, height: 1080 },
  { label: '2560×1440', width: 2560, height: 1440 },
];

export const budgetTable = () => VIEWPORTS.map((viewport) => {
  const verdict = resolveComposition(viewport);
  const today = CRI7_MEASURED.find((row) => row.width === viewport.width && row.height === viewport.height);
  return {
    viewport: viewport.label,
    width: viewport.width,
    height: viewport.height,
    todayTier: today ? (today.tier === 'expanded' ? 'Expanded' : 'Compact') : '—',
    todayCanvasPct: today ? today.canvasPct : null,
    resolved: verdict.composition,
    restPct: +(verdict.restShare * 100).toFixed(1),
    detailPct: +(verdict.detailShare * 100).toFixed(1),
    canvasBox: `${verdict.detailBox.width}×${verdict.detailBox.height}`,
    sheetSide: verdict.sheetSide ?? '—',
    denseDockPinnable: denseDockAffordable(viewport),
    deltaVsToday: today ? +(verdict.restShare * 100 - today.canvasPct).toFixed(1) : null,
  };
});

const invokedDirectly = process.argv[1]?.endsWith('canvas-budget-model.mjs');
if (invokedDirectly) {
  const rows = calibrate();
  const worst = Math.max(...rows.map((row) => Math.abs(row.delta)));
  console.log('CALIBRACIÓN — modelo vs CRI-7 §2 (composición ACTUAL del producto)\n');
  console.log('viewport      tier       CRI-7 %   modelo %        Δ');
  for (const row of rows) {
    console.log(
      `${row.label.padEnd(13)} ${row.tier.padEnd(9)} ${row.canvasPct.toFixed(1).padStart(8)}  ${row.modelled.toFixed(1).padStart(9)}  ${(row.delta >= 0 ? '+' : '') + row.delta.toFixed(2)}`.padEnd(10),
    );
  }
  console.log(`\nerror máximo: ${worst.toFixed(2)} puntos porcentuales`);
  if (worst > 0.5) {
    console.error('\nFALLO: el modelo no reproduce las mediciones de CRI-7 dentro de 0.5 pp.');
    process.exit(1);
  }
  console.log('OK — el modelo reproduce las once mediciones; sus predicciones son auditables.');

  console.log('\n\nRESOLUTOR — composición que CB permite, y lienzo resultante\n');
  console.log('viewport                            hoy         hoy%  →  resuelve  reposo%  c/detalle%  lienzo        hoja   dock denso');
  for (const row of budgetTable()) {
    console.log(
      `${row.viewport.padEnd(35)} ${row.todayTier.padEnd(10)} ${String(row.todayCanvasPct ?? '—').padStart(5)}  →  ${row.resolved.padEnd(8)} ${String(row.restPct).padStart(6)}  ${String(row.detailPct).padStart(10)}  ${row.canvasBox.padEnd(13)} ${String(row.sheetSide).padEnd(6)} ${row.denseDockPinnable ? 'sí' : 'no'}`,
    );
  }

  console.log('\n\nFRONTERA Expanded↔Medium — ancho mínimo para X2 según la altura\n');
  for (const height of [720, 768, 800, 834, 900, 960, 1024, 1080, 1200, 1366]) {
    console.log(`  altura ${String(height).padStart(4)} px  →  Expanded desde ${expandedBoundary(height)} px de ancho`);
  }
  console.log('\nNinguno de esos umbrales está escrito en el modelo: todos salen de CB.');
}
