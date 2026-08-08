# Arquitectura frontend — structureCo

> Estado documentado a 2026-08-02 (release base 0.8.0, rediseño visual 2026-08 aplicado en la capa de tokens; actualizado durante el programa de endurecimiento 0.8.1 — ver `docs/releases/0.8.1/STATUS.md`).
> Stack: React 19 + TypeScript, Vite 8, Vitest, oxlint. Sin router (una sola vista con estado `welcome | workspace`), sin gestor de estado externo (Context API).

## 1 · Árbol de arranque

```
src/main.tsx
 └─ App (src/App.tsx)
     └─ ProjectProvider (src/store/ProjectContext.tsx)
         └─ AppShell — estado local screen: 'welcome' | 'workspace'
             ├─ 'welcome'  → ClassroomSessionProvider → WelcomeScreen
             └─ 'workspace'→ ClassroomSessionProvider → Suspense → WorkspaceShell (lazy)
```

- `main.tsx` monta en `StrictMode`. Ruta especial **solo dev**: `/__components` carga `ui/ComponentLab` (laboratorio de la librería `sc-*`) en lugar de la app.
- `WorkspaceShell` se carga con `lazy()` y se **precalienta** desde la bienvenida vía `requestIdleCallback` (timeout 1800ms; fallback `setTimeout` 700ms) y en el hover/focus de los CTA (`onPreloadWorkspace`).
- `AppShell` sincroniza `document.documentElement.lang` con `project.settings.language`.

## 2 · Shell del workspace

`WorkspaceShell` (dueño de estado y comandos) compone `AppShellLayout` (frontera **solo visual**, `src/shell/AppShellLayout.tsx`) inyectando superficies por slots:

| Slot | Contenido |
| --- | --- |
| `topBar` | `TopBar` (proyecto, undo/redo, analizar, tema, layout actions: colapsar inspector, full canvas, rail compacto) |
| `toolRail` | `ToolRail` (usa `ToolBar`/registro de herramientas; modo compacto) |
| `workspace` | `ClassroomGuide` (solo si `project.settings.calculationMode === 'classroom'`) + `StructuralCanvas` + `ResultsPanel` |
| `inspector` | `Inspector` (panel derecho; modal deslizante en móvil, ancho redimensionable en desktop) |
| `backdrop` / `floatingActions` | Backdrop del inspector móvil / botón flotante `SlidersHorizontal` |
| `footer` | Nota profesional (`.professional-note`) |

`AppShellLayout` expone el estado de layout como data-attributes (`data-inspector-collapsed`, `data-full-canvas`, `data-tool-rail-compact`) y la variable `--inspector-w`; incluye skip-link a `#workspace-canvas`. **No conoce dominio**: solo ordena nodos React.

Coordinación móvil: el shell, el dock de resultados, el canvas, TopBar y la guía de Aula intercambian intenciones (no estado) a través de una fachada de comandos tipada, `src/features/workspace/workspaceCommands.ts` (0.8.1): `emitWorkspaceCommand('collapse-mobile-results')` / `onWorkspaceCommand('expand-mobile-results', handler)`, además de `focus-object`, `fit-canvas`, `export-svg` y `export-png`. El transporte sigue siendo `CustomEvent` en `window` con los mismos nombres de siempre — la fachada sólo tipa el payload y centraliza el nombre del evento, que antes se escribía a mano en 27 sitios. El shell marca `inert` + `aria-hidden` el fondo cuando el inspector móvil está abierto y sincroniza `--sc-visual-viewport-*` con `visualViewport` (teclado iOS).

`StructuralCanvas` es el **canvas real e intocable** desde el rediseño: la capa 2026-08 de `styles.css` se limita a microinteracciones sobre superficies existentes sin alterar estructura funcional ni comportamiento.

## 3 · Estado (Context API, sin librerías externas)

### ProjectContext (`src/store/ProjectContext.tsx`)

Único dueño del modelo (`ProjectModel`) y del ciclo de análisis:

