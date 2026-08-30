# structureCo Fase 3 — plan de implementación

> **HISTORICAL** — Plan de ejecución conservado. El estado vigente está en el [README principal](../../../README.md) y en los gates actuales.

**Clasificación:** `HISTORICAL`

> **Para la ejecución:** usar `superpowers:executing-plans`, `test-driven-development`, `systematic-debugging` y `verification-before-completion`. Esta sesión trabaja en la raíz autorizada y conserva los cambios locales existentes.

**Objetivo:** certificar y corregir el motor real, comunicar su calidad numérica y conservar P-Delta/sparse como capacidades experimentales acotadas.

**Arquitectura:** el análisis de primer orden conserva el backend automático actual con LU denso como referencia y fallback. P-Delta permanece opt-in pero fuerza el backend denso durante toda la corrida; reliability se deriva una vez del `AnalysisResult` y se reutiliza en worker, fallback, panel y exportaciones.

**Tecnología:** TypeScript 6, React 19, Vitest 4, Vite 8, jsPDF/pdf-lib y scripts Node/PowerShell existentes.

## Restricciones globales

- No cambiar unidades, signos, GDL, ejes, IDs, topología, restricciones, persistencia, undo/redo, portable ni valores estructurales sin prueba explícita.
- No actualizar dependencias, investigar externamente, implementar teoría nueva, P-δ, eigen-buckling, material no lineal, grandes desplazamientos, 3D ni assembly sparse completo.
- Conservar el solver denso como baseline y fallback; P-Delta y sparse no se promocionan a capacidades certificadas.
- No sobrescribir ni incorporar al commit los cambios locales ajenos; no hacer push.
- Cada cambio de comportamiento sigue RED → GREEN → regresión focalizada.

## Tareas

### 1. Baseline y F3-ENG

- [ ] Registrar SHA, versión, estado Git, hashes protegidos y respaldo focalizado.
- [ ] Ejecutar solver, math, units, validation, advancedAnalysis, connections, loadAudit, diagram, influence e invariantes.
- [ ] Comparar casos manuales y oráculos ya codificados; añadir regresiones sólo para una brecha demostrada.

### 2. F3-REL — contrato y superficies

- [ ] Escribir pruebas fallidas para los cinco estados comunicables y el bloque de diagnostics.
- [ ] Implementar metadata/copy aditivo sin semántica de seguridad estructural.
- [ ] Mostrar el estado en Resultados y conservarlo en PDF/portable, incluida una exportación P-Delta sin recálculo lineal silencioso.
- [ ] Verificar worker/fallback, ES/EN, valores no finitos, mecanismos y exportabilidad con advertencia.

### 3. F3-PDELTA — aislamiento denso

- [ ] Escribir una prueba fallida que demuestre que P-Delta no usa sparse.
- [ ] Propagar una política interna `auto|dense` por las resoluciones lineales, condensación y recuperación.
- [ ] Forzar denso en P-Delta y añadir la marca experimental estructurada.
- [ ] Ejecutar benchmarks cerrados, convergencia/no convergencia, signos, asentamientos, combinaciones, conexiones, unidades y worker/fallback.

### 4. F3-SPARSE — cierre experimental

- [ ] Escribir pruebas fallidas de backend elegido y causa de fallback.
- [ ] Añadir trazabilidad interna sin persistencia ni control de UI.
- [ ] Comparar denso/híbrido en solución, residual, condición, reacciones, N/V/M, auditoría, mecanismos y determinismo.
- [ ] Medir fixtures de 100/500/1000 miembros cuando el entorno lo soporte y registrar 5k+ como bloqueo por assembly denso.

### 5. Certificación y entrega

- [ ] Ejecutar pruebas focalizadas y casos manuales.
- [ ] Ejecutar `lint`, `typecheck`, `verify:protected`, `build`, `verify:perf`, `git diff --check` y una sola corrida final de `verify`.
- [ ] Actualizar la baseline protegida sólo después de validar las rutas autorizadas y repetir `verify:protected`.
- [ ] Generar un único reporte F3, revisar el diff, stagear rutas explícitas y crear el commit local `feat: implement structureCo phase 3 evolution`.

## Tolerancias, oráculos y rollback

- Se conservan las tolerancias existentes por familia; cualquier cambio exige caso manual y comparación reproducible.
- Oráculos permitidos: soluciones cerradas actuales, fixtures FTool, equilibrio global, load audit independiente, cierres N/V/M, invariantes y baseline denso.
- Rollback: restaurar `C:\Users\crisd\OneDrive\Imágenes\Escritorio\structureCo-backup-F3-2026-08-09-122401` o revertir únicamente el commit F3.
- Tras tres intentos fallidos sobre la misma causa, detener ese frente y documentar el bloqueo arquitectónico.
