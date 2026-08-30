# Corrige solapamiento de TopBar y material de Repeat

**Fecha:** 2026-08-11 12:04
**Agente:** Codex
**Rama:** codex/workspace-ux-overlap-repeat

## Qué cambió

La TopBar distribuye el ancho disponible entre documento y contexto antes de reservar las acciones intrínsecas, sin recortar visualmente el contexto. Se añadió una regresión Chromium que mide rectángulos de zonas y controles durante un resize continuo.

Los controles `Repetir · R` y `Repetición preparada` ahora reutilizan el material oficial de chrome flotante del canvas; conservan el acento semántico verde en el texto, pero eliminan el glow de contacto verde.

## Por qué

En anchos intermedios, la pista `auto` del contexto y la pista `max-content` de acciones podían consumir más ancho del disponible y pintar zonas unas sobre otras. Repeat usaba `--sc-shadow-contact`, destinado a contacto/estado activo, en vez de la elevación Clay flotante del canvas.

## Archivos tocados

- `src/styles.css` — distribución elástica de las zonas de la TopBar, sin clipping.
- `src/features/topbar/TopBar.test.tsx` — conserva sólo la comprobación estructural JSDOM; la geometría real se comprueba en navegador.
- `scripts/qa-topbar.mjs` — regresión Chromium de intersección de rectángulos y overflow durante resize continuo.
- `package.json` — comando `qa:topbar` para ejecutar la regresión real.
- `src/design-system/material.css` — incorpora Repeat al contrato existente de chrome flotante.
- `src/features/workspace/phase1.css` — elimina fondo, borde y sombra locales que reemplazaban el material Clay.
- `src/design-system/tokens.test.ts` — contrato que impide reintroducir `--sc-shadow-contact` en Repeat.

## Cómo verificar

1. `npm.cmd test -- src/features/topbar/TopBar.test.tsx src/features/canvas src/design-system/tokens.test.ts --maxWorkers=1`
2. `npm.cmd run qa:topbar`
3. En Workspace, seleccionar un miembro, pulsar `R`, revisar Repeat en tema claro y oscuro, tabular a Cancelar y cancelarlo.

## Pendiente / siguiente paso

El gate general `npm.cmd run qa` queda pendiente de una corrección ajena en `qa.mjs`: su selector `.welcome-import-card` exige un único elemento y el main vigente presenta dos opciones de importación. No se modificó para mantener el alcance de este bugfix.