- **Historial**: pilas `past`/`future` con tope 50; transacciones (`begin/commit/cancelProjectTransaction`) para gestos de arrastre que consolidan un solo undo; `moveNodeTransient` optimizado sin `structuredClone`.
- **Análisis**: `analyze()` repara topología (`repairProjectTopology`) antes de resolver, versiona peticiones (`analysisRevisionRef`) y descarta respuestas obsoletas; auto-selecciona el miembro crítico por momento tras un análisis exitoso; deriva a la pestaña `issues` si falla.
- **Tema** (`ThemeMode`): inicial desde `localStorage` o `prefers-color-scheme`; aplica `data-theme` en `<html>` y persiste.
- **UI transversal**: herramienta activa, selección, pestaña de resultados, combinación seleccionada, cursor de resultados, estado de línea de influencia, foco de aprendizaje, incidencias de almacenamiento (`recovered | load-failed | save-failed`).

### ClassroomSessionContext (`src/store/ClassroomSessionContext.tsx`)

Sesión del modo Aula por proyecto (predicciones, progreso); persiste bajo clave con prefijo + `projectId`.

## 4 · Workers con fallback síncrono

Tres workers ESM (Vite, `new Worker(new URL(...), { type: 'module' })`) con el mismo patrón defensivo:

| Worker | Consumidor | Protocolo |
| --- | --- | --- |
| `workers/analysis.worker.ts` | `ProjectContext.analyze()` | `engine/analysisWorkerProtocol.ts` (`requestId` correlacionado) |
| `workers/influence.worker.ts` | `engine/useInfluenceAnalysis.ts` | ídem patrón |
| `workers/scenarios.worker.ts` | `engine/useScenarioAnalysis.ts` | ídem patrón |

Patrón de fallback (idéntico en los tres): si `typeof Worker === 'undefined'`, si el constructor lanza, si `worker.onerror` dispara o si la respuesta llega mal formada → se ejecuta la **misma rutina en el hilo principal** vía `import()` dinámico del solver (`runFallbackAnalysis` → `engine/solver.analyzeProject`), diferida con `setTimeout(0)`. Cada worker se termina tras responder; las respuestas con `requestId` distinto al vigente se ignoran. Resultado: el análisis funciona igual (más lento) en navegadores sin workers o con CSP restrictiva.

## 5 · Persistencia (localStorage)

| Clave | Escritor | Contenido |
| --- | --- | --- |
| `structureCo.project` | `data/projectStorage.ts` (debounce 250ms en ProjectContext) | Proyecto normalizado (schema v3 vía `data/migrate.normalizeProject`) |
| `structureCo.project.backup` | ídem | Rotación de la última copia primaria **válida** antes de cada guardado |
| `structureCo.project.recovery` | ídem | Copia forense verbatim de un primario corrupto (nunca se destruye evidencia) |
| `structureCo.theme` | ProjectContext | `'light' | 'dark'` |
| `structureco:workspace-layout:v1` | `shell/useWorkspaceLayoutPreferences.ts` | `inspectorCollapsed`, `inspectorWidth` (con clamps MIN/MAX), `fullCanvas`, `toolRailCompact` |
| `structureco:editor-layers:v1` | `components/editorLayers.ts` | Visibilidad de capas del editor (fuerza `model: true` al guardar) |
| `structureCo.classroom.session.v1:<projectId>` | ClassroomSessionContext | Sesión de Aula por proyecto |
| `structureCo.inspector.expanded.v1` | Inspector | Estado del acordeón de propiedades avanzadas |

Carga con recuperación escalonada: primario → (si corrupto: copia a recovery) → backup → proyecto en blanco verificado; el resultado expone `recoveredFromBackup`/`recoveryMessage` que ProjectContext convierte en aviso de UI. El PDF de referencia del centro de importación **no** se persiste (protección de memoria iOS, ver catálogo i18n).

Nota: conviven dos convenciones de nombre de clave (`structureCo.` camelCase y `structureco:*:v1`); no unificar sin migración de lectura.

## 6 · i18n

- Catálogos completos **ES/EN** en un solo módulo: `src/i18n/catalogs.ts`, con tipo `TranslationKey` derivado (autocompletado y paridad verificada por tests; ver `docs/ux-redesign/I18N_PARITY.md`).
- `useI18n()` lee `project.settings.language` desde ProjectContext y devuelve `t(key, variables)`; el idioma es un ajuste **del proyecto**, no del navegador.
- `<html lang>` se sincroniza en `AppShell`.

