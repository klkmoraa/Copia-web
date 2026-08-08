# structureCo 0.8.0 — Rediseño UX/UI completo

Fecha objetivo: 27 de julio de 2026.

Candidato aprobado: `858c601`.

Formato de proyecto: sin cambios.

Producción: `https://structureco-analisis.netlify.app`

Deploy: `6a68469008f16649235e8075`.

## Qué cambia para el usuario

- Sistema visual coherente, componentes reutilizables y navegación global
  canvas-first.
- Herramientas y chrome del canvas organizados para desktop, tablet y móvil.
- Inspector con resumen de selección, propiedades frecuentes/avanzadas, unidades
  visibles, formato numérico consistente, validación inline y edición no
  destructiva.
- Centro de Resultados con resumen, diagramas, deformada, comparación,
  aprendizaje y líneas de influencia bajo demanda.
- Recorrido Aula guiado con predicción previa y revelado progresivo.
- Composiciones touch coherentes: panel lateral en desktop, drawers en tablet y
  bottom sheets en móvil.
- Feedback accesible, paridad estructural español/inglés, Light/Dark, reduced
  motion y operación completa por teclado en los flujos certificados.
- Menor costo temprano combinado y carga diferida de módulos analíticos pesados.

## Qué se preserva

Esta versión no modifica solver, engine, workers, valores físicos por defecto,
unidades internas, signos, topología, geometría, precisión almacenada, schema,
persistencia ni handlers matemáticos. Undo/redo, importación/exportación y
validaciones de dominio conservan sus contratos.

## Actualización

No existe migración de datos para pasar de 0.7.0 a 0.8.0. Antes de actualizar:

1. Exporta los proyectos críticos a JSON o `.structureco`.
2. Conserva el URL del deploy anterior.
3. Ejecuta un round-trip de importación en el preview.
4. Promueve a producción solo después del smoke test.

La aplicación mantiene almacenamiento local, por lo que limpiar los datos del
sitio o cambiar de origen puede eliminar proyectos no exportados.

## Evidencia de aceptación

- `docs/ux-redesign/RELEASE_QA_REPORT.md`
- `docs/ux-redesign/PERFORMANCE_REPORT.md`
- `docs/ux-redesign/A11Y_REPORT.md`
- `docs/ux-redesign/KNOWN_ISSUES.md`
- `docs/ux-redesign/evidence/phase-14/after/`

La suite del candidato aprobó 384/384 pruebas en 66 archivos, lint, build,
Chromium, WebKit y las matrices especializadas de Fases 11 a 14.
