# AG-009 — Presets de materiales y perfiles estructurales estándar

**Fecha:** 2026-08-05 19:00
**Agente:** Claude Code
**Rama:** main

## Qué cambió

Se implementó la propuesta AG-009: dos catálogos de datos (`standardMaterials.ts`, `standardSections.ts`) con 12 materiales y 53 perfiles comerciales verificados (AISC Shapes Database v15.0, ArcelorMittal Orange Book/EN 10365, ACI CODE-318-19, ANSI/AWC NDS/EN 338/EN 14080), y dos selectores de presets (`MaterialPresetSelector`, `SectionPresetSelector`) integrados en el Inspector del modo Completo. Al elegir un material se sobrescriben E, G y densidad del miembro activo; al elegir un perfil se sobrescriben A e I. Los valores quedan editables manualmente después, igual que antes.

## Por qué

Evitar que el usuario tenga que calcular a mano E/A/I/G en unidades internas (kN/m², m², m⁴) para perfiles comerciales conocidos (W, IPE, HEB, HSS, C, UPN, L), reduciendo errores de conversión de unidades. Solicitado por el usuario vía `Antigravity-propuestas/aprobadas/AG-009-presets-perfiles-y-materiales-aisc.md`, con dataset técnico pre-verificado en `Antigravity-propuestas/recursos/AG-009-dataset.json`.

## Archivos tocados

- `src/data/standardMaterials.ts` (nuevo) — catálogo de 12 materiales (acero, concreto, madera, aluminio), ya en unidades base internas del motor.
- `src/data/standardSections.ts` (nuevo) — catálogo de 53 perfiles comerciales (W, IPE, HEB, HSS rect/redondo, C, UPN, L, rectangulares genéricos), ya en unidades base internas.
- `src/features/inspector/MaterialPresetSelector.tsx` (nuevo) — selector de material agrupado por categoría, con hint de E convertido a la unidad activa del proyecto.
- `src/features/inspector/SectionPresetSelector.tsx` (nuevo) — selector de perfil agrupado por tipo de forma, con hint de A convertido a la unidad activa.
- `src/features/inspector/InspectorProperties.tsx` — agrega `applyMaterialPreset`/`applySectionPreset` (cada uno un solo paso de historial/undo) y monta ambos selectores antes de los campos E/A/I, solo cuando el miembro no es rígido y el proyecto no está en modo Aula.
- `src/i18n/catalogs.ts` — 17 claves nuevas (ES/EN) para los selectores, sus placeholders/hints y las etiquetas de categoría de material y tipo de forma.
- `docs/releases/0.8.1/PROTECTED_BASELINE.sha256` — baseline actualizado (`--update`) para incluir los dos archivos nuevos bajo `src/data/`. Es la única razón de tocar este archivo: los dos catálogos son datos puros (sin lógica), la propuesta pidió explícitamente crearlos ahí, y el usuario autorizó la excepción en el prompt de ejecución.
- `Antigravity-propuestas/implementadas/AG-009-presets-perfiles-y-materiales-aisc.md` — movida desde `aprobadas/`, estado cambiado a "Implementada".

## Cómo verificar

```bash
npm run lint
npx tsc -b --noEmit
npx vitest run --maxWorkers=1
npm run build
node scripts/check-protected-baseline.mjs
npm run verify:perf
```

Todo pasó: lint limpio, typecheck limpio, 670/670 tests, build OK, frontera protegida verificada (29 archivos, baseline actualizado deliberadamente), presupuesto de rendimiento respetado (633 239 B / 170 236 B gzip, techo 648 000 / 174 000). El comando combinado `npm run verify` no se corrió tal cual porque `vitest run` sin límite de workers agota memoria en esta máquina (crashes de fork aleatorios, no relacionados con el cambio); se corrió cada paso por separado, incluyendo la suite completa en modo single-worker para evitar el problema del entorno.

Verificación manual en UI: pendiente — no se abrió el preview del navegador porque el cambio es de datos/lógica en un panel ya cubierto por pruebas de React Testing Library (`InspectorProperties`/`Inspector` tests), no un rediseño visual. Se recomienda una pasada visual rápida en `npm run dev` → seleccionar una barra → Inspector → "Material estándar" / "Perfil comercial" antes de dar por cerrado el flujo end-to-end.

## Pendiente / siguiente paso

Nada bloqueante. Posible mejora futura (no incluida, fuera del alcance "baja complejidad" de AG-009): permitir aplicar automáticamente el `defaultMaterialId` sugerido por un perfil al seleccionarlo, o persistir el preset elegido en el modelo para mostrarlo pre-seleccionado al reabrir el proyecto (requeriría tocar `src/types.ts`, frontera protegida, y no se hizo sin pedirlo explícitamente).