## 7 · Frontera matemática protegida

**Prohibido modificar desde trabajo de UI/rediseño** (cualquier cambio requiere al dueño del motor y re-verificación numérica):

- `src/engine/**` — solver, diagramas, influencia, envolventes, unidades, validación (con baterías de verificación Hibbeler/FTool).
- `src/workers/**` — envoltorios de ejecución del motor.
- `src/data/**` — schema, migraciones, operaciones de modelo, almacenamiento.
- `src/types.ts` — contratos de dominio.
- `src/store/ProjectContext.tsx` — semántica de historial/análisis/persistencia.

La frontera inversa está **verificada por test**: `src/ui/dependencyBoundary.test.ts` garantiza que la librería de componentes (`controls`, `disclosure`, `editor`, `feedback`, `overlays`) no importa `engine/workers/store/data/types`, que `ui.css` solo consume tokens semánticos (nunca primitivas de paleta) y que el inventario completo de la Fase 5 (Button…NumericValue, 25 componentes) permanece exportado.

## 8 · Capas de UI

| Capa | Ubicación | Regla |
| --- | --- | --- |
| Tokens | `src/design-system/tokens.css` (+ contrato `tokens.test.ts`) | Fuente única de color/tipografía/espaciado/motion; alias de compatibilidad para CSS legado. Desde 0.8.1, `tokens.test.ts` también prohíbe cualquier literal de color opaco y limita `rgba()` a sombras/velos en `styles.css` |
| Librería de componentes | `src/ui/*` + `ui.css` (clases `sc-*`) | Aislada del dominio (ver §7); laboratorio en `/__components` |
| Iconos propios | `src/design-system/icons/structural.tsx` | Glifos de ingeniería; genéricos vía lucide-react |
| Superficies de la app | `src/features/**` + `styles.css` | Consumen librería y tokens; `styles.css` cierra con la capa "REDISEÑO 2026-08" (microinteracciones, cascada al final del archivo) |
| Shell | `src/features/workspace/*` | Composición visual pura (`AppShellLayout`) + preferencias de layout |

## 9 · Reorganización de carpetas (completada 2026-08-02)

La reorganización frontend se ejecutó como parte del rediseño visual integral:

- `src/design-system/` es la capa canónica: `tokens.css` (+ `tokens.test.ts`),
  `icons/structural.tsx`, `components/` (biblioteca `sc-*` completa con sus
  pruebas y `ui.css`) y `lab/` (ComponentLab/TopBarLab, solo desarrollo).
- `src/features/` agrupa superficies por dominio: `welcome/`, `workspace/`
  (incluye el antiguo `src/shell/`), `topbar/`, `canvas/`, `inspector/`
  (aplanado desde `components/inspector/`), `results/`, `classroom/`,
  `import-export/`.
- Las carpetas `src/components/`, `src/ui/`, `src/shell/` y `src/styles/`
  desaparecieron; `features/canvas/StructuralToolIcon.tsx` se mantiene como
  fachada de compatibilidad `tool → icono` sobre el módulo canónico de iconos.
- **No se movió ni modificó** `src/engine/`, `src/workers/`, `src/data/`,
  `src/store/`, `src/education/`, `src/i18n/`, `src/utils/` ni `src/types.ts`
  (frontera protegida). La suite completa (67 archivos / 388 pruebas) quedó en
  verde tras la migración, junto con typecheck, lint y build.
- El handoff histórico **T09 — Consolidación arquitectónica**
  (`docs/superpowers/handoffs/structureco-2026-07-29/`) contemplaba además una
  fachada de comandos para coordinar los paneles del workspace. Esa parte se
  completó en el programa 0.8.1 (S04): ver `workspaceCommands.ts` en §2. No
  reemplaza `ProjectContext` — sigue siendo el único dueño del modelo — sólo
  tipa las intenciones entre paneles que antes viajaban como cadenas sueltas.

## 10 · Utilidades transversales (`src/utils/`, ampliadas en 0.8.1)

