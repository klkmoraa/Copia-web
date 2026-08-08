# Mobile Compact Density Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compactar la interfaz de structureCo en teléfonos para reducir mensajes persistentes, filas redundantes y altura visual sin perder controles, legibilidad técnica ni interacción con el lienzo.

**Architecture:** La solución será una variante responsive de presentación aplicada hasta 700 px. Reutilizará el DOM, las traducciones, los handlers y los controles existentes; las pruebas de navegador medirán el resultado visible y las áreas táctiles, mientras CSS hará la recomposición sin crear estado funcional paralelo.

**Tech Stack:** React 19, TypeScript 6, CSS responsive, Vitest, Testing Library, Playwright, Vite y Netlify CLI.

## Global Constraints

- El cambio se limita a presentación y comportamiento local de interfaz.
- Tablet y escritorio mantienen su composición actual.
- Ningún objetivo táctil interactivo será menor de 44 por 44 px.
- No se modifican `src/engine/**`, `src/workers/**`, `src/data/**`, `src/store/ProjectContext.tsx`, `src/types.ts` ni `src/components/StructuralCanvas.tsx`.
- No cambian solver, resultados, unidades, signos, precisión, geometría, topología, snapping, hit testing, persistencia, IDs, undo/redo ni validaciones.
- La instrucción de una operación activa seguirá visible y anunciándose mediante el estado existente.
- No se añadirán estados persistentes, dependencias ni preferencias nuevas.
- Light Mode, Dark Mode, Chromium, WebKit, safe areas, Escape, retorno de foco y ausencia de overflow siguen siendo compuertas obligatorias.

---

## File map

- `src/styles.css`: única fuente de la variante visual compacta para teléfono.
- `qa-phase11.mjs`: regresión responsive para densidad, áreas táctiles, canvas alcanzable y composición en distintos teléfonos.
- `qa-phase14.mjs`: aceptación de resultados analíticos compactos después de un análisis real en Chromium y WebKit.
- `src/components/CanvasChrome.test.tsx`: caracterización de que las instrucciones de operaciones activas siguen presentes y los handlers del chrome no cambian.
- `docs/superpowers/specs/2026-07-28-mobile-compact-density-design.md`: especificación aprobada, solo referencia.

### Task 1: Compactar chrome del lienzo y resultados

**Files:**
- Modify: `qa-phase11.mjs:103-205`
- Modify: `qa-phase14.mjs:313-430`
- Modify: `src/components/CanvasChrome.test.tsx:14-62`
- Modify: `src/styles.css:2108-2158`

**Interfaces:**
- Consumes: clases existentes `.canvas-mode-badge`, `.touch-gesture-hint`, `.canvas-action-instruction`, `.canvas-result-legend`, `.results-commandbar`, `.results-mobile-toggle`, `.result-tabs` y `.results-panel[data-canvas-interactive='true']`.
- Produces: composición visual compacta hasta 700 px; no produce nuevas props, eventos ni estado.

- [ ] **Step 1: Añadir la prueba unitaria de conservación de instrucciones activas**

En `CanvasChrome.test.tsx`, ampliar el caso que renderiza `placementInstruction="Elige un nodo"` para afirmar el comportamiento real que debe sobrevivir a la compactación:

```tsx
expect(screen.getByText('Elige un nodo')).toBeTruthy();
expect(screen.getByRole('button', { name: 'Cancelar colocación' })).toBeTruthy();
expect(container.querySelector('.canvas-mode-badge')?.classList.contains('placing-load')).toBe(true);
```

Esta prueba falla si la implementación elimina la instrucción operativa o deja de identificar el estado de colocación.

- [ ] **Step 2: Añadir mediciones móviles que fallen antes del cambio**

En el bloque `phoneResults` de `qa-phase11.mjs`, medir el chrome con `getBoundingClientRect()` y `getComputedStyle()`:

