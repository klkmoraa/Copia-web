// CRI-7 — Auditoría UX integral de StructureCo.
//
// Script de INVESTIGACIÓN. No forma parte del gate del repositorio, no se
// referencia desde package.json y no modifica producción: sólo abre la app ya
// construida en `dist/`, la recorre en varios viewports y escribe evidencia
// (capturas + métricas JSON) bajo esta misma carpeta.
//
// Uso:  npm run build && node reports/evidence/2026-08-14-cri-7-ux-audit/audit-ux.mjs
//
// Mide, por flujo × viewport:
//   - canvas-budget: área útil del modelo vs. chrome fijo vs. chrome flotante.
//   - objetivos táctiles por debajo del mínimo declarado del propio proyecto.
//   - texto por debajo de 11px.
//   - desbordamiento horizontal del documento.
//   - anillo de foco visible al recorrer con teclado.
//   - radios de borde en uso, contra la escala del Brandbook Clay.
//   - solapamiento entre controles flotantes sobre el lienzo.

import { chromium } from 'playwright';
import { preview } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..', '..');
const shotsDir = path.join(here, 'shots');
fs.mkdirSync(shotsDir, { recursive: true });

const EXECUTABLE = process.env.PLAYWRIGHT_EXECUTABLE_PATH
  ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 4191;
const baseURL = `http://127.0.0.1:${PORT}/`;

// Mínimos que declara el propio proyecto (src/design-system/tokens.css):
//   --sc-size-target-touch: 44px   --sc-size-target-pointer: 36px
const TOUCH_MIN = 44;
const POINTER_MIN = 36;
const MIN_FONT_PX = 11;
// Escala de radios del Brandbook Clay §06 (xs 6 · sm 8 · md 13 · lg 18 · xl 26).
const BRANDBOOK_RADII = [6, 8, 13, 18, 26];

/** @type {{width:number,height:number,label:string,klass:string,touch:boolean}[]} */
const VIEWPORTS = [
  { label: '320x568', width: 320, height: 568, klass: 'Compact', touch: true },
  { label: '360x800', width: 360, height: 800, klass: 'Compact', touch: true },
  { label: '375x667', width: 375, height: 667, klass: 'Compact', touch: true },
  { label: '390x844', width: 390, height: 844, klass: 'Compact', touch: true },
  { label: '844x390-landscape', width: 844, height: 390, klass: 'Compact', touch: true },
  { label: '768x1024-tablet', width: 768, height: 1024, klass: 'Medium', touch: true },
  { label: '900x1000-split', width: 900, height: 1000, klass: 'Medium', touch: false },
  { label: '1024x768', width: 1024, height: 768, klass: 'Expanded', touch: false },
  { label: '1280x800', width: 1280, height: 800, klass: 'Expanded', touch: false },
  { label: '1440x900', width: 1440, height: 900, klass: 'Expanded', touch: false },
  { label: '1536x960', width: 1536, height: 960, klass: 'Expanded', touch: false },
];

const report = { generatedAt: new Date().toISOString(), viewports: VIEWPORTS, flows: {}, notes: [] };
const record = (flow, viewport, data) => {
  report.flows[flow] ??= {};
  report.flows[flow][viewport] = data;
};

// ---------------------------------------------------------------- in-page ---

