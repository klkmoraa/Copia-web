# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es este repo

structureCo (`package.json` name: `structureco`) es una app web local-first (React 19 + TypeScript + Vite 8, sin router, sin librería de estado externa) para modelar, analizar y aprender estructuras planas 2D: editor gráfico + motor matricial de rigidez (Euler–Bernoulli/Timoshenko, marcos y armaduras 2D) + resultados trazables (reacciones, diagramas N/V/M, envolventes, líneas de influencia). Todo corre en el navegador; no hay backend — la persistencia es `localStorage` y la exportación es JSON/SVG/PNG/PDF/`.structureco`.

**El proyecto real es la raíz del repo** (donde están este archivo, `package.json`, `src/`). El repo también contiene, al lado, copias vendored/backup y sub-apps no relacionadas que **no** forman parte de esta app y están excluidas de lint/test (`.oxlintrc.json`, `vite.config.ts`): `structureCo/`, `structureCo-backup-*/`, `structureCo-worktrees/`, `structureco-sites*/`, `structureco-design-review/`, `structureco-palette-lab/`, `structureCo-contexto-*/`, `structureCo-documentacion-integral-*/`, además de varios `.zip`/`.tar.gz` sueltos. Ignóralos salvo que el usuario pida explícitamente trabajar dentro de uno de ellos.

## Comandos

```bash
npm ci                  # instalar
npm run dev              # servidor de desarrollo (Vite, usualmente :5173)
npm run build             # tsc -b && vite build
npm run typecheck          # tsc -b --noEmit
npm run lint               # oxlint
npm test                    # vitest run (toda la suite)
npm run verify                # lint + verify:protected + test + build + verify:perf — gate mínimo para cualquier cambio
npm run verify:protected       # confirma que la frontera matemática protegida no cambió (ver abajo)
npm run verify:perf             # falla si el bundle inicial supera el presupuesto medido
npm run perf                     # build + medir rendimiento (scripts/measure-performance.mjs)
npm run qa                        # build + recorrido Playwright/Chromium desktop+móvil (qa.mjs)
npm run qa:webkit                  # centro de importación, lectura PDF nativa, targets táctiles ≥44px en WebKit (qa-webkit.mjs)
```

- Un solo test: `npx vitest run src/engine/solver.test.ts` (o `npx vitest src/engine/solver.test.ts` en modo watch). Vitest solo recoge `src/**/*.{test,spec}.{ts,tsx}` — las copias vendored quedan excluidas.
- `qa:phase2` … `qa:phase14` son checkpoints históricos del rediseño 0.8.0; no forman parte del gate actual, no los ejecutes salvo que se pida investigar una regresión de esa época puntual.
- No hay CI de GitHub conectado todavía (`.github/workflows/ci.yml` y `release-qa.yml` están preparados pero no activos) — `npm run verify` localmente es el gate real.

## Uso Obligatorio de Superpowers y Plugins

- **Activación de Superpowers (Claude Code y Codex)**: Ambos agentes DEBEN activar y seguir el flujo de trabajo de Superpowers en cada tarea (`using-superpowers`, `brainstorming`, `writing-plans`, `executing-plans`, `test-driven-development`, `verification-before-completion`, `systematic-debugging`).
- **Plugins Globales**: Aplicar activamente las directivas de los plugins de diseño (`frontend-design`, `ui-theme-designer`), simplificación (`code-simplifier`), seguridad (`security-guidance`) y tipado (`typescript-lsp`).

## Frontera matemática protegida

`src/engine/**`, `src/workers/**`, `src/data/**`, `src/store/ProjectContext.tsx` y `src/types.ts` son la **frontera matemática protegida**: el solver, las unidades internas, signos, geometría, topología, schema, migraciones y persistencia. Cambios de UI/rediseño **no deben tocarlos**. `npm run verify:protected` (parte de `npm run verify`) compara un hash SHA-256 por archivo contra `docs/releases/0.8.1/PROTECTED_BASELINE.sha256` (línea-ending normalizado, tests excluidos) y falla si algo cambió sin que el baseline se haya actualizado deliberadamente con `--update`. Si necesitas modificar algo en esas rutas, es una excepción explícita que requiere autorización del usuario, no un efecto colateral de una tarea visual.

La frontera inversa también está verificada por test: `src/ui/dependencyBoundary.test.ts` (via `docs/architecture/FRONTEND.md`) impide que la librería de componentes importe `engine/workers/store/data/types`.

## Arquitectura