```js
const compactDensity = await page.evaluate(() => {
  const mode = document.querySelector('.canvas-mode-badge');
  const gesture = document.querySelector('.touch-gesture-hint');
  const context = document.querySelector('.results-commandbar');
  const tabs = document.querySelector('.result-tabs');
  const panel = document.querySelector('.results-panel:not(.mobile-collapsed)');
  const legend = document.querySelector('.canvas-result-legend');
  const rect = (element) => element?.getBoundingClientRect();
  return {
    modeHeight: rect(mode)?.height ?? Infinity,
    gestureVisible: Boolean(gesture
      && (rect(gesture)?.width ?? 0) > 2
      && (rect(gesture)?.height ?? 0) > 2
      && getComputedStyle(gesture).visibility !== 'hidden'),
    contextWidth: rect(context)?.width ?? Infinity,
    tabsHeight: rect(tabs)?.height ?? Infinity,
    panelHeight: rect(panel)?.height ?? Infinity,
    legendHeight: rect(legend)?.height ?? 0,
  };
});
checks.compactModeBadge = compactDensity.modeHeight <= 40 && !compactDensity.gestureVisible;
checks.compactResultContext = compactDensity.contextWidth <= 2;
checks.compactResultTabs = compactDensity.tabsHeight <= 48;
checks.compactResultPanel = compactDensity.panelHeight <= spec.height * 0.43;
checks.compactResultLegend = compactDensity.legendHeight === 0 || compactDensity.legendHeight <= 44;
```

En `qa-phase14.mjs`, después de que `data-canvas-fit-settled="true"` exista, registrar las mismas cinco condiciones mediante `check(...)`. El flujo real de análisis debe seguir verificando `resultsAutoFitShowsEveryNode`, `canvasPansWithResultsOpen`, selección estable y N/V/M.

- [ ] **Step 3: Ejecutar RED y confirmar que las mediciones detectan la interfaz actual**

Run:

```powershell
npm.cmd run build
$env:PHASE14_VIEWPORT='mobile'; node qa-phase14.mjs
node qa-phase11.mjs
```

Expected: las pruebas unitarias siguen verdes; las nuevas comprobaciones de densidad fallan porque la ayuda gestual ocupa ancho, el commandbar es visible, las pestañas miden más de 48 px o el panel supera 43% del viewport. No cambiar los umbrales para cerrar el fallo.

- [ ] **Step 4: Implementar la variante mínima de CSS**

Al final del bloque móvil de `src/styles.css`, añadir:

```css
@media (max-width:700px) {
  .canvas-mode-badge {
    min-height:36px;
    max-width:calc(100% - 64px);
    padding:5px 8px;
    gap:5px;
    border-radius:8px;
  }
  .canvas-mode-badge strong { font-size:12px; }
  .canvas-mode-badge .touch-gesture-hint {
    position:absolute!important;
    width:1px!important;
    height:1px!important;
    padding:0!important;
    margin:-1px!important;
    overflow:hidden!important;
    clip:rect(0,0,0,0)!important;
    white-space:nowrap!important;
    border:0!important;
  }
  .canvas-mode-badge.placing-load {
    max-width:calc(100% - 20px);
    min-height:44px;
    padding:5px 6px 5px 9px;
  }
  .canvas-result-legend {
    top:52px;
    width:max-content;
    max-width:calc(100% - 72px);
    padding:6px 8px;
    gap:3px 7px;
    border-radius:8px;
  }
  .canvas-result-legend strong { font-size:11px!important; }
  .canvas-result-legend span {
    min-width:0;
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
    font-size:10px!important;
  }
  .canvas-result-legend i { width:16px; }

  .results-commandbar {
    position:absolute!important;
    width:1px!important;
    height:1px!important;
    padding:0!important;
    margin:-1px!important;
    overflow:hidden!important;
    clip:rect(0,0,0,0)!important;
    white-space:nowrap!important;
    border:0!important;
  }
  .results-panel[data-canvas-interactive='true'] {
    height:min(42dvh,420px)!important;
    min-height:min(176px,42dvh);
  }
  .results-panel:not(.mobile-collapsed) .results-mobile-toggle {
    height:48px;
    min-height:48px;
    padding-inline:12px;
  }
  .result-tabs {
    height:46px;
    flex-basis:46px;
    gap:4px;
    padding-inline:6px;
  }
  .result-tab-family { padding-right:3px; }
  .result-tabs button {
    min-width:62px;
    height:44px;
    padding-inline:8px;
    font-size:12px!important;
  }
}
```

Si `max-width:460px` define después una anchura completa para `.canvas-result-legend`, mover esta variante al final del archivo para que el resultado aprobado gane por cascada. No editar `StructuralCanvas.tsx`.

- [ ] **Step 5: Ejecutar GREEN dirigido**

Run:

