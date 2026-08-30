# Cubre findings de revision del PR 4

**Fecha:** 2026-08-11 14:32
**Agente:** Codex
**Rama:** `codex/workspace-ux-overlap-repeat`

## Que cambio

- La regresion Chromium de TopBar conserva el sweep continuo de 1024 a 1600 px y ahora mide de forma determinista cada vecino de los cambios de layout: 1023/1024/1025, 1279/1280/1281, 1439/1440/1441, 1499/1500/1501 y 1535/1536/1537.
- El workflow completo de browser QA ejecuta `npm run qa:topbar` inmediatamente despues de instalar los navegadores de Playwright, antes de los QA Chromium y WebKit ya existentes. El gate rapido no cambia.
- El boton Cancelar colocacion de Repeat conserva el material Clay local, pero usa la superficie elevada oficial, borde Clay y profundidades Clay para distinguirse del preview en ambos temas. Sus estados hover, foco y pressed reutilizan los tokens existentes y no usan glow verde.

## Por que

El avance de 16 px podia no visitar los breakpoints 1500 y 1536 ni sus vecinos. El script existia, pero no formaba parte del gate de navegador que ya instala Playwright. Tras quitar el halo de Repeat, el boton y el contenedor compartian superficie; en oscuro `surface-1` coincide con el preview, mientras que `surface-elevated` expresa la separacion Clay necesaria.

## Archivos tocados

- `.github/workflows/release-qa.yml`
- `scripts/qa-topbar.mjs`
- `src/design-system/tokens.test.ts`
- `src/features/workspace/phase1.css`
- Este reporte.

## Como verificar

1. `npm.cmd test -- src/features/topbar/TopBar.test.tsx src/features/canvas src/design-system/tokens.test.ts --maxWorkers=1`
2. `npm.cmd run qa:topbar`
3. `npm.cmd run lint`
4. `npm.cmd run verify:protected`
5. `npm.cmd run validate:ci`
6. En Chromium, cargar Portico de ejemplo, seleccionar M1, pulsar `R`, comprobar ambos temas y llegar a Cancelar colocacion con Tab.

## Resultado y pendientes

- PASS: 18 archivos / 114 tests dirigidos, `qa:topbar`, lint, build, frontera protegida y validacion de CI.
- PASS: QA visual Chromium de Repeat claro/oscuro, enfoque por teclado y limites de TopBar solicitados.
- BLOQUEADO AJENO: `npm.cmd run qa` se detiene en `qa.mjs` porque `.welcome-import-card` resuelve los dos botones de importacion existentes. No se modifica fuera de alcance.
- NOT_RUN: `qa:webkit`.