```
src/main.tsx → App.tsx → ProjectProvider (store/ProjectContext.tsx)
  → AppShell (estado local screen: 'welcome' | 'workspace')
     'welcome'  → WelcomeScreen
     'workspace'→ WorkspaceShell (lazy) → AppShellLayout (solo visual) con slots
                   topBar / toolRail / workspace (Canvas+Results) / inspector / footer

src/design-system/  tokens (tokens.css), iconos propios (icons/), librería sc-* (components/), ComponentLab (lab/, solo dev en /__components)
src/features/       welcome/ workspace/ topbar/ canvas/ inspector/ results/ classroom/ import-export/
src/engine/         ★ solver.ts, diagram.ts, envelope.ts, resultSummary.ts, math.ts, units.ts, influence.ts, pDelta.ts, cut.ts
src/workers/        ★ analysis.worker.ts / influence.worker.ts / scenarios.worker.ts — con fallback síncrono en el hilo principal si Worker no existe, el constructor lanza o la respuesta llega mal formada
src/data/           ★ defaultProject.ts, migrate.ts (schema v3), modelOperations.ts, projectStorage.ts
src/store/          ★ ProjectContext.tsx (único dueño del modelo, historial undo/redo tope 50, análisis), ClassroomSessionContext.tsx
src/education/      plantillas y progreso del modo Aula
src/i18n/           catalogs.ts (ES/EN en un solo módulo, tipo TranslationKey derivado) + useI18n()
src/utils/          numberFormat.ts (política numérica única, prohíbe toFixed/toPrecision/toExponential crudos fuera de aquí), fileGuards.ts, svgExport.ts, portable*.ts, export.ts
```

(★ = frontera matemática protegida)

Puntos que no son obvios leyendo un solo archivo:

- **Sin router**: una sola vista con estado local `welcome | workspace` en `AppShell`. `WorkspaceShell` se precalienta desde la bienvenida (`requestIdleCallback`/`setTimeout` fallback, y en hover/focus del CTA).
- **Coordinación entre paneles** vía fachada de comandos tipada `src/features/workspace/workspaceCommands.ts` (`emitWorkspaceCommand`/`onWorkspaceCommand`) sobre `CustomEvent` en `window` — no es estado, son intenciones (`collapse-mobile-results`, `focus-object`, `fit-canvas`, `export-svg`, `export-png`, …).
- **Persistencia en `localStorage`** con recuperación escalonada: primario → si corrupto, copia a `structureCo.project.recovery` (evidencia forense, nunca se destruye) → `structureCo.project.backup` → proyecto en blanco verificado. Conviven dos convenciones de key (`structureCo.` y `structureco:*:v1`) — no unificar sin migración de lectura.
- **i18n es un ajuste del proyecto**, no del navegador: `useI18n()` lee `project.settings.language` desde `ProjectContext`.
- **Motion**: CSS es el default; la librería `motion` (import `m.*`, nunca `motion.*` — evita arrastrar el bundle completo) se reserva para animaciones de salida (`AnimatePresence`) y reflow de listas (`layout`). Tokens de duración/easing en `tokens.css` §7. Detalle completo en `docs/design-system/MOTION.md`.
- **Numérico**: toda presentación de números pasa por `src/utils/numberFormat.ts` (8 contextos: canvas, chart, inspector, table, tooltip, report, annex, clipboard); `numericPolicy.test.ts` rompe el build si `features/**` usa formateo crudo.

Más detalle en `docs/architecture/FRONTEND.md` (árbol de arranque, workers, persistencia, capas de UI) y `docs/design-system/` (paleta, tipografía, spacing, iconografía, motion).

## Flujo de trabajo de dos agentes (importante)

Este repo (`github.com/klkmoraa/structureco`, rama `main`) lo trabajan **dos agentes distintos sobre el mismo working tree: Claude Code y Codex (VS Code)**. Ninguno ve la conversación del otro — git/GitHub es el único puente. Reglas que vienen de `AGENTS.md` y aplican igual aquí:

- Nunca hacer `git push` sin confirmación explícita del usuario en el chat de esa sesión (`.claude/settings.json` tiene `autoPush: false` a propósito).
- Después de cualquier cambio relevante (código, config, diseño, docs), generar un reporte en `reports/YYYY-MM-DD-HHmm-slug.md` y commitearlo junto con el cambio — usa la skill `change-report` (`.claude/skills/change-report/SKILL.md`) para el template y los pasos exactos.
- No ampliar la teoría física del motor ni actualizar dependencias sin autorización explícita del usuario.
- No declarar un cambio o una regresión cerrada sin haber ejecutado el comando de verificación correspondiente (`npm run verify`, `npm run qa`, `npm run qa:webkit`) y visto el resultado.