```powershell
npm.cmd test -- src/components/CanvasChrome.test.tsx src/components/ResultsPanel.test.tsx
npm.cmd run build
$env:PHASE14_VIEWPORT='mobile'; node qa-phase14.mjs
node qa-phase11.mjs
```

Expected: unit tests pass; Chromium y WebKit cumplen las cinco comprobaciones compactas; siguen verdes modelo completo, pan, zoom, ajuste, resultados N/V/M, Escape, foco y overflow.

- [ ] **Step 6: Revisar visualmente y ajustar solo valores ópticos**

Abrir 390 × 844 y 430 × 932 en Light y Dark. Confirmar:

- Solo “Seleccionar” ocupa la insignia persistente.
- Una instrucción de colocación activa sigue visible con su botón Cancelar.
- La leyenda N/V/M conserva familia, trazo y convención.
- “Vista global” es visible una sola vez en el botón del panel.
- El gráfico comienza más arriba y el modelo conserva mayor área.

Solo ajustar padding, gap, radio o tamaño óptico dentro de los límites probados; no alterar los 44 px táctiles ni relajar las comprobaciones.

- [ ] **Step 7: Commit**

```powershell
git add -- src/styles.css src/components/CanvasChrome.test.tsx qa-phase11.mjs qa-phase14.mjs
git commit -m "fix(mobile): compact canvas and results chrome"
```

### Task 2: Compactar encabezado y dock sin reducir alcance táctil

**Files:**
- Modify: `qa-phase11.mjs:63-101`
- Modify: `src/styles.css:850-925`
- Modify: `src/styles.css` final phone override created in Task 1

**Interfaces:**
- Consumes: `.topbar`, `.brand-mark`, `.project-name`, `.toolbar`, `.mobile-tool-dock` y `.mobile-tool-dock .tool-button`.
- Produces: encabezado de 48 px y dock de 58 px visuales con botones de al menos 44 px; conserva las seis rutas del dock.

- [ ] **Step 1: Añadir el test de densidad y alcance del shell**

En `qa-phase11.mjs`, para `spec.width <= 700`, medir:

```js
const mobileShellDensity = await page.evaluate(() => {
  const topbar = document.querySelector('.topbar')?.getBoundingClientRect();
  const toolbar = document.querySelector('.toolbar')?.getBoundingClientRect();
  const dockButtons = [...document.querySelectorAll('.mobile-tool-dock button')]
    .map((element) => element.getBoundingClientRect());
  return {
    topbarHeight: topbar?.height ?? Infinity,
    toolbarHeight: toolbar?.height ?? Infinity,
    dockCount: dockButtons.length,
    touchSafe: dockButtons.every(({ width, height }) => width >= 44 && height >= 44),
  };
});
checks.compactMobileTopbar = mobileShellDensity.topbarHeight <= 50;
checks.compactMobileDock = mobileShellDensity.toolbarHeight <= 60
  && mobileShellDensity.dockCount === 6
  && mobileShellDensity.touchSafe;
```

La altura de topbar se mide sin safe area en el navegador automatizado; la revisión visual en iOS conserva `env(safe-area-inset-top)`.

- [ ] **Step 2: Ejecutar RED**

Run:

```powershell
npm.cmd run build
node qa-phase11.mjs
```

Expected: al menos `compactMobileDock` falla porque el dock actual ocupa 64 px; no cambiar el umbral.

- [ ] **Step 3: Implementar densidad óptica del shell**

Completar el override final de `@media (max-width:700px)`:

```css
@media (max-width:700px) {
  :root { --topbar-h:48px; }
  .brand-mark,.brand-mark svg { width:24px; height:24px; }
  .project-name input { font-size:12px; }
  .toolbar {
    height:calc(58px + env(safe-area-inset-bottom));
    min-height:calc(58px + env(safe-area-inset-bottom));
    padding:3px max(6px,env(safe-area-inset-right))
      calc(3px + env(safe-area-inset-bottom))
      max(6px,env(safe-area-inset-left));
  }
  .mobile-tool-dock .tool-button {
    height:50px;
    min-height:50px;
    padding:2px 1px;
    gap:1px;
    border-radius:8px;
  }
  .mobile-tool-dock .tool-button svg { width:19px; height:19px; }
  .mobile-tool-dock .tool-button > span:not(.sc-tool-button__icon) {
    font-size:11px!important;
  }
}
```