/** Recolectores que corren dentro de la página. Se inyectan como string. */
const PAGE_HELPERS = `
window.__cri7 = (() => {
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  };
  const rectOf = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
  const label = (el) => (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '')
    .replace(/\\s+/g, ' ').trim().slice(0, 60);
  const sel = (el) => {
    const cls = (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || '')
      .toString().trim().split(/\\s+/).filter(Boolean).slice(0, 2).join('.');
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
  };

  // Área de la unión de rectángulos, por barrido de coordenadas x.
  const unionArea = (rects) => {
    const boxes = rects.filter((r) => r.w > 0 && r.h > 0);
    if (!boxes.length) return 0;
    const xs = [...new Set(boxes.flatMap((r) => [r.x, r.x + r.w]))].sort((a, b) => a - b);
    let total = 0;
    for (let i = 0; i < xs.length - 1; i += 1) {
      const x0 = xs[i], x1 = xs[i + 1], stripW = x1 - x0;
      if (stripW <= 0) continue;
      const spans = boxes.filter((r) => r.x <= x0 && r.x + r.w >= x1)
        .map((r) => [r.y, r.y + r.h]).sort((a, b) => a[0] - b[0]);
      let covered = 0, curStart = null, curEnd = null;
      for (const [s0, s1] of spans) {
        if (curStart === null) { curStart = s0; curEnd = s1; continue; }
        if (s0 > curEnd) { covered += curEnd - curStart; curStart = s0; curEnd = s1; }
        else curEnd = Math.max(curEnd, s1);
      }
      if (curStart !== null) covered += curEnd - curStart;
      total += covered * stripW;
    }
    return total;
  };

  const clipToViewport = (r) => {
    const x = Math.max(0, r.x), y = Math.max(0, r.y);
    const x2 = Math.min(innerWidth, r.x + r.w), y2 = Math.min(innerHeight, r.y + r.h);
    return { x, y, w: Math.max(0, x2 - x), h: Math.max(0, y2 - y) };
  };

  return {
    /** Presupuesto de lienzo: cuánto del viewport llega de verdad al modelo. */
    canvasBudget() {
      const vw = innerWidth, vh = innerHeight, vArea = vw * vh;
      const host = document.querySelector('.canvas-host');
      if (!host || !visible(host)) return null;
      const hostRect = clipToViewport(rectOf(host));
      const hostArea = hostRect.w * hostRect.h;

      // Chrome estructural: ocupa su propio hueco en el layout, fuera del lienzo.
      const fixedSelectors = ['.topbar', '.toolbar', '.inspector-panel', '.results-panel', '.professional-note'];
      const fixed = fixedSelectors.map((s) => {
        const el = document.querySelector(s);
        if (!el || !visible(el)) return null;
        const r = clipToViewport(rectOf(el));
        // Un panel que se superpone al lienzo (hoja inferior) no es chrome fijo.
        const overlapsHost = !(r.x + r.w <= hostRect.x || r.x >= hostRect.x + hostRect.w
          || r.y + r.h <= hostRect.y || r.y >= hostRect.y + hostRect.h);
        return { selector: s, rect: r, area: r.w * r.h, overlapsCanvas: overlapsHost };
      }).filter(Boolean);

      // Chrome flotante: vive ENCIMA del lienzo y le roba área útil.
      const floatSelectors = [
        '.mobile-tool-dock', '.toolbar', '.canvas-controls', '.canvas-status', '.canvas-minimap',
        '.canvas-mode-badge', '.canvas-view-chips', '.canvas-layer-trigger', '.mobile-inspector-toggle',
        '.quick-entry-bar', '.canvas-hint', '.canvas-feedback', '.results-mobile-toggle',
      ];
      const floating = [];
      for (const s of floatSelectors) {
        for (const el of document.querySelectorAll(s)) {
          if (!visible(el)) continue;
          const r = clipToViewport(rectOf(el));
          if (r.w <= 0 || r.h <= 0) continue;
          // Sólo cuenta la parte que cae dentro del lienzo.
          const ix = Math.max(r.x, hostRect.x), iy = Math.max(r.y, hostRect.y);
          const ix2 = Math.min(r.x + r.w, hostRect.x + hostRect.w);
          const iy2 = Math.min(r.y + r.h, hostRect.y + hostRect.h);
          const iw = Math.max(0, ix2 - ix), ih = Math.max(0, iy2 - iy);
          if (iw <= 0 || ih <= 0) continue;
          floating.push({ selector: s, rect: { x: ix, y: iy, w: iw, h: ih }, area: iw * ih });
        }
      }
      const floatingArea = unionArea(floating.map((f) => f.rect));

      return {
        viewport: { w: vw, h: vh, area: vArea },
        canvasHost: { ...hostRect, area: hostArea, pctOfViewport: +(hostArea / vArea * 100).toFixed(1) },
        usableModelArea: Math.max(0, hostArea - floatingArea),
        usablePctOfViewport: +(Math.max(0, hostArea - floatingArea) / vArea * 100).toFixed(1),
        usablePctOfCanvas: hostArea ? +(Math.max(0, hostArea - floatingArea) / hostArea * 100).toFixed(1) : 0,
        floatingChrome: { area: floatingArea, pctOfCanvas: hostArea ? +(floatingArea / hostArea * 100).toFixed(1) : 0, items: floating },
        fixedChrome: fixed,
        fixedChromeArea: unionArea(fixed.filter((f) => !f.overlapsCanvas).map((f) => f.rect)),
      };
    },

    /** Objetivos interactivos por debajo del mínimo. */
    hitTargets(min) {
      const q = 'button,[role="button"],a[href],select,input,textarea,[role="tab"],[role="switch"],[role="menuitem"],summary';
      const out = [];
      for (const el of document.querySelectorAll(q)) {
        if (!visible(el)) continue;
        if (el.closest('[aria-hidden="true"]')) continue;
        const r = rectOf(el);
        if (r.w + 0.5 < min || r.h + 0.5 < min) {
          out.push({ sel: sel(el), label: label(el), w: +r.w.toFixed(1), h: +r.h.toFixed(1),
            region: el.closest('.topbar') ? 'topbar' : el.closest('.toolbar') ? 'toolbar'
              : el.closest('.inspector-panel') ? 'inspector' : el.closest('.results-panel') ? 'results'
              : el.closest('.canvas-host') ? 'canvas' : el.closest('.welcome-screen') ? 'welcome'
              : el.closest('[role="dialog"]') ? 'dialog' : 'other' });
        }
      }
      return out;
    },

    /** Texto renderizado por debajo del umbral legible. */
    tinyText(minPx) {
      const out = new Map();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        const t = n.nodeValue && n.nodeValue.trim();
        if (!t) continue;
        const el = n.parentElement;
        if (!el || !visible(el)) continue;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (!(fs < minPx)) continue;
        const key = sel(el) + '|' + fs;
        if (!out.has(key)) out.set(key, { sel: sel(el), fontSize: fs, sample: t.slice(0, 40), count: 0,
          region: el.closest('.topbar') ? 'topbar' : el.closest('.toolbar') ? 'toolbar'
            : el.closest('.inspector-panel') ? 'inspector' : el.closest('.results-panel') ? 'results'
            : el.closest('.canvas-host') ? 'canvas' : el.closest('.welcome-screen') ? 'welcome' : 'other' });
        out.get(key).count += 1;
      }
      return [...out.values()].sort((a, b) => a.fontSize - b.fontSize);
    },

    /** Radios en uso sobre superficies accionables/contenedoras. */
    radii() {
      const out = new Map();
      for (const el of document.querySelectorAll('button,.sc-surface,[class*="card"],[class*="panel"],select,input,[role="tab"]')) {
        if (!visible(el)) continue;
        const r = parseFloat(getComputedStyle(el).borderTopLeftRadius);
        if (!Number.isFinite(r) || r === 0 || r > 900) continue;
        const rounded = Math.round(r);
        const key = rounded;
        if (!out.has(key)) out.set(key, { radius: rounded, count: 0, offScale: !BB.includes(rounded), examples: [] });
        const e = out.get(key);
        e.count += 1;
        if (e.examples.length < 3) e.examples.push(sel(el));
      }
      return [...out.values()].sort((a, b) => a.radius - b.radius);
    },

    /** Solapamiento entre controles flotantes sobre el lienzo. */
    floatingOverlaps() {
      const sels = ['.mobile-tool-dock', '.toolbar', '.canvas-controls', '.canvas-status', '.canvas-minimap',
        '.canvas-mode-badge', '.canvas-view-chips', '.canvas-layer-trigger', '.mobile-inspector-toggle',
        '.quick-entry-bar', '.canvas-hint', '.results-mobile-toggle'];
      const items = [];
      for (const s of sels) for (const el of document.querySelectorAll(s)) {
        if (visible(el)) items.push({ sel: s, r: rectOf(el) });
      }
      const hits = [];
      for (let i = 0; i < items.length; i += 1) for (let j = i + 1; j < items.length; j += 1) {
        const a = items[i].r, b = items[j].r;
        const ow = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oh = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ow > 1 && oh > 1) hits.push({ a: items[i].sel, b: items[j].sel, overlapArea: +(ow * oh).toFixed(0) });
      }
      return hits;
    },

    overflow() {
      const d = document.documentElement;
      return { scrollWidth: d.scrollWidth, clientWidth: d.clientWidth,
        horizontal: d.scrollWidth > d.clientWidth + 1,
        bodyScrollWidth: document.body.scrollWidth };
    },
  };
})();
`.replace('BB.includes', `${JSON.stringify(BRANDBOOK_RADII)}.includes`);

