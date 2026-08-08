# Mantenimiento posterior a 0.8.0

## Propiedad

| Área | Responsable operativo |
| --- | --- |
| Prioridad y aceptación de producto | Propietario del producto |
| Shell, Inspector, Resultados y responsive | Plataforma UI |
| Accesibilidad e i18n | Plataforma UI con revisión de contenido |
| QA de release y evidencia | Mantenedor de release |
| Solver y contratos físicos | Dueño del motor; fuera del ciclo UX |

## Cadencia

- Por cambio: `npm run verify` y QA enfocada.
- Antes de release: matriz Chromium/WebKit y Fases 11 a 14.
- Mensual o ante actualización de dependencias: revisión de bundle, navegadores y
  warnings del build.
- Tras incidentes: registrar síntoma, commit/deploy, recorrido reproducible,
  severidad y prueba de regresión.

## Política de regresiones

1. Clasificar la falla por superficie y confirmar si toca la frontera protegida.
2. Corregir en una rama enfocada con prueba que reproduzca el síntoma.
3. Repetir los gates de la fase propietaria y el gate de release.
4. No relajar tolerancias, assertions o validaciones para obtener verde.
5. Si el defecto afecta cálculo, detener la release y transferirlo al dueño del
   motor.

## Deprecaciones

- Mantener alias visuales solo mientras exista un consumidor documentado.
- Registrar la retirada en `MIGRATION_LEDGER.md`.
- No retirar IDs, handlers, shortcuts, formatos portables o claves de catálogo
  sin inventario de consumidores, ventana de transición y prueba de migración.
- Eliminar evidencia o documentación histórica únicamente mediante una decisión
  explícita; las fases aprobadas permanecen auditables.

## Monitoreo

Durante las primeras 24 horas de una promoción, comprobar disponibilidad, errores
de carga, importación, análisis y navegación responsive. Los límites aceptados se
mantienen en `KNOWN_ISSUES.md`; un hallazgo nuevo debe indicar dueño y mitigación.