| Módulo | Responsabilidad |
| --- | --- |
| `fileGuards.ts` | Presupuestos de tamaño/entradas/compresión para PDF, `.structureco` y JSON; rechazo temprano por firma de archivo antes de leer el contenido completo |
| `numberFormat.ts` | Política numérica única (8 contextos: canvas, chart, inspector, table, tooltip, report, annex, clipboard); `numericPolicy.test.ts` falla el build si `features/**` vuelve a usar `toFixed`/`toPrecision`/`toExponential` crudos |
| `svgExport.ts` | Serialización de SVG independiente de la hoja de estilos: resuelve clases y variables CSS a valores computados antes de exportar |
| `export.ts` | `exportSvgElement`/`exportSvgAsPng` sobre `svgExport.ts`; `rasterScaleFor` acota la resolución del PNG al límite de canvas del navegador sin reducir nunca por debajo de 1× |
| `pdf/` | Maquetación declarativa de la memoria de cálculo (0.8.2, AG-003): `PdfLayout` es el único dueño del cursor vertical y de los saltos de página; `pdfChrome`/`pdfMath`/`pdfDiagrams` dan el vocabulario visual y hay un módulo por sección del documento. `calculationPdf.ts` queda como orquestador. Todos importan `pdf-lib` **sólo como tipos** — el `import()` dinámico del orquestador es lo que mantiene la librería fuera del chunk inicial |

## 10 bis · Geometría compartida entre renderizadores (`src/graphics/`, 0.8.2)

`structureGeometry.ts` es el núcleo geométrico en **espacio-modelo** que consumen los dos renderizadores de la estructura: el canvas web (React/SVG, con cámara de pan/zoom) y la memoria de cálculo (`pdf-lib`, con encaje a caja). Es puro: sin React, sin `pdf-lib`, sin píxeles ni unidades de página.

| Función | Qué responde |
| --- | --- |
| `memberAxis(member, i, j)` | Dirección, cosenos directores, normal unitaria `(-s, c)` y luz flexible descontando los brazos rígidos |
| `grossRatioFromFlexible` / `flexibleRatioFromGross` | Conversión entre la estación del tramo flexible (lo que guardan `MemberLoad.position/start/end`) y la posición sobre el miembro completo |
| `grossRatioAtPoint` | Proyección de un puntero sobre el miembro, acotada a sus extremos |
| `pointAtGrossRatio` / `lerpPoint` | Interpolación en espacio-modelo y en el espacio ya proyectado del renderizador |
| `toGlobalVector` | Rotación de un vector en ejes locales a ejes globales |
| `distributedIntensityAt` | Intensidad interpolada de una carga distribuida |
| `modelBounds` | Caja envolvente, entrada de todo encaje a vista (`cameraToFitBounds` en el canvas, `createProjection` en el PDF) |

**Lo que deliberadamente NO se unificó**: el vocabulario visual de cada renderizador. El canvas dibuja glifos SVG de apoyo, curvas Bézier exactas (`segmentBezierControls`), flechas con `marker-end` y longitudes en píxeles dependientes del zoom; el PDF dibuja barbas de flecha a mano, polilíneas muestreadas y longitudes en puntos de página. Son políticas de presentación distintas por buenas razones, no duplicación. Tampoco se fusionaron los dos encajes a vista: el del canvas acota la escala y respeta los insets del chrome, el del PDF centra en una caja con padding fijo.

## 11 · Calidad

- `npm run verify` = oxlint + frontera matemática protegida (`scripts/check-protected-baseline.mjs`) + vitest + build TS/Vite.
- `.github/workflows/ci.yml` (gate rápido, automático) y `.github/workflows/release-qa.yml` (gate completo con Chromium + WebKit, sólo manual) preparados localmente en 0.8.1 — no conectados a GitHub. Ver `docs/releases/0.8.1/CI.md`.
- Suites QA por fase (`qa*.mjs`, Playwright); `qa.mjs` y `qa-webkit.mjs` son las que ejercitan el gate completo actual.
- Tests co-ubicados (`*.test.ts[x]`) incluyendo contratos de tokens, frontera de dependencias, foco modal, política numérica, presupuestos de importación y verificación numérica del motor (invariantes deterministas, `src/engine/invariants.test.ts`).