Mantener `.topbar` y `.toolbar` con safe areas existentes. No cambiar el número, orden, callbacks ni nombres accesibles de los botones.

- [ ] **Step 4: Ejecutar GREEN**

Run:

```powershell
npm.cmd run build
node qa-phase11.mjs
```

Expected: `compactMobileTopbar`, `compactMobileDock`, `touchTargetsAtLeast44`, safe areas y todas las comprobaciones previas pasan en Chromium y WebKit.

- [ ] **Step 5: Commit**

```powershell
git add -- src/styles.css qa-phase11.mjs
git commit -m "fix(mobile): tighten header and tool dock"
```

### Task 3: Compuerta integral, revisión protegida y publicación

**Files:**
- Verify only: `src/engine/**`
- Verify only: `src/workers/**`
- Verify only: `src/data/**`
- Verify only: `src/store/ProjectContext.tsx`
- Verify only: `src/types.ts`
- Verify only: `src/components/StructuralCanvas.tsx`
- Generated then restore: `docs/ux-redesign/evidence/phase-14/after/phase14-*.png`
- Generated then restore: `docs/ux-redesign/evidence/phase-14/after/phase14-metrics.json`

**Interfaces:**
- Consumes: commits de Tasks 1 y 2.
- Produces: branch limpia, verificación reproducible, deploy preview y producción con la misma compilación.

- [ ] **Step 1: Ejecutar verificación completa**

```powershell
npm.cmd run verify
node qa-phase11.mjs
$env:PHASE14_VIEWPORT='mobile'; node qa-phase14.mjs
```

Expected: lint limpio, 66 archivos de prueba y al menos 387 pruebas verdes, build de producción correcto, matrices responsive sin fallos, consola y `pageErrors` vacíos.

- [ ] **Step 2: Repetir WebKit móvil para detectar intermitencia**

```powershell
$env:PHASE14_BROWSER='webkit'
$env:PHASE14_VIEWPORT='mobile'
node qa-phase14.mjs
node qa-phase14.mjs
```

Expected: ambos ciclos pasan `resultsAutoFitShowsEveryNode`, densidad compacta, pan táctil, N/V/M y ausencia de overflow.

- [ ] **Step 3: Restaurar evidencia generada y revisar el diff**

```powershell
git restore --source=HEAD -- docs/ux-redesign/evidence/phase-14/after/phase14-chromium-mobile-390x844-light.png
git restore --source=HEAD -- docs/ux-redesign/evidence/phase-14/after/phase14-webkit-mobile-390x844-dark.png
git restore --source=HEAD -- docs/ux-redesign/evidence/phase-14/after/phase14-metrics.json
git diff --check
git status --short
```

Expected: solo quedan cambios intencionales si alguna corrección óptica final aún no fue committeada; `git diff --check` no reporta errores.

- [ ] **Step 4: Confirmar el límite matemático protegido**

```powershell
git diff --name-only ca43335 -- src/engine src/workers src/data src/store/ProjectContext.tsx src/types.ts src/components/StructuralCanvas.tsx
```

Expected: salida vacía.

- [ ] **Step 5: Revisión independiente**

Solicitar una revisión de solo lectura que confirme:

- La ayuda táctil persistente se compactó sin ocultar instrucciones activas.
- El panel no duplica contexto visible.
- Todos los botones relevantes mantienen 44 px.
- Tablet y desktop no cambiaron.
- No hay rutas protegidas en el diff.

Expected: cero hallazgos críticos o importantes antes de publicar.

- [ ] **Step 6: Deploy de vista previa y verificación**

```powershell
npx.cmd netlify status
npx.cmd netlify deploy --dir=dist --message "compact mobile density <commit>" --json
```

Verificar con `Invoke-WebRequest` que la URL de preview y los assets `index-*.js` y `WorkspaceShell-*.js` respondan HTTP 200.

- [ ] **Step 7: Deploy de producción**

```powershell
npx.cmd netlify deploy --prod --dir=dist --message "compact mobile density <commit>" --json
```

Verificar `https://structureco-analisis.netlify.app` con cache busting y confirmar que el HTML referencia el asset actual.

- [ ] **Step 8: Handoff**

Entregar únicamente:

- Resumen breve de la compactación móvil.
- Confirmación de que tablet, escritorio y motor matemático permanecen intactos.
- Conteo de pruebas y matrices de navegador.
- Commit final.
- URL pública.
