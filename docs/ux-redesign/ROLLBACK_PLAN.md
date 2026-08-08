# Plan de rollback — structureCo 0.8.0

## Objetivo

Restaurar el último deploy de producción conocido sin cambiar datos de proyecto
ni intentar una migración inversa. El rollback es de artefactos web, no del
contenido guardado en el navegador.

## Identidad

- Sitio: `structureco-analisis`.
- Site ID: `48d1ebdb-27e7-42fc-a682-02a3ef992ffe`.
- URL estable: `https://structureco-analisis.netlify.app`.
- Release objetivo: tag `v0.8.0`.
- Candidato funcional: `858c601`.
- Deploy de release: `6a68469008f16649235e8075`, estado `ready`.
- Preview verificado: `6a684573c2f1c94256c4a140`,
  `https://phase15-080--structureco-analisis.netlify.app`.
- Deploy de producción previo: `6a59ba4ad8be3703730d69d8`.
- Permalink de backup:
  `https://6a59ba4ad8be3703730d69d8--structureco-analisis.netlify.app`.

## Procedimiento

1. Suspender nuevas promociones y conservar el deploy fallido para diagnóstico.
2. En Netlify, seleccionar el deploy `6a59ba4ad8be3703730d69d8` y ejecutar
   **Publish deploy**; alternativamente desplegar el artefacto construido desde
   el commit anterior.
3. Verificar HTTP 200, carga del shell y apertura del Pórtico de ejemplo.
4. Ejecutar selección, análisis, Resultados y round-trip JSON.
5. Confirmar que el origen no cambió; los proyectos locales deben seguir
   disponibles.
6. Registrar incidente, alcance, responsable y decisión de volver a promover.

## Verificación del rollback

El rollback se considera válido cuando el deploy restaurado está en estado
`ready`, el URL estable responde, el recorrido crítico termina sin errores de
consola y la frontera matemática coincide con su commit de origen.

## Responsables

- Ejecución y evidencia: mantenedor de release.
- Decisión de rollback/promoción: propietario del producto.
- Defecto UI: dueño de la fase o superficie.
- Cualquier discrepancia física: bloqueo inmediato; no se corrige desde una fase
  de release visual.