// ------------------------------------------------------------- harness ------

async function newPage(browser, vp) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    hasTouch: vp.touch,
    isMobile: false, // isMobile fuerza overlay-scrollbars y meta-viewport; medimos el layout real.
    reducedMotion: 'reduce',
  });
  // El ciclo de actualización del PWA no debe inyectar banners durante la medición.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { controller: null, register: async () => ({ installing: null, waiting: null, addEventListener: () => {} }), addEventListener: () => {} },
    });
  });
  return page;
}

async function measure(page, flow, vp, extra = {}) {
  await page.waitForTimeout(140);
  await page.evaluate(PAGE_HELPERS);
  const data = await page.evaluate(([touchMin, pointerMin, minFont]) => ({
    canvasBudget: window.__cri7.canvasBudget(),
    hitTargets: window.__cri7.hitTargets(touchMin),
    hitTargetsPointer: window.__cri7.hitTargets(pointerMin),
    tinyText: window.__cri7.tinyText(minFont),
    radii: window.__cri7.radii(),
    floatingOverlaps: window.__cri7.floatingOverlaps(),
    overflow: window.__cri7.overflow(),
  }), [TOUCH_MIN, POINTER_MIN, MIN_FONT_PX]);
  const file = `${flow}__${vp.label}.png`;
  await page.screenshot({ path: path.join(shotsDir, file) });
  record(flow, vp.label, { ...data, ...extra, screenshot: `shots/${file}`, windowClass: vp.klass, touch: vp.touch });
  return data;
}

