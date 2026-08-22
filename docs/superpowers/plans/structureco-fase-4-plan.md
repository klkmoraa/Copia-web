# structureCo Fase 4 Implementation Plan

> **HISTORICAL** — Plan de ejecución conservado. El visor planar que describe fue sustituido por [Space 3D · S3D-1](../../architecture/structureco-space-3d-s3d1.md).

**Clasificación:** `HISTORICAL`

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** entregar un visor Three.js experimental y no autoritativo del proyecto 2D, junto con pre-RFCs 3D/IA y gates trazables.

**Architecture:** `App` carga una tercera pantalla bajo demanda. Un adaptador puro proyecta el `ProjectModel` actual a una escena inmutable con `z = 0`; un wrapper React local administra Three.js sin tocar contratos persistidos o matemáticos.

**Tech Stack:** React 19, TypeScript 6, Three.js 0.185, Vitest, Testing Library, Playwright/Vite y Markdown.

## Global Constraints

- No modificar `src/engine/**`, `src/workers/**`, `src/data/**`, `src/store/ProjectContext.tsx`, `src/types.ts` ni `StructuralCanvas`.
- No cambiar solver, resultados, unidades, signos, IDs, topología, persistencia, formatos, undo/redo o dependencias de cálculo.
- IA sólo documental: sin SDK, API, secreto, telemetría, backend o mutación.
- Usar staging explícito, un commit local y ningún `push`.

---

### Task 1: preflight y documentación de diseño

- [x] Registrar HEAD, rama, estado, versión y hashes.
- [x] Crear respaldo externo de archivos candidatos.
- [x] Verificar los 29 archivos de la frontera protegida.
- [x] Guardar el diseño y este plan.

### Task 2: adaptador puro del modelo visual

- [ ] Escribir pruebas que exijan `(x, y, 0)`, referencias correctas, diagnósticos y ausencia de mutación.
- [ ] Ejecutar las pruebas y comprobar que fallan por módulo ausente.
- [ ] Implementar `buildExperimental3DScene` y tipos internos de sólo lectura.
- [ ] Ejecutar las pruebas focalizadas hasta obtener verde.

### Task 3: navegación experimental

- [ ] Escribir pruebas de acceso desde Inicio/editor y retornos desde el visor.
- [ ] Ejecutarlas y comprobar el fallo esperado.
- [ ] Añadir `experimental3d` a la navegación interna y propagar callbacks explícitos.
- [ ] Ejecutar pruebas focalizadas de App, WelcomeScreen y TopBar.

### Task 4: viewport Three.js

- [ ] Escribir pruebas del controlador de cámara y estados vacío/fallback/diagnóstico.
- [ ] Comprobar los fallos esperados.
- [ ] Añadir Three.js y sus tipos con lockfile reproducible.
- [ ] Implementar escena, render bajo demanda, resize, presets, contexto perdido, reintento y dispose.
- [ ] Ejecutar pruebas focalizadas y typecheck.

### Task 5: presentación, accesibilidad e i18n

- [ ] Añadir catálogo ES/EN para todos los textos nuevos.
- [ ] Componer la pantalla con tokens existentes, foco visible, controles táctiles y responsive.
- [ ] Probar nombres accesibles, teclado, fallback y paridad de idioma.
- [ ] Revisar navegador real en 1440×900 y 390×844, claro/oscuro, lleno/vacío.

### Task 6: pre-RFCs y matriz de gates

- [ ] Documentar el futuro contrato 3D sin implementarlo.
- [ ] Documentar `CommandProposal`, allowlist, confirmación, broker y kill switch sin implementar IA.
- [ ] Clasificar evidencias y gates actuales con responsables por rol.
- [ ] Comprobar enlaces y ausencia de promesas de certificación.

### Task 7: verificación y entrega

- [ ] Ejecutar pruebas focalizadas, `verify:protected`, `verify`, diff check y auditoría de bundle.
- [ ] Guardar evidencia visual y documentar exactamente lo observado.
- [ ] Crear el reporte de cambio con resultados y limitaciones.
- [ ] Revisar el diff contra el alcance protegido.
- [ ] Stagear sólo rutas Fase 4 y crear `feat: add experimental 3D viewer and phase 4 pre-RFCs`.
- [ ] Verificar SHA y contenido del commit; no hacer push.
