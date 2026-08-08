# Slice 2.5 - Estado global del análisis

Fecha: 2026-07-17  
Estado: gate aprobado.

## Resultado

La TopBar presenta un estado global, textual e iconográfico, derivado exclusivamente de `analysis`, `isAnalyzing`, `project.id` y el ciclo visual del resultado actual:

| Estado visual | Condición existente | Acción |
| --- | --- | --- |
| Listo | No hay análisis y el proyecto aún no produjo uno | Informativo |
| Calculando | `isAnalyzing` es verdadero | Informativo con movimiento reducible |
| Actualizado | Análisis exitoso sin warnings ni errores | Informativo |
| Desactualizado | El mismo proyecto tuvo resultado y este fue invalidado | Informativo |
| Advertencia | Resultado exitoso con al menos un warning | Abre Avisos |
| Error | Resultado fallido o con al menos un error | Abre Avisos |

La memoria de “tuvo resultado” vive en un `useRef` transitorio del componente y se reinicia al cambiar `project.id`. No se persiste, no recalcula y no constituye una segunda fuente de verdad matemática.

## Accesibilidad e interacción

- `role="status"`, `aria-live="polite"` y texto legible por lector de pantalla.
- Icono + texto/tooltip: ningún estado depende únicamente del color.
- Warning/error son botones con nombre accesible y conducen al tab Avisos.
- En móvil, la acción expande el panel de resultados si estaba colapsado.
- Spinner desactivado bajo `prefers-reduced-motion: reduce`.
- Control de 44 x 44 px en tablet/móvil; label completo visible en wide y tooltip en anchos compactos.

## Evidencia Browser

- Estados reales observados: listo, actualizado, desactualizado y error.
- Error móvil: el botón global abrió `Avisos 3` y expandió el panel tras colapsarlo manualmente.
- Matriz 390, 430, 834, 1024, 1194, 1280, 1366, 1440 y 1536 px: cero intersecciones, cero controles fuera del header y cero overflow horizontal.
- A 390/430/834 px, el estado mide 44 x 44 px.
- Analizar y Más acciones permanecen visibles en 9/9 viewports.

## Pruebas

- Prueba pura de precedencia para los seis estados.
- Prueba de transición actualizado -> desactualizado -> listo al cambiar de proyecto.
- Prueba de acción accesible para warning y error.
- `npm.cmd run verify`: 41 archivos, 233 pruebas y build aprobados.

## Frontera matemática

No se modificaron solver, workers, fórmulas, signos, unidades, precisión, schema, persistencia, importación, exportación, fixtures ni payloads de análisis.
