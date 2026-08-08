# Claymorphism ciclo 2 — cierre rápido de superficies y vidrio

**Fecha:** 2026-08-07 16:52
**Agente:** Codex
**Rama:** `main`
**Estado:** `IMPLEMENTED_UNCERTIFIED`

## Qué cambió

Se completó en una sola pasada el vestido restante de la interfaz: popovers, toast, diálogo de importación, paleta móvil, cabecera y elementos auxiliares de Welcome consumen ahora el material `floating` eager. Los toolbars técnicos residuales pasan a `flat` y el botón flotante del inspector móvil usa el material opaco del chrome del lienzo.

Se retiraron todas las declaraciones de `backdrop-filter` de superficies; solo permanecen los scrims funcionales de importación, inspector móvil y hoja de resultados. También se eliminaron los cinco tokens de vidrio ya sin consumidores y se actualizó el contrato declarativo de tokens para que deje de exigirlos.

## Por qué

El ciclo 2 sustituye el lenguaje de vidrio por claymorphism opaco y centralizado. El usuario pidió acelerar el cierre porque la interfaz volverá a cambiar en el futuro, por lo que se omitieron expresamente las suites, mutaciones, matrices visuales y revisiones restantes; únicamente se generó el build necesario para preparar la actualización de Sites.

## Archivos tocados

- `src/design-system/material.css` — amplía `flat`, `floating` y chrome con los consumidores restantes; preserva los bordes semánticos de toast.
- `src/styles.css` — retira materia local duplicada, transparencias, blur y fallbacks de vidrio.
- `src/design-system/tokens.css` — elimina `--sc-surface-glass`, `--sc-surface-glass-strong`, `--sc-surface-glass-border`, `--sc-blur-glass` y `--sc-blur-chrome`.
- `src/design-system/tokens.test.ts` — actualiza las listas declarativas para la decisión de materia vigente.
- `reports/2026-08-07-1652-claymorphism-ciclo2-cierre-rapido.md` — este reporte.

## Cómo verificar

- `npm.cmd run build` — PASS; build de producción generado correctamente.
- No se ejecutaron Vitest, QA Chromium/WebKit, mutaciones ni revisión independiente por instrucción expresa del usuario.
- La búsqueda estática dejó `backdrop-filter` únicamente en `.import-center-backdrop`, `.mobile-inspector-backdrop`, `.results-sheet-backdrop` y el fallback de transparencia que también enumera `.new-exercise-backdrop`.

## Pendiente / siguiente paso

- Publicar este build en el Site existente y entregar el enlace de producción.
- El ciclo queda implementado pero no certificado. Si se necesita una liberación formal más adelante, deberá ejecutarse la certificación integral omitida.
- `capturas.mjs` continúa sin rastrear y no fue modificado. No se hizo push a GitHub.