/** Entra al espacio de trabajo. Devuelve si hizo falta reintentar el clic. */
async function enterWorkspace(page, launcherRe, rootSelector = '.app-shell') {
  const launcher = page.getByRole('button', { name: launcherRe }).first();
  await launcher.click();
  try {
    // Contexto nuevo = sin caché HTTP: el chunk diferido puede tardar. El
    // reintento sólo aplica si la bienvenida sigue en pantalla.
    await page.locator(rootSelector).waitFor({ state: 'visible', timeout: 25000 });
    return { retried: false };
  } catch {
    if (!await page.getByTestId('welcome-screen').isVisible().catch(() => false)) throw new Error(`no se alcanzó ${rootSelector}`);
    await launcher.click();
    await page.locator(rootSelector).waitFor({ state: 'visible', timeout: 25000 });
    return { retried: true };
  }
}

async function gotoWelcome(page) {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible' });
}

/** Recorre con Tab y comprueba que cada parada muestre indicador de foco. */
async function auditFocusRing(page, steps = 26) {
  await page.evaluate(() => document.body.focus());
  const stops = [];
  for (let i = 0; i < steps; i += 1) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      const outlineW = parseFloat(s.outlineWidth) || 0;
      const hasOutline = outlineW > 0 && s.outlineStyle !== 'none';
      const hasShadowRing = /inset|0 0 0/.test(s.boxShadow) && s.boxShadow !== 'none';
      const r = el.getBoundingClientRect();
      const cls = (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || '').toString();
      return {
        sel: el.tagName.toLowerCase() + (cls ? '.' + cls.trim().split(/\s+/).slice(0, 2).join('.') : ''),
        label: (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 44),
        hasOutline, outlineWidth: outlineW, outlineColor: s.outlineColor, hasShadowRing,
        offscreen: r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth,
        w: +r.width.toFixed(0), h: +r.height.toFixed(0),
      };
    });
    if (stop) stops.push(stop);
  }
  return stops;
}

