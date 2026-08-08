# structureCo Improvement Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver los hallazgos de la auditoría sin mezclar UI, dominio estructural, seguridad de archivos ni publicación.

**Architecture:** El programa usa tareas pequeñas, cada una con una única frontera de archivos y una puerta de aceptación propia. `T01`, `T02`, `T03` y `T04` parten de `0071688` en worktrees distintos; las tareas que consumen sus resultados se rebasan contra el predecesor aceptado.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Playwright, Web Workers, PDF.js, fflate y Sites.

## Global Constraints

- El checkout de aplicación es `structureCo`, base `fix/mobile-results-canvas-visibility` en `0071688`.
- Usar `npm.cmd` en PowerShell.
- UI no toca `src/engine/**`, `src/workers/**`, `src/data/**`, `src/store/ProjectContext.tsx`, `src/types.ts`, geometría del canvas, persistencia, import/export, IDs, unidades, signos, topología ni handlers matemáticos.
- Un cambio de dominio debe conservar resultados, tolerancias, unidades, historial, selección, importación/exportación y compatibilidad de modelos.
- Cada tarea termina con pruebas, build, diff protegido, commit, actualización de `docs/superpowers/handoffs/structureco-2026-07-29/STATUS.md` y un handoff breve.
- No publicar en Netlify o GitHub. La entrega externa final consume el sitio privado de Sites ya creado.

---

## Orden y concurrencia

| Ola | Tareas | Regla |
| --- | --- | --- |
| 1 — paralela | T01 foco móvil, T02 importación segura, T03 procedencia de exportación, T04 investigación de paridad | Un worktree y un escritor por tarea. T04 no implementa un cambio de dominio. |
| 2 — dependiente | T05 contrato de Resultados después de T01; T06 capacidad/rendimiento después del dictamen T04 | No compartir `ResultsPanel`, CSS ni rutas de dominio. |
| 3 — cierre | T07 certificación `0.8.1` después de T01, T02, T03, T05 y el dictamen de T04 | Es la primera tarea autorizada a regenerar evidencia de release. |
| 4 — entrega | T08 publicar en Sites después de T07 | Empaqueta el build certificado; no modifica la app. |
| Fuera de la release | T09 consolidación arquitectónica | No bloquea `0.8.1`; se planifica y ejecuta aislada. |

## Tareas

### Task 1: T01 — Hotfix de foco móvil

**Files:** `ResultsPanel.tsx`, `WorkspaceShell.tsx`, `styles.css`, pruebas de Resultados y QA móvil.

- [ ] Reproducir que el launcher de Inspector recibe foco estando cubierto por Resultados en 390 y 430 px.
- [ ] Hacer que ese launcher sea inerte/no tabbable sólo mientras Resultados está abierto en teléfono.
- [ ] Verificar Tab, Shift+Tab, Escape y retorno de foco; ejecutar pruebas dirigidas, build, `qa-phase11` y Fase 14 móvil.
- [ ] Commit y registrar evidencia en STATUS.

### Task 2: T02 — Seguridad de artefactos portables

**Files:** importadores PDF/JSON/`.structureco`, sus adaptadores y pruebas de importación.

- [ ] Escribir pruebas para archivo excesivo, ZIP con demasiadas entradas y expansión superior al presupuesto.
- [ ] Rechazar antes de leer el archivo completo y antes de descomprimir contenido no permitido.
- [ ] Verificar imports normales, round-trip y build; commit y actualizar STATUS.

### Task 3: T03 — Procedencia de exportaciones

**Files:** `TopBar.tsx`, `portablePayload.ts` y pruebas de exportación.

- [ ] Caracterizar que el payload exportado declara la misma versión que la aplicación.
- [ ] Centralizar la versión de build sin modificar formato, checksum ni compatibilidad de importación.
- [ ] Ejecutar pruebas de PDF/portable, build y registrar la versión comprobada.

### Task 4: T04 — Investigación de paridad análisis/PDF

**Files:** pruebas nuevas y, si se requiere, una nota de decisión. No modificar producción en esta tarea.

- [ ] Construir una fixture con topología que el flujo interactivo repararía.
- [ ] Comparar análisis interactivo, exportación directa y bundle portátil.
- [ ] Registrar si existe diferencia y recomendar una de tres semánticas: persistir reparación, usar snapshot reparado sólo para salida o rechazar explícitamente.
- [ ] Marcar `COMPLETE` o `NOT_NEEDED`; sólo entonces se puede autorizar una implementación de dominio separada.

### Task 5: T05 — Contrato de Resultados móvil

**Files:** Resultados, shell, CSS, documentación UX y QA móvil.

- [ ] Partir de T01 aceptada.
- [ ] Aplicar el contrato aprobado: panel rápido con canvas visible y detalle dedicado para tablas/gráficas/Avisos, o documentar el split-view si se mantiene.
- [ ] Resolver descubribilidad de pestañas y actualizar especificación, ledger y QA.
- [ ] Cerrar con matriz teléfono/tablet/escritorio, Light/Dark, teclado y touch.

### Task 6: T06 — Presupuesto de capacidad y rendimiento

**Files:** fixtures/perfiles/ documentación; código de dominio sólo tras una autorización nueva.

- [ ] Medir tamaños de modelo, preparación topológica, drag/snapping, memoria y tiempo de análisis con fixtures reproducibles.
- [ ] Publicar el presupuesto operativo y los umbrales de advertencia propuestos.
- [ ] Separar cualquier solución de worker/solver disperso como una futura especificación matemática.

### Task 7: T07 — Certificación de release 0.8.1

**Files:** evidencia QA, release notes, baseline, known issues y status; no nuevas funcionalidades.

- [ ] Confirmar que T01, T02, T03 y T05 están completas y que T04 tiene dictamen.
- [ ] Ejecutar lint, suite, build, matrices Chromium/WebKit, fases 11–14 y diff protegido.
- [ ] Actualizar documentación con conteos reales, commit exacto, riesgos residuales y rollback.
- [ ] No desplegar en esta tarea.

### Task 8: T08 — Entrega con Sites

**Files:** el proyecto hermano `structureco-sites`; no modificar estructuraCo salvo consumir su build certificado.

- [ ] Partir del commit certificado por T07.
- [ ] Sincronizar el build en el wrapper de Sites, validar, guardar una versión privada y desplegarla.
- [ ] Verificar el URL resultante y actualizar STATUS con URL y versión. No usar Netlify o GitHub.

### Task 9: T09 — Consolidación arquitectónica posterior

**Files:** se definen en una especificación posterior; puede tocar dominio y no pertenece a 0.8.1.

- [ ] Diseñar una fachada de comandos para crear, borrar, dividir, pegar y preparar topología.
- [ ] Definir contratos, snapshots de compatibilidad e invariantes de historial/selección/resultados antes de código.
- [ ] Evaluar separación de `ResultsPanel`, CSS móvil y contratos de workers.

## Self-review

- Cobertura: los hallazgos de foco, importación, exportación, paridad, UX móvil, rendimiento, QA, release, hosting y deuda arquitectónica tienen una tarea propietaria.
- Dependencias: ninguna tarea que publica consume evidencia parcial; ninguna tarea UI modifica rutas protegidas.
- Sin placeholders: cada handoff concreto está en `docs/superpowers/handoffs/structureco-2026-07-29/`.

## Execution Handoff

Abrir el documento de la tarea elegida y ejecutar sólo esa tarea. El estado canónico y el siguiente desbloqueo viven en `docs/superpowers/handoffs/structureco-2026-07-29/STATUS.md`.