// ---------------------------------------------------------------- flows -----

async function runViewport(browser, vp) {
  const page = await newPage(browser, vp);
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message.slice(0, 200)));

  try {
    // --- Flujo 1: Bienvenida -------------------------------------------------
    await gotoWelcome(page);
    await measure(page, '01-welcome', vp);

    const welcomeFocus = await auditFocusRing(page, 14);
    record('01-welcome', vp.label, { ...report.flows['01-welcome'][vp.label], focusStops: welcomeFocus });

    // --- Flujo 2: entrada al espacio de trabajo (plantilla con modelo) -------
    const entry = await enterWorkspace(page, /pórtico de ejemplo/i);
    await page.waitForTimeout(900);
    await measure(page, '02-workspace-idle', vp, { firstClickDropped: entry.retried });

    // --- Flujo 3: análisis / resultados -------------------------------------
    const analyze = page.getByRole('button', { name: /analizar estructura/i }).first();
    if (await analyze.count()) {
      await analyze.click();
      await page.waitForTimeout(1600);
    }
    await measure(page, '03-results', vp);

    const wsFocus = await auditFocusRing(page, 30);
    record('03-results', vp.label, { ...report.flows['03-results'][vp.label], focusStops: wsFocus });

    // --- Flujo 4: selección de barra + Inspector ----------------------------
    const member = page.locator('.member-object').first();
    if (await member.count()) {
      await member.click({ position: { x: 4, y: 4 }, force: true }).catch(() => {});
      await page.waitForTimeout(400);
    }
    // En Compact el Inspector es hoja inferior tras un botón flotante.
    const inspectorToggle = page.locator('.mobile-inspector-toggle');
    if (await inspectorToggle.isVisible().catch(() => false)) {
      await inspectorToggle.click().catch(() => {});
      await page.waitForTimeout(500);
    }
    await measure(page, '04-selection-inspector', vp);
    // Cerrar la hoja para no contaminar las siguientes medidas.
    if (await page.locator('.mobile-inspector-backdrop').isVisible().catch(() => false)) {
      await page.locator('.mobile-inspector-backdrop').click().catch(() => {});
      await page.waitForTimeout(300);
    }

    // --- Flujo 5: diagramas (pestaña Momento) --------------------------------
    const momento = page.getByRole('button', { name: /^Momento$/i }).first();
    if (await momento.count()) { await momento.click().catch(() => {}); await page.waitForTimeout(700); }
    await measure(page, '05-diagrams', vp);

    // --- Flujo 6: Model Doctor ----------------------------------------------
    const doctor = page.locator('.model-doctor-launcher').first();
    if (await doctor.isVisible().catch(() => false)) {
      await doctor.click().catch(() => {});
      await page.waitForTimeout(800);
      await measure(page, '06-model-doctor', vp);
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(400);
    } else {
      record('06-model-doctor', vp.label, { unreachable: true, reason: 'launcher no visible en este viewport' });
    }

    // --- Flujo 7: Datasheet --------------------------------------------------
    const datasheetTab = page.getByRole('button', { name: /datos|datasheet|tabla/i }).first();
    if (await datasheetTab.count() && await datasheetTab.isVisible().catch(() => false)) {
      await datasheetTab.click().catch(() => {});
      await page.waitForTimeout(800);
      await measure(page, '07-datasheet', vp);
    } else {
      record('07-datasheet', vp.label, { unreachable: true, reason: 'no se encontró pestaña de datasheet visible' });
    }

    // --- Flujo 8: menú de proyecto / exportación -----------------------------
    const more = page.locator('.mobile-actions-wrap button, .utility-actions-wrap button').first();
    if (await more.isVisible().catch(() => false)) {
      await more.click().catch(() => {});
      await page.waitForTimeout(500);
      await measure(page, '08-utility-menu', vp);
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(300);
    }

    record('_meta', vp.label, { consoleErrors });
  } catch (error) {
    record('_error', vp.label, { message: String(error && error.message).slice(0, 400) });
    console.error(`  !! ${vp.label}: ${error && error.message}`);
  } finally {
    await page.close();
  }
}

/**
 * Aula se diagnostica aparte. «Nuevo ejercicio» NO navega: abre un diálogo
 * modal sobre la propia bienvenida, y sólo al confirmarlo se entra a la mesa
 * con el recorrido guiado. Se mide en los dos pasos.
 */
async function runClassroom(browser, vp) {
  const page = await newPage(browser, vp);
  try {
    await gotoWelcome(page);
    await page.getByRole('button', { name: /nuevo ejercicio/i }).first().click();
    await page.locator('.new-exercise-dialog').waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(400);
    await measure(page, '09a-aula-dialogo', vp);

    // Confirmar el ejercicio para llegar al recorrido guiado en la mesa.
    const submit = page.locator('.new-exercise-dialog button[type="submit"]').first();
    if (await submit.count()) {
      await submit.click();
      await page.locator('.app-shell').waitFor({ state: 'visible', timeout: 25000 });
      await page.waitForTimeout(1400);
      await measure(page, '09b-aula-mesa', vp);
    } else {
      record('09b-aula-mesa', vp.label, { unreachable: true, reason: 'sin botón submit en el diálogo' });
    }
  } catch (error) {
    record('09a-aula-dialogo', vp.label, { error: String(error && error.message).slice(0, 300) });
  } finally { await page.close(); }
}

/** Space 3D es experimental y se marca como tal; sólo se constata su estado. */
async function runSpace3D(browser, vp) {
  const page = await newPage(browser, vp);
  try {
    await gotoWelcome(page);
    await enterWorkspace(page, /space 3d/i, '.space3d-screen');
    await page.waitForTimeout(2200);
    await measure(page, '10-space3d-experimental', vp);
  } catch (error) {
    record('10-space3d-experimental', vp.label, { error: String(error && error.message).slice(0, 300) });
  } finally { await page.close(); }
}

// ----------------------------------------------------------------- main -----

const server = await preview({ root, preview: { host: '127.0.0.1', port: PORT, strictPort: true }, logLevel: 'error' });
const browser = await chromium.launch({ headless: true, executablePath: EXECUTABLE });

try {
  // CRI7_ONLY_EXTRA permite reejecutar sólo Aula y Space 3D sin repetir la
  // pasada principal (útil al ajustar el arnés).
  if (!process.env.CRI7_ONLY_EXTRA) {
    for (const vp of VIEWPORTS) {
      console.log(`· ${vp.klass.padEnd(8)} ${vp.label}`);
      await runViewport(browser, vp);
    }
  }
  // Aula y Space 3D: un representativo por clase de ventana.
  for (const vp of VIEWPORTS.filter((v) => ['390x844', '768x1024-tablet', '1440x900'].includes(v.label))) {
    console.log(`· Aula      ${vp.label}`);
    await runClassroom(browser, vp);
    console.log(`· Space3D   ${vp.label}`);
    await runSpace3D(browser, vp);
  }
} finally {
  await browser.close();
  await server.close();
}

// Al reejecutar sólo los extras, se fusiona sobre la evidencia ya escrita.
const outFile = path.join(here, 'audit-data.json');
if (process.env.CRI7_ONLY_EXTRA && fs.existsSync(outFile)) {
  const previous = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  report.flows = { ...previous.flows, ...report.flows };
  report.generatedAt = previous.generatedAt + ' (+extras ' + new Date().toISOString() + ')';
}
fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
console.log(`\nEvidencia escrita en ${here}`);
